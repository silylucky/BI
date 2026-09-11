# M8/M12/M13 集成 API L1 kickoff r44 设计 — API-003/004/005/006/007

```yaml
date: 2026-07-04
milestone: M8/M12/M13
round_target: docs/superpowers/evolution/2026-07-04-round-target-r44.md
prd_ids: [API-003, API-004, API-005, API-006, API-007]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | IF | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|-----|:--------:|------------|----------|
| 1 | 查询服务 API | API-003 | IF-02 | 1（最低分 11.3） | 完整度 **5%→≥60%**；可靠性 **0%→≥40%**；测试 **0%→≥50%** | 外部系统可列举并调用已发布查询服务（骨架契约） |
| 2 | 报表文档 API | API-005 | IF-03 | 2 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 外部系统可按模板/时间获取报表导出元数据与导出入口（骨架） |
| 3 | 总线注册适配 | API-004 | IF-01 | 3 | 完整度 **5%→≥60%**；可靠性 **0%→≥40%** | 已发布查询服务可向数据交换总线注册；失败可重试 |
| 4 | 门户嵌入 API | API-006 | IF-04 | 4 | 完整度 **5%→≥60%**；安全性 **13%→≥40%** | 门户可签发 embed token 并获取 SDK 初始化参数 |
| 5 | OpenAPI 规范与版本策略 | API-007 | — | 5 | 完整度 **5%→≥60%**；架构 **12%→≥40%** | `/docs` 展示 IF 路由分组与版本策略声明 |

**依赖链**：`integration/errors.py`（共享错误基类）→ `query_services.py`（API-003）→ `bus_register.py` + `governance/bus/adapter.py`（API-004，复用 catalog 登记）→ `reports_export.py`（API-005）→ `embed_token.py`（API-006，复用 `viz.embed.is_origin_allowed`）→ `api/v1/{services,integration_bus,reports,embed}.py` 四路由簇 → `openapi/version_policy.py` + `extensions.py` IF tag 注入（API-007）→ `tests/test_integration_api_l1_r44.py` smoke → r31 `test_view_gov_api_r31` 回归 → P5 目标各 ID 加权总分脱离 11–13 骨架档（60–70 量级；破 90 留 companion 轮）。

**上轮已交付（本轮不重复）**：r30/r31 `gov.py` catalog + `POST /gov/bus/register`（GOV-002，**IF-06 内部治理**）；r42 `viz/embed.py` + `POST /charts/embed/validate`（VIZ-006，**图表嵌入配置校验**）；r31 `openapi/extensions.py` IF-06 datasources/execute 示例与 tag。

**IF 职责边界注记**（真理源：`round-target` > `prd/F13-API.md` > `docs/api/README.md`）：

| 能力 | 既有路由（不重复实现） | 本轮 IF 对外路由（新建） |
|------|------------------------|--------------------------|
| 总线登记 | `POST /api/v1/gov/bus/register`（admin，IF-06） | `POST /api/v1/integration/bus/register`（IF-01 集成门面） |
| 嵌入配置校验 | `POST /api/v1/charts/embed/validate`（VIZ-006） | `POST /api/v1/embed/token`（IF-04 token 签发） |
| 查询执行 | `POST /api/v1/query/execute`（IF-06） | `POST /api/v1/services/{serviceId}/execute`（IF-02 已发布服务门面） |

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M8 查询服务治理 + §M6 报表 + §M4/M5 嵌入；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `api/v1/router.py` | 无 `services`/`embed`/`reports` 路由；`gov.py` 已有 catalog + bus PoC |
| `governance/bus/poc.py` | `InMemoryBusPoCAdapter` + `BusRegisterResult`；**无** `adapter.py`、**无** retry |
| `governance/catalog/service.py` | `register_entry_to_bus()` 幂等 201/200；draft 拒绝；失败码映射 400/502/504 |
| `governance/catalog/schemas.py` | `CatalogEntryOut.status` 默认 `draft`；无 `published` 枚举约束 |
| `viz/embed.py` | `is_origin_allowed()` + `ChartEmbedConfig`；**无** token 签发 |
| `openapi/extensions.py` | IF-06 tag + datasources/execute 示例；**无** IF-01~04 tag、**无** 版本策略扩展 |
| `core/config.py` | `api_openapi_version: "0.1.0"` |
| `docs/api/README.md` | §8 已规划 `GET /services`、`GET /services/{id}/openapi`；§5 `POST /embed/token`；§6 `GET /reports/export` — 均为「规划」 |
| `test_view_gov_api_r31.py` | 24 条 gov/bus 回归；本轮不删 |

**范围框定模块**（3 ≤ 3）：

1. `backend/app/integration/` — IF 域编排（query services / bus / reports / embed）
2. `backend/app/api/v1/` — 集成 API 路由簇 + `governance/bus/adapter.py` 薄提取
3. `backend/app/openapi/` — 版本策略与 IF tag 后处理

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/integration/__init__.py` | 全部 | 新建 |
| `backend/app/integration/errors.py` | 全部 | 新建：`IntegrationError` 基类 |
| `backend/app/integration/query_services.py` | API-003 | 新建：已发布服务列表/详情/execute 门面 |
| `backend/app/integration/bus_register.py` | API-004 | 新建：IF-01 登记 + retry 编排 |
| `backend/app/integration/reports_export.py` | API-005 | 新建：导出元数据 + 任务骨架 |
| `backend/app/integration/embed_token.py` | API-006 | 新建：token 签发 + SDK 参数 |
| `backend/app/governance/bus/adapter.py` | API-004 | 新建：从 `poc.py` 提取 `BusAdapter` 协议 + `InMemoryBusAdapter` + `register_with_retry()` |
| `backend/app/api/v1/services.py` | API-003 | 新建：IF-02 路由 |
| `backend/app/api/v1/integration_bus.py` | API-004 | 新建：IF-01 路由 |
| `backend/app/api/v1/reports/export.py` | API-005 | 新建：IF-03 路由（单文件 export 入口） |
| `backend/app/api/v1/embed.py` | API-006 | 新建：IF-04 路由 |
| `backend/app/api/v1/router.py` | 全部 | 修改：挂载四路由 |
| `backend/app/openapi/version_policy.py` | API-007 | 新建：版本策略常量 + `apply_version_policy()` |
| `backend/app/openapi/extensions.py` | API-007 | 修改：IF-01~04 tag、`operationId` 前缀、`info` 扩展 |
| `tests/test_integration_api_l1_r44.py` | 全部 | 新建（≥28 条断言函数） |
| `docs/services/integration.md` | 全部 | P3 新建域附录 |
| `docs/services/README.md` | 全部 | P3 索引增行 |
| `docs/api/README.md` | 全部 | P3/P5 登记 IF 路由与状态 |

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F13-API.md` > `docs/api/README.md` > `docs/services/`。

**本轮性质**：M8/M12/M13 **L1 kickoff**（REST 契约 + 错误域 + auth 守卫 + pytest smoke）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、真实总线 HTTP、报表引擎、BPM 发布流水线、动态路由注册引擎。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/
├── integration/
│   ├── __init__.py
│   ├── errors.py                 # IntegrationError(code, message, status, trace_id?)
│   ├── query_services.py         # API-003
│   ├── bus_register.py           # API-004
│   ├── reports_export.py         # API-005
│   └── embed_token.py            # API-006
├── governance/bus/
│   ├── poc.py                    # 保留；adapter 委托 InMemoryBusAdapter
│   └── adapter.py                # BusAdapter 协议 + retry
├── api/v1/
│   ├── services.py               # IF-02
│   ├── integration_bus.py        # IF-01
│   ├── reports/export.py         # IF-03
│   ├── embed.py                  # IF-04
│   └── router.py                 # +4 include_router
└── openapi/
    ├── version_policy.py         # API-007
    └── extensions.py             # +IF tag 注入

tests/
└── test_integration_api_l1_r44.py
```

