# F08-RPT 报表子系统

> 模块：M6 · 8 维评分见 [`../prd.md`](../prd.md)

### [RPT-001] 报表引擎渲染

- **状态**：已实现（M9 r233）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：报表引擎渲染（SRS 追溯项）。
- **验收标准**：
  - [x] 模板+数据→Web 展现（r60 L1：`POST /api/v1/reports/templates/{id}/run` → renderSpec engineVersion=1.0；format web/html；`RPT_ENGINE_*` 错误域）
  - [x] companion engine run ACL + parameter guard + perf probe（r66：`set_user_engine_scope` + `RPT_ENGINE_FORBIDDEN` 403；`__proto__` parameter 422；`probe_run_template_budget_ms` ≤50ms）
  - [x] M3-LITE 绑定执行链（r233：`engine/execute.py` + `build_sections_from_extension` → `execute_query`；`dataSourceId` 必填 `RPT_ENGINE_DATASOURCE_REQUIRED`；无 dataSourceId placeholder 回归 r60）
  - [x] PDF/Word 真实渲染（companion r-e95d：`reports_export` catalog 模板链 + mock bytes 下载；`exportHook.placeholder=false`；`ReportExportCard` FE 下载）
  - [x] **M-RPT F-C**：给定列/块绑定维度字典字段，当模板 run 或 export PDF/Excel，则展示/导出值为翻译后 label；resolve 失败时保留裸码并旁注「未翻译」（完成于 2026-08-20 · `label_translation.py`）
  - [x] **M-RPT F-C**：模板 Web 展现（`format=web`）码值翻译与导出一致，共用 resolve 链（完成于 2026-08-20）
  - [x] **M-RPT F-C**：未绑定字典字段的列保持原值；绑定字段变更后 rerun 即时刷新翻译（完成于 2026-08-20）
  - [ ] **M-RPT F-D**〔可选〕：套打固定版式 PDF 分页（占位符分页 + 页眉页脚；`reports/render/` 真实排版链，非 placeholder bytes）
- **代码锚点**：`backend/app/reports/engine/execute.py` · `backend/app/reports/engine/service.py` · `backend/app/integration/reports_export.py` · `backend/app/reports/render/` · `backend/app/api/v1/metadata.py`（`resolve_dimension`）· `backend/app/api/v1/reports/engine.py` · `fe/src/pages/admin/reports/components/ReportExportCard.tsx` · `tests/test_ff_rpt_companion_e95d.py` · `tests/test_m9_rpt_theme_r233.py` T-R233-RPT-001-01~06
- **演化建议**：M-RPT F-C 导出层码值翻译；套打分页留 F-D 可选
- **里程碑对齐**：M9 · 已完成 · 2026-07-06；**M-RPT F-C · 已闭合 · 2026-08-20**
### [RPT-002] 标准分析报表体系 FR-3.1

- **状态**：已实现（2026-08-11 重建）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：面向业务对象的标准分析：显式物理表绑定、主题运行、周期快照与本期 vs 上期对比。
- **验收标准**：
  - [x] 分析包 CRUD（`PUT/GET/DELETE /api/v1/reports/standard/packs`）
  - [x] 字段能力探测（`GET .../capabilities`）
  - [x] 实时运行与对比（`POST .../run` · `GET .../compare`）
  - [x] 周期快照（`POST .../snapshots/capture` · `GET .../snapshots`）
  - [x] APScheduler 快照 job（`standard/jobs.py`）
  - [x] FE 工作台 + 配置页 + Hub（`StandardAnalysisPage` · `StandardAnalysisConfigPage`）
  - [x] **M-RPT F-A**：配置页保存成功后展示「创建定时投递」CTA，跳转 `/admin/reports/schedules` 并预填 `sourceType=standard` + `packKey`；未保存时 CTA 禁用（G UI 闭环）（完成于 2026-08-20 · `standard-analysis-config-cta.smoke.test.tsx`）
  - [x] **M-RPT F-B**：给定 pack 配置 `snapshotRetentionPeriods=N`，当连续 `capture` 超过 N 期，则 cleanup job 删除最旧快照且 `GET .../snapshots` 与 compare 不再含已删期（A 主路径 + D 状态机）（完成于 2026-08-20 · `backend/tests/test_standard_snapshot_retention.py`）
  - [x] **M-RPT F-B**：新建/编辑分析包 UI **默认 Dataset 绑定**；物理表路径显示 deprecated 提示并链至 Dataset 管理（F 配置 + G UI）（完成于 2026-08-20 · `StandardAnalysisConfigForm` · `StandardAnalysisMetaRow`）
  - [x] **M-RPT F-B**：Hub 与结果页均展示口径/最近快照/下次节奏/投递状态可观测条；实时与对比模式信息一致（G UI）（完成于 2026-08-20 · `StandardAnalysisSnapshotStrip` · `standard-analysis-observability.smoke.test.tsx`）
  - [ ] **M-RPT F-B**〔可选〕：主题聚合可走库内 GROUP BY；未启用时 API meta 诚实标注 M1 样本聚合上限，不得假称全量聚合（C 失败诚实）
