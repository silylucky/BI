# F06-VIZ 图表与可视化

> 模块：M4 · 8 维评分见 [`../prd.md`](../prd.md)

### [VIZ-001] ChartViewConfig 协议

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **描述**：ChartViewConfig 协议（SRS 追溯项）。
- **验收标准**：
  - [x] chartType/style/dimensions/metrics/filters Schema
  - [x] 前后端校验一致
  - [x] Inspector `filters[]` 编入 `encoding` 后在汇总前 SQL 过滤生效（`chartExecuteProbe` → `chart_sql.py`；`tests/test_dataset_chart_sql.py`）
- **代码锚点**：`backend/app/schemas/chart_view.py` · `backend/app/api/v1/charts.py` · `fe/src/lib/chartViewConfig.ts` · `fe/src/lib/chartExecuteProbe.ts` · `backend/app/query/dataset/chart_sql.py`
- **演化建议**：r29 字段级 `ChartViewError.fields` + POST validate `detail.fields`（T-VIZ-R29-001）；后续可补过滤器 AND/OR 分组、枚举点选与 styleVariant 全量枚举
- **里程碑对齐**：
### [VIZ-002] 最小图表集 M4-MIN

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：一期
- **里程碑对齐**：M-FE-2 · 已完成 · 2026-07-06；M-PRODUCT · F-C · 已完成 · 2026-07-08；**M-DASH-UX · F-A · Wave1 · 2026-07-09**
- **描述**：最小图表集 M4-MIN（SRS 追溯项）；M-FE-2 补齐 Dashboard widget SQL 配置与 view 模式出数；M-PRODUCT F-C 图表探索降为高级入口（非 admin 侧栏隐藏）；**M-DASH-UX F-A** 编辑态配置就绪时复用 `ChartRenderer` 真出图（去掉「仅预览才出图」路径）。
- **验收标准**：
  - [x] 表格+折线+柱状可渲染
  - [x] 绑定 QUERY-005 出数
  - [x] Dashboard edit/view widget FE 出数（`WidgetSqlPanel` + `DashboardWidget`）
  - [x] 「图表类型目录」自「分析」移至「治理」；分析分组仅保留 Dashboard（T-VIZ-FC-02~03）；`/admin/charts/types` 为主路由，`/charts/explore` 重定向
  - [x] Dashboard `WidgetPalette` 按 catalog 分类展示全部 12 种注册类型（含饼图/仪表盘/桑基/漏斗/关系图）；底部链至类型目录（T-VIZ-FC-04）
  - [x] `layout.md` §3/§6 同步图表类型目录定位
  - [x] **M-DASH-UX F-A**：`mode=edit` 且 config 就绪时渲染 `ChartRenderer`（含 `filterParameters`/`executeKey`；未就绪保留待配置占位；`dashboard.smoke` F-A）
- **代码锚点**：`fe/src/components/charts/` · `fe/src/lib/chartTypeCatalogDisplay.ts` · `fe/src/components/dashboard/WidgetPalette.tsx` · `fe/src/components/dashboard/WidgetSqlPanel.tsx` · `fe/src/components/dashboard/DashboardWidget.tsx` · `fe/src/lib/chart-theme.ts` · `fe/src/pages/admin/dashboard/dashboard.smoke.test.tsx` · `fe/src/config/nav-manifest.tsx` · `fe/src/lib/resolve-nav.test.ts` T-VIZ-FC-01~02 · `docs/ui/layout.md`
- **演化建议**：饼图/地图与配置 UI（VIZ-005）；Apex 主题与大数据虚拟化；Playwright E2E 真实查询出数；plan §M-DASH-UX F-A 行待 Wave2 后回勾
### [VIZ-003] 图表类型插件注册

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：图表类型插件注册（SRS 追溯项）。backend `ChartTypeSpec` + `builtin/*` ~40 type；FE `ChartViewPlugin` registry（`engine/plugins/`）驱动 render-plan / Inspector / Picker 分区；S2 表格 `table-info|normal|pivot`。
- **验收标准**：
  - [x] DE 独立 chartType（bar-stack、pie-donut、chart-mix* 等；弃用 type 带 migratesTo）
  - [x] FE plugin registry + `buildAntvSpec` 委托；catalog 契约字段 library/paletteCategory
  - [x] `@antv/s2-react` 表格三件套 + `migrateChartTypes` 存量迁移
  - [x] **表格样式 DE 对齐 companion**（2026-08-06）：表头/分页 `color-mix` 透明底；`headerFontSize`/`bodyFontSize`/`tablePaletteId` 面板与渲染接线；`TABLE_PALETTE_CATALOG` + `ChartPalettePicker`（case `fe-table-style-tests-unwired.md`）
