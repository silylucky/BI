# F12-DESIGN 可视化设计器

> 模块：M2 · 8 维评分见 [`../prd.md`](../prd.md)

### [DESIGN-001] 拖拽查询条件配置

- **状态**：已实现（**M-DEPTH F-D 可选 · 设计器收敛 ADR**）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：拖拽查询条件配置（SRS 追溯项）。与 `/gov/query-design`（GOV-004）存在职责重叠；可选 ADR 收敛内核。
- **验收标准**：
  - [x] 条件/过滤可拖拽（r245 FE：`ConditionsPanel` HTML5 DnD 重排 + 键盘上下移；`designer.smoke` T-DESIGN-R245-FE-01~02）
  - [x] 实时预览（r245：`POST /api/v1/designer/preview/translate` + `DesignerPage` 预览区；probe ≤50ms T-DESIGN-R245-001-06）
  - [x] 条件配置校验与持久化（r32 L1 + r245 `GET /fields` 注册表；T-DESIGN-R245-001-03~08）
  - [x] **M-DEPTH F-D〔可选〕**：designer / gov query-design 内核收敛 ADR（`docs/arch.md` ADR-15 · 2026-07-30）
- **代码锚点**：`backend/app/designer/` · `backend/app/designer/preview.py` · `backend/app/api/v1/designer.py` · `fe/src/pages/admin/designer/designer-panels.tsx` · `fe/src/pages/admin/designer/useDesignerWorkspace.ts` · `tests/test_mfinal_fe_design_r245.py` T-DESIGN-R245-001-01~08
- **演化建议**：F-D 可选 ADR；远期可补侧栏字段拖入与 explore 元数据联动
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07；**M-DEPTH F-D · ADR-15 · 2026-07-30**
### [DESIGN-002] 运算规则维护

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：运算规则维护（SRS 追溯项）。
- **验收标准**：
  - [x] 加减乘除/求和/平均（r32 L1 + r245 FE `ComputeRulesPanel` `RULE_TYPES`；T-DESIGN-R245-002-01~05）
  - [x] 计算字段保存（`PUT/GET /api/v1/designer/compute-rules` + 预览注释联动 T-DESIGN-R245-002-05）
- **代码锚点**：`backend/app/designer/` · `backend/app/api/v1/designer.py` · `fe/src/pages/admin/designer/designer-panels.tsx` · `tests/test_mfinal_fe_design_r245.py` T-DESIGN-R245-002-01~05
- **演化建议**：F-E 批次 1 已闭合规则面板与校验链；远期可补可视化表达式构建器
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [DESIGN-003] 输出字段与聚合配置

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：输出字段与聚合配置（SRS 追溯项）。
- **验收标准**：
  - [x] 聚合规则可配置（r49 L1 + r245 FE `OutputFieldsPanel`；T-DESIGN-R245-003-05）
  - [x] 数量/重复边界（r52 companion + r245 T-DESIGN-R245-003-01~03）
  - [x] 与 META-004 联动（r245：`glossary`/`datasetFields` 注册表 + dataset computed field 校验 T-DESIGN-R245-003-04/06）
- **代码锚点**：`backend/app/designer/output_fields.py` · `backend/app/designer/service.py` · `backend/app/api/v1/designer.py` · `fe/src/pages/admin/designer/designer-panels.tsx` · `tests/test_mfinal_fe_design_r245.py` T-DESIGN-R245-003-01~06
- **演化建议**：F-E 批次 1 已闭合输出面板与术语/Dataset 字段联动；远期可补维度字典下拉与 explore 拖入
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
### [DESIGN-004] 设计器与工单关联

