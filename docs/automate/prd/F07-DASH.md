# F07-DASH 驾驶舱与主题

> 模块：M5 · 8 维评分见 [`../prd.md`](../prd.md)

### [DASH-001] DashboardView 数据模型

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：DashboardView 数据模型（SRS 追溯项）。
- **验收标准**：
  - [x] 布局+组件列表+全局筛选器
  - [x] 可序列化保存
  - [x] **M-DEPTH F-0**：看板列表快速创建向导（`DashboardQuickCreateDialog`：数据源 + Dataset + 首图；字段预填 `suggestChartFields`；2026-07-10）
- **代码锚点**：`backend/app/dashboard/models.py` · `backend/app/dashboard/service.py` · `backend/migrations/versions/0013_dashboards.py` · `fe/src/components/dashboard/DashboardQuickCreateDialog.tsx` · `fe/src/pages/admin/dashboard/DashboardListPage.tsx`
- **演化建议**：r29 layout 业务校验 DASH_DUPLICATE_WIDGET/DASH_MISSING_CHART_CONFIG 等独立 code（T-DASH-R29-001）；后续可补版本历史与并发乐观锁
- **里程碑对齐**：M-DEPTH F-0 · 快速创建 · 2026-07-10
### [DASH-002] Dashboard 容器与布局引擎

- **状态**：已实现（v2 像素画布；QA 待发版抽测 — 非功能缺失）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **里程碑对齐**：M-FE-2 · 已完成 · 2026-07-06；M-PRODUCT F-A · 分享页 · 2026-07-08；**M-DEPTH F-B · 已闭合 · 2026-07-29**
- **描述**：Dashboard 容器与布局引擎（SRS 追溯项）。布局统一支持 v1 栅格与 v2 像素契约；默认编辑路径将 v1 内存迁移为 v2，v1 RGL 仅作紧急回退。
- **验收标准**：
  - [x] 空 Dashboard 可创建展示
  - [x] 网格布局可拖拽（react-grid-layout + edit/view 切换）
  - [x] 编辑态多选与 12 列吸附（Shift+点击多选、批量删除、`gridSnapUtils` 拖拽吸附；`dashboard.smoke.test.tsx` T-DASH-002-02/04/05）
  - [x] `/admin/dashboards/:id/share` 分享页 + 编辑页分享入口（`DashboardSharePage` · `DashboardEditPage`）
  - [x] **M-DASH-UX F-C**：编辑态稳定性 + 布局级撤销/重做（2026-07-09）
  - [x] BUG-2 Phase B：`layout.version=2` 像素契约、v1→v2 迁移、Pointer Capture 拖移/八向缩放、编辑/预览/分享/缩略图/View 双版本消费；v2 禁止降级写回 v1
  - [x] **数据大屏表面分化 companion**（2026-07-17）：`styleConfig.surfaceKind`（`dashboard` \| `data-screen`）；列表 `GET /dashboards?surfaceKind=`；路由 `/admin/data-screens/*`（含 `preview` 全屏投放）；默认画布大屏 **1920×1080**；编辑态最小缩放 `PIXEL_CANVAS_EDIT_MIN_SCALE=0.5`
  - [x] **Phase 2.5 Wave B 编辑深化 companion**（2026-07-29）：图层锁定、Tab 预览轮播、布局 JSON 导出、图表 PNG 导出、图层 Panel Tab 子项——Vitest 验收闭合（见 `docs/feature-design/2026-07-29-data-screen-wave-b-gap-fill.md`）
  - [x] **Phase 2.5 Wave C/D companion**（2026-07-29）：标题装饰条、21:9 画布预设、模板导出 round-trip（见 `docs/feature-design/2026-07-29-data-screen-wave-cd-gap-fill.md`）
  - [x] **Phase 2.6 编辑视口 companion**（2026-07-29）：`useDataScreenViewportState`、标尺十字线、Ctrl+滚轮指针锚点缩放（见 `plans/2026-07-20-data-screen-edit-viewport-de.md`）
  - [x] **持久化加固 companion**：`PUT /api/v1/dashboards/{id}/editor-save` 原子保存 layout+联动；编辑页未保存离开守卫；模板 sync 失败保持 dirty（`tests/test_persistence_roundtrip.py` · `tests/test_persistence_contract.py`）
  - [x] **保存 WYSIWYG companion**（2026-07-29）：数据大屏跳过 `compactPixelLayoutWhenZeroGap`（[BUG-14](../../bugs/BUG-14_data-screen-save-gap-compaction_2026-07-29.md)）
  - [x] **缩略图 WYSIWYG companion**（2026-08-06）：Hub / 列表卡片与真实播放一致——壳层字号补偿仅编辑态生效（`resolveShapeTitleCanvasScale` · `usePixelChromeScale` · `data-pixel-canvas-design-locked`）；大屏卡片改 `presentationMode="fit"` + 16:9 卡框（`hubCardPreviewFrameStyle`）；3D 地图缩略图保留 WebGL 与卫星地形（去 `renderTier` 硬降级）（case `fe-hub-card-preview-not-wysiwyg.md`）
  - [x] **列表轻量真实预览**（2026-08-07）：看板/大屏列表始终渲染真实布局（`previewProfile=card`）；真实 `query/execute` 但单图 ≤50 行、关闭标签/图例/tooltip/钻取/动画；视口驱动 live 调度，最多 8 路并发、按 `intersectionRatio` 优先（`dashboardPreviewProfile` · `listPreviewActivation`）
  - [x] **Master gap-fill 真理源**（2026-07-29）：`docs/feature-design/2026-07-29-data-screen-master-gap-fill.md`
  - [ ] BUG-2 最终真实浏览器 Pointer QA：拖移、八向缩放、保存并刷新后位置/尺寸保持（手测表见 [project master §6.1](../../feature-design/2026-07-29-vitalspan-project-master-gap-fill.md) · 大屏路径见 [data-screen master §3 MT-BUG2-DS-*](../../feature-design/2026-07-29-data-screen-master-gap-fill.md) · 已登记 · 待发版抽测）
  - [x] **M-DEPTH F-B**：layout widget 类型扩展 `filter`（兼容旧 layout round-trip；后端 schema + FE `layoutUtils`）（完成于 2026-07-29 · 代码实扫回写）