**共享 L1 契约**（五子项均满足）：

| 契约项 | 要求 |
|--------|------|
| 路由前缀 | 全部 `/api/v1/` |
| 鉴权 | `get_current_user`；未授权 **401** |
| 错误体 | `{ "code", "message", "detail" }`；校验失败 **422** + `detail.fields` |
| OpenAPI tag | IF-01~04 对应路由带 tag；`operationId` 前缀 `if01.`/`if02.`/`if03.`/`if04.` |
| 只读约束 | execute/export 为查询类；**不**写入外部数据源 |
| traceId | 失败响应 `detail.traceId` 当可用（对齐 catalog bus 链） |

### 3.2 API-003 — IF-02 查询服务 API

#### 3.2.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 独立 `PublishedService` ORM + migration | 新表持久化发布服务 | 否决 — L1 无 migration 预算；与 catalog 双写 |
| B 复用 `CatalogEntry`（`status=published`）作服务目录 | 列表/详情来自 catalog；execute 门面代理 query | **采用** — 与 GOV-001 数据一致；L1 可内存 seed + DB 读 |
| C 纯内存 Registry | 与治理域脱节 | 否决 — 无法演示「发布→调用」链路 |

#### 3.2.2 路由与 schema

**文件**：`integration/query_services.py`、`api/v1/services.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/services` | 已发布服务列表（`?limit=&offset=&category=`）；仅 `status=published` |
| GET | `/api/v1/services/{serviceId}` | 服务详情（含 `httpMethod`、`path`、`categoryCodes`、`openapiOperationId`） |
| GET | `/api/v1/services/{serviceId}/openapi` | 服务级 OpenAPI 片段（L1 固定 JSON 模板，含 `paths` 单操作） |
| POST | `/api/v1/services/{serviceId}/execute` | 执行门面（body：`parameters` map）；L1 返回 `{columns, rows, rowCount, truncated, traceId}` 骨架 |

