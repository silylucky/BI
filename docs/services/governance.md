# governance — 治理与数据目录

| 字段 | 值 |
|------|-----|
| 模块路径 | `backend/app/governance/` |
| PRD | [F10-GOV](../automate/prd/F10-GOV.md) · [F14-CAT](../automate/prd/F14-CAT.md) |
| 里程碑 | M6（L1 kickoff） |
| 状态 | **L1 + F-E 批次 1（GOV-003 自定义模板）** |

## 职责

- 查询接口 catalog 三分法（CAT-01/02/03）分类与条目登记（GOV-001）
- 总线 PoC 半自动注册 adapter 与登记 API（GOV-002）
- 可视化查询设计聚合 validate/save/get（GOV-004）
- 查询设计权限联动与 RLS 绑定守卫（GOV-008）
- 查询服务发布状态机 submit/approve/reject（GOV-005）
- **分类树节点**（`catalog/classification/`）：内存树 CRUD/move、环检测与深度守卫（CAT-004）
- **地域 geo 树**（`catalog/cat03/`）：内存树 CRUD/move、环检测与 `MAX_GEO_DEPTH=6`（CAT-003）
- **工单 stats item**（`catalog/cat05/`）：扁平 item 登记 + validate/stats probe（CAT-005）
- **工号行为审计**（`catalog/cat07/`）：mock seed + `GET /workno/behavior`（CAT-007）
- **总线全自动注册 FSM**（`bus/auto.py` + `bus/pipeline.py`）：`POST /gov/bus/auto-register`、发布 approve 钩子、`POST .../retry`（GOV-007）
- **治理 ACL 矩阵**（`acl_matrix.py` + `acl.py`）：publish/workflow/bus 守卫；`gov_catalog_entry` 资源授权（GOV-008）
- 工单流程模板与五态 FSM 实例（GOV-003）；**自定义模板 CRUD**（`workflow_template` config_store；builtin 只读）
- 发布引擎 OpenAPI 映射 store（GOV-006）
- 为开放 API 登记与 BPM 流水线奠基

## 边界

| In | Out |
|----|-----|
| catalog 分类/条目 CRUD、bus PoC 登记记录 | 查询执行（→ `query`） |
| classification 树节点 CRUD/move（内存 L1；`MAX_CLASS_DEPTH=8`） | timeseries 模板完整实现（CAT-04 companion） |
| `catalog/cat03/` geo region 树（内存 L1；`MAX_GEO_DEPTH=6`；与 classification 独立 store） | M7 地域权限 RLS（companion） |
| `catalog/cat05/` tickets stats item 扁平登记 + mock stats probe | 真实工单表联调、权限绑定工单表 |
| workflow 模板校验 + 五态 FSM 实例持久化 | 完整 BPM 工单与审批流水线 UI（GOV-003+） |
| openapi 映射 store（published entry 校验 + entityTypeRef） | 与 `publish_service` 串联的跨域发布（本域 workflow 独立） |
| `catalog/cat07/` workno behavior mock；`bus/auto.py` 全自动注册 FSM | 真实审计 DB、publish hook 内嵌、真实总线 HTTP |
| | 认证授权（→ `auth`） |

## 依赖

- `core`、`datasources`（元库 ORM Base）
- `governance`（publish 状态）、`metadata/entity`（entityTypeRef 校验）

## 主要类型 / 入口