- **代码锚点**：`fe/src/pages/admin/dashboard/` · `fe/src/pages/admin/data-screens/` · `fe/src/lib/surfacePreset.ts` · `backend/app/dashboard/surface_kind.py` · `fe/src/pages/admin/dashboard/DashboardSharePage.tsx` · `fe/src/components/dashboard/pixelCanvas/` · `fe/src/components/dashboard/screen/` · `fe/src/components/dashboard/dashboard-edit/` · `fe/src/components/dashboard/DashboardLayoutPreview.tsx` · `fe/src/components/dashboard/DashboardPreviewThumb.tsx` · `fe/src/components/dashboard/dashboardCanvasMode.ts` · `fe/src/hooks/useDashboardCanvasState.ts` · `backend/app/dashboard/schemas.py` · `backend/app/dashboard/layout_migration.py`
- **演化建议**：BUG-2 Pointer QA 待发版抽测（见 project master §6.1）；Playwright 指针回归留远期
### [DASH-003] Dashboard 组件库

- **状态**：已实现（M5 DASH-003）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：Dashboard 组件库（SRS 追溯项）。
- **验收标准**：
  - [x] 地图/热力/KPI/时间轴可插拔（M5：`builtin.py` heatmap/kpi/timeline registry + `KpiCard`/heatmap/timeline FE 渲染 + `WidgetPalette` 分组插槽；`test_dash_m5_widgets.py` + `charts.dash003.smoke.test.tsx`）
  - [x] 出厂无预装页
- **代码锚点**：`backend/app/viz/builtin.py` · `fe/src/components/charts/ChartRenderer.tsx` · `fe/src/components/charts/adapters/KpiCard.tsx` · `fe/src/components/dashboard/WidgetPalette.tsx` · `tests/test_dash_m5_widgets.py` · `fe/src/components/charts/charts.dash003.smoke.test.tsx`
- **演化建议**：Playwright E2E 拖拽插拔四类 widget 与真实数据源出数留 companion
- **里程碑对齐**：M5 · 已完成 · 2026-07-06
### [DASH-004] 全局筛选器联动

