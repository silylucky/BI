# M5 VIEW-001 + M6 companion 质量推分 r31 设计 — VIEW-001 / GOV-002 / GOV-001 / API-001 / API-002

```yaml
date: 2026-07-04
milestone: M5 + M6
round_target: docs/superpowers/evolution/2026-07-04-round-target-r31.md
prd_ids: [VIEW-001, GOV-002, GOV-001, API-001, API-002]
ui_design_skill: none
status: design
```

## 1. 批量主题与子项映射

| # | 子项 | PRD ID | 执行顺序 | 主攻薄弱维 | 用户感知 |
|---|------|--------|:--------:|------------|----------|
| 1 | DashboardView validate 边界闭合 | VIEW-001 | 1（主攻 STUCK） | 完整度 **74%→≥88%**；可靠性 **86%→≥90%** | 非法配置、空布局、跨 chart 引用、尺寸越界、循环引用均返回可定位 4xx + `detail.fields` |
| 2 | 总线 PoC 失败路径与登记鉴权 | GOV-002 | 2（主攻 STUCK） | 完整度 **76%→≥88%**；安全性 **82%→≥88%** | 总线超时/4xx/5xx 有明确原因与 traceId；重复登记幂等；未授权 403 |
| 3 | catalog 三分法与挂载边界巩固 | GOV-001 | 3 | 完整度 **80%→≥88%**；可靠性 **88%→≥92%** | 分类枚举完整；分页/过滤边界稳定；非法分类 4xx；条目解绑不脏数据 |
| 4 | IF-06 数据源 OpenAPI 契约补全 | API-001 | 4 | 完整度 **80%→≥88%** | 外部集成方可从 OpenAPI 发现完整 CRUD 路径参数、响应示例与错误语义 |
| 5 | IF-06 execute 开放面边界与 OpenAPI | API-002 | 5 | 完整度 **80%→≥88%**；可靠性 **90%→≥92%** | 越权/DML/多语句在 IF-06 路径结构化拦截；OpenAPI 参数/示例完整 |

**依赖链**：VIEW validate 边界 → DASH layout 回归 → GOV bus 失败/幂等/鉴权 → GOV catalog 过滤/解绑 → OpenAPI extensions 补全 → IF-06 auth/execute smoke → pytest r31 全绿 + r30 回归。

**上轮已交付（本轮不重复 L1 骨架）**：r30 `views/` schema+validate、`governance/catalog` + migration 0014、`governance/bus/poc` InMemory adapter、`openapi/extensions.py` IF-06 tag 基础、`test_view_gov_api_r30.py` 30 条 smoke。

**STUCK 说明**：VIEW-001(88.6)、GOV-002(88.7) 各连续 1 轮未破 90；本轮闭合 validate 边界与总线失败/鉴权缺口。

**plan.md 状态**：M1+M1B 全 `[x]`；立项来源 `plan.archive.md` §M5 VIEW-001、§M6 GOV/API；**禁止**修改 `plan.md` / `goal.md` 结构。

## 2. 现状与约束