| 符号 | 说明 | PRD | 状态 |
|------|------|-----|------|
| `CatalogCategory` / `CatalogEntry` | catalog ORM | GOV-001 | 已实现 |
| `BusRegistration` | 总线登记记录 | GOV-002 | 已实现 |
| `BusPoCAdapter` / `InMemoryBusPoCAdapter` | PoC 注册适配器 | GOV-002 | 已实现 |
| `GET/POST/DELETE /api/v1/gov/catalog/*` | catalog API | GOV-001 | 已实现 |
| `POST /api/v1/gov/bus/register` | 半自动注册 API（admin；幂等） | GOV-002 | 已实现 |
| `bus/poc_fsm.py` | semi-auto FSM `pending/registered/failed`；`set_user_bus_register_scope` enterprise path ACL | GOV-002 | 已实现 |
| `GET /gov/bus/register/fsm` · `GET /gov/bus/register/probe` | semi-auto FSM 查询与 perf probe | GOV-002 | 已实现 |
| CAT-001~003 | `cat0x/handler.py` + `GET .../m6-probe` M6 集成验收面 | CAT-001~003 | 已实现 |
| `POST /api/v1/gov/bus/auto-register` | 全自动注册 FSM（integration/admin；幂等） | GOV-007 | L1 已实现 r60 |
| `bus/pipeline.py` | `trigger_auto_bus_register` 发布钩子 + retry + audit | GOV-007 | 已实现 r247 |
| `integration/bus_adapter_factory.py` | IF-01 `get_bus_adapter()` 统一 `RetryingBusAdapter` 构造（r248） | GOV-007 | 已实现 r248 |
| `bus/degradation.py` | publish 源失败降级 FSM `deferred` + `bus_auto_register_deferred` 审计（r248） | GOV-007 | 已实现 r248 |
| `acl_matrix.py` | `describe_gov_permission_matrix` + `GET /gov/acl/matrix` | GOV-008 | 已实现 r247 |
| `acl.py` | publish/workflow/bus `assert_*` 守卫 + `gov_catalog_entry` grant + self-approve（r248） | GOV-008 | 已实现 r248 |
| `GET /api/v1/workno/behavior` | CAT-07 工号行为审计查询 mock | CAT-007 | L1 已实现 r60 |
| `query_design/` | 可视化查询设计聚合 + 工单快照投影/确认 | GOV-004 | 已实现 r246 |
| `acl.py` | 查询设计 save/publish 权限联动 + RLS smoke | GOV-008 | 已实现 |
| `POST/PUT/GET /api/v1/gov/query-design*` | 可视化查询设计 validate/save/get | GOV-004/008 | 已实现 |
| `governance/publish/` | 查询服务发布状态机 + from-workflow 发布链 | GOV-005 | 已实现 r246 |
| `governance/workflow/` | 工单模板 + 五态 FSM + 实例列表 | GOV-003/004 | 已实现 r246 |
| `governance/openapi/` | 发布 OpenAPI 3.1 文档生成 + mapping | GOV-006 | 已实现 r246 |
| `POST/GET /api/v1/gov/publish/entries/{id}/*` | 发布工作流 REST 骨架 | GOV-005 | 已实现 L1 |
| `GET /api/v1/gov/publish/entries/{id}/notifications` | 审批通知事件列表（内存 store） | GOV-005 | 已实现 companion |
| `GET/POST /api/v1/gov/workflow/*` | 工单模板/实例/迁移 REST | GOV-003 | 已实现 L1 |
| `catalog/classification/service` | 分类树内存 store + cycle/depth 守卫 | CAT-004 | L1 已实现 r59 |
| `catalog/cat03/service` | 地域 geo 树内存 store + cycle/depth 守卫 | CAT-003 | L1 已实现 r61 |
| `catalog/cat05/service` | 工单 stats item validate/create/list/stats probe | CAT-005 | L1 已实现 r61 |
| `catalog/cat06/service` | 生产销售统计 validate/create/list/stats probe | CAT-006 | L1 已实现 r62 |
| `catalog/cat01/service` | lifecycle 模板 validate/create/list/get/stage-move + scope ACL | CAT-001 | companion 已实现 r66 |
| `catalog/cat02/service` | aggregate 模板 validate/create/list + scope ACL | CAT-002 | companion 已实现 r66 |

### r66 companion 质量推分（CAT-001/002）

- **CAT-001**（`catalog/cat01/`）：`set_user_entity_scope` + `CAT01_FORBIDDEN`（viewer 写禁止 / enterprise `entityTypeCode` 前缀 scope）；`get_lifecycle_template` / `move_lifecycle_stage` NOT_FOUND 闭合（`CAT01_NOT_FOUND` / `CAT01_STAGE_NOT_FOUND` / `CAT01_STAGE_INDEX_OUT_OF_BOUNDS`）；`probe_list_lifecycle_templates_budget_ms` / `probe_validate_lifecycle_budget_ms` ≤50ms
- **CAT-002**（`catalog/cat02/`）：`set_user_aggregate_scope` + `CAT02_FORBIDDEN`；`list_aggregate_templates` enterprise 过滤；duplicate dimension/metric（`CAT02_DUPLICATE_DIMENSION` / `CAT02_DUPLICATE_METRIC`）；`probe_validate_aggregate_budget_ms` / `probe_list_aggregate_budget_ms` ≤50ms

### r65 companion 质量推分（CAT-003/004/006）

- **CAT-003**：`cat03/probe.py` — `probe_list_geo_nodes_budget_ms` / `probe_move_geo_region_budget_ms` ≤50ms；`set_user_region_scope` + `CAT03_FORBIDDEN`（viewer 写禁止 / enterprise regionCode 前缀 scope）；create/move/delete 透传 `UserContext`
- **CAT-004**：`classification/probe.py` — list/move perf probe ≤50ms；`CAT_CLASS_NOT_FOUND`（move/delete 未知 node）；`set_user_class_scope` + `CAT_CLASS_FORBIDDEN` classification scope ACL
- **CAT-006**：`get_production_stats(user)` brand ACL；`list_production_stats(user)` enterprise 按 `brandId` 过滤；`probe_production_stats_budget_ms` / `probe_validate_production_stats_budget_ms` ≤50ms；`CAT06_EMPTY_METRICS` 常量导出

## 关联 API

见 [api/README.md](../api/README.md) §治理。

## 实现笔记

- migration `0014` seed CAT-01~03；`trace_id` 取自 `trace_id_var`
- `force-fail` path 段触发 PoC adapter 拒绝（502 `BUS_REGISTRATION_REJECTED`）
- r31：`list_entries` 非法 `category` → 400 `CATALOG_INVALID_CATEGORY`；`DELETE /gov/catalog/entries/{id}` → 204（CASCADE `bus_registrations`）
- r31：`POST /gov/bus/register` 需 admin 角色；幂等二次登记 200；失败码 `BUS_REGISTRATION_TIMEOUT`/`CLIENT_ERROR`/`SERVER_ERROR`；失败响应 `detail.traceId`
- r34：`query_design/` 聚合 `VisualQueryDesignIn/Out`；validate 委托 `designer.service`；持久化 `config_type=visual_query_design`；`acl.py` 按 status/角色守卫 save；非 UUID dev token 跳过 RLS binding smoke

