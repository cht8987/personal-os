# 02-Memory 双轨记忆架构

## dynamic/ 动态流（每日自动固化，Hermes 维护）

```
dynamic/
├── journal/YYYY/YYYY-MM-DD.md   # 每日日记（同日多条自动合并）
└── ops-log/
    ├── YYYY-MM-DD.md            # Hermes 日巡检报告
    ├── tasks.md                 # 集中任务清单（移动端打勾的唯一入口）
    └── cost-YYYY-MM.md          # 月度账本
```

## static/ 静态库（Hindsight 记忆引擎维护的知识锚点，人工/Agent 沉淀）

> 与 Hindsight 三个 bank（bank-os/bank-projects/bank-learning）一一对应，
> 对接规范见 [.system/config/HINDSIGHT.md](../.system/config/HINDSIGHT.md)。

```
static/
├── os/          # 个人：身份、原则、长期偏好
├── projects/    # 项目：每个项目一个文件，含状态与决策记录
└── learning/    # 学习：主题笔记，可被精准召回的知识块
```

## 铁律

- 动态流只追加不改写历史；静态库可改写但每次大改在文件头记一行变更日志。
- 未消化的原始素材禁止入库——它们属于 `01-Inbox`。
- 静态库文件命名用 kebab-case 英文 slug，正文中文。
