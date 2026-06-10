# Schema: 日记 / 随手记（Journal）

> 三件套之一（Log）。移动端提问式交互的默认承接格式。

## 文件命名

`01-Inbox/journal-YYYY-MM-DD-HHmm.md`（入流时）
归档后 → `02-Memory/dynamic/journal/YYYY/YYYY-MM-DD.md`（同日多条追加合并）

## 标准格式

```markdown
---
type: journal
date: 2026-06-10
time: "21:30"
source: phone | pc | mac
mood: ""            # 可空；AI 从文本推断，仅在明显时填写
tags: []
---

## 核心进展
（回答"今天核心进展是什么？"——一句话到一段话）

## 随想
（未被引导问题覆盖的自由文本，原样保留，不过度加工）
```

## 字段铁律

- `date`/`time`/`source` 三字段必填，由 ingest 管线自动注入，AI 不得编造。
- 用户原文中的事实性内容**禁止改写语义**，只做排版与归类。
- 文本中若提取出 Task 或消费记录，**拆分**为独立的 task/cost 条目，
  日记正文保留一行引用：`→ 已拆分任务：[[task-xxx]]`。
