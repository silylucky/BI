# M8/M12/M13 集成 API companion 质量推分 r45 设计 — API-003/004/005/006/007

```yaml
date: 2026-07-04
milestone: M8/M12/M13
round_target: docs/superpowers/evolution/2026-07-04-round-target-r45.md
prd_ids: [API-003, API-004, API-005, API-006, API-007]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | IF | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|-----|:--------:|------------|----------|
| 1 | 报表文件生成与导出链路 | API-005 | IF-03 | 1（簇内最低 86.5） | 完整度 **76%→≥88%**；性能 **86%→≥88%** | 外部系统可触发导出并获得可下载文件；失败有结构化错误与 traceId |
| 2 | 查询服务发布守卫与参数校验 | API-003 | IF-02 | 2（86.6） | 完整度 **78%→≥88%**；可靠性 **92%→≥94%** | 已发布服务可稳定调用；非法参数与未发布状态明确拦截；重复提交幂等 |
| 3 | embed token 生命周期与 origin 链 | API-006 | IF-04 | 3（87.3） | 完整度 **78%→≥88%**；安全性 **90%→≥92%** | 令牌有效期与 origin 约束闭合；过期/非法嵌入被拦截 |
| 4 | 发布自动总线注册 | API-004 | IF-01 | 4（87.4） | 完整度 **78%→≥88%**；可靠性 **94%→≥96%** | 查询服务发布后自动向总线注册；失败可重试且不产生脏记录 |
| 5 | OpenAPI v2 文档与版本策略 | API-007 | — | 5（87.4） | 完整度 **80%→≥88%**；架构 **90%→≥92%** | `/docs` 具备 v2 稳定契约文档、IF 分组与 schema 稳定性声明 |

**依赖链**：`reports_export` 文件生成链 → `query_services` 参数校验 + 幂等 → `embed_token` 生命周期 → `bus_register` 发布钩子 + payload 校验 → `version_policy` v2 文档 + `extensions` 示例注入 → `test_integration_api_l1_r45.py` companion → r44 `test_integration_api_l1_r44` 38/38 回归 → P5 五 ID 加权总分 **≥90**。

**上轮已交付（本轮不重复 L1 骨架）**：r44 IF-01~04 四路由簇、`integration` 域六模块、`governance/bus/adapter.py`、`openapi/version_policy.py` IF tag、`test_integration_api_l1_r44.py` 38 条；导出恒 `pending`、无文件下载、无发布钩子、无 execute 参数校验/幂等、embed 无 resolve origin 守卫、OpenAPI 无 v2 文档面。

**STUCK 说明**：五 ID 各连续 1 轮（86.5–87.4）；本轮 companion 质量推分主攻，目标破 90 并清零 STUCK upsert。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M8/M6/M12/M13；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `integration/reports_export.py` | `create_export_request` 返回 `status=pending`、`downloadUrl=null`；无文件生成、无大小边界、无 `traceId` 于生成失败 |
| `integration/query_services.py` | `_require_published` 于 get/execute；**无** execute 参数 schema 校验；**无** `Idempotency-Key`；`SERVICE_EXECUTE_INVALID` 未实现 |
| `integration/bus_register.py` | 仅手动 `register_catalog_to_bus`；**无** 发布→注册编排；**无** payload 字段级校验 |
| `integration/embed_token.py` | `_TOKEN_STORE` 无 `allowed_origins`；`resolve_sdk_params` **不**校验请求 Origin；无显式过期 smoke 路径 |
| `openapi/version_policy.py` | v1 策略 + IF tag；**无** v2 文档面、`x-supported-versions`、`x-schema-stability` |
| `openapi/extensions.py` | IF-06 示例丰富；IF-01~04 **无** response example |
| `governance/catalog/service.py` | `create_entry` 可设 `status=published`；**无** `publish_entry(draft→published)`；注册与发布解耦 |
| `api/v1/reports/export.py` | 仅 `GET /reports/export` 创建任务；**无** status/download 路由 |
| `api/v1/services.py` | 无 `publish` 路由；execute 未透传 `Idempotency-Key` |
| `test_integration_api_l1_r44.py` | 38 条 L1 smoke；无文件下载、幂等、过期 token、v2 openapi 断言 |

**范围框定模块**（3）：

1. `backend/app/integration/` — companion 域逻辑闭合
2. `backend/app/api/v1/` — 集成路由簇（`services` / `integration_bus` / `reports/export` / `embed`）
3. `backend/app/openapi/` — v2 文档与 IF 示例后处理

**范围框定文件列表**（17 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/integration/reports_export.py` | API-005 | 修改：生成链 + store + 大小边界 |
| `backend/app/integration/query_services.py` | API-003 | 修改：参数校验 + 幂等缓存 |
| `backend/app/integration/bus_register.py` | API-004 | 修改：发布钩子 + payload 校验 |
| `backend/app/integration/embed_token.py` | API-006 | 修改：生命周期 + resolve origin |
| `backend/app/integration/errors.py` | 全部 | 修改（若需新 code 常量文档） |
| `backend/app/governance/catalog/service.py` | API-004 | 修改：`publish_entry()` 最小函数（发布状态迁移） |
| `backend/app/api/v1/reports/export.py` | API-005 | 修改：status + download 路由 |
| `backend/app/api/v1/services.py` | API-003/004 | 修改：publish + Idempotency-Key |
| `backend/app/api/v1/integration_bus.py` | API-004 | 修改：payload 校验错误映射 |
| `backend/app/api/v1/embed.py` | API-006 | 修改：resolve Origin 头透传 |
| `backend/app/openapi/version_policy.py` | API-007 | 修改：v2 文档 + 稳定性扩展 |
| `backend/app/openapi/extensions.py` | API-007 | 修改：IF-01~04 response examples |
| `tests/test_integration_api_l1_r45.py` | 全部 | 新建（≥22 条 companion 断言） |
| `docs/services/integration.md` | 全部 | P3：边界 Out 更新、新入口登记 |
| `docs/services/README.md` | 全部 | P3：integration 状态 → companion |
| `docs/api/README.md` | 全部 | P3/P5：新路由与错误码 |
| `docs/automate/prd/F13-API.md` | 全部 | P5 对账（非 P3） |

