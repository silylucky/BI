# F11-META 元数据语义层

> 模块：M1 · 8 维评分见 [`../prd.md`](../prd.md)

### [META-001] 术语字典

- **状态**：已实现（M-FINAL F-D r244 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：术语字典（SRS 追溯项）。
- **验收标准**：
  - [x] 业务术语 CRUD（r32 L1：`GlossaryTerm` + `POST/GET/PUT/DELETE /api/v1/metadata/glossary`）
  - [x] 写 ACL + 空名拦截 + 引用中删除 409 + list perf probe（r244：`metadata/_acl.py` viewer POST/PUT 403；`probe_list_terms_budget_ms` ≤50ms；`test_mfinal_fd_meta_r244.py` T-META-R244-001-01~06）
  - [x] Admin 术语面板 CRUD（r244：`fe/src/pages/admin/metadata/glossary-panel.tsx` + `MetadataHubPage`）
  - [x] 与物理字段映射（companion F-F：`PUT/GET /glossary/{id}/field-mappings` + `term-field-mapping-dialog.tsx`；`test_meta_ff_companion_r251.py` T-META-FF-001）
- **代码锚点**：`backend/app/metadata/glossary/` · `backend/app/metadata/_acl.py` · `backend/app/api/v1/metadata.py` · `fe/src/pages/admin/metadata/glossary-panel.tsx` · `tests/test_mfinal_fd_meta_r244.py` T-META-R244-001-01~06
- **演化建议**：r244 收官 F-D plan 术语字典（写 ACL + probe + Admin UI）；物理字段映射留 companion
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07
### [META-002] 业务主题树

- **状态**：已实现（M-FINAL F-D r244 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：业务主题树（SRS 追溯项）。
- **验收标准**：
  - [x] 主题→对象→属性树（r32 L1：`ThemeNode` 多级 parent + `term_id` 关联）
  - [x] 可导航 Admin 主题面板 + 写 ACL + 环检测/子节点删除守卫（r244：`themes-panel.tsx`；viewer POST 403；move cycle 422；delete children 409；`probe_list_themes_budget_ms` ≤50ms；T-META-R244-002-01~07）
  - [x] 深层级树形拖拽导航（companion F-F：`theme-tree.tsx` 递归树 + move sortOrder；T-META-FF-002）
- **代码锚点**：`backend/app/metadata/themes/` · `backend/app/api/v1/metadata.py` · `fe/src/pages/admin/metadata/themes-panel.tsx` · `tests/test_mfinal_fd_meta_r244.py` T-META-R244-002-01~07
- **演化建议**：r244 收官 F-D plan 主题树（Admin 列表/表单 + 写 ACL + probe）；深层级树形 UX 留 companion
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07
### [META-003] 维度字典注册

- **状态**：已实现（M-FINAL F-D r244 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：维度字典注册（SRS 追溯项）。
- **验收标准**：
  - [x] 维度 code/枚举值可配置（migration 0016 + 8 REST 路由 CRUD/values；`META_DIM_*` 冲突与校验，r38 L1）
  - [x] values 注册校验链（空 code/非法 pattern/重复 batch/空 label + list 分页 limit 500，r39）
  - [x] 主题 FK + 写 ACL + Admin 维度面板（r244：migration 0019 `theme_node_id` FK；`dimensions-panel.tsx`；viewer POST 403；`probe_list_dimensions_budget_ms` ≤50ms；T-META-R244-003-01~07）
  - [x] M4/M5/M6 统一引用（companion F-F：`GET /dimensions/resolve?code=` + prefab/global-filters/theme 校验链；T-META-FF-003）
  - [x] **M-RPT F-C**：标准分析表/图绑定维度字典字段时自动 resolve 显示 label（完成于 2026-08-20 · `label_translation.py` · lifecycle→status / distribution→region）
  - [x] **M-RPT F-C**：模板 run Web 展现码值翻译与标准分析一致；与 RPT-001 导出翻译共用 resolve 链（完成于 2026-08-20）
  - [x] **M-RPT F-C**：resolve 失败时展示裸码 + 「未翻译」旁注，不得静默当成功（完成于 2026-08-20 · `translationNote` meta）
  - [x] **M-RPT F-C**：viewer 可读 resolve；未授权或未知维度 code 返回空集或 403，不得泄露他人字典值（既有 ACL + 诚实降级）
