# 🧠 PERSONAL OS

> An AI-powered second brain on plain Markdown — capture anything, let agents organize everything.
> 基于纯 Markdown 的个人 AI 操作系统：你只管丢想法，系统自动分类、归档、提醒、沉淀。

**核心哲学：做减法是美德 · 系统包裹化 · 多端联动**

## 它解决什么问题

传统笔记系统要求你"先想清楚放哪、打什么标签"——认知负担全在你身上。
Personal OS 反过来：**唯一动作是把想法丢进 Inbox**，AI 管线自动拆分为
日记 / 待办 / 账单 / 学习笔记 / 个人画像变更，夜间管家自动归档并生成日报。

## 系统结构（5 大支柱）

```
PERSONAL OS/
├── HOME.md          # 主页看板（待办/日记/项目/账单一屏总览）
├── 01-Inbox/        # 唯一入口：一切输入先到这里
├── 02-Memory/       # 双轨记忆：dynamic 动态流 + static 静态知识库
├── 03-Agents/       # 引擎舱：rtk CLI · Hermes 夜间管家 · 自动化脚本
├── 04-Output/       # 高价值产出：周报/创作/摘要/看板
└── .system/         # 包裹化隐藏：Schema·模版·配置·日志
```

## 快速开始

```bash
git clone https://github.com/cht8987/personal-os.git
cd personal-os && ./install.sh   # 交互式安装：选择库位置 → 自动配置
```

然后：

1. 用 [Obsidian](https://obsidian.md)（免费）打开生成的库
2. 阅读库内 `START-HERE.md`（10 分钟新手引导）
3. 运行 `rtk onboard` 设定个人画像
4. 把第一个想法丢进 Inbox 🎉

## 特性

- **五类实体自动分流**：一段凌乱语音转文字 → 日记+待办+账单+学习+画像，全自动
- **零依赖引擎**：纯 Python 标准库，macOS 自带环境直接跑；无 API Key 时降级规则引擎，**绝不丢数据**
- **可插拔 LLM**：默认 DeepSeek（高性价比），一行配置切换任意 OpenAI 兼容 API
- **夜间管家 Hermes**：launchd 定时巡检（睡眠错过自动补跑），分发归档 + 日报 + 滞留告警
- **权限锁定**：S0–S3 数据分级、`private: true` 隐私铁律、AI 目录权限矩阵、画像变更须人工确认
- **多端输入**：桌面 Obsidian 插件引导式提问 / CLI / iOS 快捷指令，共用同一条管线
- **记忆引擎可选对接**：支持 [Hindsight](https://github.com/vectorize-io/hindsight) 语义召回（见 docs/MEMORY-ENGINE.md）

## 文档

- [架构设计](docs/ARCHITECTURE.md) — 数据流、五支柱铁律、安全模型
- [移动端路线图](docs/MOBILE-ROADMAP.md) — 快捷指令 → Bot → 自有 App 三阶段
- [记忆引擎](docs/MEMORY-ENGINE.md) — 双层记忆架构与 Hindsight 对接

## 许可

MIT — 自由使用、修改、分发。Obsidian 为第三方商业软件（个人使用免费），本项目仅以其为可替换的显示层。