- **代码锚点**：`backend/app/reports/standard/` · `backend/app/api/v1/reports/standard.py` · `backend/app/reports/standard/snapshot.py` · `backend/app/reports/persistence/standard_repo.py` · `fe/src/pages/admin/reports/StandardAnalysisPage.tsx` · `fe/src/pages/admin/reports/StandardAnalysisConfigPage.tsx` · `fe/src/pages/admin/reports/components/StandardAnalysisSnapshotStrip.tsx` · `backend/tests/test_standard_snapshot_retention.py` · `fe/src/pages/admin/reports/standard-analysis-observability.smoke.test.tsx`
- **演化建议**：M-RPT F-C 字典 lookup；库内 GROUP BY 留 F-B 可选；消费端两期对比与多期并排图主表辅（`StandardAnalysisCompareChart` · `StandardAnalysisCompareMatrixChart`）已落地
- **里程碑对齐**：M9 · 已完成 · 2026-08-11；**M-RPT F-A · 已闭合 · 2026-08-20**；**M-RPT F-B · 已闭合 · 2026-08-20**
### [RPT-003] Word/Excel/PDF 模板定义

- **状态**：已实现（M10 r234）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：Word/Excel/PDF 模板定义（SRS 追溯项）。
- **验收标准**：
  - [x] 模板可嵌 SQL/表格/图形（r62 L1：`PUT/GET /api/v1/reports/templates/{id}` word/excel/pdf blocks：sql/table/chart）
  - [x] 模板校验（r62 L1：`POST validate` + empty blocks/invalid block type 422 + `RPT_TEMPLATE_*` 错误域）
  - [x] companion ACL/probe 边界（r67：viewer PUT/enterprise 越权 GET 403；duplicate sql block/非法 chartType 422；`probe_validate_template_budget_ms`/`probe_get_template_budget_ms` ≤50ms）
  - [x] M10 storageRef/DELETE/list/exportHook（r234：`GET/DELETE /reports/templates` + `storageRef` mock URI；`RPT_TEMPLATE_IN_USE` 409；`engine/service.run_template` word/excel/pdf 占位 `exportHook`；`probe_list_templates_budget_ms` ≤50ms）
  - [x] M10 FE 模板元数据页（r234：`ReportTemplatesPage` + `useReportTemplates.ts`；vitest smoke 含树加载/空态）
  - [x] PDF/Word 真实排版引擎与 WYSIWYG 设计器（companion r-e95d：`TemplateBlockEditor` 块列表/SQL/重排；非全量 WYSIWYG）
  - [x] **M-RPT F-A**：`report-templates.smoke.test.tsx` 选择器/label 与 `ReportTemplatesPage` 实现一致，vitest 全绿无假绿（E 可运维）（完成于 2026-08-20）
  - [x] **M-RPT F-C**：首进模板页展示示例模板种子 + 空态引导 + 「运行/导出」CTA；新用户 60 秒内可完成首次导出（完成于 2026-08-20 · `POST /center/seed-demo` · `ReportTemplatesPage`）
  - [x] **M-RPT F-D**〔可选〕：交叉表 MVP（单维行×列 + 指标聚合；RenderSpec 扩展 + PDF/Excel/Web 预览）（完成于 2026-08-24 · `crosstab.py` · `CrosstabBlockFields`）
