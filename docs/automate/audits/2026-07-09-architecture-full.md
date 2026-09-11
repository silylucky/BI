# Architecture full audit — 2026-08-11

> Findings: **145** · P0=16 P1=52 P2=60 P3=17
> HTML: `C:\Users\30381\AppData\Local\Temp\architecture-review-20260709-181722.html`

## Category counts

- `bug`: 34
- `dead`: 15
- `leak`: 10
- `patch`: 21
- `security`: 12
- `shallow`: 23
- `size`: 30

## Phased plan

### P0 · 安全与正确性（1–2 周）
- 修 middleware 禁止默认 admin
- Dashboard ACL + theme SQL 参数化 + global-filters ACL
- gridX/Y 进 schema；SharePage layoutJson；pie 渲染；view 布局对齐
- FE 路由 RequireCapability；Embed origin/stub
- dialect alias；native 对齐；update 时 evict_pool
- 保存不清空 globalFilters；就绪判据对齐

### P1 · M-DASH-UX 接线 + 高风险债（并行 graduation）
- F-A 编辑态 ChartRenderer；F-B Inspector←ChartConfigPanel
- F-C undo；F-D 编辑页 GlobalFilterBar
- 抽 sqlParameters；删死 prop/死导出
- dataset 传 filterParameters
- gov/kingbase 移出生产 mock.patch

### P2 · 加深模块（架构）
- C1 DashboardLayout module
- C3 ConnectorCapability 统一注册表 + MySQL/PG 族基类
- C6 queryKeys + ErrorBanner 统一
- 拆 God 页：DashboardEditPage / designer-panels / RoleListPage / gov.py

### P3 · 补丁清扫与持久化
- metadata/views/embed_token 落库
- 推送/总线真实 adapter；移除 DrillStub 生产路径
- ACTIVE_MILESTONES 配置化
- 报表 placeholder / xinchuang stub 收口

### P4 · 可选深化（非毕业阻塞）
- 对齐/多选、组件联动（plan 可选）
- M-PRODUCT F-F companion
- AntV / 大数据虚拟化 / GIS
- leave-guard 迁 data router + useBlocker

## Full inventory

