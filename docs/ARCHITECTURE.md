# 架构设计

## 单向数据流

```
Phone / Desktop 插件 / CLI 输入（提问式交互）
        │
        ▼  ingest.py（LLM 或离线规则引擎，五类实体提取）
   01-Inbox  ── 每晚 Hermes patrol 分发 ──▶  02-Memory ── 沉淀提纯 ──▶ 04-Output
        ▲                                       │
        └────────── .system/schemas 约束格式 ────┘
```

## 五类实体分流

| 实体 | 判定 | 去向 |
| --- | --- | --- |
| Task | 明确动作意图 | `ops-log/tasks.md` 集中清单 |
| Cost | 含金额数字 | `ops-log/cost-YYYY-MM.md` 月度账本 |
| Learning | 成块知识 | `dynamic/raw/learning/YYYY/` |
| Profile | 画像变更意图 | **留 Inbox 待人工确认**（安全铁律） |
| Journal | 其余一切 | `dynamic/journal/YYYY/` 按日合并 |

## 设计铁律

1. **数据不灭**：任何解析失败 → 原文落盘 `raw-*.md` + `#needs-review`，宁留垃圾不丢数据
2. **文件名碰撞保护**：秒级时间戳 + 自动序号，并发写入绝不覆盖
3. **本地验证优先**：巡检第一步验证目录完整性，拒绝带病运行
4. **包裹化**：脚本只存在于 `03-Agents/automation/`，统一 `rtk` CLI 入口
5. **权限矩阵**：见 `vault-template/.system/schemas/security.schema.md`——
   画像与系统规则 AI 不可擅改，`private: true` 内容永不进入汇总输出

## 显示层可替换

数据层 = 纯 Markdown。Obsidian 只是默认"浏览器"，可整体换为
Logseq / SilverBullet / 自建 Tauri 应用，引擎与数据零改动。
