# F14-CAT 查询接口分类

> 模块：附录E · 8 维评分见 [`../prd.md`](../prd.md)

### [CAT-001] CAT-01 实体生命周期查询类

- **状态**：已实现（M6 probe handler L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：一期
- **描述**：CAT-01 实体生命周期查询类（SRS 追溯项）。
- **验收标准**：
  - [x] 模板规格落地（r64 L1：`POST validate` + `POST/GET /api/v1/gov/catalog/lifecycle-templates` + `CAT01_*` 错误域 + stages/entityType 校验 + readOnlyOpenApi 默认 true）
  - [x] companion lifecycle scope ACL + perf probe（r66：`set_user_lifecycle_scope` + `CAT01_FORBIDDEN` 403；GET/stage-move NOT_FOUND 404；`probe_list_lifecycle_templates_budget_ms`/`probe_validate_lifecycle_budget_ms` ≤50ms）
  - [x] M6 catalog probe handler + `GET /api/v1/gov/catalog/m6-probe/cat01` + ACL/perf 回归（`cat01/handler.py` · `test_cat_001_lifecycle_m6.py` T-CAT-001-M6-01~04）
  - [ ] OpenAPI 只读（无 IF-02 `GET /api/v1/entities/{entityType}/{entityId}` 实体查询链）
- **代码锚点**：`backend/app/governance/catalog/cat01/` · `backend/app/governance/catalog/cat01/handler.py` · `backend/app/api/v1/gov.py` · `tests/test_nfr_cat_r64.py` T-CAT-R64-001-01~06 · `tests/test_cat_dash_rpt_meta_r66.py` T-CAT-R66-001-01~06 · `tests/test_cat_001_lifecycle_m6.py`
- **演化建议**：M6 L1 已闭合 m6-probe handler + ACL/perf 回归；后续补 IF-02 实体生命周期只读查询与 fe 模板页
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [CAT-002] CAT-02 统计分析聚合类

- **状态**：已实现（M6 probe handler L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：一期
- **描述**：CAT-02 统计分析聚合类（SRS 追溯项）。
- **验收标准**：
  - [x] aggregate API 模板（r64 L1：`POST validate` + `POST/GET /api/v1/gov/catalog/aggregate-templates` + `CAT02_*` 错误域 + dimensions/metrics/aggregationFn 校验）
  - [x] PoC API 可归属（r64 L1：`attributionLabel` + `tableRef` stub 登记 + list 含已创建项）
  - [x] companion aggregate scope ACL + perf probe（r66：`set_user_aggregate_scope` + `CAT02_FORBIDDEN` 403；duplicate dimensions/metrics 422；`probe_validate_aggregate_budget_ms`/`probe_list_aggregate_budget_ms` ≤50ms）
  - [x] M6 catalog probe handler + `GET /api/v1/gov/catalog/m6-probe/cat02` + ACL/perf 回归（`cat02/handler.py` · `test_cat_002_aggregate_m6.py` T-CAT-002-M6-01~04）
  - [x] IF-02 `GET /api/v1/stats/aggregate` 真实聚合查询链（F-F companion：`templateKey` + `groupBy` PoC · `cat02/query.py` · `test_cat002_if02.py` T-CAT-002-IF02-01~05）
- **代码锚点**：`backend/app/governance/catalog/cat02/` · `backend/app/governance/catalog/cat02/handler.py` · `backend/app/governance/catalog/cat02/query.py` · `backend/app/api/v1/stats.py` · `backend/app/api/v1/gov.py` · `tests/test_nfr_cat_r64.py` T-CAT-R64-002-01~06 · `tests/test_cat_dash_rpt_meta_r66.py` T-CAT-R66-002-01~06 · `tests/test_cat_002_aggregate_m6.py` · `tests/test_cat002_if02.py`
- **演化建议**：M6 L1 已闭合 m6-probe handler + ACL/perf 回归；stats/aggregate PoC 已闭合；后续补数据源绑定与 fe 模板页
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [CAT-003] CAT-03 地域维度查询类

