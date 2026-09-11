# 证据袋 · 三类日志分轨

```yaml
scope: three-tier-logging
date: 2026-08-09
domain_strength: mixed
```

## E1 · 生产红线（R2）

- `.cursor/rules/production.mdc`：结构化 JSON；`traceId`；按大小/时间滚动 + 保留；分类 **请求 / 进程 / 作业**；统一 mask；禁裸 print
- `.cursor/rules/backend-fastapi.mdc`：结构化 JSON + `TraceIdMiddleware`

## E2 · PRD / BOOT-004

- `docs/automate/prd/F01-BOOT.md` BOOT-004：**已实现** — 仅「环境变量可加载」「结构化日志输出请求 traceId」
- 演化建议已列 LOG_LEVEL 热切换测试；**未**验收分轨文件与轮转

## E3 · 当前实现

- `backend/app/core/logging.py`：单一 `StreamHandler` → stdout；`JsonFormatter`（timestamp/level/logger/message/traceId + method/path/status_code）
- `backend/app/core/middleware/__init__.py`：`vitalspan.http` · `request_started` / `request_finished`
- `backend/app/main.py`：`configure_logging` 于启动；lifespan 内 seed/warm 用 `getLogger(__name__)`
- **无** `request.log`、**无** `RotatingFileHandler`、**无** `category` 字段、**无** `LOG_DIR` env

## E4 · 作业状态（DB 真源，非日志文件）

| 表/模型 | 域 | 字段含 trace |
|---------|-----|--------------|
| `ingestion_sync_runs` | ingestion | `trace_id`, status, error_message |
| `report_schedule_executions` | reports scheduler | execution 记录 |
| `report_jobs` | reports | job_kind, status, error_message |
| `report_delivery_attempts` | reports | channel, status, error_message |
| `auth_audit_events` | auth | **业务审计**（权限变更），非应用日志 |

## E5 · 作业 scattered logging

- `ingestion/sync_consume.py`, `analytics_datasource.py`：`logger.info/warning`
- `reports/scheduler/delivery_adapter.py`, `channels/dispatch.py`：失败 warning
- 无统一 `vitalspan.job.*` logger；异步任务 traceId 传播未系统化

## E6 · 测试契约

- `tests/test_trace.py`：18 项 traceId + LOG_LEVEL；针对 `vitalspan.http` StringIO handler
- 无分轨文件、无 job category 测试

## E7 · 文档

- `docs/service/backend.md`：仅描述 stdout JSON；未登记三文件
- `docs/services/nfr.md`：未覆盖日志分轨

## selection_constraints

| id | topic | status | evidence | blocks_flows | action |
|----|-------|--------|----------|--------------|--------|
| S1 | 日志落盘：stdout 默认 vs 可选文件轮转 | assumed | E1/E3；政企裸机 vs K8s 采集惯例 | F5 | assume（确认面请用户裁定默认） |
| S2 | 作业：DB 状态真源 + 日志诊断事件 | anchored | E4；council 共识 | F4 | none |
| S3 | JSON + traceId 信封 | anchored | BOOT-004 E2/E3 | F2 | none |
| S4 | 脱敏：日志字段经 core mask | assumed | production R2；当前 JsonFormatter 无 mask | F1,F2,F4 | assume |

## 场景对照（业内）

| 场景 | 业内惯例 | VitalSpan 现状 | 偏离 |
|------|----------|----------------|------|
| K8s / compose | stdout JSON → 采集器 | ✅ stdout JSON | 缺 category 字段供采集规则 |
| 政企裸机 | `/var/log/<app>/*.log` 轮转 | ❌ | 无文件 Handler |
| 请求排障 | access/request 日志可筛 path/status | 部分（http logger） | 无独立 request 轨文件名约定 |
| 批作业 | job log + DB run 表关联 jobId/traceId | DB 有；日志散落 | 无 job 轨统一事件名 |
| 安全审计 | 权限审计入审计表 + 不可篡改 | `auth_audit_events` | 与「作业功能日志」不同类，勿混 |

## Council（独立 Task · architecture+product+plan）

- 三席：**revise → approve**
- 建议：新 PRD 切片 `NFR-R2-LOG`；不 reopen BOOT-004 勾选
- veto 项：日志替代 DB 作业历史；强制三文件硬编码无配置
