# core — 应用内核

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/core/` |
| PRD | [F01-BOOT](../automate/prd/F01-BOOT.md) · BOOT-001 ~ BOOT-006 |
| 里程碑 | M1 |
| 状态 | **已实现** |

## 职责

- 应用配置（`Settings`、环境变量校验）
- FastAPI 应用工厂、`lifespan`、全局异常处理
- 请求 ID、结构化日志、健康检查
- 安全中间件基座（CORS 来源 `Settings.cors_origins` / `CORS_ORIGINS`；鉴权委托 `auth/`）
- 数据库会话 / 依赖注入入口（`get_db`）

## 边界

| In | Out |
|----|-----|
| 配置、日志、中间件、健康端点 | 业务 RBAC（→ `auth`） |
| OpenAPI 元信息与路由挂载 | 领域查询与连接器（→ `query` / `datasources`） |

## 依赖

- 无业务域上游；被所有域服务依赖

## 主要类型 / 入口（M1 已实现）

| 符号 | 说明 | 锚点 |
|------|------|------|
| `app.main:app` | ASGI 入口；中间件与路由挂载 | `backend/app/main.py` |
| `Settings` / `get_settings` | pydantic-settings；含 `cors_origins` 计算字段 | `backend/app/core/config.py` |
| `configure_logging` | JSON 结构化日志 | `backend/app/core/logging.py` |
| `TraceIdMiddleware` | 请求 trace；响应头 `X-Trace-Id` | `backend/app/core/middleware.py` |
| `CORSMiddleware` | 由 `main.py` 挂载；来源 `Settings.cors_origins` | `backend/app/main.py` |
| `GET /health` | 存活探针 | `backend/app/main.py` |
| `core/nfr/runtime_guard.py` | NFR-008 零 DE/SS pyproject 扫描 + 模块探测 | `backend/app/core/nfr/runtime_guard.py` |
| `core/nfr/deployment_report.py` | NFR-008 部署验收报告（`overallAcceptance` + `remediation_index`） | `backend/app/core/nfr/deployment_report.py` |
| `core/nfr/report_perf.py` | NFR-002 报表查询性能 mock probe + budget 守卫 + ACL/sampleQueryId（companion 全量压测留 `tests/perf/nfr01_report/`） | `backend/app/core/nfr/report_perf.py` |
| `core/nfr/dashboard_first_screen.py` | NFR-001 首屏 mock probe + budget 守卫 + ACL/dashboardId pattern（companion 全量压测留 `tests/perf/nfr01_dashboard/`） | `backend/app/core/nfr/dashboard_first_screen.py` |

## 关联 API

见 [api/README.md](../api/README.md) §系统。

## 实现笔记

- 中间件注册顺序（`main.py`）：CORS → TraceId → Auth（后注册者先执行）
- 鉴权逻辑委托 `auth/`；`AuthMiddleware` 由 `main.py` 注册，不在 `core/` 内实现
- r53 NFR-008：`runtime_guard.py` 扫描 pyproject 禁止 superset/dataease 依赖 + 已加载模块探测；`GET/POST /api/v1/nfr/runtime-compliance`；**始终 strict**（无 env 模式开关）
- r57 NFR-008 companion：`deployment_report.py` — `build_deployment_acceptance_report`（`reportVersion=nfr08-deployment-v1`）；`overallAcceptance` accepted/rejected/conditional；`remediation_index` 聚合 fail 项；`GET /api/v1/nfr/runtime-compliance/deployment-report`；`probe_deployment_report_budget_ms` ≤100ms
- r61 NFR-002：`report_perf.py` — 进程内 mock `elapsedMs=120` + budget/sample 守卫；`POST /api/v1/nfr/report-query-perf/probe|validate`；错误码 `REPORT_PERF_*`
- r64 NFR-001：`dashboard_first_screen.py` — 进程内 mock `elapsedMs=800` + budget/widget 守卫；`POST /api/v1/nfr/dashboard-first-screen/probe|validate`；错误码 `DASHBOARD_FIRST_SCREEN_*`
- **r67 NFR-001 companion**：`set_user_first_screen_scope` + `DASHBOARD_FIRST_SCREEN_FORBIDDEN` / `INVALID_DASHBOARD_ID`；`probe_validate_first_screen_budget_ms` / `probe_first_screen_probe_budget_ms` ≤50ms
- **r67 NFR-002 companion**：`set_user_report_perf_scope` + `REPORT_PERF_FORBIDDEN` / `INVALID_SAMPLE_QUERY`；`simulateFailure` 降级链；双 probe ≤50ms
- **r68 NFR-003 companion**：`dashboard_sla.py` — `set_user_dashboard_sla_scope` + `DASHBOARD_SLA_FORBIDDEN` / `INVALID_DASHBOARD_ID` / `ALERT_THRESHOLD_OUT_OF_RANGE`；`validate_dashboard_sla` / `probe_dashboard_sla` actor 透传；`get_dashboard_sla_alerts(thresholdPercent)`；`probe_validate_dashboard_sla_budget_ms` / `probe_dashboard_sla_probe_budget_ms` ≤50ms
- **r68 NFR-004 companion**：`https_audit.py` — `auditScope` ACL（`set_user_https_audit_scope` + `HTTPS_AUDIT_FORBIDDEN` / `INVALID_SCOPE`）；`simulateAuditFailure`；`probe_https_mask_budget_ms` / `probe_https_status_budget_ms` ≤50ms