**Pydantic 模型**（camelCase alias）：

- `QueryServiceOut`：`id`, `name`, `httpMethod`, `path`, `categoryCodes`, `status`, `version`（固定 `"v1"`）, `createdAt`
- `QueryServiceListResponse`：`items`, `total`, `limit`, `offset`
- `QueryServiceExecuteIn`：`parameters: dict[str, str | int | float | bool | None]`（L1 可选空）
- `QueryServiceExecuteOut`：与 `query/execute` 200 同形（复用字段名）

**错误码**：

| code | HTTP | 触发 |
|------|------|------|
| `SERVICE_NOT_FOUND` | 404 | 未知 serviceId |
| `SERVICE_NOT_PUBLISHED` | 400 | 条目存在但非 published |
| `SERVICE_EXECUTE_FORBIDDEN` | 403 | 无集成调用权限（L1：`integration` 角色或 admin） |
| `SERVICE_EXECUTE_INVALID` | 422 | parameters 校验失败 |

**L1 权限**：`_assert_service_invoke(actor)` — `admin` 或 `integration` in roles；否则 403。

**execute L1 行为**：不调用真实外部 DB；根据 catalog entry `path` 返回确定性 mock 行（如 `SELECT 1` 等价 `[{"value": 1}]`）；`force-error` in path → `SERVICE_EXECUTE_FAILED` 502。

**验收（可测试）**：

| ID | 断言 |
|----|------|
| T-API-R44-003-01 | `GET /services` 无鉴权 → 401 |
| T-API-R44-003-02 | 空库 → `items=[]` `total=0` |
| T-API-R44-003-03 | seed published entry → 列表含该项；draft 不出现 |
| T-API-R44-003-04 | `GET /services/{id}` 存在 → 200 + `version=v1` |
| T-API-R44-003-05 | 未知 id → 404 `SERVICE_NOT_FOUND` |
| T-API-R44-003-06 | draft entry id → 400 `SERVICE_NOT_PUBLISHED` |
| T-API-R44-003-07 | `GET /services/{id}/openapi` → 200 JSON 含 `paths` 与 `info.version` |
| T-API-R44-003-08 | `POST .../execute` 成功 → 200 + `rowCount>=1` |
| T-API-R44-003-09 | 非 admin/integration 角色 → 403 `SERVICE_EXECUTE_FORBIDDEN` |
| T-API-R44-003-10 | `force-error` path entry → 502 `SERVICE_EXECUTE_FAILED` |

### 3.3 API-004 — IF-01 总线注册适配

#### 3.3.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 仅文档化复用 `/gov/bus/register` | 无新路由 | 否决 — PRD 锚点 `adapter.py`；IF-01 与 IF-06 需分离 |
| B 新 IF-01 门面 + `adapter.py` 提取 + retry | 委托 `catalog_service.register_entry_to_bus` | **采用** |
| C 真实 HTTP 总线客户端 | httpx 对接外部总线 | 否决 — 超出 L1 |

#### 3.3.2 实现要点

**文件**：`governance/bus/adapter.py`、`integration/bus_register.py`、`api/v1/integration_bus.py`

`adapter.py`：

```python
class BusAdapter(Protocol):
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult: ...

def register_with_retry(
    adapter: BusAdapter,
    *,
    entry: CatalogEntryOut,
    trace_id: str,
    max_attempts: int = 3,
) -> BusRegisterResult: ...
```