| 项 | 现状（范围框定内已读） |
|----|------------------------|
| `views/validate.py` | 已有 `VIEW_UNKNOWN_CHART_REF`、`VIEW_DEFAULT_SELF_REF`；`chartRef` 仅检查存在性，**无**环检测；Pydantic 越界（colSpan/rowSpan/widgets 上限）映射为通用 `VIEW_INVALID_LAYOUT`，字段路径不够稳定 |
| `views/schemas.py` | `DashboardView` + `ViewError`；无专用 bounds/cycle 错误码 |
| `api/v1/views.py` | `_error_response` 已输出 `detail.fields`；合法空 widgets 200 已覆盖（T-VIEW-R30-001-02） |
| `dashboard/service.py` | `_validate_layout_business` 委托 `validate_layout_dict`；重复 widget ID → `DASH_DUPLICATE_WIDGET` |
| `dashboard/schemas.py` | `col_span: Literal[4,6,8,12]`；`widgets` max 32；`row_span` ge=1 le=8 |
| `governance/catalog/service.py` | seed 三分法；`list_entries` 非法 `category` 过滤返回空列表（**应 400**）；`register_entry_to_bus` 每次成功均 INSERT 新 `BusRegistration`（**无幂等**）；失败 `CatalogError` **无** traceId |
| `governance/bus/poc.py` | `force-fail` path → 502；**无** timeout/4xx/5xx 模拟分支 |
| `api/v1/gov.py` | 全路由仅 `get_current_user`；**无** bus/register 角色守卫；错误体 `detail: null` |
| `openapi/extensions.py` | datasources 路径 IF-06 tag + operationId；execute requestBody examples；**缺** path 参数示例、GET/PUT/PATCH/DELETE 响应示例、gov/views 路径 tag |
| `api/v1/datasources.py` | POST 有 `openapi_extra` example；GET `/{id}` 等**无** response example |
| `api/v1/query.py` | execute 有 responses 400/403 描述；OpenAPI **缺** response example 与多语句拒绝 smoke |
| `test_view_gov_api_r30.py` | 30 条；**无** colSpan 越界、chartRef 环、bus 超时/幂等、401/403 gov、OpenAPI path param example 断言 |

**范围框定模块**（3）：`backend/app/views/`、`backend/app/governance/`、`backend/app/api/v1/` + `backend/app/openapi/` + `backend/app/dashboard/service.py`（只读回归）+ `tests/` + 文档同步。

**范围框定文件列表**（18 ≤ 20）：

| 文件 | 子项 | 变更类型 |
|------|------|----------|
| `backend/app/views/validate.py` | VIEW-001 | 修改 |
| `backend/app/views/schemas.py` | VIEW-001 | 修改（错误码常量，可选） |
| `backend/app/api/v1/views.py` | VIEW-001 | 修改（边界错误映射，若有） |
| `backend/app/governance/bus/poc.py` | GOV-002 | 修改 |
| `backend/app/governance/catalog/service.py` | GOV-001/002 | 修改 |
| `backend/app/governance/catalog/schemas.py` | GOV-001 | 修改（DELETE 响应，若需） |
| `backend/app/api/v1/gov.py` | GOV-001/002 | 修改 |
| `backend/app/openapi/extensions.py` | API-001/002 | 修改 |
| `backend/app/api/v1/datasources.py` | API-001 | 修改（responses openapi_extra） |
| `backend/app/api/v1/query.py` | API-002 | 修改（responses openapi_extra） |
| `backend/app/dashboard/service.py` | VIEW-001 | **只读回归**（不改逻辑，测试覆盖） |
| `tests/test_view_gov_api_r31.py` | 全部 | 新建（r31 增量；保留 r30 文件不删） |
| `docs/services/views.md` | VIEW-001 | 修改 |
| `docs/services/governance.md` | GOV-001/002 | 修改 |
| `docs/api/README.md` | API-001/002/GOV | 修改 |
| `docs/automate/prd/F09-VIEW.md` | VIEW-001 | P5 对账（非 P3） |
| `docs/automate/prd/F10-GOV.md` | GOV-001/002 | P5 对账（非 P3） |
| `docs/automate/prd/F13-API.md` | API-001/002 | P5 对账（非 P3） |

**真理源优先级**：`round-target` > `prd/F09|F10|F13` > `docs/services/views.md` · `governance.md` > `docs/api/README.md`。

**本轮性质**：M5/M6 **质量推分** companion（边界闭合 + 测试 + OpenAPI 补全），**纯后端**；`ui_design_skill: none`；不含 `fe/`、真实总线 HTTP、BPM 工单、VIEW-002/003、GOV-003~008。

## 3. 架构设计

### 3.1 目标增量结构

```
backend/app/views/
├── validate.py          # + bounds 映射、chartRef 环检测、空 widgets 显式路径
└── schemas.py           # + 错误码文档注释（可选常量）

backend/app/governance/
├── bus/poc.py           # + timeout/4xx/5xx 模拟分支（path 约定）
└── catalog/service.py   # + 幂等登记、非法 category 400、DELETE 解绑

backend/app/openapi/
└── extensions.py        # + datasources CRUD 示例、gov/views IF-06、execute response

backend/app/api/v1/
├── views.py             # 错误体保持一致
├── gov.py               # + bus/register admin 守卫、错误 traceId
├── datasources.py       # + path/response openapi_extra
└── query.py             # + execute response example

tests/
└── test_view_gov_api_r31.py   # T-*-R31-xxx 新用例
```