**跨模块触达说明**：`governance/catalog/service.py` 仅新增 `publish_entry(db, entry_id) -> CatalogEntryOut`（draft→published 单步迁移 + 404/400），供 `integration` 发布钩子调用；不改动 bus 幂等或 gov 路由行为。

**真理源优先级**：`round-target` > `prd.md` hub + `prd/F13-API.md` > `docs/api/README.md` > `docs/services/integration.md`。

**本轮性质**：r44 L1 后 **companion 质量推分**（闭合完整度/可靠性/安全/架构薄弱维）；**纯后端**；`ui_design_skill: none`；不含 `fe/`、真实报表引擎、生产总线 HTTP、Redis 限流、Alembic migration。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/integration/
├── reports_export.py      # + 同步 mock 生成、_EXPORT_STORE、大小/失败边界
├── query_services.py      # + _validate_parameters、_IDEMPOTENCY_STORE、publish_service 委托
├── bus_register.py        # + register_on_publish、validate_register_payload
└── embed_token.py         # + allowed_origins 持久、resolve origin 守卫

backend/app/governance/catalog/
└── service.py             # + publish_entry()

backend/app/api/v1/
├── reports/export.py      # + GET /{exportId}、GET /{exportId}/download
├── services.py            # + POST /{id}/publish、Idempotency-Key on execute
├── integration_bus.py     # + payload 字段校验 detail.fields
└── embed.py               # + Origin header on sdk-params

backend/app/openapi/
├── version_policy.py      # + v2 doc paths、x-supported-versions、x-schema-stability
└── extensions.py          # + IF-01~04 response examples

