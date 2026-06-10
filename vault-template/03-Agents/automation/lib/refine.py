#!/usr/bin/env python3
"""Refine 蒸馏引擎：AI 定期优化记忆结构 + 消化慢车道 Inbox。

A. 精修（static 区，profile 除外）：优化字句与结构、补标题层级、
   自动加 [[双链]]——改写前原文备份到 .system/backups/refine/，绝不丢数据。
B. 蒸馏（unprocessed / quick-capture / web-clippings）：提炼成 Wiki 条目
   或日记素材，原文留在原地打 distilled 戳，raw 区永不被改写（用户自留地）。

无 LLM Key 时本引擎直接跳过（它是增强器，不是必需品）。
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ingest import call_llm_raw, ROOT  # noqa: E402

STATIC = ROOT / "02-Memory" / "static"
INBOX_LEGACY = ROOT / "01-Inbox" / "legacy"
BACKUP = ROOT / ".system" / "backups" / "refine"
LOGS = ROOT / ".system" / "logs"
LANG = os.environ.get("POS_LANG", "zh")
MAX_REFINE = 3      # 每次精修篇数上限（控成本）
MAX_DISTILL = 3     # 每次蒸馏篇数上限
RECENT_DAYS = 30


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line)
    LOGS.mkdir(parents=True, exist_ok=True)
    with open(LOGS / "refine.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def note_titles(limit=300):
    """全库笔记标题清单，供 LLM 选择双链目标。"""
    titles = []
    for p in STATIC.rglob("*.md"):
        titles.append(p.stem)
        if len(titles) >= limit:
            break
    return titles


def lang_rule():
    return ("All output in English (translate if source is Chinese)."
            if LANG == "en" else "输出使用中文。")


# ---------------------------------------------------------------- A. 精修
def refine_targets():
    cutoff = time.time() - RECENT_DAYS * 86400
    out = []
    for p in sorted(STATIC.rglob("*.md"), key=lambda x: -x.stat().st_mtime):
        rel = p.relative_to(STATIC)
        if rel.parts[:3] == ("os", "profile") or "profile" in rel.parts[:2]:
            continue  # 画像区：AI 修改须用户确认，精修不碰
        if p.stat().st_mtime < cutoff or p.name == "README.md":
            continue
        head = p.read_text(encoding="utf-8", errors="replace")[:400]
        if "refined:" in head:
            continue
        out.append(p)
        if len(out) >= MAX_REFINE:
            break
    return out


def refine_note(p, titles):
    raw = p.read_text(encoding="utf-8", errors="replace")
    if len(raw) < 80 or len(raw) > 12000:
        return False
    prompt = f"""你是个人知识库的结构编辑。优化下面这篇笔记：
1. 保留全部事实与原意，禁止编造或删减信息；只优化措辞清晰度、段落结构、标题层级。
2. 在正文中自然地为出现的概念加 Obsidian 双链 [[标题]]，只能从这份清单选：{json.dumps(titles[:120], ensure_ascii=False)}
3. 保留并补全 frontmatter（保持原 created；updated 改为今天 {datetime.now():%Y-%m-%d}；新增一行 refined: {datetime.now():%Y-%m-%d}）。
4. {lang_rule()}
只输出完整的 markdown 文件内容（以 --- 开头），不要解释。

【笔记内容】
{raw}"""
    resp = call_llm_raw(prompt)
    if not resp or not resp.strip().startswith("---") or len(resp) < len(raw) * 0.5:
        log(f"精修跳过（响应无效）: {p.name}")
        return False
    day_dir = BACKUP / f"{datetime.now():%Y-%m-%d}"
    day_dir.mkdir(parents=True, exist_ok=True)
    (day_dir / p.name).write_text(raw, encoding="utf-8")   # 原文备份
    p.write_text(resp.strip() + "\n", encoding="utf-8")
    log(f"✨ 精修完成: {p.relative_to(ROOT)}（备份于 {day_dir.relative_to(ROOT)}）")
    return True


# ---------------------------------------------------------------- B. 蒸馏
def distill_targets():
    out = []
    for bucket in ("unprocessed", "quick-capture", "web-clippings"):
        d = INBOX_LEGACY / bucket
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.md")) + sorted(d.glob("*.txt")):
            if p.name == "README.md":
                continue
            head = p.read_text(encoding="utf-8", errors="replace")[:300]
            if "distilled:" in head:
                continue
            out.append(p)
            if len(out) >= MAX_DISTILL:
                return out
    return out


def distill_note(p):
    raw = p.read_text(encoding="utf-8", errors="replace")
    if len(raw.strip()) < 40:
        return False
    cats = [d.name for d in (STATIC / "learning" / "wiki").iterdir() if d.is_dir()] or ["General"]
    prompt = f"""你是个人知识库的蒸馏器。判断下面这份原始材料的价值并提炼，只返回 JSON（无围栏）：
{{"action": "wiki|skip", "title": "", "category": "{'|'.join(cats[:15])}", "content": "提炼后的结构化正文（markdown，含小标题）", "reason": ""}}
规则：有可沉淀的知识/方法/洞察 → wiki；纯碎碎念或无信息量 → skip。
保留原意禁止编造。{lang_rule()}

【原始材料】
{raw[:6000]}"""
    resp = call_llm_raw(prompt)
    try:
        data = json.loads(re.sub(r"^```(json)?|```$", "", (resp or "").strip(), flags=re.M).strip())
    except Exception:
        log(f"蒸馏跳过（解析失败）: {p.name}")
        return False
    if data.get("action") == "wiki" and data.get("title"):
        cat = data.get("category") if data.get("category") in cats else cats[0]
        slug = re.sub(r"[^\w一-鿿-]+", "-", data["title"])[:48].strip("-")
        dest = STATIC / "learning" / "wiki" / cat / f"{slug}.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            dest.write_text(f"""---
title: {data['title']}
type: wiki
status: active
created: {datetime.now():%Y-%m-%d}
updated: {datetime.now():%Y-%m-%d}
tags: [wiki, distilled]
source: "{p.relative_to(ROOT)}"
---

# {data['title']}

{data.get('content', '')}
""", encoding="utf-8")
            log(f"📚 蒸馏入 Wiki: {dest.relative_to(ROOT)} ← {p.name}")
    else:
        log(f"蒸馏判定 skip: {p.name}（{data.get('reason', '')[:40]}）")
    # 原文打戳（不删除不移动——尊重用户自留地）
    stamp = f"\n\n<!-- distilled: {datetime.now():%Y-%m-%d} -->\n"
    if p.suffix == ".md" and raw.startswith("---"):
        body = raw.split("---", 2)
        if len(body) == 3 and "distilled:" not in body[1]:
            p.write_text(f"---{body[1]}distilled: {datetime.now():%Y-%m-%d}\n---{body[2]}", encoding="utf-8")
        else:
            p.write_text(raw + stamp, encoding="utf-8")
    else:
        p.write_text(raw + stamp, encoding="utf-8")
    return True


def main():
    if not os.environ.get("SILICONFLOW_API_KEY"):
        log("未配置 LLM Key，refine 跳过（这是增强器，不影响主管线）")
        return
    log("=== refine 开始 ===")
    titles = note_titles()
    done_r = sum(refine_note(p, titles) for p in refine_targets())
    done_d = sum(distill_note(p) for p in distill_targets())
    log(f"=== refine 完成：精修 {done_r} 篇 · 蒸馏 {done_d} 篇 ===")


if __name__ == "__main__":
    main()
