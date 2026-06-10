# 🚀 OBSIDIAN AI OS — NEW PERSONAL OS

> **系统宪法 v2.0** | 构建者：Claude Fable 5 | 初始化 2026-06-10 · 同日完成旧库深度重构吸收
> 核心哲学：**做减法是美德 · 系统包裹化 · 多端联动**

---

## 一、系统定位

本目录是一个完整的个人操作系统（Personal AI OS），由传统的 11 级流水线 / 17 个目录
深度剪枝重构为 **5 大高语义顶层目录**。所有底层配置、Schema、模版、日志全部
"包裹化"隐藏于 `.system/`，用户视角保持绝对极简。

## 二、目录架构（不可随意增加顶层目录）

```text
NEW PERSONAL OS/
├── HOME.md            # 系统主页（Dataview 看板入口）
├── 01-Inbox/          # 统一中央收件箱（Phone/PC/Mac 全汇聚；legacy/ 为旧库待办迁置区）
├── 02-Memory/
│   ├── dynamic/       # 动态流：journal 日记 · ops-log(巡检/任务清单/账本) · tasks(TaskNotes) · raw(六大生活域原始层)
│   └── static/        # 静态库：os(含 profile 个人画像9块) · projects · learning(含 wiki)
├── 03-Agents/         # Hermes 核心 · automation(rtk CLI) · workflows(12类工作流SOP) · coding-standards
├── 04-Output/         # Report / Content / Summary / Dashboard(生活·项目·记忆看板)
└── .system/           # 【包裹化】schemas(三件套+metadata+security) · templates(25+) · config · reference(旧库规则原件,只读) · logs
```

### 各支柱职责铁律

| 目录 | 唯一职责 | 禁止事项 |
| --- | --- | --- |
| `01-Inbox` | 一切外部输入的唯一落点，**只进不存**，每日由 Hermes 清空分发 | 禁止手工长期存放文件 |
| `02-Memory` | `dynamic/` 动态流（ops-log、日记三件套）+ `static/` 静态库（os/projects/learning） | 禁止存放未消化的原始素材 |
| `03-Agents` | 所有脚本、Agent 配置、Cron 任务、编码规范 | 脚本严禁写出到用户层目录之外的位置 |
| `04-Output` | 纯粹的高价值资产发布区（Report/Content/Summary） | 禁止作为素材堆放地 |
| `.system` | Schema、模版、配置、运行日志 | 用户日常无需进入 |

## 三、数据流（单向，不可逆流）

```
Phone/PC/Mac 输入
      │  (提问式交互 → AI 结构化提炼)
      ▼
  01-Inbox  ──每日 Hermes 分发──▶  02-Memory ──沉淀提纯──▶  04-Output
      ▲                                │
      └────── .system/schemas 约束格式 ─┘
```

1. **Ingest**：移动端凌乱文本经 `03-Agents/automation/bin/ingest.py` 按
   `.system/schemas/ingest-protocol.md` 提炼为标准 Markdown，单向推入 `01-Inbox/`。
2. **Dispatch**：Hermes 每日巡检，将 Inbox 条目按类型分发至 `02-Memory/dynamic/`
   对应位置，并固化当日 ops-log。
3. **Distill**：高价值内容由 Agent 消化后，按 `.system/templates/` 规范产出至 `04-Output/`。

## 四、多端适配

| 终端 | 场景 | 技术支撑 |
| --- | --- | --- |
| **Mac / PC** | 深度工作站、AI 编程、知识架构调整 | Obsidian 桌面端 + Claude Code 联动 |
| **Phone** | 碎片化输入（日记/速记/Task 打勾/消费记录） | **默认方案 A**：iOS 快捷指令 → `ingest.py`（经 iCloud/Syncthing 同步目录中转）<br>**预留方案 B**：Telegram/微信 Bot Webhook 适配器（见 `.system/config/os.config.yml` 的 `ingest.adapters`） |

> 移动端适配器是可插拔的：两套方案共用同一条 `ingest.py` 管线，
> 切换只需改 `os.config.yml` 中的 `ingest.active_adapter`，不影响任何下游逻辑。

## 五、Agent 铁律（Hermes 及一切自动化）

1. **本地验证优先**：故障排查必须"先本地状态验证，后远程原因推导"，拒绝虚假 claim。
2. **包裹化**：所有 shell/python 脚本只能存在于 `03-Agents/automation/`，
   通过 `bin/rtk` 统一 CLI 入口调用。
3. **务实选型**：日常自动化优先用高性价比模型（DeepSeek API 等）；
   复杂系统重构与工程任务交由 Claude Code 调度。
4. **无感执行**：Cron 任务静默运行，结果只写 `.system/logs/`，异常才上浮到 Inbox。

## 六、快速上手

```bash
# 统一 CLI 入口（所有系统操作都从这里走）
03-Agents/automation/bin/rtk help        # 查看所有命令
03-Agents/automation/bin/rtk ingest "凌乱的一段速记文本"   # 手动模拟移动端入流
03-Agents/automation/bin/rtk patrol      # 手动触发一次 Hermes 日巡检
03-Agents/automation/bin/rtk status      # 系统健康状态
```

详细文档索引：
- 入流协议 → [.system/schemas/ingest-protocol.md](.system/schemas/ingest-protocol.md)
- 三件套 Schema → [.system/schemas/](.system/schemas/)
- 统一元数据规范 → [.system/schemas/metadata.schema.md](.system/schemas/metadata.schema.md)
- **权限锁定与隐私** → [.system/schemas/security.schema.md](.system/schemas/security.schema.md)
- Hermes 设计 → [03-Agents/hermes/HERMES.md](03-Agents/hermes/HERMES.md)
- 工作流 SOP → [03-Agents/workflows/](03-Agents/workflows/)
- 输出规范 → [04-Output/OUTPUT-SPEC.md](04-Output/OUTPUT-SPEC.md)
- Hindsight 对接 → [.system/config/HINDSIGHT.md](.system/config/HINDSIGHT.md)

## 七、权限锁定（摘要）

带 `ai-editable: false` 的文件与 `.system/schemas|config|reference`、个人画像
`static/os/profile/`、`03-Agents/` 行为定义，AI 修改前必须获得用户**当次明确授权**；
`private: true` 内容绝不进入 `04-Output/` 与任何汇总；`.system/reference/` 已在
文件系统层面 chmod 只读。完整矩阵见 [security.schema.md](.system/schemas/security.schema.md)。