| # | Sev | Cat | Area | Problem | Files | Fix |
|---|-----|-----|------|---------|-------|-----|
| 1 | P0 | security | auth | DB 角色查询失败时 roles 降级为 ["admin"]，有效 JWT 可获超权 | backend/app/auth/middleware.py:72 | 失败返回 503/401，禁止默认 admin |
| 2 | P0 | security | query | 报表/主题 drill 显式 rls.enabled=False；默认 development 可关 RLS | backend/app/reports/engine/execute.py + core/config.py | 生产强制 RLS；默认 env=production |
| 3 | P0 | security | query | Native 执行无 RLS/org 过滤（Mongo/ES/OS） | backend/app/query/native/executor.py | 补等价约束或生产阻断 native |
| 4 | P0 | security | dashboard | Dashboard CRUD 无 owner/租户 ACL，任意登录用户可改删全部看板 | backend/app/dashboard/service.py + api/v1/dashboards.py | 引入 resource grant / created_by 校验 |
| 5 | P0 | security | dashboard | drill filter 值 f-string 拼 SQL，注入风险 | backend/app/dashboard/theme/query.py:22-26 | 参数化或白名单 |
| 6 | P0 | security | dashboard | 从 layout 读 SQL 执行且无 dashboard 所有权校验 | backend/app/dashboard/global_filters/execute.py | 执行前 ACL + SQL 审计 |
| 7 | P0 | security | auth | admin 角色全局 bypass RLS 与 datasource 可见性 | backend/app/query/rls/guard.py + datasources/acl.py | 拆系统 admin / 租户 admin；审计 bypass |
| 8 | P0 | security | fe-acl | designer/charts/types/reports/themes 导航有 capability，路由仅 RequireAuth | fe/src/routes.tsx vs nav-manifest | 路由包 RequireCapability |
| 9 | P0 | security | embed | parentOrigin 校验自身 origin；硬编码 funnel/SQL stub；/embed 无鉴权 | fe/src/embed/EmbedChartPage.tsx | 校验父 origin + 真实 embed-config + DEV 守卫 |
| 10 | P1 | security | datasources | 连接错误原文回传客户端，可能泄露连接细节 | dialects/* except Exception message=str(exc) | 统一 redact + 结构化 error code |
| 11 | P1 | security | metadata | list_physical_tables 无用户过滤，内存全局可见 | backend/app/metadata/physical/service.py | 持久化 + ACL |
| 12 | P1 | security | ingestion | SELECT * FROM `{table}` 表名未校验，配置可注入 | backend/app/ingestion/sync_executor.py:34 | 标识符白名单 |
| 13 | P0 | bug | dashboard | 前端持久化 gridX/gridY，后端 schema 无字段，保存后坐标丢失重排 | DashboardEditPage + dashboard/schemas.py LayoutWidget | schema 增加 gridX/gridY 并贯通 |
| 14 | P0 | bug | dashboard | 编辑用 RGL 坐标；预览用 order 流式 CSS grid，布局不一致 | DashboardGrid.tsx edit vs view | view 复用 widgetsToGridLayout / 只读 RGL |
| 15 | P0 | bug | charts | pie 被排除 advanced 路径，落入 Apex 折线/柱逻辑，饼图错误 | chartViewConfig.ts + ChartRenderer.tsx | pie 走 render-spec / buildPieOption |
| 16 | P0 | bug | dashboard | 类型读 layout.widgets，API 为 layoutJson，分享页恒空 | DashboardSharePage.tsx:16,64 | 改为 layoutJson |
| 17 | P0 | bug | query | SQL dialect 仅 mysql/pg/clickhouse，30+ 连接器 SQL 模式 UnsupportedDialect | backend/app/query/dialects/__init__.py | 统一 dialect alias 表 |
| 18 | P0 | bug | query | 路由声明 file/api/timeseries native，executor 仅 mongo/es/os；csv/excel/rest 有 native 却不可达 | native/guard vs native/executor | 对齐 routing 与 executor |
| 19 | P0 | bug | datasources | 更新连接参数不 evict_pool，旧凭证残留 | datasources/service.py update | 变更时 evict_pool |
| 20 | P1 | bug | dashboard | 仅拦 <a> 点击，不覆盖 navigate/后退/popstate | use-unsaved-leave-guard.ts | useBlocker 或补 popstate（需 data router） |
| 21 | P1 | bug | charts | dataset 模式忽略 filterParameters，全局筛选对 Dataset 无效 | useChartExecute.ts dataset mode | dataset execute 传 linkage 参数 |
| 22 | P1 | bug | dashboard | 就绪判据认 datasetId；执行要 dataSourceId+configId，假就绪 | createLayoutWidget isWidgetConfigReady vs useChartExecute | 对齐就绪判据 |
| 23 | P1 | bug | dashboard | 保存布局硬编码清空全局筛选 | DashboardEditPage save globalFilters:[] | 合并服务端已有 filters |
| 24 | P1 | bug | dashboard | 预览 minHeight 与编辑 GRID_ROW_HEIGHT 不一致 | DashboardGrid row height 120 vs 48 | 共用常量 |
| 25 | P1 | bug | fe-auth | 有默认 Dashboard 时忽略 from 深链 | LoginPage.tsx navigate | 优先合法 from |
| 26 | P1 | bug | fe-acl | 查 admin 角色而非 system:* capability | RequirePlatformAdmin vs capabilities | 与 capabilities 对齐 |
| 27 | P1 | bug | fe | 在截断 50 条上客户端过滤，total 不准 | RoleListPage statusFilter | 筛选走 API |
| 28 | P1 | bug | charts | chart 级 filters/timeRange 仅 sql 注入，dataset 忽略 | useChartExecute sql-only filters | 文档化或后端支持 |
| 29 | P1 | bug | dashboard | 静默吞掉筛选栏故障 | GlobalFilterBar 非404 return null | 区分 404/5xx 错误态 |
| 30 | P1 | bug | dashboard | setName 仅 load，无编辑保存 | DashboardEditPage name 只读 | 补名称编辑或删无用 state |
| 31 | P1 | bug | backend | except Exception: pass，cron 失败无日志 | ingestion/scheduler refresh_all_jobs | 记录异常 + metrics |
| 32 | P1 | bug | backend | 硬编码仅 mysql 源，与多连接器战略冲突 | ingestion sync_executor mysql-only | 经 registry 拉取 |
| 33 | P1 | bug | backend | except Exception 吞细节，统一 Invalid layout JSON | dashboard/service layout validate | 只捕 ValidationError |
| 34 | P1 | bug | backend | 字符串启发式映射错误码易误判 | query/executor broad except heuristics | 按驱动异常类型映射 |
| 35 | P1 | bug | backend | 任意认证用户可建源 | datasources create 无角色门 | admin/analyst gate |
| 36 | P1 | bug | backend | 递增不减，无 idle/age 限制 | pool connect_count | 生命周期 + 计数维护 |
| 37 | P1 | bug | backend | 配置错误与未知错误难区分 | rls guard 异常→1=0 | 区分 RlsConfigError vs 500 |
| 38 | P1 | bug | backend | binding 仅 sql/table，与 execute 不对称 | binding_service 无 native | 扩展或显式拒绝 |
| 39 | P1 | bug | fe | sql && mode!==dataset 可误判 | WidgetInspector resolveDataMode 启发式 | 以 mode 为唯一真理源 |
| 40 | P1 | bug | fe | widget 标题 + ChartPanel 标题可能叠显 | ChartPanel 双标题 | hideTitle 或传空 |
| 41 | P1 | bug | fe | SessionRole 无 editor | themes canWrite 含 editor | hasCapability 对齐 |
| 42 | P1 | patch | dashboard | 僵尸编辑页补丁状态机 | DashboardEditPage missing/leaveEditShell | 404 路由级重定向 + 单一守卫 |
| 43 | P1 | patch | dashboard | pointerToGridCell + interactingRef + useCSSTransforms=false 抗闪烁补丁堆 | DashboardGrid RGL 绕过 isDroppable | 封装单一 layout controller |
| 44 | P1 | patch | backend | 进程内内存 store，重启丢数据 | metadata/entity/physical/dataset _store dict | 落库 + migration |
| 45 | P1 | patch | backend | 测试钩子混生产 ACL | governance/catalog _USER_*_SCOPE | 仅 fixture 注入 |
| 46 | P1 | patch | backend | 多实例/重启失效 | embed_token / views/store 内存 | Redis/DB + TTL |
| 47 | P1 | patch | backend | 生产通知/总线走 mock | dispatch_push_mock / InMemoryBusAdapter | 配置驱动真实 adapter |
| 48 | P1 | patch | backend | probe/kingbase 用 MagicMock | gov.py unittest.mock.patch 生产代码 | 移到 tests/ |
| 49 | P1 | patch | backend | header 控制 mock 调度 | reports X-Rpt-Delivery-Mock header | 仅 dev/test |
| 50 | P1 | patch | backend | 测试连接器进生产注册路径 | DrillStubConnector 注册 | 仅 pytest fixture |
| 51 | P1 | patch | backend | 四步硬编码 pass/stub，不真执行 | dataset/executor stub plan | 接入真实 execute 或 deprecated |
| 52 | P1 | patch | fe | 硬编码 M1/M7/M11/M13，与 plan 易漂移 | resolve-nav ACTIVE_MILESTONES | 配置/API 注入 |
| 53 | P1 | patch | fe | 演示硬编码残留 | EmbedChartPage stub + ReportExportCard UUID | 接真实 API |
| 54 | P2 | patch | fe | deprecated 常量仍被多处引用 | WIDGET_CHART_LABELS @deprecated 仍用 | 迁 catalog displayName |
| 55 | P2 | patch | fe | 脏检查脆弱 | layoutFingerprint JSON.stringify | 规范化 fingerprint |
| 56 | P2 | patch | fe | 字符串匹配补丁 | error.includes('数据源') 特殊分支 | 结构化错误码 |
| 57 | P2 | patch | backend | 模板/渲染 placeholder | reports templates mock:// placeholder | 真实 storage/engine |
| 58 | P2 | patch | backend | 合规 checklist stub 项 | xinchuang stub status | 完成或移出 |
| 59 | P2 | patch | backend | 内部探测与 impersonation 暴露面 | m6-probe /dev-switch | feature flag + 默认禁用 |
| 60 | P2 | patch | fe | 占位维度/entityType | ThemeAnalysis DIMENSION_OPTIONS 写死 | 元数据 API 驱动 |
| 61 | P1 | dead | dashboard | prop 传入未解构未调用 | DashboardWidget onChartConfigChange | 删除或接入 |
| 62 | P1 | dead | dashboard | Inspector 删除 UI 永不渲染 | WidgetInspector onDelete 未传 | 传 onDelete 或删死代码 |
| 63 | P2 | dead | charts | config 模式无父调用方 | ChartRenderer mode=config | 删除或接到编辑页 |
| 64 | P2 | dead | dashboard | 仅测试用，UI 无上移下移 | layoutUtils.moveWidget | 删或补 UI |
| 65 | P2 | dead | dashboard | 死导出 | useGlobalFiltersQuery 导出无引用 | 删或替换 loadFilters |
| 66 | P2 | dead | fe | 未使用导出 | CHART_TYPES_CATALOG_LEGACY_PATH / ChartTypeL1 / isBasicChartType 外部 | 删或接入 |
| 67 | P2 | dead | fe | 死导出/未调用模块 | WIDGET_CHART_ICONS 重导出 / isWorkspaceViewPath / canManagePlatform / browserCompat | 删除或启动接入 |
| 68 | P2 | dead | dashboard | 生产恒 embedded | Palette/Inspector embedded=false 分支 | 删非嵌入分支 |
| 69 | P2 | dead | charts | 运行路径未用 | getFallbackChartType 仅测试 | 接入降级或移 test |
| 70 | P2 | dead | backend | 占位 pass | registry 空异常类 / BindingUpdate pass / viz bare pass / theme bare pass | 补实现或删除 |
| 71 | P2 | dead | backend | 见 patch 条 | dataset stub plan | 同上 |
| 72 | P1 | shallow | dashboard | 看板编辑无法配维度/指标/样式；ChartConfigPanel 孤立 | WidgetInspector 未嵌 ChartConfigPanel | Inspector 嵌入（M-DASH-UX F-B） |
| 73 | P1 | shallow | dashboard | 编辑非所见即所得 | 编辑态 WidgetEditPreview 挡 ChartRenderer | F-A 接线真出图 |
| 74 | P1 | leak | charts | charts 依赖 dashboard 域 | useChartExecute → dashboardFilterUtils | 抽 lib/sqlParameters |
| 75 | P1 | leak | backend | outbound 依赖 query 域，依赖方向反转 | datasources dialects → query.native.guard | guard 下沉 shared |
| 76 | P1 | leak | backend | 启动环状耦合 | datasources ↔ core.nfr.plugin_extension 环 | bootstrap/dialects.py |
| 77 | P1 | leak | backend | 跨域 import 私有函数 | query/metadata → _resolve_connection_options 私有 | 公开 connection API |
| 78 | P1 | shallow | backend | 连接/SQL 两套体系易漂移 | 双 dialect 注册表 datasources vs query | 单一 SqlDialect 注册表 |
| 79 | P1 | shallow | backend | 仅改 type/error code 的子类文件 | 6 MySQL 系 + 4 PG 系浅包装 | 族基类 + 配置表 |
| 80 | P1 | shallow | backend | client/probe 高度重复 | elasticsearch vs opensearch 重复 | SearchEngineConnectorBase |
| 81 | P1 | shallow | backend | metadata/query/native 复制 | _connector_and_kwargs 三处复制 | connection_factory |
| 82 | P1 | shallow | fe | 与 PageErrorBanner 重复 | ErrorBanner 18+ 处内联重复 | 全站统一 |
| 83 | P1 | shallow | fe | 同 API 两套类型/缓存 | chartRegistry vs ChartExplorePage 双类型 | 统一 ChartTypeCatalogItem |
| 84 | P1 | shallow | fe | users/views、schedules、themes、datasources invalidate 不一致 | Query Key 手写漂移 8 处 | 强制 queryKeys.* |
| 85 | P2 | shallow | fe | 多处复制 | formatUpdatedAt / fetchChartTypeCatalog / ResultTable 重复 | 共享 hook/组件 |
| 86 | P2 | shallow | fe | bar/line 双路径 | ChartRenderer Apex vs ECharts 双实现 | 统一渲染策略表 |
| 87 | P2 | shallow | fe | 语义不清 | 行数上限 100/500/50 三套 | 集中常量 |
| 88 | P2 | shallow | fe | 重复 API_BASE + 无统一 401 | login 裸 fetch 绕过 apiFetch | auth-api.ts |
| 89 | P2 | leak | charts | 渲染与配置分层破坏 | ChartRenderer 内嵌 ChartConfigPanel | 配置上提 inspector |
| 90 | P2 | leak | charts | 纯函数副作用 | buildMapOption 内 registerMap | 模块级一次注册 |
| 91 | P2 | leak | backend | 跨域编排 | dashboard theme → reports.engine | query facade |
| 92 | P2 | leak | backend | NFR 与生产 ACL 混 | core NFR 含 _USER_*_SCOPE | 分离 |
| 93 | P2 | shallow | backend | entry 样板重复 | 17+ _db() session 工厂重复 | core/deps.py |
| 94 | P2 | shallow | fe | 缩略图与画布漂移 | DashboardPreviewThumb 忽略 grid 坐标 | 读坐标或标注示意 |
| 95 | P2 | size | fe | 超 fe ≤300 软约束 | fe … DashboardEditPage.tsx (~478 lines) | 拆 hook/子组件 |
| 96 | P2 | size | fe | 超 fe ≤300 软约束 | fe … DashboardListPage.tsx (~339 lines) | 拆 hook/子组件 |
| 97 | P2 | size | fe | 超 fe ≤300 软约束 | fe … ChartConfigPanel.tsx (~306 lines) | 拆 hook/子组件 |
| 98 | P2 | size | fe | 超 fe ≤300 软约束 | fe … WidgetInspector.tsx (~294 lines) | 拆 hook/子组件 |
| 99 | P2 | size | fe | 超 fe ≤300 软约束 | fe … designer-panels.tsx (~531 lines) | 拆 hook/子组件 |
| 100 | P2 | size | fe | 超 fe ≤300 软约束 | fe … RoleListPage.tsx (~507 lines) | 拆 hook/子组件 |
| 101 | P2 | size | fe | 超 fe ≤300 软约束 | fe … themes-panel.tsx (~383 lines) | 拆 hook/子组件 |
| 102 | P2 | size | fe | 超 fe ≤300 软约束 | fe … DatasourceListPage.tsx (~346 lines) | 拆 hook/子组件 |
| 103 | P2 | size | fe | 超 fe ≤300 软约束 | fe … ChartExplorePage.tsx (~344 lines) | 拆 hook/子组件 |
| 104 | P2 | size | fe | 超 fe ≤300 软约束 | fe … RlsAdminPage.tsx (~321 lines) | 拆 hook/子组件 |
| 105 | P2 | size | fe | 超 fe ≤300 软约束 | fe … dimensions-panel.tsx (~313 lines) | 拆 hook/子组件 |
| 106 | P2 | size | fe | 超 fe ≤300 软约束 | fe … SchedulePanel.tsx (~305 lines) | 拆 hook/子组件 |
| 107 | P2 | size | fe | 超 fe ≤300 软约束 | fe … WorkflowInstancesPanel.tsx (~302 lines) | 拆 hook/子组件 |
| 108 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/gov.py (~936 lines) | 按子域拆文件 |
| 109 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/datasources/dialects/errors.py (~700 lines) | 按子域拆文件 |
| 110 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/nfr.py (~517 lines) | 按子域拆文件 |
| 111 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/metadata.py (~433 lines) | 按子域拆文件 |
| 112 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/designer.py (~375 lines) | 按子域拆文件 |
| 113 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/datasources/service.py (~346 lines) | 按子域拆文件 |
| 114 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/auth/rls/groups/service.py (~322 lines) | 按子域拆文件 |
| 115 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/ingestion/sync.py (~318 lines) | 按子域拆文件 |
| 116 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/rls.py (~285 lines) | 按子域拆文件 |
| 117 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/dashboards.py (~275 lines) | 按子域拆文件 |
| 118 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/auth/users/service.py (~273 lines) | 按子域拆文件 |
| 119 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/reports/__init__.py (~262 lines) | 按子域拆文件 |
| 120 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/datasources.py (~228 lines) | 按子域拆文件 |
| 121 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/api/v1/query.py (~226 lines) | 按子域拆文件 |
| 122 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/metadata/dimensions/service.py (~215 lines) | 按子域拆文件 |
| 123 | P2 | size | backend | 超 py ≤200 软约束 | backend/app/metadata/physical/service.py (~205 lines) | 按子域拆文件 |
| 124 | P2 | bug | fe | 未知 URL 不 404，可能送进 admin 壳 | routes * → /admin | 404 页 |
| 125 | P2 | dead | fe | 缺失时造假用户造 nav | AdminLayout authUser fallback viewer | skeleton 加载态 |
| 126 | P2 | shallow | fe | 展示名双源 | SOURCE_TYPE_LABELS vs connector-taxonomy | 统一 displayName |
| 127 | P2 | dead | fe | 不读 URL，无法深链 tab | metadata glossary 双路由同页 | searchParams 同步 |
| 128 | P2 | bug | fe | default 非 UUID | nav 主题分析 /admin/themes/default | 动态入口 |
| 129 | P3 | shallow | fe | Inspector vs Widget 标题栏 | 删除确认对话框两套 | 共用 ConfirmDelete |
| 130 | P3 | shallow | fe | 文案样式分叉 | view/edit 空态两套 | empty variant |
| 131 | P3 | shallow | fe | 类型常量分散 | 薄 lib chartPaths/dashboardDnd 分散 | 合并域模块 |
| 132 | P3 | leak | fe | 编排层过厚 | DashboardEditPage 编排 10+ 模块 | useDashboardLayoutEditor |
| 133 | P3 | bug | backend | 默认值不一致 | row_span 默认 1 vs FE DEFAULT 3 | 对齐 |
| 134 | P3 | patch | fe | 默认口令 | dev-user-switch password changeme | 生产 tree-shake + 后端禁用 |
| 135 | P3 | dead | fe | 仅测试注入 | OPTIONAL_ROLE_CAPABILITY_MAP 空壳 | 迁 test helper |
| 136 | P3 | shallow | fe | 可接受浅 hook | usePrefabReports / useReportTemplates 薄包装 | 可选合并 reports-api |
| 137 | P3 | size | fe | UI 膨胀 | alert.tsx ~278 CVA 过多 | 减 appearance 组合 |
| 138 | P3 | shallow | backend | 可接受若 viz=charts 域 | api/v1/charts 薄转发 viz | 文档明确 |
| 139 | P3 | leak | backend | 缺 anti-corruption | metadata → datasources.metadata 直依赖 | 边界 exception |
| 140 | P3 | bug | backend | 关闭连接静默失败 | pool/close except pass | debug 日志 |
| 141 | P3 | patch | backend | 掩盖系统性故障 | ingestion BLE001 递归重试 | 限定可重试异常 |
| 142 | P3 | dead | charts | 其他 builder 用 unsafe colIndex | safeColIndex 未统一 | 统一 safeColIndex |
| 143 | P3 | shallow | fe | key 形状不同 | 双调度 UI ReportSchedules vs SchedulePanel | 共用 hook |
| 144 | P3 | shallow | fe | 风格不一致 | EtlRulesPage 手写 load 非 react-query | 对齐 useQuery |
| 145 | P3 | bug | fe | viewer 空卡片但路由可达 | entities canRead 仅 admin/analyst | 路由守卫 |