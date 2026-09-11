# Headless Automation Plan: Engine Spec Phase 2 — SQL 方言

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute

## 目标

闭合 CONN-Q-10/11/12：为 sqlite / sqlserver / oracle 注册独立 SqlDialect，接入查询主路径。

## 任务

1. 新增 `query/dialects/sqlite.py`、`sqlserver.py`、`oracle.py`
2. `_REGISTRY` 注册 + `_DIRECT_SQL_DIALECTS` 扩展
3. 方言单测 + 更新 r15 对齐测试
4. 架构债 §2.6 更新（可用 22 型）

## 验收

```bash
cd backend && python -m pytest ../tests/test_r15_phase2_sql_dialects.py ../tests/test_r15_connector_query_align.py -q
```