### 3.2 VIEW-001 — validate 边界闭合

#### 3.2.1 方案比选

| 方案 | 环检测 | 越界错误 | 结论 |
|------|--------|----------|------|
| A 在 `validate.py` 增 `_check_chart_ref_cycle` + 统一 `_map_validation_error` | DFS on raw `chartRef`/`chartId` graph | 捕获 `ValidationError` → `VIEW_LAYOUT_BOUNDS` + fields | **采用** — 与 r30 委托链一致，不改 `dashboard/schemas` |
| B 扩展 `LayoutWidget` 增 `chartRef` 字段 | Pydantic 自引用 | 原生校验 | 否决 — 需改 DASH schema，波及 fe 契约 |
| C 拒绝空 widgets | N/A | 空 → 422 | 否决 — r30 已允许空布局且 DASH 默认空 widgets |

#### 3.2.2 新增/强化校验规则

**文件**：`backend/app/views/validate.py`

| 场景 | 规则 | code | HTTP | detail.fields |
|------|------|------|:----:|---------------|
| 空 widgets | `widgets=[]` 合法，校验通过并归一化 order | — | 200 | — |
| 未知 chartId/chartRef | 已有逻辑保持 | `VIEW_UNKNOWN_CHART_REF` | 422 | `[{field, message}]` |
| colSpan 非 4/6/8/12 | Pydantic `layout.widgets[n].colSpan` | `VIEW_LAYOUT_BOUNDS` | 422 | 含字段路径 |
| rowSpan ∉ [1,8] 或 widgets>32 | 同上 | `VIEW_LAYOUT_BOUNDS` | 422 | 含字段路径 |
| chartRef 环 | raw widgets 建邻接表 DFS；`chartRef` 或 `chartConfig.chartId` 指向其他 widget | `VIEW_CHART_REF_CYCLE` | 422 | `[{field: "widgets[i].chartRef", message: "Circular chart reference"}]` |
| defaultViewId 自引用 | 已有 | `VIEW_DEFAULT_SELF_REF` | 422 | 保持 |

**环检测算法**：对每个 widget `i`，从 `chartRef` 或外指 `chartId` 沿引用 walk，visited 集合遇重复 → 抛 `VIEW_CHART_REF_CYCLE`。自引用 `chartId == widget.id` 由 `DASH_CHART_ID_MISMATCH` 在 business 层处理，不视为环。

**API 层**：`api/v1/views.py` `_error_response` 保持 `detail: {fields: [...]}` 形状；新增测试断言 `detail` 非 null 且 `fields` 为数组。

#### 3.2.3 DASH 互操作回归

| ID | 断言 |
|----|------|
| T-VIEW-R31-001-01 | `validate_dashboard_view` 空 widgets → 200，`layout.widgets==[]` |
| T-VIEW-R31-001-02 | colSpan=5 → 422 `VIEW_LAYOUT_BOUNDS`，`detail.fields` 含 `colSpan` |
| T-VIEW-R31-001-03 | widgets 两节点 A→B→A chartRef → 422 `VIEW_CHART_REF_CYCLE` |
| T-VIEW-R31-001-04 | `POST /views/validate` 上述场景 body 含 `code`+`detail.fields` |
| T-VIEW-R31-001-05 | `PUT /dashboards/{id}/layout` 合法 layout 200；重复 widget 仍 `DASH_DUPLICATE_WIDGET`（r30 回归） |
| T-VIEW-R31-001-06 | 未知 chartId 仍 `VIEW_UNKNOWN_CHART_REF`（r30 回归） |

**验收（可测试）**：

