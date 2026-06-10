---
title: HOME · 系统主页
type: output
status: evergreen
created: 2026-06-10
updated: 2026-06-10
tags: [dashboard, home]
ai-editable: false
---

# 🧠 NEW PERSONAL OS

> [[README|📜 系统宪法]] · [[02-Memory/MEMORY-SPEC|🧬 记忆架构]] · [[04-Output/OUTPUT-SPEC|📤 输出规范]] · [[03-Agents/hermes/HERMES|🤖 Hermes]]

## 📥 待处理（Inbox）

```dataview
TABLE WITHOUT ID file.link AS "条目", file.mtime AS "进入时间"
FROM "01-Inbox"
WHERE file.name != "legacy"
SORT file.mtime DESC
LIMIT 10
```

## ✅ 近期任务

![[02-Memory/dynamic/ops-log/tasks.md]]

## 📓 最近日记

```dataview
TABLE WITHOUT ID file.link AS "日期", mood AS "心情"
FROM "02-Memory/dynamic/journal"
SORT file.name DESC
LIMIT 7
```

## 🚀 活跃项目

```dataview
TABLE WITHOUT ID file.link AS "项目", status, updated AS "更新"
FROM "02-Memory/static/projects"
WHERE status = "active" OR type = "project-note"
SORT updated DESC
LIMIT 8
```

## 📊 看板入口

[[04-Output/Dashboard/life-dashboard|🌱 生活]] · [[04-Output/Dashboard/project-dashboard|📦 项目]] · [[04-Output/Dashboard/memory-dashboard|🧬 记忆]]