- `InMemoryBusAdapter` 自 `poc.InMemoryBusPoCAdapter` 迁移（`poc.py` 保留薄 re-export 避免破坏 r31 导入）
- retry：仅对 `BUS_REGISTRATION_TIMEOUT` / `BUS_REGISTRATION_SERVER_ERROR` 重试；`max_attempts` 默认 3；间隔 0（单测可 patch sleep）

**路由**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/integration/bus/register` | body：`{ catalogEntryId, retry?: { maxAttempts } }`；需 `integration` 或 `admin` |
| POST | `/api/v1/integration/bus/register/retry` | body：`{ catalogEntryId, registrationId? }`；对末次失败登记重试（L1：无 succeeded 记录时可再调 adapter） |

**响应**：复用 `BusRegisterOut`；201 新建 / 200 幂等；与 gov 链一致。

**新增错误码**（相对 gov）：

| code | HTTP | 说明 |
|------|------|------|
| `BUS_REGISTER_INTEGRATION_FORBIDDEN` | 403 | 非 integration/admin |
| `BUS_REGISTER_RETRY_EXHAUSTED` | 502 | retry 用尽仍失败 |

**验收**：

| ID | 断言 |
|----|------|
| T-API-R44-004-01 | 无鉴权 → 401 |
| T-API-R44-004-02 | 非 integration/admin → 403 |
| T-API-R44-004-03 | published entry mock 成功 → 201 + `busResponse.busId` |
| T-API-R44-004-04 | 重复 POST → 200 幂等同 `busId` |
| T-API-R44-004-05 | `force-timeout` path + retry → 最终 502 `BUS_REGISTER_RETRY_EXHAUSTED` 或成功（mock 可配置单次成功） |
| T-API-R44-004-06 | draft entry → 400 `BUS_ENTRY_NOT_PUBLISHABLE` |
| T-API-R44-004-07 | `adapter.register_with_retry` 单元：timeout 重试次数 ≤ maxAttempts |

### 3.4 API-005 — IF-03 报表文档 API

#### 3.4.1 路由与 schema

**文件**：`integration/reports_export.py`、`api/v1/reports/export.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reports/export` | Query：`templateId`（UUID）、`format`（`pdf`\|`word`\|`excel`）、`from`、`to`（ISO8601，可选） |

**响应** `ReportExportOut`：

```json
{
  "exportId": "uuid",
  "templateId": "uuid",
  "format": "pdf",
  "status": "pending",
  "downloadUrl": null,
  "expiresAt": null,
  "requestedAt": "2026-07-04T00:00:00Z",
  "traceId": "..."
}
```

L1：`status` 恒 `pending`；`downloadUrl=null`（真实引擎留 companion）；响应头 `X-RateLimit-Limit: 60`、`X-RateLimit-Remaining: 59`（常量桩）。

**错误码**：

| code | HTTP | 触发 |
|------|------|------|
| `REPORT_EXPORT_INVALID_FORMAT` | 422 | format 非法 |
| `REPORT_EXPORT_INVALID_RANGE` | 422 | `from` > `to` |
| `REPORT_TEMPLATE_NOT_FOUND` | 404 | 未知 templateId（L1：固定 seed UUID + 任意未知） |
| `REPORT_EXPORT_FORBIDDEN` | 403 | 无 `reports:export` 权限（L1：admin 或 `integration`） |
| `REPORT_EXPORT_RATE_LIMITED` | 429 | L1：`templateId` 末段为 `force-rate-limit` 时触发 |

**验收**：

| ID | 断言 |
|----|------|
| T-API-R44-005-01 | 无鉴权 → 401 |
| T-API-R44-005-02 | 合法参数 + seed template → 200 `status=pending` |
| T-API-R44-005-03 | `format=invalid` → 422 `REPORT_EXPORT_INVALID_FORMAT` |
| T-API-R44-005-04 | 未知 template → 404 |
| T-API-R44-005-05 | 非授权角色 → 403 |
| T-API-R44-005-06 | 响应含 `X-RateLimit-*` 头 |
| T-API-R44-005-07 | `force-rate-limit` template → 429 |

### 3.5 API-006 — IF-04 门户嵌入 API

#### 3.5.1 与 VIZ-006 边界

| 项 | VIZ-006（r42，不重复） | API-006（本轮） |
|----|------------------------|-----------------|
| 路径 | `POST /charts/embed/validate` | `POST /embed/token` |
| 职责 | 校验嵌入**配置**（target + origins） | **签发** embed token + SDK 参数 |
| 鉴权 | 任意已登录用户 | `admin` 或 `dashboard:share` 角色（L1） |

**文件**：`integration/embed_token.py`、`api/v1/embed.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/embed/token` | 签发 token |
| GET | `/api/v1/embed/sdk-params` | Query：`token`；返回 SDK 初始化参数 |

**请求** `EmbedTokenIn`：`chartId?`, `dashboardId?`, `allowedOrigins[]`, `expiresInSec`（默认 3600，max 86400）, `theme`（`light`|`dark`）

**响应** `EmbedTokenOut`：`token`, `expiresAt`, `embedUrl`（`/embed/{token}` 文案路径）, `sdkParams`（`{ containerId, theme, apiBase, token }`）

**origin 守卫**：签发前校验 `allowedOrigins` 格式（复用 `app.viz.embed.is_origin_allowed` 的 `_ORIGIN_RE`）；请求头 `Origin` 若 present 且 origins 非空 → 须在白名单，否则 403 `EMBED_ORIGIN_DENIED`。

**错误码**：`EMBED_MISSING_TARGET`、`EMBED_TARGET_CONFLICT`、`EMBED_INVALID_ORIGIN`（与 viz 同码）、`EMBED_TOKEN_FORBIDDEN`、`EMBED_TOKEN_INVALID`（GET sdk-params 过期/伪造 token）

**L1 token**：`secrets.token_urlsafe(32)`；内存 dict `_TOKEN_STORE`（进程内，无 migration）；过期基于 `expiresAt`。

**验收**：

| ID | 断言 |
|----|------|
| T-API-R44-006-01 | 无鉴权 POST → 401 |
| T-API-R44-006-02 | chartId only + 合法 origins → 201 + `token` + `sdkParams.apiBase` |
| T-API-R44-006-03 | 双 target → 422 `EMBED_TARGET_CONFLICT` |
| T-API-R44-006-04 | 非法 origin 格式 → 422 `EMBED_INVALID_ORIGIN` |
| T-API-R44-006-05 | 非 share/admin 角色 → 403 |
| T-API-R44-006-06 | `Origin: https://evil.com` 不在白名单 → 403 `EMBED_ORIGIN_DENIED` |
| T-API-R44-006-07 | `GET /embed/sdk-params?token=` 有效 → 200 含 `containerId` |
| T-API-R44-006-08 | 无效 token → 404 `EMBED_TOKEN_INVALID` |