- [ ] 空 widgets、未知 chart、尺寸越界、循环引用均有结构化 4xx + `detail.fields`（或空 widgets 200）
- [ ] DASH-001~003 layout/widgets 互操作 pytest 全绿
- [ ] VIEW-001 加权总分目标 ≥90（完整度 ≥88%）

### 3.3 GOV-002 — 总线 PoC 失败路径与鉴权

#### 3.3.1 方案比选

| 方案 | 失败模拟 | 幂等 | 鉴权 | 结论 |
|------|----------|------|------|------|
| A path 约定 + InMemory 分支扩展 | `force-timeout`/`force-4xx`/`force-5xx` path 段 | DB 查已有 `succeeded` 登记 → 200 返回同记录 | `bus/register` 需 `admin` role | **采用** — 与 r30 `force-fail` 一致，无新依赖 |
| B 独立 `MockBusAdapter` 测试注入 | pytest patch only | 无生产幂等 | 不变 | 否决 — 完整度/安全性维 production 路径不足 |
| C 真实 HTTP 总线 stub | httpx mock server | 复杂 | 不变 | 否决 — 超出 PoC 范围 |

#### 3.3.2 `InMemoryBusPoCAdapter` 扩展

**文件**：`backend/app/governance/bus/poc.py`

| path 含片段 | error_code | HTTP（service 映射） | message |
|-------------|------------|----------------------|---------|
| `force-fail` | `BUS_REGISTRATION_REJECTED` | 502 | 已有 |
| `force-timeout` | `BUS_REGISTRATION_TIMEOUT` | 504 | Bus registration timed out |
| `force-4xx` | `BUS_REGISTRATION_CLIENT_ERROR` | 400 | Bus client error |
| `force-5xx` | `BUS_REGISTRATION_SERVER_ERROR` | 502 | Bus server error |

#### 3.3.3 登记服务加固

**文件**：`backend/app/governance/catalog/service.py`

| 增强 | 行为 |
|------|------|
| 幂等 | `register_entry_to_bus` 前查 `BusRegistration` where `catalog_entry_id` + `status=succeeded`；存在则返回已有行（HTTP **200**，body 同 `BusRegisterOut`） |
| 失败 traceId | 抛 `CatalogError` 时附带 `trace_id`；`api/v1/gov.py` 错误体 `detail: {traceId}` |
| 鉴权 | `POST /bus/register` 增加 `require_roles(["admin"])` 或等价 `UserContext.roles` 检查；非 admin → 403 `BUS_REGISTER_FORBIDDEN` |

**文件**：`backend/app/api/v1/gov.py` — `_catalog_error_response(exc, trace_id=None)` 扩展。

#### 3.3.4 测试策略

| ID | 断言 |
|----|------|
| T-GOV-R31-002-01 | path `force-timeout` → 504 `BUS_REGISTRATION_TIMEOUT`，`detail.traceId` 存在 |
| T-GOV-R31-002-02 | path `force-4xx` → 400；`force-5xx` → 502 |
| T-GOV-R31-002-03 | 同一 entry 连续两次 `POST /bus/register`（admin）→ 首次 201、二次 **200** 同 `id` |
| T-GOV-R31-002-04 | 非 admin Bearer dev（若无 admin 角色配置则用无权限 fixture）→ 403 `BUS_REGISTER_FORBIDDEN` |
| T-GOV-R31-002-05 | 失败场景不插入 `succeeded` 行；成功链 GOV-001 catalog 不回归 |

**验收（可测试）**：

- [ ] mock 总线超时/4xx/5xx、重复 POST 幂等、未授权 403 pytest 绿
- [ ] 登记记录与 catalog 联动不回归 r30
- [ ] GOV-002 加权总分目标 ≥90

### 3.4 GOV-001 — catalog 边界巩固

#### 3.4.1 方案比选

| 方案 | 非法 category 过滤 | 条目解绑 | 结论 |
|------|-------------------|----------|------|
| A `list_entries` 非法 code → 400；`DELETE /entries/{id}` draft/active | 硬删 + CASCADE bus_registrations | **采用** — 最小 REST 面 |
| B 过滤返回空列表 | 无 DELETE | 否决 — 与 round-target「非法 catalog code 4xx」不符 |
| C PATCH 清空 categoryCodes | 软解绑 | 否决 — 超出本轮必要面 |