- **代码锚点**：`backend/app/reports/templates/service.py` · `backend/app/reports/engine/service.py` · `fe/src/pages/admin/reports/ReportTemplatesPage.tsx` · `fe/src/pages/admin/reports/components/TemplateBlockEditor.tsx` · `fe/src/pages/admin/reports/useReportTemplates.ts` · `fe/src/pages/admin/reports/report-templates.smoke.test.tsx` · `tests/test_ff_rpt_companion_e95d.py` · `tests/test_m10_report_templates_r234.py` T-RPT-R234-003-01~09
- **演化建议**：M-RPT F-A smoke 修漂移；F-C 首进体验；交叉表留 F-D 可选；块模板 ≠ WYSIWYG 设计器（对标积木分期自研）
- **里程碑对齐**：M10 · 已完成 · 2026-07-07；**M-RPT F-A · 已闭合 · 2026-08-20**；**M-RPT F-C · 已闭合 · 2026-08-20**
### [RPT-004] 模板树形目录管理

- **状态**：已实现（M10 r234）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：模板树形目录管理（SRS 追溯项）。
- **验收标准**：
  - [x] 增删改查/移动（r53 L1：`POST/GET/DELETE /api/v1/reports/catalog/nodes` + move；无另存/手工执行）
  - [x] 树形边界守卫（cycle/max depth/has children/`RPT_CATALOG_*` 错误域）
  - [x] 目录权限受 M7 控制（r57 companion：`reports/catalog/acl.py` viewer 禁写/owner 删叶/admin 绕过 move；ACL 判定 ≤10ms）
  - [x] extension 同比环比（r58 companion：`compareMode` yoy/mom + `POST .../compare-preview` + render-spec `compareMetrics`；`extension/acl.py` viewer 禁写）
  - [x] M10 templateKey 唯一关联 + list probe（r234：`RPT_CATALOG_DUPLICATE_TEMPLATE_KEY`/`RPT_CATALOG_TEMPLATE_KIND_MISMATCH`/`RPT_CATALOG_TEMPLATE_NOT_FOUND`；`catalog/probe.py` list ≤50ms；`ReportTemplatesPage` 树浏览）
  - [ ] 另存为/手工执行（companion · **M-RPT F-D 可选 · 非阻塞**）
- **代码锚点**：`backend/app/reports/catalog/service.py` · `backend/app/reports/catalog/probe.py` · `fe/src/pages/admin/reports/components/CatalogTreeNode.tsx` · `tests/test_dash_rpt_query_nfr_r53.py` T-RPT-R53-004-01~06 · `tests/test_dash_rpt_r58.py` T-RPT-R58-004-01~08 · `tests/test_m10_report_templates_r234.py` T-RPT-R234-004-01~06
- **演化建议**：r234 闭合 catalog `templateKey` 外键唯一、list perf probe 与 FE 树形管理；另存为/手工执行留 companion
- **里程碑对齐**：M10 · 已完成 · 2026-07-07
### [RPT-005] 报表调度 FR-3.2