### 3.6 API-007 — OpenAPI 规范与版本策略

#### 3.6.1 实现要点

**文件**：`openapi/version_policy.py`、`openapi/extensions.py`

`version_policy.py` 导出：

| 常量 | 值 |
|------|-----|
| `API_URL_PREFIX` | `/api/v1/` |
| `VERSION_POLICY_TEXT` | 破坏性变更升 `v2`；非破坏性 additive 变更保持 `v1` |
| `OPENAPI_INFO_EXTENSIONS` | `x-api-version-policy`, `x-breaking-change-policy`, `x-if-groups` |

`apply_version_policy(schema: dict) -> dict`：

1. `info.description` 追加版本策略段落
2. `info` 合并 extensions
3. 校验所有 `paths` key 以 `/api/v1/` 或系统路径（`/health` 等）开头；违规路径写入 `x-unversioned-paths`（L1 应为空列表）
4. 路径前缀 → tag 注入：

| 前缀 | tag | operationId 前缀 |
|------|-----|------------------|
| `/api/v1/integration/bus` | IF-01 | `if01.` |
| `/api/v1/services` | IF-02 | `if02.` |
| `/api/v1/reports/export` | IF-03 | `if03.` |
| `/api/v1/embed` | IF-04 | `if04.` |

5. 保留既有 IF-06 逻辑（datasources、execute、gov、views）

**验收**：

| ID | 断言 |
|----|------|
| T-API-R44-007-01 | `GET /openapi.json` → `info.x-api-version-policy` 存在 |
| T-API-R44-007-02 | IF-02 路径 operations 含 tag `IF-02` |
| T-API-R44-007-03 | IF-01~04 operationId 分别以 `if01.`~`if04.` 开头 |
| T-API-R44-007-04 | 所有业务 paths 以 `/api/v1/` 开头（`x-unversioned-paths==[]`） |
| T-API-R44-007-05 | `info.version` 等于 `settings.api_openapi_version` |

## 4. 测试策略