- **代码锚点**：`backend/app/viz/registry.py` · `backend/app/viz/builtin/` · `backend/app/api/v1/charts.py` · `fe/src/components/charts/engine/plugins/` · `fe/src/lib/migrateChartTypes.ts` · `fe/src/lib/chartRegistry.ts` · `fe/src/lib/chartPaletteTaxonomy.ts`
- **演化建议**：类型元数据（icon/预览缩略图）扩展；**离线**中国省/市 GeoJSON 分级；**地名映射一期**（`ChartGeoStyle.areaMapping` · 高级 Tab · join/联动/下钻链，`chartGeoAreaMapping.ts`）；**地名映射二期**（自定义多省区域、CAT-003 打通）；**`map-3d`（3D 区域地图）**：Three.js Extrude 顶面 + **离线 hillshade 三张贴图**（构建产出 `diffuse/normal/displacement`；**运行时当前仅 `diffuse` 接顶面材质**，见 [`docs/ui/map-texture.md`](../../ui/map-texture.md)）；全国 L0 + 下钻省级 L1 懒加载（`chinaTerrainLoader.ts` · `pnpm run build:geo-terrain`）+ 全国省市区点击下钻（与 `map` 共用 drill 链）+ `geo3d` 质量档位/起伏开关 + WebGL 或区县级自动降级 2D（`data-render-engine` + 横幅，见 `renderThreeChoropleth` · `geo3dQuality.ts`）；**点位特效**（对标 sc-datav Demo1：贴地热力 blob · 垂直光柱 · 浮动标签，`geo3dPointEffects.ts` · `ChartGeoStylePanel` 可配）；r250 补 `isKnownChartType` + `getFallbackChartType` → table fallback（T-VIZ-R250-003-01~02）
- **里程碑对齐**：
### [VIZ-004] 图表样式子类型

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：图表样式子类型（SRS 追溯项）。r42 交付每类型 `style_variants` 声明 + registry 驱动校验；r43 companion 交付 `ChartConfigPanel` styleVariant 选择与 `renderFromSpec` 变体渲染（stacked/grouped/area/donut 等）。
- **验收标准**：
  - [x] 堆叠/分组/面积/环形等（`bar`: stacked/grouped/horizontal；`line`: area/smooth；`pie`: donut）
  - [x] styleVariant 生效（后端校验 + 前端 `renderFromSpec`/`ChartConfigPanel` 变体渲染）
  - [x] **M-DASH-UX F-B**：`WidgetInspector` 嵌入 `ChartConfigPanel` 可改 styleVariant/筛选（Wave1；`columns=[]` 时维度/度量下拉禁用）
  - [x] 检视器内维度/度量列驱动选择（需 schema/`columns` 接线；companion）（完成于 2026-07-29 · `useInspectorColumns.ts` · `DatasetFieldGroups.tsx`）
- **代码锚点**：`backend/app/viz/specs.py` · `backend/app/viz/builtin.py` · `fe/src/components/charts/ChartConfigPanel.tsx` · `fe/src/components/charts/adapters/renderFromSpec.ts` · `fe/src/components/dashboard/WidgetInspector.tsx` · `fe/src/components/dashboard/WidgetInspector.smoke.test.tsx`
- **演化建议**：styleVariant 与 dashboard 主题全局联动；更多高级类型变体；r250 补 `buildBarOption`/`buildPieOption` 显式构建函数（T-VIZ-R250-004-01~02：stacked→stack非空、donut→radius数组）
- **里程碑对齐**：
### [VIZ-005] 维度指标筛选配置 UI

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：维度指标筛选配置 UI（SRS 追溯项）。r42 交付 FieldRule + registry 驱动校验；r43 companion 交付 `ChartConfigPanel` 维度/指标字段绑定与 style_variant 选择；r236 交付多字段/筛选器动态增删与 native execute 联动；r237 交付 `timeRange` 相对/绝对 preset + sql `time_start`/`time_end` 注入链。
- **验收标准**：
  - [x] 维度/指标/筛选器可配置（`ChartConfigPanel` 多字段动态增删 + operator/value 筛选器 + 后端 FieldRule 校验链）
  - [x] **DE 字段轴对齐**（2026-07-30）：Inspector 槽位名称/顺序/必填/可拖类型与 DataEase v2 `axisConfig` 一致；`ChartViewConfig.axes` 命名轴存储；`chartDeAxis/catalog` + `resolveChartEncoding` + parity 测试 T-VIZ-R32-011
  - [x] native mode 图表执行链（r236：`useChartExecute` mode=native + `ChartRenderer` rerun）
  - [x] 时间范围选择（r237：`TimeRangeConfig` + `ChartTimeRangeRef` FE/BE 校验 + `buildTimeRangeParameters` sql 注入）
  - [x] **M-DASH-UX F-B**：检视器内嵌 `ChartConfigPanel` 筛选/时间范围 onChange 合并回 `chartConfig`（Wave1；`WidgetInspector.smoke` F-B）