- **状态**：已实现（M12 r238；**M-DEPTH F-C 深度 companion 已闭合** · 2026-07-29）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：报表调度 FR-3.2（SRS 追溯项）。
- **验收标准**：
  - [x] 日/周/月/组合调度（r53 L1：cron 校验 + draft→scheduled→paused→cancelled FSM；无日/周/月组合粒度枚举）
  - [x] IF-03 文档 API 可提取（`GET/POST /api/v1/reports/schedules` + transition + allowedActions）
  - [x] 调度 mock 执行器（r57 companion：`POST .../schedules/{id}/execute` Idempotency-Key + mock_succeeded；非真实产物投递）
  - [x] semi-real 执行器 + mock 投递链（r58 companion：`X-Rpt-Semi-Real: 1` + `delivery.py` success/fail/retry + `revisionSnapshot`；`probe_semi_real_execute_budget_ms` ≤35ms）
  - [x] APScheduler 调度注册 + lifespan（r238：`scheduler/jobs.py` + `main.py` lifespan hook）
  - [x] 列表/历史/重试 API（r238：`GET /api/v1/reports/schedules` + `GET .../executions` + `POST .../retry` + failed 错误信息）
  - [x] M12 Admin 调度 UI（r238：`SchedulePanel` + `TemplateDetailPanel` 调度 Tab；`SchedulePanel.smoke.test.tsx`）
  - [x] 真实 SMTP 投递（companion r-e95d：固定 SMTP + MailHog 兼容适配器；测试 mock 仅 header）
  - [x] **按人 IM 投递**（飞书发给用户资料绑的账号；未绑号该通道失败且不回落群 webhook；`notifyGroup` 才发群机器人）
  - [x] **钉钉群发**（2026-09-01：平台对接粘贴自定义机器人 webhook；保存时真 POST 探测；可选加签；`deliveryMode=group_webhook`；Alembic `0062`）
  - [x] **M-DEPTH F-C**：调度执行历史 / 重试 UI 增强（接 `GET .../executions` + `POST .../retry`；失败可读、可重试）（完成于 2026-07-29 · `SchedulePanel.tsx` · `SchedulePanel.smoke.test.tsx`）
  - [x] **G5 看板/大屏可视化 PDF**（2026-08-03：`export_render.py` Playwright + FE `/export/*?token=`；`artifactKind=visual_snapshot`；`tests/test_dashboard_visual_export.py`）
  - [x] **定时报告可删除**（2026-08-14：`DELETE /api/v1/reports/schedules/{id}`；列表页「删除」；停 job 并清理执行历史）
  - [x] **M-RPT F-A**：给定已存标准分析 `packKey` + 已配 SMTP/IM 台账，当管理员创建 `sourceType=standard` 调度并触发 execute，则 execution 成功含 `standard_render` 附件或 `failed` 含人话错误（**非** `mock_succeeded`）（A 主路径 + C 失败诚实）（完成于 2026-08-20 · `test_report_schedule_trust_chain.py`）
  - [x] **M-RPT F-A**：viewer 为他人 pack 创建 standard 调度 → 403；`packKey` 不存在 → 创建 422 `RPT_SCHEDULE_*`（B 权限 + D 边界）（完成于 2026-08-20）
  - [x] **M-RPT F-A**：SMTP/IM 通道未配置或投递失败时 execution 状态 `failed` + 可读 `errorMessage`，不得返回 succeeded（C 失败诚实）（完成于 2026-08-20）
  - [x] **M-RPT F-A**：`GET /api/v1/reports/schedules` 与 `GET .../executions` 纳入 CI pytest 或 deploy-dev 走查；list 500 即失败（E 可运维）（完成于 2026-08-20 · `test_report_schedule_trust_chain.py`）
  - [x] **M-RPT F-A**：pytest 覆盖 standard create→execute→attachment/log 链（真实 executor + 显式失败语义；测试 mock 仅投递/SMTP 解析）（A + E）（完成于 2026-08-20）
  - [ ] 组合调度粒度枚举（companion · **演化建议 / 非阻塞**）
- **代码锚点**：`backend/app/reports/scheduler/service.py` · `backend/app/reports/scheduler/jobs.py` · `backend/app/reports/scheduler/executor.py` · `backend/app/reports/scheduler/standard_export.py` · `backend/app/reports/scheduler/delivery_adapter.py` · `backend/app/reports/scheduler/channels/work_notice.py` · `backend/app/reports/scheduler/channels/im_sdk/` · `tests/test_im_sdk_adapters.py` · `tests/test_im_probe.py` · `backend/app/auth/users/im_bindings.py` · `backend/app/dashboard/export_render.py` · `fe/src/pages/export/DashboardExportSnapshotPage.tsx` · `fe/src/pages/admin/reports/ReportCenterPage.tsx` · `fe/src/pages/admin/reports/components/DashboardSchedulePanel.tsx` · `fe/src/pages/admin/reports/components/SchedulePrecheckPanel.tsx` · `fe/src/pages/admin/system/users/UserImAccountsPanel.tsx` · `backend/app/api/v1/reports/__init__.py` · `tests/test_im_person_delivery.py` · `tests/test_ff_rpt_companion_e95d.py` · `tests/test_dashboard_visual_export.py` · `tests/test_report_dashboard_schedule.py` · `tests/test_m12_batch1_r238.py` T-RPT-R238-005-* · `tests/test_dash_rpt_query_nfr_r53.py` T-RPT-R53-005-01~08 · `tests/test_dash_rpt_query_nfr_r57.py` T-RPT-R57-005-01~07 · `tests/test_dash_rpt_r58.py` T-RPT-R58-005-01~07
- **演化建议**：M-RPT F-A 标准分析投递信任链 + 调度探针；组合调度粒度留远期
- **里程碑对齐**：M12 · 已完成 · 2026-07-07；**M-DEPTH F-C · 已闭合 · 2026-07-29**；**M-RPT F-A · 已闭合 · 2026-08-20**
### [RPT-006] 报表扩展配置 FR-6.3