tests/
└── test_integration_api_l1_r45.py
```

**共享 companion 契约**（五子项均满足）：

| 契约项 | r45 增量 |
|--------|----------|
| 错误体 | 保持 `{code, message, detail}`；生成/执行失败含 `detail.traceId` |
| 只读 | download 为 GET；execute/export 不写入外部数据源 |
| 内存 store | `_EXPORT_STORE`、`_IDEMPOTENCY_STORE`、`_TOKEN_STORE` 进程内；文档注明非生产持久化 |
| 测试隔离 | r45 fixture 独立 sqlite URL；不破坏 r44 38 条 |

### 3.2 API-005 — 报表文件生成与导出链路

#### 3.2.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 异步 Celery + 对象存储 | 真实生产导出 | 否决 — round-target 不含大文件流式与队列 |
| B 同步 companion mock 生成 + 内存字节 + download 路由 | L2 闭合 PRD「按模板提取 Word/PDF/Excel」可测语义 | **采用** |
| C 仅把 `status` 改为 `ready` 仍无文件 | 虚假完整度 | 否决 — 无法测 download 与 size 边界 |

#### 3.2.2 域逻辑

**文件**：`integration/reports_export.py`

- 常量：`MAX_EXPORT_BYTES = 5_242_880`（5 MiB companion 上限）；`EXPORT_TTL_SEC = 3600`
- `_EXPORT_STORE: dict[UUID, ExportRecord]`：`ExportRecord` 含 `bytes`、`content_type`、`status`、`expires_at`、`trace_id`
- `create_export_request` 增强：
  - seed 模板（`SEED_TEMPLATE_IDS`）→ 同步生成 mock 文件（PDF `%PDF-1.4 mock`、Word/Excel 最小 magic bytes + template 名）
  - `template_id` 末段 `force-generation-fail` → `REPORT_EXPORT_GENERATION_FAILED` **502** + `traceId`
  - 生成后 `status=ready`、`downloadUrl=/api/v1/reports/export/{exportId}/download`、`expiresAt` ISO8601
  - 超限 → `REPORT_EXPORT_TOO_LARGE` **413**
- 新增：`get_export_status(export_id) -> ReportExportOut`、`get_export_file(export_id) -> tuple[bytes, str, str]`（content_type, filename）

**MIME 映射**：`pdf` → `application/pdf`；`word` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`；`excel` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

#### 3.2.3 路由

**文件**：`api/v1/reports/export.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reports/export` | 既有：创建并同步生成（ready） |
| GET | `/api/v1/reports/export/{exportId}` | 轮询状态；未知 → 404 `REPORT_EXPORT_NOT_FOUND` |
| GET | `/api/v1/reports/export/{exportId}/download` | 返回文件流；`Content-Disposition: attachment`；未 ready/过期 → 404 |

#### 3.2.4 验收（可测试）

| ID | 断言 |
|----|------|
| T-API-R45-005-01 | seed template + `format=pdf` → 200 `status=ready` + `downloadUrl` 非空 |
| T-API-R45-005-02 | `GET .../download` → 200 `Content-Type: application/pdf` + body 非空 |
| T-API-R45-005-03 | `force-generation-fail` template → 502 `REPORT_EXPORT_GENERATION_FAILED` + `detail.traceId` |
| T-API-R45-005-04 | 未知 `exportId` status → 404 `REPORT_EXPORT_NOT_FOUND` |
| T-API-R45-005-05 | `format=word`/`excel` download MIME 正确（smoke 各 1） |
| T-API-R45-005-06 | 响应时间：同步生成 < 500ms（同进程 smoke，无真实渲染） |

### 3.3 API-003 — 查询服务发布守卫与参数校验

#### 3.3.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 完整 JSON Schema 自 catalog | 需 migration 存 schema | 否决 — 无 migration 预算 |
| B path 约定 `;requires=foo,bar` + 类型粗校验 | L2 可测、零 schema 存储 | **采用** |
| C 仅加强 published 检查 | 不闭合完整度 | 否决 |

#### 3.3.2 域逻辑

**文件**：`integration/query_services.py`

- `_parse_required_params(path: str) -> list[str]`：路径含 `;requires=a,b` 片段时解析必填参数名（剥离后不影响路由匹配，仅 catalog `path` 字段约定）
- `_validate_execute_parameters(required: list[str], parameters: dict)`：
  - 缺键 → `SERVICE_EXECUTE_INVALID` **422** + `detail.fields`
  - 值类型非 str/int/float/bool/None → 422
  - 空字符串视为缺失
