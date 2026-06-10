---
title: Agents 协作指南
type: system
status: evergreen
created: 2026-06-11
updated: 2026-06-11
tags: [agents, guide]
ai-editable: false
---

# 🤖 与 Agents 协作 — Personal OS 的精髓

> [!tip] 核心理念
> 这套 OS 不是「笔记软件」，而是**由 Agents 管理的大脑**：你负责输入想法和做决定，
> Agents 负责写入、整理、链接、产出。你和系统的关系 = 董事长和运营团队。

## 一、你的三个 Agent 是谁

| Agent | 形态 | 何时找它 |
| --- | --- | --- |
| **🌙 Hermes 夜巡** | 全自动后台（每晚 23:30 + 每周日 22:00 蒸馏） | 不用找——它自己跑。结果看运维页 |
| **💬 Hermes Console** | Obsidian 右侧对话框 | 日常对话：问数据、改笔记、跑产出、解释内容 |
| **🛠 Claude Code** | 终端 / 桌面 App | 重活：改系统结构、写脚本、批量迁移、调试 |

## 二、五种核心工作流（Workflow）

### W1 · 写入资料（每天）
```
你：随时点「＋记录」三问卡片，或手机快捷指令丢一句话
夜巡：23:30 自动拆五类 → 日记/任务/账单/学习/画像 各就各位
你：次日总览页看结果，橙色卡片（画像待确认）点进去审一眼
```

### W2 · 整理与链接（每周自动）
```
蒸馏引擎（周日 22:00）：
  精修 static 近期笔记 → 优化结构字句 + 自动加 [[双链]]（原文备份 .system/backups/）
  消化 unprocessed / web-clippings → 提炼成 Wiki 条目
你想立即跑：终端 rtk refine，或让 Console 帮你跑
```

### W3 · 产出闭环（Report / 文章）⭐
```
① 产出页选类型 → 引导填写 → 生成草稿（自带 Agent Brief 区块 + 数据引用清单）
② 点「复制 Agent 指令」→ 粘贴给 Hermes Console（或 Claude）
③ Agent 读取 Brief 引用的 ops-log/账本/日记 → 在草稿里写出完整内容
④ 你审阅修改 → frontmatter 改 status: final → 完成（进入正式资产）
```

### W4 · 项目推进
```
项目页「创建项目」→ 描述/阶段/下一步
对 Console 说：「读取 [[项目名]]，根据决策记录帮我推进下一步 / 写周进展」
任务页勾选完成 →「写入 Active-Context」让所有 Agent 知道你当前的焦点
```

### W5 · 提问与回忆
```
对 Console 说：「这个月钱花哪了？」「上次关于 X 的决策是什么？」
它会读账本/ops-log/static 回答；深度回忆走 Hindsight（bank: os/projects/learning）
```

## 三、对话技巧（怎么说 Agent 才好用）

- **给路径**：「读取 02-Memory/static/projects/xxx.md」比「看看我的项目」准确十倍
- **给边界**：「只改措辞不改事实」「不超过300字」「写进原文件不要新建」
- **要确认**：涉及 profile/ 和 .system/ 的修改，Agent 必须先问你——这是权限矩阵规定的，没问就是违规
- **用双链**：对话里提 [[笔记名]]，Agent 能直接定位

## 四、安全边界（Agent 永远不会做的事）

❌ 擅自改写你的画像（profile/）、系统规则（.system/）
❌ 把 `private: true` 内容写进任何产出或汇总
❌ 动 `dynamic/raw/` 用户自留地（只读，蒸馏只提炼不改写）
❌ 删除任何数据（最多移动归档；改写前必备份）