- **状态**：已实现（M-FE-3 FE + M8 r231 BE execute；**M-DEPTH F-B 深度 companion 已闭合** · 2026-07-29）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：全局筛选器联动（SRS 追溯项）。`GlobalFilterBar` 与画布内 filter widget 已支持下拉/日期/多选等控件（M-DEPTH F-B · 2026-07-29）。
- **验收标准**：
  - [x] 联动规则可配置（r61 L1：`POST validate` + `PUT/GET /api/v1/dashboards/{id}/global-filters` + config_store `global_filter_linkage` + `DASH_FILTER_*` + widget 存在性校验 + viewer ACL）
  - [x] companion validate/get perf probe + ACL 边界（r67：非法 dimensionRef/重复 parameterKey 422；enterprise 越权 GET 403、viewer save 403；`probe_validate_linkage_budget_ms`/`probe_get_linkage_budget_ms` ≤50ms）
  - [x] 筛选器驱动组件刷新（M-FE-3：`GlobalFilterBar` + `dashboardFilterUtils` + `useChartExecute` 参数注入；`dashboard-view.smoke.test.tsx` T-DASH-004-01）
  - [x] 编辑页联动规则配置 UI（`LinkageRulesPanel` + PUT global-filters；`dashboard.smoke.test.tsx` T-DASH-004-02/03）
  - [x] BE widget execute 合并 linkage（r231：`sql_parameters.py` + `execute.py` + `_load_linkage_payload`；GET linkage 严格 owner/admin ACL；viewer execute 200；`test_meta_dash_m8_r231.py` T-DASH-R231-004-03~07 + `test_cat_dash_viz_nfr_r61.py` T-DASH-R61-004-04）
  - [x] **M-DASH-UX F-D**：编辑页挂载全局筛选条并可驱动 widget 刷新（2026-07-09）
  - [x] **M-DEPTH F-B**：筛选器 widget UI（下拉/日期/文本）+ Palette 可拖入（**工具栏查询组件类型选择** DASH-007-02 · 2026-07-13）（完成于 2026-07-29 · `FilterWidget.tsx` · `QueryComponentPicker`）
  - [x] **M-DEPTH F-B**：GlobalFilterBar 控件升级（下拉/日期/多选；替纯 Input）（完成于 2026-07-29 · `FilterWidgetControls.tsx`）
  - [x] **M-DEPTH F-B**：筛选值驱动关联 chart execute 刷新（与 filter widget / 全局条统一参数注入）（完成于 2026-07-29 · `dashboardFilterUtils` · `useChartExecute`）
- **代码锚点**：`backend/app/dashboard/global_filters/` · `backend/app/query/sql_parameters.py` · `backend/app/api/v1/dashboards.py` · `fe/src/components/dashboard/GlobalFilterBar.tsx` · `fe/src/components/dashboard/LinkageRulesPanel.tsx` · `fe/src/components/dashboard/dashboardFilterUtils.ts` · `tests/test_meta_dash_m8_r231.py` T-DASH-R231-004-03~07 · `tests/test_cat_dash_viz_nfr_r61.py` T-DASH-R61-004-01~07 · `fe/src/pages/admin/dashboard/dashboard-view.smoke.test.tsx` · `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx`
- **演化建议**：跨 widget 口径联动与 Playwright E2E 留远期
- **里程碑对齐**：M8 · 已完成 · 2026-07-06；**M-DEPTH F-B · 已闭合 · 2026-07-29**
### [DASH-005] 实体总览页 FR-6.2

- **状态**：已实现（M8 r232 收官）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：实体总览页 FR-6.2（SRS 追溯项）。
- **验收标准**：
  - [x] 实体总览 config_store validate/save/get（r59 L1：`PUT/GET /api/v1/dashboards/{id}/entity-overview` + `POST validate` + `DASH_OVERVIEW_*` + viewer ACL）
  - [x] 重复 metric 拦截 + theme-analysis 路由不变（r59 回归）
  - [x] companion entityTypeRef/drill widget 校验 + perf probe（r66：非法 entityTypeRef/drill widget 422；viewer save 403；`probe_validate_overview_budget_ms`/`probe_get_overview_budget_ms` ≤50ms）
  - [x] 统计卡片+详情筛选+下钻（r231：`EntityOverviewPage` + `/admin/entities` 导航 + entity-types/physical-tables/entity-overview 数据链；`entities-overview.smoke.test.tsx`）
  - [x] 详情 Sheet + 空态引导 + 权限/下钻/Tab vitest（r232：`useEntityOverview` + `EntityDetailSheet` + 7 用例 smoke；页内 stat count 对齐 physical total）
  - [x] 跨组件口径一致（F-F companion：`metricSource.widgetId` 与 widget `metricKey` 对齐 · `useEntityStatMetrics.ts` · `test_ff_track_d_dash005.py` · `entities-overview.smoke.test.tsx` T-DASH-005-08）