- `_IDEMPOTENCY_STORE: dict[str, QueryServiceExecuteOut]`：key = `{serviceId}:{idempotencyKey}`
- `execute_published_service`：读 `Idempotency-Key`（经路由透传）；命中则返回缓存；否则校验参数后执行并缓存
- `publish_service(db, service_id, actor)`：`_assert_service_invoke` + `catalog_service.publish_entry` + `bus_register.register_on_publish`（见 §3.5）

**文件**：`governance/catalog/service.py`

```python
def publish_entry(db: Session, entry_id: uuid.UUID) -> CatalogEntryOut:
    # draft → published；已 published 幂等 200 语义由调用方处理
    # draft 不存在 → 404；非法状态 → 400 CATALOG_INVALID_STATUS
```

#### 3.3.3 路由

**文件**：`api/v1/services.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/services/{serviceId}/publish` | draft→published + 触发总线注册；201 |
| POST | `/api/v1/services/{serviceId}/execute` | 增 `Idempotency-Key` 可选 Header |

#### 3.3.4 验收

| ID | 断言 |
|----|------|
| T-API-R45-003-01 | path `;requires=region` + 空 parameters → 422 `SERVICE_EXECUTE_INVALID` |
| T-API-R45-003-02 | 补 `region` → 200 |
| T-API-R45-003-03 | 同 `Idempotency-Key` 两次 execute → 相同 body（rowCount/trace 一致） |
| T-API-R45-003-04 | draft entry execute → 400 `SERVICE_NOT_PUBLISHED`（r44 回归） |
| T-API-R45-003-05 | `POST .../publish` draft entry → 201 + entry `status=published` |
| T-API-R45-003-06 | 已 published 再 publish → 200 幂等 |

### 3.4 API-006 — embed token 生命周期与 origin 链

#### 3.4.1 实现要点

**文件**：`integration/embed_token.py`

- `_TOKEN_STORE` 增 `allowed_origins: list[str]`
- `resolve_sdk_params(token, origin_header)`：
  - 过期 → 404 `EMBED_TOKEN_EXPIRED`（与 invalid 区分 message）
  - `allowed_origins` 非空且 `origin_header` present 且不在列表 → 403 `EMBED_ORIGIN_DENIED`
- 测试辅助：`issue_embed_token` 支持 `expiresInSec=60`；用 `freezegun` 或手动 patch `datetime.now` 测过期（优先 unittest.mock `datetime` in module）

**文件**：`api/v1/embed.py`

- `GET /embed/sdk-params` 增 `Origin` Header 透传至 `resolve_sdk_params`

#### 3.4.2 验收

| ID | 断言 |
|----|------|
| T-API-R45-006-01 | 签发后 resolve 无 Origin → 200 |
| T-API-R45-006-02 | resolve 带非法 Origin → 403 `EMBED_ORIGIN_DENIED` |
| T-API-R45-006-03 | patch 时间超过 `expiresAt` → 404 `EMBED_TOKEN_EXPIRED` |
| T-API-R45-006-04 | r44 `EMBED_TOKEN_INVALID` 伪造 token 仍 404（回归） |

### 3.5 API-004 — 发布自动总线注册

#### 3.5.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 修改 gov `create_entry` 内嵌注册 | 破坏 IF-06 边界 | 否决 |
| B `publish_service` 编排 publish_entry + register_catalog_to_bus | 集成域单点 | **采用** |
| C 仅文档说明手动两步 | 不闭合 PRD 验收 | 否决 |

#### 3.5.2 域逻辑

**文件**：`integration/bus_register.py`

- `validate_register_payload(catalog_entry_id: UUID)`：nil UUID → `BUS_REGISTER_INVALID_PAYLOAD` **422** + fields
- `register_on_publish(db, entry_id, actor) -> BusRegisterOut`：
  - 委托 `register_catalog_to_bus`（已 published）
  - 幂等：重复 publish 不重复 INSERT（catalog 层已有 succeeded 检查）
- `integration/query_services.publish_service` 顺序：`publish_entry` → `register_on_publish`；bus 失败时 entry **保持 published**（注册可重试 `/integration/bus/register/retry`），不 rollback 状态

