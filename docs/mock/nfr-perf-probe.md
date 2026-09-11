# NFR 性能 / 可用性 Mock 探针

| 字段 | 值 |
|------|-----|
| 模块 | `backend/app/core/nfr/dashboard_first_screen.py` · `dashboard_sla.py` · `dashboard_availability.py` · `report_perf.py` |
| 关联 API | `api/v1/nfr.py` — `dashboard-first-screen/probe` · `dashboard-sla/probe` · `dashboard-availability/smoke|report` · `report-query-perf/probe` |
| 域附录 | [services/nfr.md](../services/nfr.md) · [services/core.md](../services/core.md) |

## 行为

- 首屏 / SLA / 看板可用性 / 报表查询性能探针在未接真实指标源时返回**硬编码或预算阈值派生**的 `withinBudget` / `available` / `elapsedMs`，可被验收脚本误判为真实 SLO。
- `dashboard_availability` 部分字段比较的是预算阈值而非实测耗时（见 code-reviewer 对账）。

## 非 mock 路径

报表调度真实执行与 SMTP/企微 httpx 投递见 [reports-scheduler.md](./reports-scheduler.md)（与 [nfr-push.md](./nfr-push.md) 双轨，勿混用 env 语义）。

## 计划

接真实指标源或探针响应显式 `fixture: true`；未就绪时管理面/API 返回 `degraded` 而非 `available`。