#### 3.4.2 服务与 API 增量

**`list_entries`**：`category` 非空且 ∉ `VALID_CATEGORY_CODES` → `CatalogError("CATALOG_INVALID_CATEGORY", ..., 400)`。

**`DELETE /api/v1/gov/catalog/entries/{entry_id}`**（新增）：
- 存在 → 204；关联 `BusRegistration` 由 FK CASCADE 清除
- 不存在 → 404 `CATALOG_ENTRY_NOT_FOUND`
- 需 `get_current_user`（与 create 同级，不要求 admin）

**枚举完整性测试**：`GET /catalog/categories` 返回恰好 3 条，且 `kind` 分别为 `entity`/`aggregate`/`geo`（在 r30 codes 基础上增字段断言）。

#### 3.4.3 测试策略

| ID | 断言 |
|----|------|
| T-GOV-R31-001-01 | `GET entries?category=CAT-99` → 400 `CATALOG_INVALID_CATEGORY` |
| T-GOV-R31-001-02 | `GET entries?limit=1&offset=0` 分页 total/limit/offset 一致 |
| T-GOV-R31-001-03 | seed 三分法 `kind` 枚举完整 |
| T-GOV-R31-001-04 | 创建 entry → `DELETE` → 204；再 `GET` → 404 |
| T-GOV-R31-001-05 | 删除后 `POST /bus/register` 同 id → 404（与 GOV-002 链一致） |

**验收（可测试）**：

- [ ] 三分法枚举、分页/过滤、非法 code 4xx、条目解绑 smoke pytest 绿
- [ ] GOV-002 登记链引用 catalog 不回归

### 3.5 API-001 — IF-06 数据源 OpenAPI 补全

#### 3.5.1 方案比选

| 方案 | 示例注入点 | 结论 |
|------|-----------|------|
| A 集中 `openapi/extensions.py` 后处理 | 遍历 datasources paths 注入 parameters/responses examples | **采用** — 与 r30 一致，entry 层薄 |
| B 每路由 `openapi_extra` | 分散在 `datasources.py` | 否决 — 文件体量超限风险 |

#### 3.5.2 `extensions.py` 增量

对 `/api/v1/datasources` 及 `/{data_source_id}` 下 GET/PUT/PATCH/DELETE/POST test/metadata：

| 补全项 | 内容 |
|--------|------|
| path 参数 | `data_source_id` example UUID |
| POST 响应 | 201 `DataSourceOut` 示例（无密码明文） |
| GET 列表/详情 | 200 示例含 `id`/`name`/`type` |
| 错误 responses | 401/403/404 描述（components 或 operation-level） |

**`docs/api/README.md`**：核对 IF-06 datasources 行与 OpenAPI operationId 一致；补 `bus/register` 403/幂等说明（若 GOV 节变更）。

#### 3.5.3 测试策略

| ID | 断言 |
|----|------|
| T-API-R31-001-01 | OpenAPI `paths["/api/v1/datasources/{data_source_id}"].get.parameters[0].example` 存在 |
| T-API-R31-001-02 | POST/GET datasources responses 含 `application/json` example 或 `examples` |
| T-API-R31-001-03 | `GET /datasources` 无 Authorization → 401 |
| T-API-R31-001-04 | 内部 M3 CRUD 行为 smoke 不回归（r30 T-API-R30-001-03） |

**验收（可测试）**：

- [ ] OpenAPI 数据源 CRUD 路径参数/响应示例补全；`docs/api/README.md` 一致
- [ ] 契约 smoke、鉴权 401/403 pytest 绿

### 3.6 API-002 — IF-06 execute 边界与 OpenAPI

#### 3.6.1 OpenAPI 补全

**`extensions.py`** 对 `POST /api/v1/query/execute`：

| 补全项 | 内容 |
|--------|------|
| response 200 | `ExecuteResponse` 示例（columns/rows/rowCount/truncated/traceId） |
| responses 400/403 | `QUERY_NOT_READONLY`、`RESOURCE_FORBIDDEN` 描述 + example body |
| parameters | 确认 requestBody `ExecuteRequest` required 字段文档完整 |