- **代码锚点**：`backend/app/metadata/dimensions/` · `backend/migrations/versions/0019_dimension_theme_node.py` · `backend/app/api/v1/metadata_dimensions.py` · `backend/app/api/v1/metadata.py`（`resolve_dimension`）· `fe/src/pages/admin/metadata/dimensions-panel.tsx` · `fe/src/pages/admin/reports/` · `tests/test_mfinal_fd_meta_r244.py` T-META-R244-003-01~07
- **演化建议**：M-RPT F-C 报表展示/导出层 lookup；不复建第二套字典 CRUD
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07；**M-RPT F-C · 已闭合 · 2026-08-20**
### [META-004] Dataset CRUD M1-DATASET

- **状态**：已实现（M-FINAL F-D r244 + **M-DEPTH F-A** ORM/可视化编辑 · 2026-07-10）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：Dataset CRUD M1-DATASET（SRS 追溯项）。**ORM 持久化**（`datasets` 表 · Alembic `0023`）；Admin 可视化编辑（`DatasetTablePicker` + `ComputedFieldsEditor`）；Dashboard 可绑定出图。
- **验收标准**：
  - [x] Dataset 内存 store + list/create/get/validate（r59 L1；已由 ORM 替代）
  - [x] 计算字段名校验链（空 tables/非法 field 名/冲突 409，r59）
  - [x] companion dataset write ACL + duplicate table guard + perf probe（r66：viewer create 403 `META_DATASET_FORBIDDEN`；duplicate table 409；`probe_validate_dataset_budget_ms`/`probe_list_datasets_budget_ms` ≤50ms）
  - [x] PUT/DELETE + bind-query-config + QUERY 四步集成测（r244：`PUT/DELETE /api/v1/datasets/{id}`；`POST bind-query-config`；create→bind→execute 链；`DatasetListPage` 编辑/删除；T-META-R244-004-01~08）
  - [x] Dashboard 组件绑定 Dataset/boundConfigId 出图（M-PRODUCT F-A companion；`WidgetInspector` + `useChartExecute` dataset 路径）
  - [x] **M-DASH-UX F-A**：检视器改 Dataset/SQL 后编辑态画布即时刷新（`onChange`→`chartConfig`→`ChartRenderer` `executeKey`；Wave1 2026-07-09）
  - [x] 计算字段执行与指标引擎（companion F-F：`computed_sql.py` 白名单表达式注入 SELECT；`execute_config.py` bound dataset 链；T-META-FF-004）
  - [x] **M-DEPTH F-0**：Inspector 真实 columns 探测（`useInspectorColumns` + `chartExecuteProbe`；2026-07-10）
  - [x] **M-DEPTH F-A**：Dataset ORM 持久化（替内存 store；重启不丢；Alembic `0023`）（完成于 2026-07-10）
  - [x] **M-DEPTH F-A**：Dataset 可视化编辑器（`DatasetTablePicker` + SchemaBrowser 选表/字段；无裸 JSON textarea）（完成于 2026-07-10）
  - [x] **M-DEPTH F-A**：计算字段行编辑（`ComputedFieldsEditor` name+expression；替 `computedJson` textarea）（完成于 2026-07-10）
  - [ ] Dataset 对标 DE/SS 全量能力（远期 companion；含多表 join 可视化等，不阻塞 F-A 收官）
- **代码锚点**：`backend/app/metadata/dataset/models.py` · `backend/migrations/versions/0023_datasets_orm.py` · `backend/app/metadata/dataset/service.py` · `backend/app/api/v1/datasets.py` · `fe/src/pages/admin/datasets/DatasetListPage.tsx` · `fe/src/pages/admin/datasets/DatasetEditorForm.tsx` · `fe/src/pages/admin/datasets/components/DatasetBindPanel.tsx` · `fe/src/hooks/useInspectorColumns.ts` · `fe/src/lib/chartExecuteProbe.ts` · `fe/src/components/dashboard/ChartEditRail.tsx` · `fe/src/components/charts/useChartExecute.ts` · `tests/test_mfinal_fd_meta_r244.py` T-META-R244-004-01~08
- **演化建议**：M-DEPTH F-A 优先 ORM + 可视化编辑；全量 DE/SS 对标（多表 join UX 等）留远期
- **里程碑对齐**：M-FINAL · F-D · 已完成 · 2026-07-07；M-PRODUCT F-A · Dashboard 绑定 · 2026-07-08；**M-DEPTH F-A · 已闭合 · 2026-07-29**
### [META-005] 物理表元数据登记 M1-ENTITY

