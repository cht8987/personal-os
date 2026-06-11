---
title: 手机端双模式设计规格 v1
type: system
status: active
created: 2026-06-11
updated: 2026-06-11
tags: [mobile, design-spec, osmind]
ai-editable: false
---

# 📱 手机端双模式设计规格（OSMIND Mobile）

> [!tip] 总架构：一个大脑，两个入口
> **模式 A**＝Obsidian Mobile（看 + 小改 + Copilot 聊）——资料库的"阅览室"
> **模式 B**＝OSMIND App（自研，专注输入）——大脑的"耳朵和嘴"
> 两者殊途同归：一切写入最终落进 `01-Inbox`，桌面 cron 闭环消化。

---

## 模式 A · Obsidian Mobile（零开发，配置即用）

| 能力 | 方案 | 状态 |
| --- | --- | --- |
| 查看全库 | Obsidian Mobile + 同步（现 iCloud，后官方 Sync） | ✅ 可用 |
| 小修改 | 直接编辑；新建笔记自动落 `01-Inbox/legacy/unprocessed`（app.json 已配） | ✅ 可用 |
| Copilot 对话 | Copilot 插件移动端可用；对话存档→`ai-conversations`（已配） | ✅ 可用 |
| **Personal OS 看板** | `personal-os-core` 插件 `isDesktopOnly: false`，手机可加载 | ⚠️ 待优化 |

> [!warning]+ 看板手机端适配清单（下个版本 v0.7 做）
> 1. **响应式布局**：左侧导航 168px 在手机太宽 → 窄屏(<700px)切为顶部横向滚动 tab 条
> 2. **桌面专属功能降级**：立即巡检/备份按钮（child_process）已有 try-catch 守护，
>    需改为隐藏 + 提示「桌面端功能」
> 3. **触控目标**：卡片/按钮最小 44px 点击区
> 4. 设置页"路径"卡片手机端显示「移动端不可见」已处理 ✅

---

## 模式 B · OSMIND App（自研，NotebookLM 式输入端）

### 产品定位一句话
> 「随手丢任何东西给大脑，它自己消化」——录音、拍照、PDF、网页、碎碎念，
> 全部对话式进入，AI 当场分析回报，落库后桌面自动化闭环。

### 核心界面（5 屏，供 AI Studio 设计参考）

| # | 屏 | 内容 | 参考 |
| --- | --- | --- | --- |
| 1 | **对话主屏** | AI 对话框为中心；底部输入条：文本/🎙长按录音/📎附件/🔗贴链接；消息流里 AI 实时反馈分类结果卡片（"已拆：1任务+1账单"） | NotebookLM 聊天页 |
| 2 | **来源库 Sources** | 本次会话上传的 PDF/图片/网页清单；点开看 AI 的摘要分析报告；可勾选多源让 AI 综合分析 | NotebookLM 来源面板 |
| 3 | **收件回执 Inbox** | 今天丢进去的所有东西 + 各自落桶状态（待夜巡/已归档/待确认）；画像变更在这里一键确认 | — |
| 4 | **报告 Reports** | AI 生成的分析报告列表（网页分析/PDF 摘要/语音转写稿）；可继续对话修改后定稿入库 | NotebookLM 笔记 |
| 5 | **设置** | 网关地址配对（扫码）/ LLM Key / 语言 / 同步状态 | — |

### 输入类型 → 落桶契约（与桌面体系严格对齐）

| 输入 | App 端处理 | 落库位置 | 桌面闭环 |
| --- | --- | --- | --- |
| 文本/碎碎念 | 直接发送 | `01-Inbox/.queue/q-mobile-*.txt` | 夜巡五类分流 |
| 🎙 录音 | 端上转写(Whisper)→文本走分流；原音频上传 | 音频→`legacy/voice-notes/` + 转写文本→`.queue` | 夜巡分流 |
| PDF/图片 | AI 当场摘要报告；原件上传 | 原件→`legacy/temporary/` 摘要→`legacy/web-clippings/` | 周日蒸馏进 Wiki |
| 网页链接 | 抓取→AI 分析报告 | 报告→`legacy/web-clippings/` | 周日蒸馏 |
| 与 Agent 改文件 | 对话修订报告/笔记 | 定稿写回对应路径 | — |

### 技术架构（三层）

```
┌──────────── OSMIND App（React Native/Expo 推荐）────────────┐
│ 对话 UI · 录音/转写 · 文件选择 · 分享扩展(Share Sheet 一键收件) │
└──────────────────────────┬──────────────────────────────────┘
                           ▼ HTTPS (Tailscale 内网穿透)
┌──────────── OSMIND Gateway（FastAPI，跑在 Mac/NAS）──────────┐
│ POST /ingest {type, text|file, meta}  → 按契约写入 vault     │
│ POST /chat   → 转发 SiliconFlow（复用 ~/.personal-os/llm.env）│
│ GET  /status → 收件回执（读 ops-log + Inbox 状态）            │
│ POST /patrol → 触发 rtk patrol（"立即消化"按钮）              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼ 本地文件写入
              NEW PERSONAL OS vault → 桌面 cron 闭环
```

> [!note]+ 关键设计决策
> - **网关是唯一写入口**：App 永不直接碰同步盘，避开 iCloud/Sync 冲突；
>   Obsidian Sync 时代这是唯一正确架构
> - **复用现有管线**：网关只是把 rtk ingest / 桶规则包成 HTTP——零新逻辑
> - **离线队列**：App 本地暂存，连上网关后补传（搭配收件回执屏）
> - **配对**：网关启动打印二维码（Tailscale 地址+一次性 token），App 扫码即连
> - **AI 角色名**：App 内的 agent 统一叫 **OSMIND**（桌面实现是 Hermes，用户无感）

### MVP 切片（建议三期）

| 期 | 范围 | 验收 |
| --- | --- | --- |
| M1 | 文本+录音转写 → 网关 → 落桶；收件回执屏 | 手机说一句话，次日桌面总览各就各位 |
| M2 | PDF/图片/网页 → AI 分析报告 → web-clippings；分享扩展 | Safari 分享一篇文章，周日自动进 Wiki |
| M3 | Agent 对话修改文件、画像确认、报告定稿入库 | 手机端完成一次完整产出闭环 |

### 你在 AI Studio 设计 UI 时需要的素材清单
- 五屏线框（上表）+ 桌面看板的视觉语言延续（卡片圆角 14-16px、accent 蓝、统计大数字）
- 分类结果卡片的五种状态色：任务✅/账单💸/日记📓/学习📚/画像⚠️橙
- 录音态/转写态/上传进度的微交互
- 收件回执的三态徽章：待夜巡(灰) · 已归档(绿) · 待确认(橙)
