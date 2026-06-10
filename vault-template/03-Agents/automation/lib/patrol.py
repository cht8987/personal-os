#!/usr/bin/env python3
"""Hermes 日巡检：消化队列 → 分发 Inbox → 固化 ops-log → 健康告警。

铁律：先本地状态验证，后远程原因推导；只在 PERSONAL OS/ 内读写。
"""
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INBOX = ROOT / "01-Inbox"
QUEUE = INBOX / ".queue"
MEMORY = ROOT / "02-Memory" / "dynamic"
LOGS = ROOT / ".system" / "logs"
INBOX_MAX_IDLE_DAYS = 3

sys.path.insert(0, str(Path(__file__).parent))
from ingest import ingest  # noqa: E402


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line)
    LOGS.mkdir(parents=True, exist_ok=True)
    with open(LOGS / "patrol.log", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def verify_local_state():
    """巡检第一步：本地状态验证。任何缺失立即报错退出，拒绝带病运行。"""
    problems = [str(d) for d in (INBOX, MEMORY, LOGS.parent)
                if not d.is_dir()]
    if problems:
        log(f"FATAL 本地状态验证失败，目录缺失: {problems}")
        sys.exit(1)


def consume_queue():
    """消化移动端（快捷指令适配器）投递的原始文本队列。"""
    if not QUEUE.is_dir():
        QUEUE.mkdir(parents=True)
        return 0
    archive = INBOX / "legacy" / "mobile-notes"
    archive.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted(QUEUE.glob("*.txt")):
        text = f.read_text(encoding="utf-8", errors="replace")
        written = ingest(text, source="phone")
        log(f"queue 消化 {f.name} → {len(written)} 个条目")
        f.rename(archive / f.name)   # 原文归档，数据不灭
        n += 1
    return n


def body_after_frontmatter(text):
    m = re.match(r"^---\n.*?\n---\n", text, re.S)
    return text[m.end():] if m else text


def dispatch_inbox():
    """把已结构化的 Inbox 条目归档至 02-Memory/dynamic/。

    profile-*.md 不在此分发：画像变更须用户确认（security.schema.md），
    留在 Inbox 由 check_stale 兜底提醒。
    """
    counts = {"journal": 0, "task": 0, "cost": 0, "learning": 0}
    today = datetime.now()
    for f in sorted(INBOX.glob("*.md")):
        name = f.name
        text = f.read_text(encoding="utf-8")
        if name.startswith("journal-"):
            day = name[8:18]  # YYYY-MM-DD
            dest = MEMORY / "journal" / day[:4] / f"{day}.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "a", encoding="utf-8") as out:
                out.write(("\n---\n\n" if dest.exists() and dest.stat().st_size else "")
                          + text)
            f.unlink()
            counts["journal"] += 1
        elif name.startswith("task-"):
            dest = MEMORY / "ops-log" / "tasks.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                dest.write_text("# 任务清单\n\n", encoding="utf-8")
            lines = [l for l in body_after_frontmatter(text).splitlines()
                     if l.startswith("- [")]
            with open(dest, "a", encoding="utf-8") as out:
                out.write("\n".join(lines) + "\n")
            f.unlink()
            counts["task"] += 1
        elif name.startswith("cost-"):
            month = name[5:12]  # YYYY-MM
            dest = MEMORY / "ops-log" / f"cost-{month}.md"
            dest.parent.mkdir(parents=True, exist_ok=True)
            rows = [l for l in body_after_frontmatter(text).splitlines()
                    if l.startswith("|") and "---" not in l and "日期" not in l]
            if not dest.exists():
                dest.write_text(f"# 账本 {month}\n\n"
                                "| 日期 | 项目 | 金额 | 币种 | 分类 | 渠道 | 备注 |\n"
                                "| --- | --- | --- | --- | --- | --- | --- |\n",
                                encoding="utf-8")
            with open(dest, "a", encoding="utf-8") as out:
                out.write("\n".join(rows) + "\n")
            f.unlink()
            counts["cost"] += 1
        elif name.startswith("learning-"):
            day = name[9:19]  # YYYY-MM-DD
            dest_dir = MEMORY / "raw" / "learning" / day[:4]
            dest_dir.mkdir(parents=True, exist_ok=True)
            f.rename(dest_dir / name)
            counts["learning"] += 1
        # raw-*.md / profile-*.md（needs-review）留在 Inbox 等人工处理
    return counts


BINARY_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".zip", ".docx", ".xlsx", ".pptx"}
AUDIO_EXT = {".m4a", ".mp3", ".wav", ".aac", ".ogg", ".flac"}