- **代码锚点**：`backend/app/viz/specs.py`（FieldRule）· `backend/app/schemas/chart_view.py` · `fe/src/components/charts/ChartConfigPanel.tsx` · `fe/src/components/charts/TimeRangeConfig.tsx` · `fe/src/components/charts/useChartExecute.ts` · `fe/src/lib/chartViewConfig.ts` · `fe/src/lib/chartDeAxis/` · `fe/src/lib/resolveChartEncoding.ts` · `fe/src/components/dashboard/ChartDataSlots.tsx` · `fe/src/components/dashboard/WidgetInspector.tsx` · `tests/test_m11_batch3_r237.py` T-VIZ-R237-005-01~02
- **演化建议**：Playwright E2E 真实出数；native mode timeRange 执行链扩展
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [VIZ-006] iframe 嵌入门户

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：iframe 嵌入门户（SRS 追溯项）。r42 交付后端嵌入配置契约 + `POST /charts/embed/validate`；r43 companion 交付 `EmbedChartPage`/`EmbedSharePanel`/`EmbedLayout` + `is_origin_allowed` 前端守卫链。
- **验收标准**：
  - [x] 图表可 iframe 嵌入（`/embed/chart` 页面 + `EmbedSharePanel` origin 白名单配置）
  - [x] 跨域策略可配置（`allowedOrigins` 白名单 + `is_origin_allowed` + 非法 origin 错误态）
- **代码锚点**：`backend/app/viz/embed.py` · `backend/app/api/v1/charts.py`（POST /charts/embed/validate）· `fe/src/embed/EmbedChartPage.tsx` · `fe/src/embed/EmbedSharePanel.tsx`
- **演化建议**：CSP/X-Frame-Options 响应头 + 嵌入 token 签发/校验链
- **里程碑对齐**：
### [VIZ-007] SDK 嵌入门户

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：SDK 嵌入门户（SRS 追溯项）。r61 L1 后端 sdk_portal + lifecycle；r63 companion perf probe/ACL；r237 交付 FE `embedSdk.ts` + `public/sdk/vitalspan-embed.js` + `EmbedSdkDemoPage` token 透传 iframe 链。
- **验收标准**：
  - [x] JS SDK 初始化与销毁（r61 L1 backend：`POST /api/v1/charts/sdk/validate` + lifecycle init/destroy + capabilities + `VIZ_SDK_*` 错误域；embed/validate 回归不变）
  - [x] companion perf probe + lifecycle ACL（r63：`probe_validate_sdk_budget_ms`/`probe_lifecycle_budget_ms` ≤50ms；`VIZ_SDK_TOKEN_REQUIRED`/`VIZ_SDK_DUPLICATE_ORIGIN`/`VIZ_SDK_FORBIDDEN`）
  - [x] 鉴权 token 传递（r237：`fe/src/sdk/embedSdk.ts` init 调 `GET /embed/sdk-params` + iframe `token` query；`fe/src/sdk/embedSdk.test.ts` T-VIZ-R237-007-01~03）
- **代码锚点**：`backend/app/viz/sdk_portal/` · `backend/app/api/v1/embed.py`（GET /embed/sdk-params）· `fe/src/sdk/embedSdk.ts` · `fe/public/sdk/vitalspan-embed.js` · `fe/src/pages/embed/EmbedSdkDemoPage.tsx` · `tests/test_m11_batch3_r237.py` T-VIZ-R237-007-04
- **演化建议**：完整 iframe 跨域 SSO 与 embed token 签发轮换；M12 VIEW-003 用户视图覆盖联动
- **里程碑对齐**：M11 · 已完成 · 2026-07-07
### [VIZ-008] ECharts/AntV 渲染适配层