- **代码锚点**：`backend/app/dashboard/entity_overview/` · `backend/app/api/v1/metadata.py` · `fe/src/pages/admin/entities/EntityOverviewPage.tsx` · `fe/src/pages/admin/entities/useEntityOverview.ts` · `fe/src/pages/admin/entities/useEntityStatMetrics.ts` · `fe/src/pages/admin/entities/EntityDetailSheet.tsx` · `fe/src/routes.tsx` · `fe/src/config/nav-manifest.tsx` · `tests/test_meta_cat_dash_conn_design_r59.py` T-DASH-R59-005-01~06 · `tests/test_cat_dash_rpt_meta_r66.py` T-DASH-R66-005-01~06 · `tests/test_ff_track_d_dash005.py` · `fe/src/pages/admin/entities/entities-overview.smoke.test.tsx`
- **演化建议**：r232 收官闭合 M8 实体总览交互与 META-005/006 消费链；跨组件 metricSource 口径联动已闭合；Playwright E2E 留 companion
- **里程碑对齐**：M8 · 已完成 · 2026-07-06
### [DASH-006] 实体主题分析 FR-4.1

- **状态**：已实现（M9 r233）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：二期
- **描述**：实体主题分析 FR-4.1（SRS 追溯项）。
- **验收标准**：
  - [x] 时间域日/周/月（r53 L1：`POST validate` + `PUT/GET /api/v1/dashboards/theme-analysis` timeGranularity day/week/month + geoBinding 校验）
  - [x] chartViewBindings 联动（r57 companion：`PUT/GET /api/v1/dashboards/{id}/chart-bindings` widget/dimension/chartConfig 校验 + `_link_chart_views` ≤50ms）
  - [x] 同比环比计算链（r58 companion：`POST /api/v1/dashboards/theme-analysis/execute-plan` 四步链 + yoy/mom `compareWindow`；`probe_theme_execute_plan_budget_ms` ≤35ms）
  - [x] 维度钻取查询 + FE 配置/分析双 Tab（r233：`POST .../theme-analysis/query` + M8 physical table 解析；`ThemeAnalysisPage` + vitest smoke 4/4）
  - [x] GIS 分布与行政区划下钻（F-F companion：`ThemeGeoMapPanel` + province click drill · `theme-analysis.smoke.test.tsx` geo map）
  - [x] 编辑页未保存离开守卫（`useThemeAnalysis.isConfigDirty` + `ThemeAnalysisPage` + `UnsavedLeaveDialog`）
- **代码锚点**：`backend/app/dashboard/theme/query.py` · `backend/app/dashboard/theme/execute.py` · `backend/app/api/v1/dashboards.py` · `fe/src/pages/admin/themes/ThemeAnalysisPage.tsx` · `fe/src/pages/admin/themes/ThemeGeoMapPanel.tsx` · `fe/src/pages/admin/themes/useThemeAnalysis.ts` · `tests/test_dash_rpt_r58.py` T-DASH-R58-006-01~12 · `tests/test_m9_rpt_theme_r233.py` T-R233-DASH-006-01~06 · `fe/src/pages/admin/themes/theme-analysis.smoke.test.tsx`
- **演化建议**：r233 闭合主题维度钻取 query 链路与 FE 配置/分析页；GIS 地图渲染与行政区划下钻已闭合
- **里程碑对齐**：M9 · 已完成 · 2026-07-06

### [DASH-007] DE 编辑工具栏与扩展 Widget

- **状态**：已实现（Wave 1–6 · 2026-07-13）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：M-DEPTH companion
- **里程碑对齐**：plan `2026-07-13-dashboard-de-toolbar-full.md`
- **描述**：看板编辑页 `CanvasEditToolbar` 对标 DataEase `middle-area`；消除 disabled 占位，扩展 layout widget 类型（text/media/tabs）与复用流程。
- **验收标准**：
  - [x] DASH-007-01：图表 DE 分区选择器（`ChartPickerPopover` + `chartPaletteTaxonomy` · 410px 网格）
  - [x] DASH-007-02：查询组件类型选择（text/select/date/multiselect）插入 filter widget
  - [x] DASH-007-03：富文本 widget（`type: text` + `textConfig`）
  - [x] DASH-007-03A：富文本 Widget 使用 Tiptap 3；画布双击内联编辑
  - [x] DASH-007-03B：HTML 白名单净化；旧 plain/markdown 可读并在编辑提交后升级
  - [x] DASH-007-03C：点击外部/Ctrl+Enter 提交，Esc 取消；编辑时不触发画布拖拽
  - [x] DASH-007-04：媒体 widget（`type: media` + `mediaConfig`）
  - [x] DASH-007-05：Tab 容器 widget
  - [x] DASH-007-06：跨看板复用组件
  - [x] DASH-007-07：「更多」菜单 ≥2 项可用（样式/外部参数等）
  - [x] DASH-007-08（companion）：数据大屏素材 IA 对标 DataEase——更多=时钟/边框/标题装饰；素材网格=日期时间/网页；`ScreenVisualEditRail` 样式 Tab