- **状态**：已实现（M6 probe handler L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：一期
- **描述**：CAT-03 地域维度查询类（SRS 追溯项）。
- **验收标准**：
  - [x] geo distribution 模板（r61 L1：`POST/GET/DELETE /api/v1/gov/geo-regions` + move + `CAT03_*` 错误域 + MAX_DEPTH=8 + code 冲突/环检测）
  - [x] companion region scope ACL + perf probe（r65：`set_user_region_scope` + `CAT03_FORBIDDEN` 403；viewer create 403；`probe_geo_list_budget_ms`/`probe_geo_move_budget_ms` ≤50ms）
  - [x] M6 catalog probe handler + `GET /api/v1/gov/catalog/m6-probe/cat03` + ACL/perf 回归（`cat03/handler.py` · `test_cat_003_region_m6.py` T-CAT-003-M6-01~04）
  - [x] M7 地域权限（F-F companion：`regionColumn` RLS 注入 · `query/rls/region_scope.py` · `test_cat003_region_rls.py` T-CAT-003-RLS-01~05）
- **代码锚点**：`backend/app/governance/catalog/cat03/` · `backend/app/governance/catalog/cat03/handler.py` · `backend/app/query/rls/region_scope.py` · `backend/app/query/rls/guard.py` · `backend/app/api/v1/gov.py` · `tests/test_cat_rpt_meta_r65.py` T-CAT-R65-003-01~07 · `tests/test_cat_dash_viz_nfr_r61.py` T-CAT-R61-003-01~06 · `tests/test_cat_003_region_m6.py` · `tests/test_cat003_region_rls.py`
- **演化建议**：M6 L1 已闭合 m6-probe handler + ACL/perf 回归；regionScope RLS 注入已闭合；后续补 fe geo distribution 模板
- **里程碑对齐**：M6 · 已完成 · 2026-07-06
### [CAT-004] CAT-04 时间序列分析类

- **状态**：已实现（M11 m11-probe L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：二期
- **描述**：CAT-04 时间序列分析类（SRS 追溯项）。r59 交付分类树 L1；r65 companion ACL/perf；r237 交付 `cat04/handler.py` + `GET /api/v1/gov/catalog/classification/m11-probe` 聚合 list/move/ACL 探测。
- **验收标准**：
  - [x] 分类树 CRUD + move + 环检测（r59 L1：`POST/GET/DELETE /api/v1/gov/classification` + move + `CAT_CLASS_*` + MAX_DEPTH=8）
  - [x] companion classification scope ACL + perf probe（r65：`set_user_class_scope` + `CAT_CLASS_FORBIDDEN` 403；move/delete NOT_FOUND 404；`probe_class_list_budget_ms`/`probe_class_move_budget_ms` ≤50ms）
  - [x] M11 catalog m11-probe handler + ACL 回归（r237：`run_cat04_catalog_probe` · `test_m11_batch3_r237.py` T-CAT-R237-004-01~02）
  - [ ] timeseries API 模板与粒度/同比环比参数（IF-02 远期）
- **代码锚点**：`backend/app/governance/catalog/classification/` · `backend/app/governance/catalog/cat04/handler.py` · `backend/app/api/v1/gov.py` · `tests/test_m11_batch3_r237.py` T-CAT-R237-004-01~02
- **演化建议**：补 `GET /api/v1/timeseries` 模板与粒度/同比环比参数；真实时序库 E2E
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [CAT-005] CAT-05 工单与业务受理类

- **状态**：已实现（M11 m11-probe L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：二期
- **描述**：CAT-05 工单与业务受理类（SRS 追溯项）。r61 L1 ticket-stats 模板；r63 companion ACL/perf；r237 交付 `cat05/handler.py` + `GET /api/v1/gov/catalog/tickets/m11-probe` 聚合 stats/ACL 探测。
- **验收标准**：
  - [x] tickets stats 模板（r61 L1：`POST validate` + `POST/GET /api/v1/gov/ticket-stats` + stats probe + `CAT05_*` 错误域 + statusFilters 校验）
  - [x] companion ticket ACL + perf probe（r63：enterprise scope `CAT05_FORBIDDEN`；viewer create 403；`probe_ticket_stats_budget_ms` ≤50ms；viewer stats 只读 200）
  - [x] M11 catalog m11-probe handler + ACL 回归（r237：`run_cat05_catalog_probe` · `test_m11_batch3_r237.py` T-CAT-R237-005-01~04）
  - [ ] 权限绑定工单表与真实数据源查询链（远期）