### 4.1 新套件

**文件**：`tests/test_integration_api_l1_r44.py`

- 命名 `T-API-R44-<PRD>-*`；复用 r31 `client`/`AUTH` fixture 模式（`Bearer dev` + sqlite memory meta db）。
- 纯单测（integration 域直调 + adapter retry）+ TestClient（四路由簇 + `/openapi.json`）。
- 目标 **≥28** 条断言（§3.2–3.6 合计 38 条，实施可合并部分参数化）。
- 保留 `test_view_gov_api_r31.py` 全绿（gov bus 链不被破坏）。

### 4.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_integration_api_l1_r44.py \
  ../tests/test_view_gov_api_r31.py \
  -v
```

全量基线：`cd backend && python3 -m pytest ../tests -q` 现 ≥1068 passed；本轮目标 **≥1096 passed** + skipped 不变，零失败、`ruff` clean。

### 4.3 HTTP 语义

- 校验失败：**422** + `{code,message,detail:{fields}}`
- 未鉴权：**401**
- 集成权限不足：**403** + 域专属 code
- 查询类 execute/export：**只读**；无外部写操作

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | L1 目标 | companion 目标 |
|--------|------------------|--------------|---------|-----------------|
| API-003(11.3) | 完 5%、靠 0%、测 0%、性 0% | 4 路由 + execute 门面 + 10 测 | 完 ≥60%、靠 ≥40%、测 ≥50% | 破 90 |
| API-004(11.7) | 完 5%、靠 0%、测 0% | adapter + retry + IF-01 路由 + 7 测 | 完 ≥60%、靠 ≥40% | 破 90 |
| API-005(11.6) | 完 5%、靠 0%、测 0%、性 0% | export 契约 + 限流桩 + 7 测 | 完 ≥60%、靠 ≥40% | 破 90 |
| API-006(12.0) | 完 5%、靠 0%、测 0%、安 13% | token 签发 + origin 守卫 + 8 测 | 完 ≥60%、安 ≥40% | 破 90 |
| API-007(13.1) | 完 5%、靠 0%、测 0% | version_policy + IF tag + 5 测 | 完 ≥60%、架 ≥40% | 破 90 |

## 6. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- `fe/` 任何文件（iframe 页面、SDK 脚本、Admin 分享 UI）
- GOV-003 工单、GOV-005 发布引擎、动态 path 注册（§9 CAT 路由实体化）
- 真实总线 HTTP 客户端、报表 Word/PDF/Excel 渲染引擎
- 新 Alembic migration（L1 复用 catalog + 内存 token store）
- 替换或删除 `POST /gov/bus/register`（GOV-002 保持 IF-06）
- 替换 `POST /charts/embed/validate`（VIZ-006 保持）
- 生产级限流（Redis）、JWT embed token 持久化、CSP / X-Frame-Options
- Dataset 语义层（M13）、QUERY-009 迁移绑定

## 7. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/integration.md` | P3 | 新建：In=IF 门面编排；Out=真实引擎/动态注册/fe；依赖 catalog/query/viz.embed |
| `docs/services/README.md` | P3 | 增 `integration` 索引行 |
| `docs/api/README.md` | P3/P5 | §5/6/8 路由状态 → 已实现；补 IF tag 与错误码脚注 |
| `docs/automate/prd/F13-API.md` | P5 | API-003~007 状态与验收勾选对账 |

## 8. P4 风险与缓解

| 风险 | 缓解 |
|------|------|
| `poc.py` 导入路径变更破坏 r31 | `adapter.py` 提取后 `poc.py` re-export `InMemoryBusPoCAdapter` |
| catalog 无 `published` 种子数据导致列表空 | r44 测试 fixture 创建 `status=published` entry |
| embed token 内存存储重启丢失 | L1 文档注明；companion 轮接持久化 |
| IF-01 与 GOV-002 行为漂移 | `bus_register.py` 单点委托 `catalog_service.register_entry_to_bus` |
| `reports/export.py` 与未来 `reports/templates.py` 包冲突 | 本轮仅单文件 `export.py`；templates 留后续子包 |

## 9. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 18 文件 ≤ 20；3 模块 ≤ 3
- [x] 无 TBD/TODO 占位
- [x] 每项含可测试验收 ID
- [x] `ui_design_skill: none`（纯后端，不触 fe/）
- [x] 明确 IF 与 GOV/VIZ 既有路由边界
- [x] 禁止写生产代码（本文档仅设计）
