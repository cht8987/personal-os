# 记忆引擎：双层架构

## 设计原则

**Vault 文件 = 事实源（Source of Truth）**：人类可读、可编辑、可双链导航。
**语义召回引擎 = 索引**：跨文档检索与时间线推理，供 AI 会话使用。
引擎永远是可替换的索引，不是档案本体——删掉重建索引不丢任何数据。

## 推荐对接：Hindsight

[Hindsight](https://github.com/vectorize-io/hindsight) 提供 bank 隔离、
事实抽取、时间感知召回。建议三个 bank 对应静态库三大块：

| Bank | 对应目录 | 内容 |
| --- | --- | --- |
| `bank-os` | `02-Memory/static/os/` | 个人画像、原则、系统治理教训 |
| `bank-projects` | `02-Memory/static/projects/` | 项目状态与决策 |
| `bank-learning` | `02-Memory/static/learning/` | 知识锚点与 Wiki |

工作流：静态库固化新知识 → retain 进对应 bank（document_id 用文件路径保证可溯源）；
AI 处理涉历史决策的任务前先 recall。隐私铁律：`private: true` 内容只 retain
抽象模式（"现金流偏紧张期"），禁止具体数字。

## 备选方案

| 方案 | 适合 | 代价 |
| --- | --- | --- |
| **不接引擎**（纯 Dataview + 全文搜索） | 起步阶段，<1000 笔记 | 无语义召回 |
| **本地嵌入**（sqlite-vec + ollama embeddings） | 离线优先、隐私极致 | 自己维护索引管线 |
| **Hindsight** | 需要事实级召回与时间推理 | 常驻服务（Docker） |

> 建议路径：起步不接 → 笔记过千后接 Hindsight。本系统的分流与归档
> 不依赖任何记忆引擎，引擎只增强 AI 会话的召回质量。
