# F10-GOV 查询服务治理

> 模块：M8 · 8 维评分见 [`../prd.md`](../prd.md)

### [GOV-001] 查询接口分类 catalog 附录 E

- **状态**：已实现（M6 appendix E L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：一期
- **描述**：查询接口分类 catalog 附录 E（SRS 追溯项）。
- **验收标准**：
  - [x] CAT-01/02/03 三分法 taxonomy seed + list API（r30 L1）
  - [x] catalog 条目 CRUD + 分类挂载
  - [x] 非法 category 过滤 4xx + 分页边界 + DELETE 解绑（r31，`CATALOG_INVALID_CATEGORY`）
  - [x] 7 类 taxonomy 可配置（M6 r219：`GET /api/v1/gov/catalog/appendix-e` CAT-01~07 + `appendix_e.py` schema；`categories` 同步 7 类）
  - [x] appendix E probe ≤50ms + enterprise ACL `GOV_APPENDIX_E_FORBIDDEN`（`test_gov_001_catalog_appendix_e.py` T-GOV-001-04~05）
  - [ ] WS-01 对齐纪要
- **代码锚点**：`backend/app/governance/catalog/` · `backend/app/governance/catalog/appendix_e.py` · `backend/app/governance/catalog/probe.py` · `backend/migrations/versions/0014_gov_catalog.py` · `backend/app/api/v1/gov.py` · `tests/test_gov_001_catalog_appendix_e.py`
- **演化建议**：M6 L1 已闭合 7 类 appendix E taxonomy + probe/ACL；后续补 WS-01 对齐纪要与 Admin UI
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [GOV-002] 总线 PoC 半自动注册 FR-1.1

- **状态**：已实现（M6 PoC FSM L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：一期
- **描述**：总线 PoC 半自动注册 FR-1.1（SRS 追溯项）。
- **验收标准**：
  - [x] `POST /api/v1/gov/bus/register` 半自动注册（内存 adapter）
  - [x] OpenAPI operationId 与登记回执（traceId/busId）
  - [x] 总线失败路径：timeout/4xx/5xx + 幂等登记 + admin 403（r31）
  - [x] M6 semi-auto FSM pending/registered/failed + `GET /api/v1/gov/bus/register/fsm` + scope ACL + probe ≤50ms（`poc_fsm.py` · `test_gov_002_bus_poc_fsm.py` T-GOV-002-01~06）
  - [ ] ≥2 真实总线端点对接
  - [ ] 完整审批工单流水线
- **代码锚点**：`backend/app/governance/bus/poc.py` · `backend/app/governance/bus/poc_fsm.py` · `backend/app/governance/bus/probe.py` · `backend/app/governance/catalog/service.py` · `backend/app/api/v1/gov.py` · `tests/test_gov_002_bus_poc_fsm.py`
- **演化建议**：M6 L1 已闭合 semi-auto FSM + GET/probe/ACL；后续接 ≥2 真实总线 HTTP 端点与 GOV-007 全自动发布
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [GOV-003] 工单流程模板 FR-1.2

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：工单流程模板 FR-1.2（SRS 追溯项）。
- **验收标准**：
  - [x] 草稿→待审批→设计中→待发布→已发布（r49 L1 + r245 FSM happy path T-GOV-R245-003-06）
  - [x] 节点角色描述与 resolve（r52 companion + r245 自定义模板 `describe_node_roles` T-GOV-R245-003-03）
  - [x] 节点角色可配置（r245：`POST/PUT/DELETE /workflow/templates` 自定义模板 + `CreateWorkflowTemplateDialog`；内置 `standard_query_release` 只读 T-GOV-R245-003-01~05）
