---
title: Obsidian 官方 Sync 迁移手册
type: system
status: active
created: 2026-06-11
updated: 2026-06-11
tags: [sync, runbook]
ai-editable: false
---

# ☁️ iCloud → Obsidian 官方 Sync 迁移手册

> [!warning] 黄金法则：**两套同步永远不要叠加**
> 库在 iCloud 目录里就绝不能同时开官方 Sync（双同步会打架产生冲突副本）。
> 迁移的本质 = 把库搬出 iCloud 到本机普通目录，再交给官方 Sync 接管。

## 迁移当天的步骤（约 30 分钟）

> [!example]+ Step 1 · 准备（5 分钟）
> 1. 订阅 Obsidian Sync（Settings → Sync，Standard 档够用：1 库 1GB）
> 2. 跑一次手动备份：`rtk backup`（出事可回滚）
> 3. **关闭 Mac 上所有会写库的东西**：等夜巡时段过去 / 确认 23:30 前操作

> [!example]+ Step 2 · 搬库出 iCloud（5 分钟）
> ```bash
> # 等 iCloud 同步图标静止后：
> mv "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/NEW PERSONAL OS" \
>    "$HOME/Vaults/NEW PERSONAL OS"
> ```
> Obsidian 里移除旧库引用 → 「打开另一个库」选新位置。

> [!example]+ Step 3 · 接管同步（5 分钟）
> Settings → Sync → 创建 remote vault →（建议）开启端到端加密 → 全量首传。
> Selective sync 建议**排除** `.system/reference/`（133 个旧规则冷文件）提速。
> 手机端：Obsidian Mobile 新建空库 → 登录 → 连接同一 remote vault → 等待下载。

> [!example]+ Step 4 · 修复自动化路径（10 分钟，全部一条命令搞定的部分）
> 路径变了，以下要重新指向新位置：
>
> | 组件 | 怎么改 |
> | --- | --- |
> | 巡检/蒸馏 launchd | 在**新路径**下重跑 `03-Agents/automation/bin/rtk install-launchd`（plist 内嵌绝对路径，必须重装） |
> | 自动备份 launchd | 新路径下 `rtk backup-auto on` |
> | 磁盘访问权限 | 不用动——python3 的授权跟可执行文件走，与库位置无关 ✅ |
> | iOS 快捷指令 | 改投递目标：新库不在 iCloud 后快捷指令写不进 `.queue` → **改投 NAS OS-Inbox**（夜巡已会扫描）或继续投旧 iCloud 路径专用目录由 NAS 中转 |
> | 旧 crontab 备份脚本 | `（如有旧备份脚本指向其他库，与本库无关） |

> [!example]+ Step 5 · 修复 OS-MIND（Hermes）与 Hindsight 引用（5 分钟）
> **OS-MIND（`~/.hermes`）三个文件里的库路径**：
> - `SOUL.md` 工作范围里的【主库】路径
> - `memories/MEMORY.md` 迁移总纲里的主库路径 + ops-log 路径
> - `skills/note-taking/personal-os/SKILL.md` 的库根路径
> （让 Claude 一句话批量替换：旧 iCloud 路径 → `~/Vaults/NEW PERSONAL OS`）
>
> **Hindsight**：三个 bank 的 mission 里写有库路径，迁移后让 Claude 跑一次
> `update_bank` 更新 mission 文案 + 加一条新 directive 注明路径变更日期即可。
> （事实数据不受影响——retain 的 document_id 是库内相对路径，天然不变 ✅）

> [!success]+ Step 6 · 验收清单
> - [ ] `rtk status` 根目录显示新路径
> - [ ] `launchctl start com.personalos.patrol` → 日志正常写入
> - [ ] 手机 Obsidian 打开任意笔记 < 3 秒
> - [ ] 手机改一行 → Mac 10 秒内看到
> - [ ] `rtk backup` 三链路成功

> [!tip] 设计上已为你减负的部分
> 引擎全部「路径自洽」（从自身位置反推库根），插件全部用库内相对路径，
> 密钥在库外 `~/.personal-os/`——所以迁移成本只剩上面这一页。