- **代码锚点**：`backend/app/governance/catalog/cat05/` · `backend/app/governance/catalog/cat05/handler.py` · `backend/app/api/v1/gov.py` · `tests/test_m11_batch3_r237.py` T-CAT-R237-005-01~04
- **演化建议**：补工单表 ACL 与 M3-LITE 数据源绑定；fe 工单统计页
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [CAT-006] CAT-06 生产与销售统计类

- **状态**：已实现（M11 m11-probe L1）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：二期
- **描述**：CAT-06 生产与销售统计类（SRS 追溯项）。r62 L1 production-stats 模板；r65 companion ACL/perf；r237 交付 `cat06/handler.py` + `GET /api/v1/gov/catalog/production-stats/m11-probe` 聚合 validate/stats/ACL 探测。
- **验收标准**：
  - [x] production stats 模板（r62 L1：`POST validate` + `POST/GET /api/v1/gov/production-stats` + stats probe + `CAT06_*` 错误域 + vendorType/metricKeys 校验）
  - [x] 企业域隔离（r62 L1：`enterprise` 角色 brand scope 守卫 + `CAT06_BRAND_FORBIDDEN` 403）
  - [x] companion stats ACL + perf probe（r65：enterprise list 过滤；empty metrics `CAT06_EMPTY_METRICS` 422；`probe_production_stats_budget_ms`/`probe_production_validate_budget_ms` ≤50ms）
  - [x] M11 catalog m11-probe handler + ACL 回归（r237：`run_cat06_catalog_probe` · `test_m11_batch3_r237.py` T-CAT-R237-006-01~04）
  - [ ] 真实生产数据源查询链与 fe 统计页（远期）
- **代码锚点**：`backend/app/governance/catalog/cat06/` · `backend/app/governance/catalog/cat06/handler.py` · `backend/app/api/v1/gov.py` · `tests/test_m11_batch3_r237.py` T-CAT-R237-006-01~04
- **演化建议**：补 M3-LITE 绑定与 fe 生产统计 UI；跨品牌报表口径
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [CAT-007] CAT-07 组织行为审计类

- **状态**：已实现（M12 r238）
- **goal_ref**：goal.md §2.5（G5）
- **期次**：三期
- **描述**：CAT-07 组织行为审计类（SRS 追溯项）。
- **验收标准**：
  - [x] workno behavior 模板（r60 L1：`GET /api/v1/workno/behavior` + mock behaviors + `CAT07_*` 错误域 + limit/offset 分页）
  - [x] companion enterprise/viewer scope ACL + perf probe（r64：`set_user_workno_scope` + `CAT07_FORBIDDEN` 403；viewer 跨 scope 403；`probe_workno_behavior_budget_ms` ≤50ms）
  - [x] m12-probe handler（r238：`GET /api/v1/catalog/m12-probe` + CAT-07 taxonomy + elapsed budget）
  - [ ] 审计日志联动（无真实 audit store 写入与跨系统 trace 链）
- **代码锚点**：`backend/app/governance/catalog/cat07/` · `backend/app/governance/catalog/m12_probe.py` · `backend/app/api/v1/workno.py` · `tests/test_m12_batch1_r238.py` T-CAT-R238-* · `tests/test_nfr_cat_r64.py` T-CAT-R64-007-01~07 · `tests/test_rpt_view_cat_gov_r60.py` T-CAT-R60-007-01~07
- **演化建议**：r238 闭合 m12-probe handler 与 M12 集成门控；真实审计日志联动与 fe 行为审计 UI 留 companion
- **里程碑对齐**：M12 · 已完成 · 2026-07-07
