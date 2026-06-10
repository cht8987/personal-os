# 04-Output 输出看板规范

> 决策高地。**不是素材堆放地**——只允许存放最终态的高价值资产。

## 三类产出

| 类型 | 目录 | 命名 | 模版 |
| --- | --- | --- | --- |
| **Report** 周/月度深度分析 | `Report/` | `report-YYYY-Www.md` / `report-YYYY-MM.md` | `.system/templates/report.template.md` |
| **Content** 结构化创作/技术沉淀 | `Content/` | `content-<slug>.md` | 自由格式，但必须含 frontmatter |
| **Summary** 高维信息摘要 | `Summary/` | `summary-YYYY-MM-DD-<slug>.md` | `.system/templates/summary.template.md` |

## 准入铁律

1. 任何文件必须含 frontmatter：`type / date / status: final`。
2. 草稿不入库——草稿在 `02-Memory` 里打磨，只有 `status: final` 才移入本目录。
3. Report 的数据来源必须可溯源（引用 ops-log / cost 账本的具体文件）。
4. 产出由人触发 Claude Code 生成；Hermes 不在此目录写文件。