**文件**：`integration_bus.py`

- `IntegrationBusRegisterIn`：`catalogEntryId` 必填；缺失 → 422 `BUS_REGISTER_INVALID_PAYLOAD`

#### 3.5.3 验收

| ID | 断言 |
|----|------|
| T-API-R45-004-01 | `POST /services/{id}/publish` draft → 201 bus 登记 + `busResponse.busId` |
| T-API-R45-004-02 | 重复 publish → 200 同 `busId`（幂等） |
| T-API-R45-004-03 | `force-timeout` path publish → 502/504 且 entry 仍为 published |
| T-API-R45-004-04 | retry 端点可补登记成功 |
| T-API-R45-004-05 | 非法 `catalogEntryId`（nil）→ 422 |
| T-API-R45-004-06 | r44 手动 register 38 条子集仍绿（回归） |

### 3.6 API-007 — OpenAPI v2 文档与版本策略

#### 3.6.1 方案比选

| 方案 | 描述 | 结论 |
|------|------|------|
| A 真实 `/api/v2/*` 路由全量复制 | 超范围、双维护 | 否决 |
| B OpenAPI 注入 v2 文档面 + `x-supported-versions` + IF examples | 策略声明 + 集成方可读 | **采用** |
| C 仅 bump `info.version` 字符串 | 不闭合「v2 文档」 | 否决 |

#### 3.6.2 实现要点

**文件**：`openapi/version_policy.py`

- 新增常量：
  - `SUPPORTED_API_VERSIONS = ["v1", "v2"]`
  - `V2_DOCUMENTATION_PREFIX = "/api/v2/"`
  - `SCHEMA_STABILITY = "stable"`（companion 声明 IF-01~04 为 stable）
- `inject_v2_documentation_paths(schema)`：
  - 对 IF-01~04 的每个 `/api/v1/...` path 生成平行 `/api/v2/...` entry（相同 operation，增 `x-implements-version: v2`、`description` 注明「v2 稳定文档面；运行时委托 v1」）
  - **不**注册真实 FastAPI 路由
- `apply_version_policy` 合并：
  - `info.x-supported-versions`
  - `info.x-schema-stability: stable`
  - `info.x-changelog`：单条 `2026-07-04: IF-01~04 companion stable documentation`
  - `info.version` 仍为 `settings.api_openapi_version`（不伪造 2.0.0 误导）

**文件**：`openapi/extensions.py`

- `_inject_integration_openapi_examples(schema)`：为 IF-01~04 各至少 1 个 200/201 response `example`（BusRegisterOut、QueryServiceListResponse、ReportExportOut ready、EmbedTokenOut）

#### 3.6.3 验收

| ID | 断言 |
|----|------|
| T-API-R45-007-01 | `GET /openapi.json` → `info.x-supported-versions` 含 `v1` 与 `v2` |
| T-API-R45-007-02 | 存在 `/api/v2/services` path key（文档面） |
| T-API-R45-007-03 | IF-03 export operation 含 200 response example 且 `status=ready` |
| T-API-R45-007-04 | `info.x-schema-stability == "stable"` |
| T-API-R45-007-05 | r44 `x-unversioned-paths==[]` 仍成立（真实路由未偏离 v1） |

## 4. 测试策略

### 4.1 新套件

**文件**：`tests/test_integration_api_l1_r45.py`

- 命名 `T-API-R45-<PRD>-*`；复用 r44 sqlite module fixture 模式（独立 DB URL `integration_r45` 避免与 r44 冲突）
- 纯单测（参数解析、payload 校验）+ TestClient（新路由 + openapi）
- 目标 **≥22** 条断言（§3.2–3.6 合计 27 条，可参数化合并）
- **强制** r44 全量回归：`test_integration_api_l1_r44.py` 38/38 + `test_view_gov_api_r31.py` 24/24

### 4.2 验证命令

```bash
cd backend && python3 -m ruff check . && python3 -m pytest \
  ../tests/test_integration_api_l1_r45.py \
  ../tests/test_integration_api_l1_r44.py \
  ../tests/test_view_gov_api_r31.py \
  -v
```