- **状态**：已实现
- **goal_ref**：goal.md §2.3（G3）
- **期次**：三期
- **描述**：ECharts/AntV 渲染适配层（SRS 追溯项）。r42 交付后端 `build_render_spec` + `POST /charts/render-spec`；r43 companion 交付 `renderFromSpec`/`AdvancedEchartsChart`/`echarts-theme.ts` 消费 render-spec + Tailwind Token 主题协调。
- **验收标准**：
  - [x] 统一 ChartConfig→渲染器映射（`build_render_spec` + `renderFromSpec` ECharts option 构造）
  - [x] 主题与 Tailwind 协调（`echarts-theme.ts` + `createBarChartOptions` Token 对齐）
  - [x] **M-DASH-UX F-A**：编辑态复用 `ChartRenderer`/`ChartPanel` loading·错误·空数据覆盖层（非白屏；`DashboardWidget` mode=edit）
- **代码锚点**：`backend/app/viz/render.py` · `backend/app/api/v1/charts.py`（POST /charts/render-spec）· `fe/src/components/charts/adapters/renderFromSpec.ts` · `fe/src/components/charts/adapters/AdvancedEchartsChart.tsx` · `fe/src/lib/echarts-theme.ts`
- **演化建议**：AntV 适配器分支；大数据量虚拟化与性能 profiling；r250 补 rows=[] 空数据防护 + `AdvancedEchartsChart` 空态覆盖层（T-VIZ-R250-008-01~02：空数据不抛错、主路径 bar type 回归）
- **里程碑对齐**：

### [VIZ-009] ChartPluginPackage SDK（单包闭环）

- **状态**：已实现（Phase 2 基线 · 2026-07-24）
- **描述**：`ChartPluginPackage` + `registerChartPluginPackage`；`plugins/bar/` 示例；`pnpm check:chart-plugin-parity` 校验 metadata 与 registry 一致。
- **验收标准**：
  - [x] `ChartPluginPackage` 类型与 `registerChartPluginPackage`
  - [x] `plugins/bar/index.ts` 示例包
  - [x] `pluginParity.test.ts` / `check:chart-plugin-parity`
- **代码锚点**：`fe/src/components/charts/engine/plugins/types.ts` · `registry.ts` · `fe/src/components/charts/plugins/bar/`
- **演化建议**：其余类型逐步迁入 `plugins/<type>/`；ChartExplore 挂 demo 预览

### [VIZ-003-GIS] gis-map 图层栈与球面大气（GeoLibre 子集）

- **状态**：已实现（2026-08-27）
- **goal_ref**：ADR-12 · GEO-IRON-01 B 路径
- **期次**：二期 companion
- **描述**：`chartType=gis-map` 薄 MapLibre + 登记 PMTiles；右侧样式 Tab 扩展 `gisProject.layers[]` 多图层（散点/热力）、高级大气/光晕参数、`activeLayerId` 数据 Tab 上下文；禁止 iframe GeoLibre 整应用。
- **验收标准**：
  - [x] `nativeBody.gisProject.layers[]` 读写 + legacy `overlay` 迁移（`gisProjectLayers.ts`）
  - [x] 样式 Tab「GIS 图层」：列表/显隐/排序/类型/样式/字段 binding 覆写
  - [x] `GisMapView` 多 source/layer runtime + heatmap（`gisMapLayerStyle.ts`）
  - [x] 数据 Tab 显示当前编辑图层（`activeLayerId` + `ChartGisMapDataPanel`）
  - [x] 球面大气面板：fog 细项、halo、自转速度（`ChartGisMapProjectPanel`）
  - [ ] GeoLibre 远视图像素级对标（feature-truth T1 · PARTIAL）
- **代码锚点**：`fe/src/components/charts/engine/maplibre/` · `ChartGisMapLayersPanel.tsx` · `ChartGisMapProjectPanel.tsx` · `docs/arch.md` ADR-12
- **演化建议**：每层独立 Dataset binding（二期）；GeoLibre #230 椭圆球缘拟合