#### 3.6.2 边界测试扩展

| ID | 断言 |
|----|------|
| T-API-R31-002-01 | `POST /execute` 无 auth → 401 |
| T-API-R31-002-02 | 不可见 dataSource → 403（强化 r30，固定断言 403 若可见性链确定） |
| T-API-R31-002-03 | `SELECT 1; DELETE FROM t` → 400 `QUERY_NOT_READONLY` |
| T-API-R31-002-04 | OpenAPI execute response 200 example 含 `traceId` |
| T-API-R31-002-05 | r27 RLS guard smoke 不回归（复用现有 `test_query_quality_r27` 标记，本轮不重复实现） |

**验收（可测试）**：

- [ ] IF-06 execute 越权 403、只读拒绝、OpenAPI 参数/示例完整性 pytest 绿
- [ ] API-002 加权总分巩固 ≥91

## 4. PRD 8 维薄弱项对齐

| PRD ID | 薄弱维 | 本轮闭合动作 | 目标 |
|--------|--------|--------------|------|
| VIEW-001 | 完整度 74% | bounds/cycle/fields 结构化 + DASH 回归测试 | ≥88% |
| VIEW-001 | 可靠性 86% | validate 与 layout 互操作全路径覆盖 | ≥90% |
| VIEW-001 | 安全性 84% | 非法引用/越界不可静默通过 | ≥86% |
| GOV-002 | 完整度 76% | timeout/4xx/5xx + 幂等 + traceId 失败体 | ≥88% |
| GOV-002 | 安全性 82% | bus/register admin 403 | ≥88% |
| GOV-001 | 完整度 80% | 非法过滤 4xx + DELETE 解绑 + 枚举断言 | ≥88% |
| GOV-001 | 可靠性 88% | 分页边界 + 登记链删除后 404 | ≥92% |
| API-001 | 完整度 80% | OpenAPI CRUD 示例 + README 对齐 | ≥88% |
| API-002 | 完整度 80% | execute response/error examples | ≥88% |
| API-002 | 可靠性 90% | 多语句只读拒绝 + 403 固定断言 | ≥92% |

## 5. 非目标（明确不做）

- 修改 `docs/automate/goal.md` / `plan.md` 结构
- 前端 `fe/` 任何文件；Admin 治理 UI
- VIEW-002/003、GOV-003~008、API-003~007、CAT-004~007
- 真实总线 HTTP 客户端、BPM 工单、M7 全量 RLS 设计器
- 新 migration（本轮数据模型不变；DELETE 用已有表）
- META-001、DESIGN-001、CONN-021、QUERY-007 等 M8+ 远期项

## 6. 验证与文档同步

**验证命令**：`cd backend && python3 -m ruff check . && python3 -m pytest -v`

**通过门槛**：
- r30 `test_view_gov_api_r30.py` 全绿（回归）
- r31 `test_view_gov_api_r31.py` 新增 ≥18 条全绿
- 总 pytest ≥680 passed（在 r30 662 基线上增量）
- ruff clean

**P3 文档同步**（按 `prd-sync.mdc`）：
- `docs/services/views.md` — 增 bounds/cycle 错误码
- `docs/services/governance.md` — 增幂等、鉴权、DELETE、bus 失败码
- `docs/api/README.md` — GOV DELETE、bus 403/幂等、OpenAPI 示例说明

## 7. UI 设计交付

```yaml
ui_design_skill: none
```

本轮为纯后端质量推分，不触及 `fe/` 或任何 `*.tsx`；不启用前端 UI 门控。

## 8. Spec self-review

| 检查项 | 结果 |
|--------|------|
| 覆盖 round-target 5 子项 | 通过 |
| 范围框定内（18 文件） | 通过 |
| 无 TBD/TODO | 通过 |
| 验收标准可测试 | 通过 |
| ui_design_skill 记录 | `none` |
| 禁止生产代码 | 本文档仅设计，无代码变更 |
