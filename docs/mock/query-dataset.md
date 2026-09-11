# Query Dataset Execute Stub

| 字段 | 值 |
|------|-----|
| 模块 | `backend/app/query/dataset/executor.py` |
| 域附录 | [services/query.md](../services/query.md) |

## 行为

部分 Dataset execute 路径返回 **stub plan**（非真实 SQL 执行），用于 M3-LITE 占位与契约回归。

## 边界

- 真实查数走 `query/engine/execute` 或已接线的 `execute_dataset_from_config`。
- 文档与 PRD 不得将 stub plan 表述为「全量 Dataset 引擎已交付」。

## 计划

M13 Dataset 建模与执行链完善后移除或收窄 stub 面；见 [automate/plan.md](../automate/plan.md)。
