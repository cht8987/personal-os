#!/usr/bin/env python3
"""交互式新人引导：提问 → 生成个人画像（profile）骨架。

唯一会写 static/os/profile/ 的脚本——因为它由用户亲手运行，等同当次授权。
"""
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROFILE = ROOT / "02-Memory" / "static" / "os" / "profile"


def ask(q, multiline=False):
    print(f"\n\033[1m{q}\033[0m")
    if not multiline:
        return input("> ").strip()
    print("（多行输入，空行结束）")
    lines = []
    while True:
        line = input("> ").strip()
        if not line:
            break
        lines.append(line)
    return lines


def write_note(rel, title, body):
    p = PROFILE / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        print(f"  ⚠️ 已存在，跳过：{p.relative_to(ROOT)}（如需重设请先手动删除）")
        return
    today = date.today().isoformat()
    p.write_text(f"""---
title: {title}
type: memory
status: active
created: {today}
updated: {today}
tags: [profile]
---

{body}
""", encoding="utf-8")
    print(f"  ✅ {p.relative_to(ROOT)}")


def main():
    print("=" * 46)
    print("  PERSONAL OS · 画像设定向导（约 3 分钟）")
    print("  回答会写入 02-Memory/static/os/profile/")
    print("  任何问题直接回车可跳过")
    print("=" * 46)

    name = ask("1/5 怎么称呼你？你目前的身份/角色是？（如：独立开发者 / 设计师）")
    goals = ask("2/5 今年最重要的目标（最多3条，一行一条）", multiline=True)
    principles = ask("3/5 你的做事原则（一行一条，如：做减法是美德）", multiline=True)
    constraints = ask("4/5 当前的约束或限制（时间/资源/健康等，一行一条）", multiline=True)
    focus = ask("5/5 接下来 30 天最想推进的一件事？")

    print("\n生成画像文件：")
    if name:
        write_note("identity/identity.md", "身份与角色",
                   f"## 我是谁\n\n{name}")
    if goals:
        write_note(f"goals/{date.today().year}-goals.md", f"{date.today().year} 年度目标",
                   "## 年度三大目标\n\n" + "\n".join(f"- [ ] {g}" for g in goals))
    if principles:
        write_note("identity/principles.md", "做事原则",
                   "## 原则\n\n" + "\n".join(f"- {p}" for p in principles))
    if constraints:
        write_note("constraints/current.md", "当前约束",
                   "## 约束清单\n\n" + "\n".join(f"- {c}" for c in constraints))
    if focus:
        write_note("goals/30-day-focus.md", "30 天聚焦",
                   f"## 当前聚焦\n\n{focus}\n\n> 设定于 {date.today().isoformat()}，到期请复盘更新。")

    print("\n🎉 画像设定完成！下一步：回到 Obsidian 打开 START-HERE.md 第 3 步，")
    print("   学会唯一需要的动作——把想法丢进 Inbox。")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n（已中断，可随时重新运行 rtk onboard）")
        sys.exit(0)