- **代码锚点**：`backend/app/governance/workflow/` · `backend/app/governance/workflow/templates_store.py` · `backend/app/governance/workflow/node_roles.py` · `backend/app/api/v1/gov.py` · `fe/src/pages/admin/governance/components/CreateWorkflowTemplateDialog.tsx` · `tests/test_mfinal_fe_design_r245.py` T-GOV-R245-003-01~08
- **演化建议**：F-E 批次 1 已闭合自定义模板 CRUD 与 FSM；远期可补 BPM 可视化编排与审批收件箱 UI
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [GOV-004] 可视化查询设计 FR-1.3

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：可视化查询设计 FR-1.3（SRS 追溯项）。
- **验收标准**：
  - [x] 查询条件 validate/save/get API（`visual_query_design` config_store，r34 L1）
  - [x] 未知 fieldId → 422 + `detail.fields`（r34）
  - [x] revision 乐观锁冲突 → 409 `CONFIG_VERSION_CONFLICT`（r34）
  - [x] 空 conditions、非法 aggregate、blank title、未知 dataSourceId、get 404 边界 + `detail.fields`（r35）
  - [x] 拖拽配置查询条件与运算规则（r245 设计器三面板 DESIGN-001~003 + r246 工单快照投影）
  - [x] 审批态设计确认（r246：`GET approved-design` + `POST confirm-design` viewer 403 / 双确认 409；`query-design` 可读 T-GOV-R246-004-01~06）
- **代码锚点**：`backend/app/governance/query_design/service.py` · `backend/app/api/v1/gov.py` · `fe/src/pages/admin/governance/WorkflowInstancesPanel.tsx` · `tests/test_mfinal_fe_design_r246.py` T-GOV-R246-004-01~06 · `tests/test_connectors_gov_r34.py` · `tests/test_connectors_gov_r35.py`
- **演化建议**：r246 闭合工单快照→审批态设计确认链；远期可补 explore 元数据拖入与独立治理设计器页
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [GOV-005] 查询服务发布 FR-1.4

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：查询服务发布 FR-1.4（SRS 追溯项）。
- **验收标准**：
  - [x] 发布审批后自动创建接口（draft→pending_publish→published FSM + integration list 可见，r46 L1）
  - [x] 审批通知钩子（submit/approve/reject 通知 + 幂等双批单通知，r51 companion）
  - [x] 从工单实例发布（r246：`POST /gov/publish/from-workflow` 非法态 400 / viewer 403 / 幂等 T-GOV-R246-005-01~04）
  - [x] catalogEntryId 回写 workflow-link + 版本回滚骨架（r246 T-GOV-R246-005-05~06；FE `GovernancePublishPage` 行内发布 T-GOV-R246-FE-03）
  - [x] 发布页 → 查询服务导航串联 + `/admin/services` 列表页（M-PRODUCT F-A；`GovernancePublishPage` · `QueryServicesPage`）
- **代码锚点**：`backend/app/governance/publish/service.py` · `backend/app/governance/publish/notifications.py` · `backend/app/api/v1/gov.py` · `fe/src/pages/admin/governance/GovernancePublishPage.tsx` · `fe/src/pages/admin/services/QueryServicesPage.tsx` · `tests/test_mfinal_fe_design_r246.py` T-GOV-R246-005-01~06
- **演化建议**：M-PRODUCT F-D P4-SMOKE 发布→服务试跑浏览器链；远期可补申请人收件箱通知与 BPM 可视化编排
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07；M-PRODUCT F-A · 服务页 FE · 2026-07-08
### [GOV-006] 发布引擎 OpenAPI 映射

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：发布引擎 OpenAPI 映射（SRS 追溯项）。
- **验收标准**：
  - [x] 配置项自动映射 OpenAPI（published catalog entry → openapi-mappings store）
  - [x] validate 端点支持 entityTypeRef 与 path 前缀校验
  - [x] apiVersion 边界 + operationId 校验 + deactivate 幂等（r55 companion）
  - [x] 发布后 OpenAPI 3.1 文档生成（r246：`GET /publish/entries/{id}/openapi` draft 422 `GOV_OPENAPI_DOC_NOT_PUBLISHED`；`redact_openapi_fields`；probe ≤50ms T-GOV-R246-006-01~06）
  - [x] Admin OpenAPI 预览（r246 FE `GovernancePublishPage` Sheet T-GOV-R246-FE-04）
  - [ ] 只读 GET 查询聚合文档（多 entry 合并导出留远期）
