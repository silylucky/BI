# 核心看板可用性（NFR-003）

> 复合探针：`GET /api/v1/nfr/dashboard-availability/report?dashboardId=`  
> 批量 smoke：`GET /api/v1/nfr/dashboard-availability/smoke`

## 核心看板 ID（r248）

`CORE_DASHBOARD_IDS = ("core-dash", "executive-overview")` — `probe_core_dashboards_smoke()` 遍历批量探针。

## 阈值

| 指标 | 阈值 | 来源 |
|------|------|------|
| SLA uptime | ≥ 99.5% | `dashboard_sla.probe_dashboard_sla` |
| 首屏 P95 | ≤ 5000ms | `dashboard_first_screen` budgetMs；smoke 端点 `p95ThresholdMs` 硬断言 |

## 综合判定

- `overallStatus`: `available` | `degraded` | `unavailable`
- `withinSla && withinFirstScreenBudget` → `available`
- smoke 响应 `allAvailable`：全部看板满足 SLA 与首屏预算

## 环境变量

| 变量 | 说明 |
|------|------|
| 门禁 | 始终 strict | `overallStatus != available` 或 smoke `allAvailable=false` 时 HTTP 503 `DASHBOARD_AVAILABILITY_BREACH` |

## CI / pytest

- 主套件：`tests/test_mfinal_fe_gov_batch3_r247.py`（`T-NFR-R247-003-*`）
- r248 批量 smoke：`tests/test_mfinal_fe_gov_batch4_r248.py`（`@pytest.mark.nfr_dashboard_smoke`）
- 探针预算：`probe_dashboard_availability_budget_ms` ≤ 50ms
