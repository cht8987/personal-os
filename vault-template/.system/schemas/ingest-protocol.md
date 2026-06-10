# 入流协议（Ingest Protocol）— 提问式交互规范

> 定义：当移动端经任意适配器送来一段凌乱文本时，AI 如何将其格式化并推入 `01-Inbox/`。
> 本文件同时是 ingest 管线调用 LLM 时的 System Prompt 蓝本（见 `ingest.py` 内嵌引用）。

## 1. 提问式交互（移动端 UX）

移动端**不做排版操作**。适配器按以下引导链提问，用户可随时跳过：

1. 「今天核心进展是什么？」
2. 「有产生新的待办或消费吗？」
3. 「还有什么随想要记录？」

用户的回答（或一段未经引导的自由语音转文字）整体作为 `raw_text` 送入管线。

## 2. 实体提取规则（五类）

AI 对 `raw_text` 做且仅做五类实体提取，逐条对照 Schema：

| 实体 | 判定信号 | Inbox 文件 | 巡检后去向 |
| --- | --- | --- | --- |
| **Task** | 明确动作意图 + 可执行（"记得/要/明天…"） | `task-*` | `ops-log/tasks.md` 自动合并 |
| **Cost** | 明确金额数字（无金额 = 不提取） | `cost-*` | `ops-log/cost-YYYY-MM.md` 自动入账 |
| **Learning** | 成块知识：学到/读了/课程心得/笔记 | `learning-*` | `dynamic/raw/learning/YYYY/` 自动归档 |
| **Profile** | 画像变更意图：设定目标/调整原则/资源变化 | `profile-*` | **留在 Inbox 待用户确认**后才合入 `static/os/profile/` |
| **Log/Thought** | 其余一切内容 | `journal-*` | `dynamic/journal/YYYY/` 按日合并 |

> Profile 不自动分发是 security.schema.md 的要求：个人画像 AI 写入须当次授权。
> 确认方式：在 Obsidian 里打开 `profile-*.md` 审阅后，让 Claude 合入并删除该文件即可。

## 3. 输出契约（管线强制校验）

AI 必须返回如下 JSON，由 `ingest.py` 落盘，**AI 自己不写文件**：

```json
{
  "journal":  { "core_progress": "…", "thoughts": "…", "mood": "", "tags": [] },
  "tasks":    [ { "text": "给服务器换证书", "priority": "high", "due": "2026-06-15", "tags": ["project/bank-os"] } ],
  "costs":    [ { "item": "午餐", "amount": -38.00, "currency": "CNY", "category": "餐饮", "channel": "微信" } ],
  "learning": [ { "topic": "launchd 机制", "content": "StartCalendarInterval 错过会补跑", "tags": [] } ],
  "profile":  [ { "aspect": "goals", "change": "今年内把个人OS全面自动化" } ]
}
```

校验铁律：
- 三个键必须齐全；无内容用空对象/空数组，禁止省略键。
- `journal.thoughts` 保留用户原文语义，禁止 AI 改写事实。
- 相对日期一律换算为绝对日期（基准 = 入流时刻的本地日期）。
- 任何无法解析的输出 → 整段 `raw_text` 原样落入
  `01-Inbox/raw-YYYY-MM-DD-HHmm.md` 并打 `#needs-review` 标签，**绝不丢数据**。

## 4. 适配器（可插拔）

| 适配器 | 触发方式 | 状态 |
| --- | --- | --- |
| `shortcuts` | iOS 快捷指令把文本写入同步目录 `01-Inbox/.queue/`，Hermes 巡检时消化 | ✅ 默认启用 |
| `telegram` | Bot Webhook → 中转服务 → 调 `rtk ingest` | 🔌 预留（见 os.config.yml） |
| `cli` | Mac/PC 直接 `rtk ingest "文本"` | ✅ 内建 |

切换/启用只改 `.system/config/os.config.yml` → `ingest.active_adapter`。