def scan_nas_inbox():
    """NAS 投递箱扫描（旧 OS 功能移植）：只取顶层文件，分类子目录不碰。

    文本 → ingest 智能分流；二进制/音频 → 库内对应桶。
    原件移入 NAS 的 archive/（数据不灭）。POS_NAS_INBOX=off 可关闭。
    """
    import os
    nas = os.environ.get("POS_NAS_INBOX", "off")
    if nas.lower() == "off":
        return 0
    nas = Path(nas)
    if not nas.is_dir():
        return 0
    done_dir = nas / "archive" / f"{datetime.now():%Y-%m}"
    n = 0
    for f in sorted(nas.iterdir()):
        if not f.is_file() or f.name.startswith("."):
            continue
        ext = f.suffix.lower()
        try:
            if ext in {".md", ".txt"}:
                text = f.read_text(encoding="utf-8", errors="replace")
                ingest(text, source="nas")
            elif ext in AUDIO_EXT:
                dest = INBOX / "legacy" / "voice-notes"
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest / f.name)
            else:
                dest = INBOX / "legacy" / "temporary"
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest / f.name)
            done_dir.mkdir(parents=True, exist_ok=True)
            f.rename(done_dir / f.name)
            log(f"NAS 收件 {f.name} → 已入库（原件归档 NAS archive/）")
            n += 1
        except Exception as e:
            log(f"NAS 收件失败 {f.name}: {e}")
    return n


def classify_strays():
    """Inbox 顶层的非 markdown 文件自动分桶：二进制→temporary，音频→voice-notes。"""
    moved = 0
    for f in INBOX.iterdir():
        if not f.is_file() or f.name.startswith("."):
            continue
        ext = f.suffix.lower()
        if ext in AUDIO_EXT:
            dest = INBOX / "legacy" / "voice-notes"
        elif ext in BINARY_EXT:
            dest = INBOX / "legacy" / "temporary"
        else:
            continue
        dest.mkdir(parents=True, exist_ok=True)
        f.rename(dest / f.name)
        log(f"杂物分类 {f.name} → {dest.name}/")
        moved += 1
    return moved


def check_stale():
    """Inbox 滞留告警（raw / needs-review 条目超期未处理）。"""
    stale = []
    now_ts = datetime.now().timestamp()
    for f in INBOX.glob("*.md"):
        idle_days = (now_ts - f.stat().st_mtime) / 86400
        if idle_days > INBOX_MAX_IDLE_DAYS:
            stale.append(f"{f.name}（滞留 {idle_days:.0f} 天）")
    return stale


def write_daily_oplog(queued, counts, stale):
    pending_profile = len(list(INBOX.glob("profile-*.md")))
    day = datetime.now().strftime("%Y-%m-%d")
    dest = MEMORY / "ops-log" / f"{day}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    alerts = "\n".join(f"- ⚠️ {s}" for s in stale) or "- 无"
    dest.write_text(f"""---
type: ops-log
date: {day}
---

# Hermes 日巡检 {day}

| 指标 | 值 |
| --- | --- |
| 队列消化 | {queued} 条 |
| NAS 收件 | {counts.get('nas', 0)} |
| 日记归档 | {counts['journal']} |
| 任务归档 | {counts['task']} |
| 消费归档 | {counts['cost']} |
| 学习归档 | {counts['learning']} |
| 杂物分桶 | {counts.get('strays', 0)} |
| 画像变更待确认 | {pending_profile} |

## 告警
{alerts}
""", encoding="utf-8")
    return dest


def main():
    log("=== patrol 开始 ===")
    verify_local_state()                 # 1. 本地状态验证
    queued = consume_queue()             # 2. 消化移动端队列（原文归档 mobile-notes）
    nas_n = scan_nas_inbox()             # 2.5 NAS 投递箱扫描
    counts = dispatch_inbox()            # 3. 分发归档
    counts["strays"] = classify_strays() # 4. 顶层杂物分桶
    counts["nas"] = nas_n
    stale = check_stale()                # 5. 滞留告警
    dest = write_daily_oplog(queued, counts, stale)
    log(f"=== patrol 完成 → {dest.relative_to(ROOT)} ===")


if __name__ == "__main__":
    main()