- **状态**：已实现
- **goal_ref**：goal.md §2.5（G5）
- **期次**：四期
- **描述**：设计器与工单关联（SRS 追溯项）。
- **验收标准**：
  - [x] workflow-link validate/save/get（r59 L1 + r245 roundtrip T-DESIGN-R245-004-06~07）
  - [x] 未知 instance/非法 item/sql_mode 路由不变（r59）
  - [x] companion catalog/designType 守卫 + perf probe（r63 + r245 catalog mismatch T-DESIGN-R245-004-05）
  - [x] 设计器配置快照提交工单（r245：`capture_snapshot` + `POST /submit-workflow` + 不可变快照 T-DESIGN-R245-004-01/04/08）
  - [x] 快照 ACL + 双向 link 查询 + draft 撤回守卫（r246：`GET /snapshots/{id}` viewer 403 `DESIGN_SNAPSHOT_FORBIDDEN`；`workflow-link?workflowInstanceId=`；`DELETE` 非 draft 409 T-DESIGN-R246-004-01~04）
  - [x] 工单实例列表与快照回看（r246：`GET /gov/workflow/instances` + `includeDesignSnapshot` + `snapshotRevision` 不可变 T-DESIGN-R246-004-05~08；FE `WorkflowInstancesPanel` T-GOV-R246-FE-01~02）
  - [x] 设计完成进入 GOV-005 发布全链路（r246：`confirm-design` → `publish/from-workflow` → `catalogEntryId` 回写 link T-GOV-R246-005-01~05）
  - [x] 查询设计器移入治理分组 + Badge「治理专用」（T-DESIGN-FC-01~03）；analyst/viewer 侧栏排除
- **代码锚点**：`backend/app/designer/workflow.py` · `backend/app/designer/snapshot.py` · `backend/app/api/v1/designer.py` · `fe/src/pages/admin/governance/WorkflowInstancesPanel.tsx` · `fe/src/config/nav-manifest.tsx` · `fe/src/lib/resolve-nav.test.ts` T-DESIGN-FC-01~03 · `fe/src/layouts/AdminLayout.smoke.test.tsx` T-DESIGN-FC-01-smoke · `tests/test_mfinal_fe_design_r245.py` T-DESIGN-R245-004-01~08 · `tests/test_mfinal_fe_design_r246.py` T-DESIGN-R246-004-01~08 · `docs/ui/layout.md`
- **演化建议**：F-E 批次 2 已闭合快照 ACL、双向关联、实例回看与发布链；F-C 已闭合治理分组 IA；远期可补 BPM 外部系统双向状态钩子
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07；M-PRODUCT · F-C · 已完成 · 2026-07-08
### [DESIGN-005] 传统 SQL 模式

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：四期
- **描述**：传统 SQL 模式（SRS 追溯项）。
- **验收标准**：
  - [x] SQL Lab 式编辑（r246 FE：`designer-sql-panel.tsx` Segmented 可视化/SQL 切换 + Textarea 编辑 T-DESIGN-R246-FE-01~02）
  - [x] SQL 只读校验与持久化（r49 L1 + r246：`design-mode` GET/PUT + `PUT/GET sql-mode` + `submit-workflow` 完整性分支 T-DESIGN-R246-005-01~05）
  - [x] 只读链 companion（r52：DML/注释隐藏/FOR UPDATE/长度上限 + `detail.remediation` + chart_view `CHART_SQL_NOT_READONLY` 联动）
  - [x] validate probe ≤50ms（r246 `probe_validate_sql_mode` T-DESIGN-R246-005-06）
  - [ ] 语法高亮与在线执行（计划外：不引入 Monaco/CodeMirror）
- **代码锚点**：`backend/app/designer/sql_mode.py` · `backend/app/api/v1/designer.py` · `fe/src/pages/admin/designer/designer-sql-panel.tsx` · `fe/src/pages/admin/designer/DesignerPage.tsx` · `tests/test_mfinal_fe_design_r246.py` T-DESIGN-R246-005-01~06 · `tests/test_design_conn_gov_query_r52.py` T-DESIGN-R52-005-01~10
- **演化建议**：r246 闭合 Admin SQL 模式与只读校验链；远期可补语法高亮与数据源在线执行
- **里程碑对齐**：M-FINAL · F-E · 已完成 · 2026-07-07