- **代码锚点**：`fe/src/components/dashboard/CanvasEditToolbar.tsx` · `ChartPickerPopover.tsx` · `screen/ScreenMaterialPicker.tsx` · `lib/screenVisualAssets.ts` · `createLayoutWidget.ts` · `backend/app/dashboard/schemas.py` · `docs/automate/plans/2026-07-13-dashboard-de-toolbar-full.md`
- **演化建议**：Wave 1–6 已交付；Tab 子组件嵌套与媒体上传后端留 companion

### [DASH-008] 仪表板配置栏（对标 DataEase §5）

- **状态**：已实现（Phase 0–5 · 2026-07-13）
- **goal_ref**：goal.md §2.3（G3）
- **期次**：M-DEPTH companion
- **描述**：编辑页点击画布空白展示「仪表板配置」右栏；`layoutJson.styleConfig` 全链路消费（编辑/预览/分享）。
- **验收标准**：
  - [x] DASH-008-01：浅/深色主题 + View/Share 一致（与 Admin 壳层顶栏主题独立）
  - [x] DASH-008-02：间隙预设、像素 gutter、`scaleMode`、刷新频率、`defaultQueryLimit`
  - [x] DASH-008-03：背景色板 + URL 背景图 + 清除
  - [x] DASH-008-04~09：图表样式/配色/标题/查询组件/数字格式/高级样式全局配置
  - [x] DASH-008-10：筛选联动分组常显
- **代码锚点**：`fe/src/components/dashboard/DashboardContextInspector.tsx` · `dashboardConfigPanels.tsx` · `dashboardStyleConfig.ts` · `DashboardStyleSurface.tsx` · `backend/app/dashboard/schemas.py` · `docs/automate/plans/2026-07-13-dashboard-config-inspector-de-full.md`
- **演化建议**：背景图上传 API、组件级样式覆盖 Tab、批量样式操作留 companion

### [DASH-009] 可视化模板中心（企业内）

- **状态**：已实现（2026-07-23）
- **描述**：企业内看板/大屏布局模板库：内置种子、组织发布/上下架、分类检索、JSON 导入导出、`POST /dashboards/from-template` 原子实例化；不含在线商店与报表模板。
- **验收标准**：
  - [x] `dashboard_templates` 表 + `backend/app/dashboard/templates/` 子域 CRUD/ACL/seed
  - [x] API：`/api/v1/dashboard-templates/*` + `POST /api/v1/dashboards/from-template`
  - [x] 能力码 `dashboard:template.manage`；内置模板只读
  - [x] FE Hub `/admin/viz-templates`；列表「使用模板新建」；大屏/看板发布为模板
  - [x] 统一信封 `kind: viz-layout`；兼容旧 `kind: data-screen` 导入
  - [x] 导出 JSON 将 chart `dataSourceId` 归一化为 `__demo:sample_db__`（保留 SQL）；导入/预览/实例化绑定本环境 sample_db 后 execute 有数据
- **代码锚点**：`backend/app/dashboard/templates/` · `backend/app/api/v1/dashboard_templates.py` · `fe/src/pages/admin/viz-templates/VizTemplatesHubPage.tsx` · `fe/src/components/dashboard/templates/` · `tests/test_dash_templates_r01.py`
- **演化建议**：模板缩略图自动生成（Hub 已支持布局示意预览）、组织级分类管理 UI；看板编辑页对称发布入口（已实现 `DashboardTemplateExtras`）

### [DASH-010] 可视化组件库（组织内复用）

- **状态**：已实现（2026-07-24）
- **描述**：单 widget 级组织组件库。Hub 保存当时的样式与数据绑定快照；看板「复用」时拷贝到画布，之后只属于该看板，**不写回、不随库热更新**。
- **验收标准**：
  - [x] `viz_components` 表 + `backend/app/viz/components/` CRUD/ACL/batch-resolve
  - [x] API：`/api/v1/viz-components/*`；能力码 `viz:component.manage`
  - [x] 复用插入为 inline 快照（无活 `componentRef`）；存量引用若已有实例配置则看板优先
  - [x] `VizReuseDialog` 组织库 + 从看板复制双 Tab
  - [x] Hub `/admin/viz-components`；发布对话框（下发快照，不把画布重新链回库）
  - [x] vitest + `tests/test_viz_components_r01.py`
  - [x] 看板编辑不 PATCH 组件库；保存保留实例 payload
- **代码锚点**：`backend/app/viz/components/` · `fe/src/lib/vizComponents.ts` · `fe/src/lib/resolveVizComponent.ts` · `fe/src/components/dashboard/VizReuseDialog.tsx` · `fe/src/pages/admin/viz-components/VizComponentsHubPage.tsx`