- **状态**：已实现（M10 r234）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：报表扩展配置 FR-6.3（SRS 追溯项）。
- **验收标准**：
  - [x] 可调整既有报表指标/筛选器（template 节点 extension CRUD；metrics/filters 校验）
  - [x] 变更可追溯（revision + changeNote 审计）
  - [x] render-spec 可见指标/修订历史/内存持久化快照（r55 companion：`build_extension_render_spec` + revisions + snapshot）
  - [x] batch compare 联动（r58 companion：batch yoy render-spec compareMetrics + `probe_render_spec_budget_ms` ≤50ms）
  - [x] M10 Admin 扩展配置 UI（r234：`TemplateDetailPanel` 扩展 Tab metrics/changeNote PUT + 预览 Tab render-spec JSON；folder 节点 extension 422 回归）
  - [x] P3 DB 持久化（`RPT_METADATA_STORE=db` + migration 0034 + `persistence/store` repo 抽象；`test_report_metadata_db_store.py`）
  - [x] P3 Dataset 桥接（metric `queryMode` + `datasetId`/`boundConfigId` → `execute_dataset_from_config`；FE SQL/Dataset 切换）
  - [x] P3 RenderSpec 真导出（`reports/render/` PDF/Excel/Word；调度模板附件 + IF-03）
- **代码锚点**：`backend/app/reports/extension/` · `fe/src/pages/admin/reports/components/TemplateDetailPanel.tsx` · `fe/src/pages/admin/reports/useReportTemplates.ts` · `tests/test_rpt_gov_meta_conn_r55.py` T-RPT-R55-01~08 · `tests/test_m10_report_templates_r234.py` T-RPT-R234-006-01~03
- **演化建议**：r234 闭合 Admin 扩展配置与 render-spec 预览 UI；真实 DB 持久化与运行时渲染展现留 companion
- **里程碑对齐**：M10 · 已完成 · 2026-07-07
### [RPT-007] 批量新增报表 FR-6.4

- **状态**：已实现（M12 r238）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：批量新增报表 FR-6.4（SRS 追溯项）。
- **验收标准**：
  - [x] 基于模板批量复制（batch create template 节点 + 可选 extension）
  - [x] 幂等守卫（Idempotency-Key + 原子回滚）
  - [x] 部分失败结构化 detail + rolledBackCount（r55 companion）
  - [x] 产物访问守卫（r58 companion：`GET .../executions/{id}/artifact` owner 可读/viewer 他人 403；batch 10 项 `probe_batch_budget_ms` ≤200ms）
  - [x] artifact owner DB 持久化（`report_artifact_owners` · Alembic `0040` · `tests/test_persistence_roundtrip.py`）
  - [x] 重复命名 422 + failures 索引（r238：`batch/service.py` duplicate name + `failures` 字段）
  - [x] 管理员批量导入 UI（r238：`BatchImportPanel` + `TemplateDetailPanel` 批量 Tab；`BatchImportPanel.smoke.test.tsx`）
  - [x] 批量导入 dry-run 预检（2026-08-09：`POST /api/v1/reports/batch/dry-run` + 冲突行高亮；`batch/dry_run.py`）
  - [x] 异步导出链（companion r-e95d：`POST /batch/export` + `GET /jobs/{id}` 轮询 + download）
- **代码锚点**：`backend/app/reports/batch/` · `backend/app/reports/batch/export_jobs.py` · `backend/app/reports/catalog/acl.py`（`assert_artifact_access`）· `fe/src/pages/admin/reports/components/BatchImportPanel.tsx` · `backend/app/api/v1/reports/__init__.py` · `tests/test_ff_rpt_companion_e95d.py` · `tests/test_m12_batch1_r238.py` T-RPT-R238-007-* · `tests/test_rpt_gov_meta_conn_r54.py` T-R54-RPT-08~15 · `tests/test_rpt_gov_meta_conn_r55.py` T-RPT-R55-09~15 · `tests/test_dash_rpt_r58.py` T-RPT-R58-007-01~04
- **演化建议**：r238 闭合 duplicate name、failures 索引与 Admin BatchImportPanel；dry-run 预检已闭合（2026-08-09）；异步导出链留 companion
- **里程碑对齐**：M12 · 已完成 · 2026-07-07