- **代码锚点**：`backend/app/governance/openapi/service.py` · `backend/app/api/v1/gov.py` · `fe/src/pages/admin/governance/GovernancePublishPage.tsx` · `tests/test_mfinal_fe_design_r246.py` T-GOV-R246-006-01~06 · `tests/test_rpt_gov_meta_conn_r55.py` T-GOV-R55-01~08
- **演化建议**：r246 闭合单 entry OpenAPI 3.1 生成与脱敏；远期可补多 entry 聚合导出与 Swagger UI
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [GOV-007] 总线全自动注册 FR-1.1

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：总线全自动注册 FR-1.1（SRS 追溯项）。
- **验收标准**：
  - [x] 发布引擎→总线全自动（r60 L1：`POST /api/v1/gov/bus/auto-register` + FSM draft→registering→succeeded/failed + 幂等 201/200）
  - [x] ≥ PoC 能力（integration/admin 角色；published catalog entry 前置；403 `GOV_AUTO_BUS_*` 守卫；mock busId）
  - [x] companion FSM 非法转移守卫 + path scope + HTTP probe（r68：`GOV_AUTO_BUS_INVALID_TRANSITION` 409 failed→retry；`set_user_auto_bus_scope` enterprise 403；`GET /api/v1/gov/bus/auto-register/probe` ≤50ms；r60 force_fail 回归保留）
  - [x] publish 审批链触发总线注册 + 重试管线 + 审计事件（r247：`trigger_auto_bus_register` pipeline；`POST approve` 联动；`POST /bus/auto-register/retry`；`BUS_REGISTER_RETRY_EXHAUSTED` 502；audit `traceId`；T-GOV-R247-007-01~08）
  - [x] IF-01 工厂共用 + publish 源 deferred 降级 + busRegisterStatus（r248：`bus_adapter_factory.get_bus_adapter`；approve force-timeout → 200 published + `busRegisterStatus=deferred`；deferred FSM + `bus_auto_register_deferred` 审计；retry deferred→succeeded；P4-SMOKE 尾段；T-GOV-R248-007-01~09）
  - [ ] 真实总线 HTTP 对接与生产级熔断
- **代码锚点**：`backend/app/integration/bus_adapter_factory.py` · `backend/app/governance/bus/degradation.py` · `backend/app/governance/bus/pipeline.py` · `backend/app/governance/publish/service.py` · `backend/app/api/v1/gov.py` · `tests/test_mfinal_fe_gov_batch4_r248.py` T-GOV-R248-007-01~09 · `tests/test_mfinal_fe_gov_batch3_r247.py` T-GOV-R247-007-01~08
- **演化建议**：r248 闭合 IF-01 工厂、publish 源 deferred 降级与 P4-SMOKE 尾段；后续补真实总线 HTTP 端点与生产熔断
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [GOV-008] 治理权限联动 FR-1.6

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：治理权限联动 FR-1.6（SRS 追溯项）。
- **验收标准**：
  - [x] query-design save `pending_publish` ACL（viewer 403 `GOV_ACL_FORBIDDEN`，admin 200，r34）
  - [x] RLS 绑定 smoke（`resolve_user_org_node_ids` + `get_query_rls_fragment`，r34 mock）
  - [x] `POST preview-execute` ACL/RLS 链：viewer 403、designer 无 org 403、admin bypass 审计、空 RLS 链、save 联合回归（r35）
  - [x] 发布/审批/总线角色矩阵 + resource grant 守卫（r247：`acl_matrix.py` + `GET /gov/acl/matrix`；`assert_publish_approve`/`assert_workflow_action`/`assert_bus_register`；`gov_catalog_entry` grants；T-GOV-R247-008-01~07）
  - [x] self-approve 禁止 + workflow publish 守卫补洞（r248：`assert_workflow_action` self-approve/requester 403；matrix 9 actions；viewer publish/approve 403；publisher 无 grant 403；approver bus auto-register 403；T-GOV-R248-008-01~06）
  - [ ] 发布后 RLS 端到端生效（真实 org 绑定全链路）
- **代码锚点**：`backend/app/governance/acl_matrix.py` · `backend/app/governance/acl.py` · `backend/app/auth/resources/service.py` · `backend/app/api/v1/gov.py` · `tests/test_mfinal_fe_gov_batch4_r248.py` T-GOV-R248-008-01~06 · `tests/test_mfinal_fe_gov_batch3_r247.py` T-GOV-R247-008-01~07
- **演化建议**：r248 闭合 self-approve/workflow publish 守卫与矩阵越权回归；后续补发布后 RLS 端到端与真实 org 回归
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
