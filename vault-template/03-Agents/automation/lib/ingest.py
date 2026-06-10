#!/usr/bin/env python3
"""Ingest 管线：凌乱文本 → 结构化三件套 → 单向推入 01-Inbox/。

数据安全铁律：任何失败路径都把原文落盘为 raw-*.md 打 #needs-review，绝不丢数据。
LLM 不可用（无 API Key / 网络故障）时自动降级为 offline 规则引擎。
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]   # → PERSONAL OS/
INBOX = ROOT / "01-Inbox"
SCHEMA_DIR = ROOT / ".system" / "schemas"

CATEGORIES = ["餐饮", "交通", "居住", "订阅", "设备", "学习", "医疗",
              "人情", "娱乐", "其他", "收入"]

SYSTEM_PROMPT = """你是 OBSIDIAN AI OS 的入流引擎。对用户的凌乱文本做实体提取，\
只返回 JSON（无 markdown 围栏），契约如下，五键必须齐全：
{"journal": {"core_progress": "", "thoughts": "", "mood": "", "tags": []},
 "tasks": [{"text": "", "priority": "high|mid|low", "due": "YYYY-MM-DD或空", "tags": []}],
 "costs": [{"item": "", "amount": -0.0, "currency": "CNY", "category": "", "channel": ""}],
 "learning": [{"topic": "", "content": "", "tags": []}],
 "profile": [{"aspect": "goals|identity|behavioral|life|resources|constraints", "change": ""}]}