全量基线：`cd backend && python3 -m pytest ../tests -q` 现 ≥1104 passed；本轮目标 **≥1126 passed** + skipped 不变，零失败、`ruff` clean。

### 4.3 HTTP 语义（r45 增量）

| 场景 | 期望 |
|------|------|
| 导出生成失败 | **502** + `REPORT_EXPORT_GENERATION_FAILED` + `traceId` |
| 导出过大 | **413** + `REPORT_EXPORT_TOO_LARGE` |
| 参数缺失 | **422** + `SERVICE_EXECUTE_INVALID` + `fields` |
| 幂等重复 execute | **200** 相同 body |
| embed 过期 | **404** + `EMBED_TOKEN_EXPIRED` |
| 发布+注册 | **201** 首次 / **200** 幂等 |

## 5. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维（选题时） | 本轮闭合手段 | companion 目标 |
|--------|------------------|--------------|----------------|
| API-005(86.5) | 完 76%、性 86% | 同步 mock 生成 + download + 502/413 边界 + 6 测 | 完 ≥88%、性 ≥88%、**总分 ≥90** |
| API-003(86.6) | 完 78%、靠 92% | 参数校验 + publish 路由 + Idempotency-Key + 6 测 | 完 ≥88%、靠 ≥94%、**总分 ≥90** |
| API-006(87.3) | 完 78%、安 90% | resolve origin + 过期码 + 4 测 | 完 ≥88%、安 ≥92%、**总分 ≥90** |
| API-004(87.4) | 完 78%、靠 94% | publish→bus 编排 + payload 校验 + 6 测 | 完 ≥88%、靠 ≥96%、**总分 ≥90** |
| API-007(87.4) | 完 80%、架 90% | v2 文档面 + stability + IF examples + 5 测 | 完 ≥88%、架 ≥92%、**总分 ≥90** |

## 6. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- `fe/` 任何文件（Embed SDK、iframe、管理台分享 UI）
- 真实 Word/PDF/Excel 模板引擎、对象存储、异步任务队列
- 生产级总线 HTTP SDK、GOV-005 完整发布引擎、BPM 工单
- 真实 `/api/v2/*` 运行时路由（仅 OpenAPI 文档面）
- Redis 限流、JWT 持久化 token、新 Alembic migration
- Dataset 语义层（M13）、QUERY-009、NFR-006/007、GOV-003
- 删除或替换 `POST /gov/bus/register`、`POST /charts/embed/validate`

## 7. 文档同步（P3/P5）

| 文档 | 时机 | 内容 |
|------|------|------|
| `docs/services/integration.md` | P3 | Out 移除「文件生成留 companion」；增 publish/download 入口 |
| `docs/services/README.md` | P3 | integration 状态 → companion 已实现 |
| `docs/api/README.md` | P3/P5 | 登记 `POST /services/{id}/publish`、`GET /reports/export/{id}`、download；v2 OpenAPI 注记 |
| `docs/automate/prd/F13-API.md` | P5 | API-003~007 验收勾选 + 状态对账 |

## 8. P4 风险与缓解

| 风险 | 缓解 |
|------|------|
| publish 成功但 bus 失败导致「已发布未注册」 | 文档明确 retry 路径；测试覆盖 retry 恢复 |
| v2 OpenAPI path 与真实路由不一致误导集成方 | `x-implements-version` + description 声明文档面；测试不断言 v2 HTTP 200 |
| 同步 mock 生成阻塞请求 | companion 仅小文件；测 <500ms smoke |
| `_EXPORT_STORE` 内存膨胀 | TTL + 单测 module scope 清理 |
| catalog `publish_entry` 与 gov 未来 GOV-005 重复 | 函数保持最小；GOV-005 可复用同一 service 函数 |

## 9. Self-review 清单

- [x] 覆盖 round-target 全部 5 子项
- [x] 17 文件 ≤ 20；3 模块 + 1 最小 catalog 触达
- [x] 无 TBD/TODO 占位
- [x] 每项含可测试验收 ID
- [x] `ui_design_skill: none`（纯后端，不触 fe/）
- [x] 明确 IF 与 GOV/VIZ 边界不变
- [x] 禁止写生产代码（本文档仅设计）
