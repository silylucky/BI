# Headless Automation Plan: Engine Spec Phase 1 — Native 接线

- Plan type: Headless Automation Plan
- Cursor Build: disabled
- Execution trigger: dev-autopilot A5 plan-execute
- 对标: DataEase CSV/Excel/API 一等数据源；Superset 非 SQL 源走独立执行路径

## 目标

CONN-Q-22/23/24（csv / excel / rest_api）接入查询主路径：连接器已有 `execute_native_query`，补齐白名单与 executor 分发。

## 范围

- **包含**：`query/capabilities.py`、`query/native/executor.py`、回归测试、架构债清单更新
- **不包含**：influx/tdengine（仍 queryCapable=false）、Phase 2 SQL EngineSpec

## 任务

1. `NATIVE_QUERY_CAPABLE` 增加 csv / excel / rest_api
2. Native executor 对 file/api 类型传递 `offset`
3. 更新 `test_r15_connector_query_align.py` + 新增 Phase1 冒烟
4. 更新 `2026-07-10-architecture-improve-exhaustive.md` §2.6

## 验收

```bash
cd backend && python -m pytest ../tests/test_r15_connector_query_align.py ../tests/test_r15_phase1_native_wire.py -q
cd backend && python -m pytest ../tests/test_mfinal_ff_fg_batch1_r249.py -q -k "native_query or routing_mode_native"
```
