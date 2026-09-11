# Headless Automation Plan: 连接器查询对齐 R1.5

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute
- Parent: `docs/automate/plans/2026-07-10-architecture-improve-exhaustive.md` §Wave R1.5

## 目标

打通 CONN-Q-01~09、CONN-Q-19 的 SQL 查询主路径；types API 与 FE 标注 `queryCapable`。

## 范围

- **包含**：`query/capabilities.py` 别名；`get_sql_dialect`；`native/guard` 路由；`export_type_catalog`；FE taxonomy + 选型副标题
- **不包含**：CONN-Q-10~24（R1.5-D/E 排期）；compose 真机集成测

## 任务

1. [x] 新增 `CONNECTOR_SQL_DIALECT_ALIASES` + `is_query_capable`
2. [x] `get_sql_dialect` / `resolve_query_mode` 消费别名
3. [x] types API `queryCapable` + `queryMode`
4. [x] FE `connector-taxonomy` + 选型「仅连接」副标题
5. [x] pytest `test_r15_connector_query_align.py`

## 验收

```bash
cd backend && python -m pytest ../tests/test_r15_connector_query_align.py -q
cd fe && npx vitest run src/lib/connector-taxonomy.test.ts --reporter=dot
```