- **状态**：已实现（M8 r232 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：物理表元数据登记 M1-ENTITY（SRS 追溯项）。
- **验收标准**：
  - [x] 物理表/字段登记（r62 L1：`POST/GET /api/v1/metadata/physical-tables` + columns 登记 + duplicate column 422 + list）
  - [x] companion register ACL + perf probe（r65：viewer register 403 `META_PHYSICAL_FORBIDDEN`；column name pattern `META_PHYSICAL_INVALID_COLUMN` 422；`probe_physical_validate_budget_ms`/`probe_physical_list_budget_ms` ≤50ms）
  - [x] register-from-schema 编排（r231：`POST /api/v1/metadata/physical-tables/register-from-schema` + `datasources.metadata.list_columns` + entityTypeCode 过滤 GET；`test_meta_dash_m8_r231.py` T-META-R231-005-01~04）
  - [x] PUT/DELETE CRUD + dataSourceId+schema+table 复合唯一（r232：`PUT/DELETE /api/v1/metadata/physical-tables/{fqn}` + `_ds_table_index` 409 `META_PHYSICAL_DS_TABLE_CONFLICT` + viewer 403；`test_meta_dash_m8_r232.py` T-META-R232-005-01~05）
  - [x] GOV catalog 引用释放与 lineage 全链路（companion F-F：`META_PHYSICAL_GOV_IN_USE` + `GET …/lineage` stub + `link-physical`；T-META-FF-005）
- **代码锚点**：`backend/app/metadata/physical/` · `backend/app/api/v1/metadata.py` · `tests/test_meta_dash_m8_r232.py` T-META-R232-005-01~05 · `tests/test_meta_dash_m8_r231.py` T-META-R231-005-01~04 · `tests/test_cat_rpt_meta_r65.py` T-META-R65-005-01~05 · `tests/test_cat_nfr_rpt_meta_r62.py` T-META-R62-005-01~06
- **演化建议**：r232 收官闭合 M8 plan 物理表 CRUD 与复合唯一；GOV 引用释放与 lineage 联动留 companion
- **里程碑对齐**：M8 · 已完成 · 2026-07-06
### [META-006] 实体类型 schema 配置

- **状态**：已实现（M8 r232 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：实体类型 schema 配置（SRS 追溯项）。
- **验收标准**：
  - [x] 实体属性/生命周期可配置（attributes + lifecycleStates 默认 draft/active/retired）
  - [x] 不预置业务实体（内存 store，按需创建）
  - [x] schema 校验链 + 只读 query bindings（r55 companion：POST validate + GET query-bindings）
  - [x] physicalTableFqn 映射主链（r231：类型配置 physicalTableFqn + unknown 422 + 冲突 409 + create 回写 physical；`test_meta_dash_m8_r231.py` T-META-R231-006-01~04）
  - [x] 引用计数生命周期对称（r232：登记→删 physical→删 type 链 + in_use 409 `META_ENTITY_TYPE_IN_USE` + PUT 改绑 entityTypeCode；`test_meta_dash_m8_r232.py` T-META-R232-006-01~04）
  - [x] GOV 引用释放（companion F-F：`unpublish` + openapi mapping deactivate 递减 `_ref_counts`；T-META-FF-006）
- **代码锚点**：`backend/app/metadata/entity/` · `backend/app/api/v1/metadata.py` · `tests/test_meta_dash_m8_r232.py` T-META-R232-006-01~04 · `tests/test_meta_dash_m8_r231.py` T-META-R231-006-01~04 · `tests/test_rpt_gov_meta_conn_r54.py` T-R54-META-01~07 · `tests/test_rpt_gov_meta_conn_r55.py` T-META-R55-01~08
- **演化建议**：r232 收官闭合 physical 删/改绑与 `_ref_counts` 对称；GOV 引用释放留 companion
- **里程碑对齐**：M8 · 已完成 · 2026-07-06
