# 移动端路线图（三阶段，渐进式）

## 阶段 A · 零开发（当天可用）

- **查看**：Obsidian Mobile（免费）+ iCloud 同步
- **输入**：iOS 快捷指令，3 个「要求输入」动作模拟提问式交互
  （今天核心进展？→ 待办或消费？→ 随想？），拼接后存为
  `01-Inbox/.queue/q-时间戳.txt`，夜间巡检自动消化
- **语音**：第一个动作换成「听写文本」即可

## 阶段 B · Bot 中转（一个周末）

- Telegram Bot 常驻 NAS/Mac（python-telegram-bot，约百行）
- 收到消息/语音 → 调用 `rtk ingest` → 即时回执
- 配置位已预留：`os.config.yml → ingest.adapters.telegram`
- 体验质变点：对话式追问、转发文章直接入库

## 阶段 C · 自有 App（产品化阶段）

- 技术选型：PWA（最快）或 React Native / SwiftUI
- 架构：App → 自托管 ingest API（FastAPI 包一层 `rtk ingest`，
  Tailscale/内网穿透连接 Mac/NAS）→ 同一条管线
- UI 核心：单屏三问引导卡片 + 历史时间线 + Task 打勾
- 桌面联动：与 Obsidian 插件同协议（写 `.queue/`），
  状态经 iCloud/Syncthing 自然同步，无需自建同步服务

> 原则：管线不动，只换前端。每一阶段都是完整可用的产品。
