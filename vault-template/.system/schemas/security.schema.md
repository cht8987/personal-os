---
title: Security Schema · 权限锁定与隐私规范
type: system
version: "2.0"
status: active
ai-editable: false
---

# 权限锁定与隐私规范（蒸馏自旧库 08-Security + 11-AI-Policies，原件见 .system/reference/）

## 一、数据安全四级（沿用旧库 S0–S3）

| 级别 | 内容 | 保护方式 |
| --- | --- | --- |
| **S0 公开** | 普通笔记、Wiki | 无 |
| **S1 私密** | 个人感受、关系细节 | frontmatter `private: true` |
| **S2 敏感** | 财务数字、医疗信息 | `private: true` + 不入任何汇总 |
| **S3 机密** | 密码、API Key、凭证 | **禁止存入 Vault**（用密码管理器；脚本凭据只走环境变量） |

## 二、AI 目录权限矩阵（权限锁定核心）

| 目录 | AI 读 | AI 写 | 说明 |
| --- | --- | --- | --- |
| `01-Inbox/` | ✅ | ✅ | ingest 唯一写入口；分发后清空 |
| `02-Memory/dynamic/` | ✅ | ✅ 仅追加 | 禁止改写历史记录 |
| `02-Memory/static/os/profile/` | ✅ | ⚠️ 须用户确认 | 个人画像，AI 不得擅自改写 |
| `02-Memory/static/`（其余） | ✅ | ✅ | 知识沉淀区 |
| `03-Agents/` | ✅ | ⚠️ 须用户确认 | 改 Agent 行为 = 改系统，需授权 |
| `04-Output/` | ✅ | ✅ 仅 final | 草稿禁入 |
| `.system/schemas/` `.system/config/` | ✅ | ❌ `ai-editable: false` | 规则层，仅用户显式授权可改 |
| `.system/reference/` | ✅ | ❌ 只读 | 旧库规则原件，冷参考 |
| `.system/logs/` | ✅ | ✅ | 仅 Hermes 追加 |
| 迁移前的旧库 `legacy/`（整库） | ✅ | ❌ 只读冷归档 | 永不写入 |

执行机制：带 `ai-editable: false` 的文件，任何 Agent 修改前必须获得用户当次明确授权
（旧库 2026-05-26 已确立此先例：现场豁免一次性有效，不可延续）。

## 三、private: true 处理铁律（沿用旧库规则）

- ❌ 私密内容禁止写入 `04-Output/` 任何文件（含周报、月报、仪表盘查询结果）
- ❌ AI 不主动检索私密文件，除非任务明确要求
- ✅ 可读取以提供当次会话上下文；可给分析建议但不引用原文
- ✅ 记忆固化只允许**模式与倾向**（"现金流偏紧张期"），禁止**具体数字**（余额/债务额）
- 归档时 `private: true` 标注永不去除；归档日志只记路径不记摘要
- Hindsight retain 同样遵守：私密事实只存抽象模式，不存具体数字

## 四、违规处理

1. 立即删除违规输出 → 2. 在当日 ops-log 记录事件 → 3. 检查并修补对应规则