### r35 companion 质量推分（GOV-004/008）

- **GOV-008**：`assert_query_design_execute` + `POST /api/v1/gov/query-design/preview-execute`；viewer 403 `GOV_ACL_FORBIDDEN`；designer 无 org 403 `GOV_RLS_BINDING_REQUIRED`；admin bypass 审计日志 `gov_acl_bypass`；空 RLS 链返回 `rlsFragment: "1=0"`
- **GOV-004**：gov validate 覆盖 `DESIGN_EMPTY_CONDITIONS`、`DESIGN_INVALID_AGGREGATE`（computeRules）、`GOV_QUERY_DESIGN_INVALID`、`GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE`、`GOV_QUERY_DESIGN_NOT_FOUND`、`CONFIG_VERSION_CONFLICT` 均含 `detail.fields`（适用时）

### r46 L1 kickoff（GOV-005）

- **GOV-005**：`governance/publish/service` 在 `CatalogEntry.status` 上编排 `draft→pending_publish→published`；非法迁移 → 400 `GOV_PUBLISH_INVALID_TRANSITION`；pending 重复 submit → 409 `GOV_PUBLISH_ALREADY_PENDING`
- integration 快路径 `POST /api/v1/services/{id}/publish` 仍保留 `draft→published`（r45 companion 不变）

### r51 companion 质量推分（GOV-005）

- **GOV-005**：`governance/publish/notifications.py` 内存 `_PUBLISH_NOTIFICATIONS`；`submit`/`approve`/`reject` 成功后 `emit_publish_notification`；幂等 double approve 不重复发 approved 通知；`GET /gov/publish/entries/{id}/notifications` 只读；非持久化、非真实 IM 发送

### r49 L1 kickoff（GOV-003）

- **GOV-003**：`governance/workflow/service` 内置 `standard_query_release` 模板；五态 FSM `draft→pending_approval→designing→pending_publish→published`；实例持久化 `config_type=workflow_instance`；不调用 `publish_service`

### r52 companion 质量推分（GOV-003）

- **GOV-003**：`governance/workflow/node_roles.py` — `describe_node_roles` / `resolve_required_role` / `probe_transition_path`（<50ms smoke）；模板校验要求 `draft`+`published` 节点（缺节点 `detail.missingNodes`）；`GOV_WORKFLOW_CONFLICT`（重复 submit）、`GOV_WORKFLOW_ALREADY_TERMINAL`（published 后再迁移）；`GET /gov/workflow/templates/{id}/node-roles`

### r55 companion 质量推分（GOV-006）

- **GOV-006**：`SUPPORTED_API_VERSIONS` 仅 `v1`；`GOV_OPENAPI_MAP_UNSUPPORTED_VERSION` / `GOV_OPENAPI_MAP_INVALID_OPERATION_ID`；`validate_mapping` → `OpenApiMappingValidateOut`；`deactivate_mapping` + `GOV_OPENAPI_MAP_ALREADY_INACTIVE`（409）；`probe_openapi_validate_budget_ms=50`

### r63 companion 质量推分（CAT-005）

- `cat05/_assert_ticket_access` / `set_user_ticket_scope`；`CAT05_FORBIDDEN`（viewer 写 / enterprise scope 外读）
- `probe_ticket_stats_budget_ms`（50ms smoke）

### r68 companion 质量推分（GOV-007）

- **GOV-007**：`bus/auto.py` — failed/auto_registering 状态重试 → 409 `GOV_AUTO_BUS_INVALID_TRANSITION`；`set_user_auto_bus_scope` + enterprise entry path scope（`GOV_AUTO_BUS_FORBIDDEN`）；`bus/probe.py` — `probe_auto_register_budget_ms` ≤50ms；`GET /gov/bus/auto-register/probe`

### r248 companion 收官（GOV-007/008）

- **GOV-007**：`integration/bus_adapter_factory.get_bus_adapter()` IF-01 统一适配器；publish 源总线失败 → FSM `deferred` + `bus_auto_register_deferred` 审计（不 rollback 发布）；`PublishActionOut.busRegisterStatus`/`busRegisterErrorCode`；手动 auto-register 仍 `failed` + 502
- **GOV-008**：`GOV_ACL_SELF_APPROVE_FORBIDDEN`（publisher 自批 submitter）；workflow `publish` action 要求 publisher/admin；`record_publish_submitter` 内存追踪

### M11 m11-probe（CAT-04~06）

- `GET .../classification|tickets|production-stats/m11-probe` 聚合 list/validate/move 或 stats probe + `aclReady`
- 与 M6 `m6-probe` 路由并存；不替代 CRUD
- CAT-04 委托 `classification/`；不实现真实 timeseries API
