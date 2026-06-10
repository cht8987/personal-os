---
title: START HERE · 新手引导
type: system
status: evergreen
created: 2026-06-11
updated: 2026-06-11
tags: [onboarding]
ai-editable: false
---

# 👋 欢迎来到 PERSONAL OS

> 这是一台「个人资料与项目管理大脑」：你只管把任何想法丢进来，
> 系统自动分类、归档、提醒、沉淀。本页 10 分钟带你完全上手。

## 第 1 步 · 认识地形（1 分钟）

你只需要记住 **4 个地方**：

| 去哪里         | 做什么                        |
| ----------- | -------------------------- |
| [[HOME]]    | 每天打开的主页：待办、日记、项目、看板全在这     |
| `01-Inbox`  | 一切输入的入口（你丢，系统收）            |
| `02-Memory` | 你的第二大脑（日记/账本/知识/画像，系统整理好的） |
| `04-Output` | 高价值产出（周报/创作/看板）            |

`.system` 和 `03-Agents` 是引擎舱，日常**不需要**进去。

## 第 2 步 · 设定你的画像（3 分钟）

打开终端，运行交互式向导，回答几个问题即可生成你的个人画像：

```bash
"03-Agents/automation/bin/rtk" onboard
```

它会引导你填写：我是谁 → 今年三大目标 → 做事原则 → 当前约束，
自动写入 `02-Memory/static/os/profile/`（这是 AI 永远不会擅自改动的区域）。

## 第 3 步 · 学会唯一的动作：丢进 Inbox（2 分钟）

系统只要求你会一件事——**把想法丢进来**，方式任选：

- **桌面快捷**：Obsidian 左侧栏点 🧠 图标（Personal OS 插件），回答 3 个引导问题
- **桌面命令**：`rtk ingest "随便一段话"`
- **手机**：iOS 快捷指令（配置见 `.system/config/MOBILE-SETUP.md`）

试一下！输入这句话：
`今天开始用Personal OS。记得明天看一遍START-HERE。买咖啡花了15块`
→ 系统会自动拆成 **日记 + 待办 + 账单** 三条记录。

## 第 4 步 · 理解自动化节奏（2 分钟）

- **每晚 23:30**：管家 Hermes 自动巡检——消化手机队列、分发 Inbox、写当日报告
- **次日清晨**：打开 [[HOME]]，昨天的一切已各就各位；有需要你确认的
  （比如画像变更）会标记「待确认」
- 随时手动触发：`rtk patrol`；查健康：`rtk status`

## 第 5 步 · 进阶（按需阅读）

- 系统宪法与铁律 → [[README]]
- 隐私与权限锁定（private 标注、AI 权限矩阵）→ `.system/schemas/security.schema.md`
- 长期记忆引擎（Hindsight 对接）→ `.system/config/HINDSIGHT.md`
- 输出规范（怎样的内容才进 04-Output）→ [[04-Output/OUTPUT-SPEC|OUTPUT-SPEC]]

> **核心心法**：做减法是美德。别整理，别分类，别纠结放哪——丢进 Inbox，剩下的交给系统。