规则：保留用户原文语义禁止改写事实；相对日期换算为绝对日期（今天是 {today}）；\
无金额不生成 cost；消费分类闭集：%s；\
learning=学到的知识/读书笔记/课程心得（成块知识，区别于日记流水）；\
profile=对个人画像的更新意图（设定目标/调整原则/资源变化），只记变更意图不直接改写。""" % "/".join(CATEGORIES)


def now():
    return datetime.now()


def stamp(dt=None):
    dt = dt or now()
    return dt.strftime("%Y-%m-%d-%H%M%S")


def unique(path: Path) -> Path:
    """落盘前碰撞检测：同名文件存在则加序号，绝不覆盖已有数据。"""
    if not path.exists():
        return path
    for i in range(1, 1000):
        cand = path.with_stem(f"{path.stem}-{i}")
        if not cand.exists():
            return cand
    raise RuntimeError(f"无法为 {path} 生成唯一文件名")


# ---------------------------------------------------------------- LLM 调用
def call_llm(raw_text: str):
    """调用 os.config.yml 指定的高性价比模型。失败返回 None（触发 offline 降级）。"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return None
    body = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system",
             "content": SYSTEM_PROMPT.replace("{today}", now().strftime("%Y-%m-%d"))},
            {"role": "user", "content": raw_text},
        ],
        "temperature": 0.1,
    }).encode()
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions", data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = json.load(resp)["choices"][0]["message"]["content"]
        content = re.sub(r"^```(json)?|```$", "", content.strip(), flags=re.M).strip()
        data = json.loads(content)
        assert {"journal", "tasks", "costs"} <= set(data)
        return data
    except Exception as e:
        print(f"[ingest] LLM 调用失败，降级 offline: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- offline 规则引擎
TASK_HINT = re.compile(r"(记得|要做|待办|别忘了|明天.*?[做去买改写发]|todo)", re.I)
COST_HINT = re.compile(r"(?:花了?|支出|买.*?花|付了?|消费)\s*([0-9]+(?:\.[0-9]+)?)\s*[元块]?")
LEARN_HINT = re.compile(r"(学习了|学到|学会|读了|看完|上了.*?课|心得|笔记[:：])")
PROFILE_HINT = re.compile(r"(设定目标|新目标|定个目标|目标[:：]|更新画像|调整原则|我决定以后|profile)", re.I)


def offline_extract(raw_text: str):
    """无 LLM 时的保底规则引擎：宁可少提取，不可错提取。

    语音转文字常是单行多句，按句切分后逐句判定实体。
    """
    tasks, costs, learning, profile, thoughts = [], [], [], [], []
    sentences = re.split(r"[。！？；\n]+", raw_text)
    for line in filter(None, (s.strip() for s in sentences)):
        m = COST_HINT.search(line)
        if m:
            costs.append({"item": line[:20], "amount": -float(m.group(1)),
                          "currency": "CNY", "category": "其他", "channel": ""})
            continue
        if PROFILE_HINT.search(line):
            profile.append({"aspect": "goals" if "目标" in line else "identity",
                            "change": line})
            continue
        if TASK_HINT.search(line):
            due = ""
            if "明天" in line:
                due = (now() + timedelta(days=1)).strftime("%Y-%m-%d")
            tasks.append({"text": line[:30], "priority": "mid", "due": due, "tags": []})
            continue
        if LEARN_HINT.search(line):
            learning.append({"topic": line[:20], "content": line, "tags": []})
            continue
        thoughts.append(line)
    return {"journal": {"core_progress": "", "thoughts": "\n".join(thoughts),
                        "mood": "", "tags": ["needs-review"]},
            "tasks": tasks, "costs": costs,
            "learning": learning, "profile": profile}


# ---------------------------------------------------------------- 落盘
def write_journal(j, source, ts):
    if not (j.get("core_progress") or j.get("thoughts")):
        return None
    path = unique(INBOX / f"journal-{stamp(ts)}.md")
    tags = json.dumps(j.get("tags", []), ensure_ascii=False)
    path.write_text(f"""---
type: journal
date: {ts:%Y-%m-%d}
time: "{ts:%H:%M}"
source: {source}
mood: "{j.get('mood', '')}"
tags: {tags}
---

## 核心进展
{j.get('core_progress', '') or '（无）'}

## 随想
{j.get('thoughts', '') or '（无）'}
""", encoding="utf-8")
    return path


PRIO = {"high": " ⏫", "mid": "", "low": " 🔽"}


def write_tasks(tasks, ts):
    if not tasks:
        return None
    path = unique(INBOX / f"task-{stamp(ts)}.md")
    lines = ["---", "type: task", f"date: {ts:%Y-%m-%d}", "---", ""]
    for i, t in enumerate(tasks):
        due = f" 📅 {t['due']}" if t.get("due") else ""
        tags = "".join(f" #{x}" for x in t.get("tags", []))
        lines.append(f"- [ ] {t['text']}{PRIO.get(t.get('priority', 'mid'), '')}"
                     f"{due}{tags} ^task-{ts:%Y%m%d-%H%M}-{i}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def write_costs(costs, ts):
    costs = [c for c in costs if c.get("amount")]
    if not costs:
        return None
    path = unique(INBOX / f"cost-{stamp(ts)}.md")
    lines = ["---", "type: cost", f"date: {ts:%Y-%m-%d}", "---", "",
             "| 日期 | 项目 | 金额 | 币种 | 分类 | 渠道 | 备注 |",
             "| --- | --- | --- | --- | --- | --- | --- |"]
    for c in costs:
        cat = c.get("category") if c.get("category") in CATEGORIES else "其他"
        lines.append(f"| {ts:%Y-%m-%d} | {c.get('item', '')} | {c['amount']:.2f} "
                     f"| {c.get('currency', 'CNY')} | {cat} | {c.get('channel', '')} | |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def write_learning(items, ts):
    if not items:
        return None
    path = unique(INBOX / f"learning-{stamp(ts)}.md")
    parts = ["---", "type: learning", f"date: {ts:%Y-%m-%d}", "status: inbox", "---"]
    for it in items:
        tags = "".join(f" #{x}" for x in it.get("tags", []))
        parts += [f"\n## {it.get('topic', '未命名主题')}{tags}", it.get("content", "")]
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")
    return path


def write_profile(items, ts):
    """画像变更意图：只入 Inbox 待用户确认，绝不直接改写 static/os/profile/。

    依据 security.schema.md：profile 目录 AI 写入须用户当次授权。
    """
    if not items:
        return None
    path = unique(INBOX / f"profile-{stamp(ts)}.md")
    parts = ["---", "type: profile-update", f"date: {ts:%Y-%m-%d}",
             'tags: ["needs-review"]', "---",
             "", "> ⚠️ 画像变更需用户确认后才会合入 `02-Memory/static/os/profile/`。", ""]
    for it in items:
        parts.append(f"- **[{it.get('aspect', '?')}]** {it.get('change', '')}")
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")
    return path


def write_raw_fallback(raw_text, ts, reason):
    path = unique(INBOX / f"raw-{stamp(ts)}.md")
    path.write_text(f"""---
type: raw
date: {ts:%Y-%m-%d}
tags: ["needs-review"]
reason: "{reason}"
---

{raw_text}
""", encoding="utf-8")
    return path


def ingest(raw_text: str, source: str = "cli") -> list:
    """主入口。返回写入的文件路径列表。"""
    ts = now()
    INBOX.mkdir(exist_ok=True)
    raw_text = raw_text.strip()
    if not raw_text:
        return []
    data = call_llm(raw_text) or offline_extract(raw_text)
    try:
        written = [p for p in (write_journal(data["journal"], source, ts),
                               write_tasks(data["tasks"], ts),
                               write_costs(data["costs"], ts),
                               write_learning(data.get("learning", []), ts),
                               write_profile(data.get("profile", []), ts)) if p]
        if not written:
            written = [write_raw_fallback(raw_text, ts, "no entity extracted")]
        return written
    except Exception as e:
        return [write_raw_fallback(raw_text, ts, f"write error: {e}")]


if __name__ == "__main__":
    text = " ".join(sys.argv[1:]) or sys.stdin.read()
    for p in ingest(text):
        print(f"[ingest] → {p.relative_to(ROOT)}")
