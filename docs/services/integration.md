# integration — 对外集成 API 门面

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/integration/` |
| PRD | [F13-API](../automate/prd/F13-API.md)（API-003~007） |
| 里程碑 | M8 / M12 / M13 |
| 状态 | **companion 已实现（r45 + M-DEPTH F-C · 2026-07-29）** |

## 职责

- IF-01 总线注册适配编排（`bus_register` → catalog + `governance/bus/adapter`；发布自动注册）
- IF-02 已发布查询服务列表/详情/OpenAPI 片段/执行（`query_services`；参数校验、幂等、publish）
- IF-03 报表导出同步生成与下载（`reports_export`；DB `report_integration_exports` + FS 产物；**真实模板渲染失败 → 502 `REPORT_EXPORT_GENERATION_FAILED`**，禁止 silent minimal 产物假成功；内置 seed 模板仍走显式 minimal 合法 PDF/OOXML）
- IF-04 门户嵌入 token 签发与 SDK 参数解析（`embed_token` + `embed_tokens` 表 TTL；过期码、resolve origin 守卫）
- 统一 `IntegrationError` 错误域

## 边界

| In | Out |
|----|-----|
| catalog 已发布条目、bus adapter、seed 报表模板、embed origin 校验 | 真实总线 HTTP 对接（→ GOV-007+） |
| viz.embed `_ORIGIN_RE` 复用 | 真实 Word/PDF/Excel 渲染引擎与对象存储（→ `reports`） |
| `governance.catalog.publish_entry` draft→published | 前端 SDK 与 iframe 页面（→ `fe/`） |
| OpenAPI v2 文档面（无真实 `/api/v2/*` 路由） | 前端 SDK 与 iframe 页面（→ `fe/`） |
| `integration_idempotency_records` 查询执行幂等 | 真实总线 HTTP 对接（→ GOV-007+） |

## 依赖

- `governance.catalog` — 已发布服务列表、总线登记、`publish_entry`
- `governance.bus.adapter` — `BusAdapter` / `register_with_retry`
- `viz.embed` — origin 正则校验
- `auth` — `UserContext` 角色守卫（`integration` / `admin` / `dashboard:share`）
- `core.logging` — `trace_id_var`

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `IntegrationError` | 集成 API 统一错误 | API-003~007 | 已实现 |
| `list_published_services` / `execute_published_service` | IF-02 查询服务门面（`;requires=` 校验、`Idempotency-Key`） | API-003 | companion |
| **FE** | `QueryServicesPage` · `QueryServiceTrialSheet` · `queryServicePathUtils`（试跑 + OpenAPI + 参数表单） | API-003 | M-DEPTH F-C · 2026-07-29 |
| `publish_service` | draft→published + 自动总线注册 | API-003/004 | companion |
| `register_catalog_to_bus` / `register_on_publish` | IF-01 总线注册 + retry + payload 校验 | API-004 | companion |
| `create_export_request` / `get_export_status` / `get_export_file` | IF-03 同步生成 + 下载 | API-005 | companion |
| `issue_embed_token` / `resolve_sdk_params` | IF-04 嵌入 token（过期/origin 守卫） | API-006 | companion |
| `GET/POST /api/v1/services*` · `POST .../publish` | IF-02 entry | API-003 | companion |
| `POST /api/v1/integration/bus/register` | IF-01 entry | API-004 | companion |
| `GET /api/v1/reports/export` · `GET .../{exportId}` · `GET .../download` | IF-03 entry | API-005 | companion |
| `POST /api/v1/embed/token` · `GET /api/v1/embed/sdk-params` | IF-04 entry | API-006 | companion |
| `openapi/version_policy.apply_version_policy` | v1/v2 文档面 + IF tag + stability | API-007 | companion |

## OpenAPI 运行时与版本策略

| 锚点 | 说明 |
|------|------|
| `backend/app/openapi/` | OpenAPI 后处理：`extensions.py` · `version_policy.py` |
| `GET /openapi.json` | 运行时规范；`x-api-version-policy` · IF tag · operationId 前缀 |
| `backend/app/governance/openapi/` | 治理侧 OpenAPI 片段生成（catalog 已发布服务） |
| `GET /docs` · `GET /redoc` | Swagger UI / ReDoc（免鉴权） |

**说明**：`info.x-supported-versions` 含 `v2` **文档面**；运行时 HTTP 仍委托 `/api/v1/*`（无真实 `/api/v2/*` 路由）。

## 内置 sample-api（REST 连接器联调）

供 `datasources` REST API 连接器本地测连与 Native 查询；挂载于主应用根路径（非 `/api/v1`）。

| 路径 | 说明 | 代码锚点 |
|------|------|----------|
| `GET /sample-api/health` | 存活 | `backend/app/sample_api/router.py` |
| `GET /sample-api/orders` | 订单列表样例 | Native body: `{"path":"/sample-api/orders"}` |
| `GET /sample-api/v1/orders` | 包装 JSON（`jsonPath` 演示） | `internal.py` dispatch |
| Basic Auth | 可选 | `HTTPBasic` · `SAMPLE_API_*` env（见 `.env.example`） |

## 关联 API

见 [api/README.md](../api/README.md) §5（嵌入）、§6（报表）、§8（查询服务与 IF-01）。

## 实现笔记

- 不新增 Alembic migration；`_EXPORT_STORE`、`_IDEMPOTENCY_STORE`、`_TOKEN_STORE` 为进程内 companion store。
- `POST /gov/bus/register`（GOV-002）与 `POST /integration/bus/register`（IF-01）并存：前者 admin-only PoC，后者 integration/admin 开放集成路径。
- `POST /charts/embed/validate`（VIZ-006）校验配置；`POST /embed/token`（IF-04）签发运行时 token。
- OpenAPI `info.x-supported-versions` 含 `v2` 文档面；运行时仍委托 `/api/v1/*`。
