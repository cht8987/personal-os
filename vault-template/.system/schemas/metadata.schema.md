---
title: Metadata Schema · 统一元数据规范
type: system
version: "2.0"
status: active
ai-editable: false
---

# 统一元数据规范（蒸馏自旧库 09-System/01-Metadata，原件见 .system/reference/metadata/）

> 旧库 12 种 type / 9 种 status 精简为 **7 种 type / 5 种 status**。

## 必填字段（所有笔记）

```yaml
---
title: ""        # ≤60字，见名知义
type: ""         # 见下方枚举
status: active   # 见下方枚举
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
---
```

## type 枚举（7 种，对应五大支柱）

| 值 | 适用层 | 说明 |
| --- | --- | --- |
| `inbox` | `01-Inbox/` | 未处理输入（含 journal/task/cost/raw 子型，由 ingest 自动赋值） |
| `raw` | `02-Memory/dynamic/raw/` | 原始记录（六大生活域） |
| `memory` | `02-Memory/static/` | 提炼后的知识锚点 / 个人画像 |
| `project` | `02-Memory/static/projects/` | 项目追踪笔记 |
| `wiki` | `02-Memory/static/learning/wiki/` | 知识体系 |
| `output` | `04-Output/` | 最终产出（report/content/summary/dashboard） |
| `system` | `03-Agents/` `.system/` | 规则、Agent、工作流定义 |

## status 枚举（5 种）

`inbox`（未处理）→ `active`（活跃）→ `evergreen`（长青）/ `review`（待复审）→ `archived`

## 可选字段

| 字段 | 用途 |
| --- | --- |
| `private: true` | 私密内容，见 [security.schema.md](security.schema.md) |
| `ai-editable: false` | AI 禁改锁，见 [security.schema.md](security.schema.md) |
| `priority: high/mid/low` | 项目与任务 |
| `source: phone/pc/mac` | 入流来源（ingest 自动注入） |
| `related: []` | 关联笔记双链 |
