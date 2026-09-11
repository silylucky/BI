# -*- coding: utf-8 -*-
"""Generate architecture review HTML — one-shot, not production code."""
from __future__ import annotations

import html
from datetime import date
from pathlib import Path

OUT = Path(r"C:\Users\30381\AppData\Local\Temp\architecture-review-20260709-181722.html")
AUDIT = Path(r"C:\Users\30381\Desktop\VitalSpan\docs\automate\audits\2026-07-09-architecture-full.md")

# (id, sev, cat, area, files, problem, fix, strength)
# strength: Strong | Worth exploring | Speculative
FINDINGS: list[tuple] = []

def add(sev, cat, area, files, problem, fix, strength="Worth exploring"):
    FINDINGS.append((len(FINDINGS) + 1, sev, cat, area, files, problem, fix, strength))

# ===== SECURITY =====
add("P0", "security", "auth", "backend/app/auth/middleware.py:72",
    "DB 角色查询失败时 roles 降级为 [\"admin\"]，有效 JWT 可获超权",
    "失败返回 503/401，禁止默认 admin", "Strong")
add("P0", "security", "query", "backend/app/reports/engine/execute.py + core/config.py",
    "报表/主题 drill 显式 rls.enabled=False；默认 development 可关 RLS",
    "生产强制 RLS；默认 env=production", "Strong")
add("P0", "security", "query", "backend/app/query/native/executor.py",
    "Native 执行无 RLS/org 过滤（Mongo/ES/OS）",
    "补等价约束或生产阻断 native", "Strong")
add("P0", "security", "dashboard", "backend/app/dashboard/service.py + api/v1/dashboards.py",
    "Dashboard CRUD 无 owner/租户 ACL，任意登录用户可改删全部看板",
    "引入 resource grant / created_by 校验", "Strong")
add("P0", "security", "dashboard", "backend/app/dashboard/theme/query.py:22-26",
    "drill filter 值 f-string 拼 SQL，注入风险",
    "参数化或白名单", "Strong")
add("P0", "security", "dashboard", "backend/app/dashboard/global_filters/execute.py",
    "从 layout 读 SQL 执行且无 dashboard 所有权校验",
    "执行前 ACL + SQL 审计", "Strong")
add("P0", "security", "auth", "backend/app/query/rls/guard.py + datasources/acl.py",
    "admin 角色全局 bypass RLS 与 datasource 可见性",
    "拆系统 admin / 租户 admin；审计 bypass", "Strong")
add("P0", "security", "fe-acl", "fe/src/routes.tsx vs nav-manifest",
    "designer/charts/types/reports/themes 导航有 capability，路由仅 RequireAuth",
    "路由包 RequireCapability", "Strong")
add("P0", "security", "embed", "fe/src/embed/EmbedChartPage.tsx",
    "parentOrigin 校验自身 origin；硬编码 funnel/SQL stub；/embed 无鉴权",
    "校验父 origin + 真实 embed-config + DEV 守卫", "Strong")
add("P1", "security", "datasources", "dialects/* except Exception message=str(exc)",
    "连接错误原文回传客户端，可能泄露连接细节",
    "统一 redact + 结构化 error code", "Strong")
add("P1", "security", "metadata", "backend/app/metadata/physical/service.py",
    "list_physical_tables 无用户过滤，内存全局可见",
    "持久化 + ACL", "Worth exploring")
add("P1", "security", "ingestion", "backend/app/ingestion/sync_executor.py:34",
    "SELECT * FROM `{table}` 表名未校验，配置可注入",
    "标识符白名单", "Strong")

# ===== P0 BUGS =====
add("P0", "bug", "dashboard", "DashboardEditPage + dashboard/schemas.py LayoutWidget",
    "前端持久化 gridX/gridY，后端 schema 无字段，保存后坐标丢失重排",
    "schema 增加 gridX/gridY 并贯通", "Strong")
add("P0", "bug", "dashboard", "DashboardGrid.tsx edit vs view",
    "编辑用 RGL 坐标；预览用 order 流式 CSS grid，布局不一致",
    "view 复用 widgetsToGridLayout / 只读 RGL", "Strong")
add("P0", "bug", "charts", "chartViewConfig.ts + ChartRenderer.tsx",
    "pie 被排除 advanced 路径，落入 Apex 折线/柱逻辑，饼图错误",
    "pie 走 render-spec / buildPieOption", "Strong")
add("P0", "bug", "dashboard", "DashboardSharePage.tsx:16,64",
    "类型读 layout.widgets，API 为 layoutJson，分享页恒空",
    "改为 layoutJson", "Strong")
add("P0", "bug", "query", "backend/app/query/dialects/__init__.py",
    "SQL dialect 仅 mysql/pg/clickhouse，30+ 连接器 SQL 模式 UnsupportedDialect",
    "统一 dialect alias 表", "Strong")
add("P0", "bug", "query", "native/guard vs native/executor",
    "路由声明 file/api/timeseries native，executor 仅 mongo/es/os；csv/excel/rest 有 native 却不可达",
    "对齐 routing 与 executor", "Strong")
add("P0", "bug", "datasources", "datasources/service.py update",
    "更新连接参数不 evict_pool，旧凭证残留",
    "变更时 evict_pool", "Strong")

# ===== P1 BUGS FE =====
add("P1", "bug", "dashboard", "use-unsaved-leave-guard.ts",
    "仅拦 <a> 点击，不覆盖 navigate/后退/popstate",
    "useBlocker 或补 popstate（需 data router）", "Strong")
add("P1", "bug", "charts", "useChartExecute.ts dataset mode",
    "dataset 模式忽略 filterParameters，全局筛选对 Dataset 无效",
    "dataset execute 传 linkage 参数", "Strong")
add("P1", "bug", "dashboard", "createLayoutWidget isWidgetConfigReady vs useChartExecute",
    "就绪判据认 datasetId；执行要 dataSourceId+configId，假就绪",
    "对齐就绪判据", "Strong")
add("P1", "bug", "dashboard", "DashboardEditPage save globalFilters:[]",
    "保存布局硬编码清空全局筛选",
    "合并服务端已有 filters", "Strong")
add("P1", "bug", "dashboard", "DashboardGrid row height 120 vs 48",
    "预览 minHeight 与编辑 GRID_ROW_HEIGHT 不一致",
    "共用常量", "Worth exploring")
add("P1", "bug", "fe-auth", "LoginPage.tsx navigate",
    "有默认 Dashboard 时忽略 from 深链",
    "优先合法 from", "Strong")
add("P1", "bug", "fe-acl", "RequirePlatformAdmin vs capabilities",
    "查 admin 角色而非 system:* capability",
    "与 capabilities 对齐", "Worth exploring")
add("P1", "bug", "fe", "RoleListPage statusFilter",
    "在截断 50 条上客户端过滤，total 不准",
    "筛选走 API", "Worth exploring")
add("P1", "bug", "charts", "useChartExecute sql-only filters",
    "chart 级 filters/timeRange 仅 sql 注入，dataset 忽略",
    "文档化或后端支持", "Worth exploring")
add("P1", "bug", "dashboard", "GlobalFilterBar 非404 return null",
    "静默吞掉筛选栏故障",
    "区分 404/5xx 错误态", "Worth exploring")
add("P1", "bug", "dashboard", "DashboardEditPage name 只读",
    "setName 仅 load，无编辑保存",
    "补名称编辑或删无用 state", "Speculative")
add("P1", "bug", "backend", "ingestion/scheduler refresh_all_jobs",
    "except Exception: pass，cron 失败无日志",
    "记录异常 + metrics", "Strong")
add("P1", "bug", "backend", "ingestion sync_executor mysql-only",
    "硬编码仅 mysql 源，与多连接器战略冲突",
    "经 registry 拉取", "Worth exploring")
add("P1", "bug", "backend", "dashboard/service layout validate",
    "except Exception 吞细节，统一 Invalid layout JSON",
    "只捕 ValidationError", "Worth exploring")
add("P1", "bug", "backend", "query/executor broad except heuristics",
    "字符串启发式映射错误码易误判",
    "按驱动异常类型映射", "Worth exploring")
add("P1", "bug", "backend", "datasources create 无角色门",
    "任意认证用户可建源",
    "admin/analyst gate", "Strong")
add("P1", "bug", "backend", "pool connect_count",
    "递增不减，无 idle/age 限制",
    "生命周期 + 计数维护", "Worth exploring")
add("P1", "bug", "backend", "rls guard 异常→1=0",
    "配置错误与未知错误难区分",
    "区分 RlsConfigError vs 500", "Worth exploring")
add("P1", "bug", "backend", "binding_service 无 native",
    "binding 仅 sql|table，与 execute 不对称",
    "扩展或显式拒绝", "Speculative")
add("P1", "bug", "fe", "WidgetInspector resolveDataMode 启发式",
    "sql && mode!==dataset 可误判",
    "以 mode 为唯一真理源", "Worth exploring")
add("P1", "bug", "fe", "ChartPanel 双标题",
    "widget 标题 + ChartPanel 标题可能叠显",
    "hideTitle 或传空", "Worth exploring")
add("P1", "bug", "fe", "themes canWrite 含 editor",
    "SessionRole 无 editor",
    "hasCapability 对齐", "Worth exploring")

# ===== PATCH =====
add("P1", "patch", "dashboard", "DashboardEditPage missing/leaveEditShell",
    "僵尸编辑页补丁状态机",
    "404 路由级重定向 + 单一守卫", "Worth exploring")
add("P1", "patch", "dashboard", "DashboardGrid RGL 绕过 isDroppable",
    "pointerToGridCell + interactingRef + useCSSTransforms=false 抗闪烁补丁堆",
    "封装单一 layout controller", "Worth exploring")
add("P1", "patch", "backend", "metadata/entity/physical/dataset _store dict",
    "进程内内存 store，重启丢数据",
    "落库 + migration", "Strong")
add("P1", "patch", "backend", "governance/catalog _USER_*_SCOPE",
    "测试钩子混生产 ACL",
    "仅 fixture 注入", "Worth exploring")
add("P1", "patch", "backend", "embed_token / views/store 内存",
    "多实例/重启失效",
    "Redis/DB + TTL", "Worth exploring")
add("P1", "patch", "backend", "dispatch_push_mock / InMemoryBusAdapter",
    "生产通知/总线走 mock",
    "配置驱动真实 adapter", "Worth exploring")
add("P1", "patch", "backend", "gov.py unittest.mock.patch 生产代码",
    "probe/kingbase 用 MagicMock",
    "移到 tests/", "Strong")
add("P1", "patch", "backend", "reports X-Rpt-Delivery-Mock header",
    "header 控制 mock 调度",
    "仅 dev/test", "Worth exploring")
add("P1", "patch", "backend", "DrillStubConnector 注册",
    "测试连接器进生产注册路径",
    "仅 pytest fixture", "Worth exploring")
add("P1", "patch", "backend", "dataset/executor stub plan",
    "四步硬编码 pass/stub，不真执行",
    "接入真实 execute 或 deprecated", "Worth exploring")
add("P1", "patch", "fe", "resolve-nav ACTIVE_MILESTONES",
    "硬编码 M1/M7/M11/M13，与 plan 易漂移",
    "配置/API 注入", "Worth exploring")
add("P1", "patch", "fe", "EmbedChartPage stub + ReportExportCard UUID",
    "演示硬编码残留",
    "接真实 API", "Strong")
add("P2", "patch", "fe", "WIDGET_CHART_LABELS @deprecated 仍用",
    "deprecated 常量仍被多处引用",
    "迁 catalog displayName", "Worth exploring")
add("P2", "patch", "fe", "layoutFingerprint JSON.stringify",
    "脏检查脆弱",
    "规范化 fingerprint", "Speculative")
add("P2", "patch", "fe", "error.includes('数据源') 特殊分支",
    "字符串匹配补丁",
    "结构化错误码", "Worth exploring")
add("P2", "patch", "backend", "reports templates mock:// placeholder",
    "模板/渲染 placeholder",
    "真实 storage/engine", "Speculative")
add("P2", "patch", "backend", "xinchuang stub status",
    "合规 checklist stub 项",
    "完成或移出", "Speculative")
add("P2", "patch", "backend", "m6-probe /dev-switch",
    "内部探测与 impersonation 暴露面",
    "feature flag + 默认禁用", "Worth exploring")
add("P2", "patch", "fe", "ThemeAnalysis DIMENSION_OPTIONS 写死",
    "占位维度/entityType",
    "元数据 API 驱动", "Worth exploring")

# ===== DEAD =====
add("P1", "dead", "dashboard", "DashboardWidget onChartConfigChange",
    "prop 传入未解构未调用",
    "删除或接入", "Strong")
add("P1", "dead", "dashboard", "WidgetInspector onDelete 未传",
    "Inspector 删除 UI 永不渲染",
    "传 onDelete 或删死代码", "Strong")
add("P2", "dead", "charts", "ChartRenderer mode=config",
    "config 模式无父调用方",
    "删除或接到编辑页", "Worth exploring")
add("P2", "dead", "dashboard", "layoutUtils.moveWidget",
    "仅测试用，UI 无上移下移",
    "删或补 UI", "Speculative")
add("P2", "dead", "dashboard", "useGlobalFiltersQuery 导出无引用",
    "死导出",
    "删或替换 loadFilters", "Strong")
add("P2", "dead", "fe", "CHART_TYPES_CATALOG_LEGACY_PATH / ChartTypeL1 / isBasicChartType 外部",
    "未使用导出",
    "删或接入", "Worth exploring")
add("P2", "dead", "fe", "WIDGET_CHART_ICONS 重导出 / isWorkspaceViewPath / canManagePlatform / browserCompat",
    "死导出/未调用模块",
    "删除或启动接入", "Worth exploring")
add("P2", "dead", "dashboard", "Palette/Inspector embedded=false 分支",
    "生产恒 embedded",
    "删非嵌入分支", "Speculative")
add("P2", "dead", "charts", "getFallbackChartType 仅测试",
    "运行路径未用",
    "接入降级或移 test", "Speculative")
add("P2", "dead", "backend", "registry 空异常类 / BindingUpdate pass / viz bare pass / theme bare pass",
    "占位 pass",
    "补实现或删除", "Worth exploring")
add("P2", "dead", "backend", "dataset stub plan",
    "见 patch 条",
    "同上", "Worth exploring")

# ===== SHALLOW / LEAK / SIZE =====
add("P1", "shallow", "dashboard", "WidgetInspector 未嵌 ChartConfigPanel",
    "看板编辑无法配维度/指标/样式；ChartConfigPanel 孤立",
    "Inspector 嵌入（M-DASH-UX F-B）", "Strong")
add("P1", "shallow", "dashboard", "编辑态 WidgetEditPreview 挡 ChartRenderer",
    "编辑非所见即所得",
    "F-A 接线真出图", "Strong")
add("P1", "leak", "charts", "useChartExecute → dashboardFilterUtils",
    "charts 依赖 dashboard 域",
    "抽 lib/sqlParameters", "Strong")
add("P1", "leak", "backend", "datasources dialects → query.native.guard",
    "outbound 依赖 query 域，依赖方向反转",
    "guard 下沉 shared", "Strong")
add("P1", "leak", "backend", "datasources ↔ core.nfr.plugin_extension 环",
    "启动环状耦合",
    "bootstrap/dialects.py", "Worth exploring")
add("P1", "leak", "backend", "query/metadata → _resolve_connection_options 私有",
    "跨域 import 私有函数",
    "公开 connection API", "Worth exploring")
add("P1", "shallow", "backend", "双 dialect 注册表 datasources vs query",
    "连接/SQL 两套体系易漂移",
    "单一 SqlDialect 注册表", "Strong")
add("P1", "shallow", "backend", "6 MySQL 系 + 4 PG 系浅包装",
    "仅改 type/error code 的子类文件",
    "族基类 + 配置表", "Worth exploring")
add("P1", "shallow", "backend", "elasticsearch vs opensearch 重复",
    "client/probe 高度重复",
    "SearchEngineConnectorBase", "Worth exploring")
add("P1", "shallow", "backend", "_connector_and_kwargs 三处复制",
    "metadata/query/native 复制",
    "connection_factory", "Strong")
add("P1", "shallow", "fe", "ErrorBanner 18+ 处内联重复",
    "与 PageErrorBanner 重复",
    "全站统一", "Strong")
add("P1", "shallow", "fe", "chartRegistry vs ChartExplorePage 双类型",
    "同 API 两套类型/缓存",
    "统一 ChartTypeCatalogItem", "Worth exploring")
add("P1", "shallow", "fe", "Query Key 手写漂移 8 处",
    "users/views、schedules、themes、datasources invalidate 不一致",
    "强制 queryKeys.*", "Strong")
add("P2", "shallow", "fe", "formatUpdatedAt / fetchChartTypeCatalog / ResultTable 重复",
    "多处复制",
    "共享 hook/组件", "Worth exploring")
add("P2", "shallow", "fe", "ChartRenderer Apex vs ECharts 双实现",
    "bar/line 双路径",
    "统一渲染策略表", "Worth exploring")
add("P2", "shallow", "fe", "行数上限 100/500/50 三套",
    "语义不清",
    "集中常量", "Speculative")
add("P2", "shallow", "fe", "login 裸 fetch 绕过 apiFetch",
    "重复 API_BASE + 无统一 401",
    "auth-api.ts", "Worth exploring")
add("P2", "leak", "charts", "ChartRenderer 内嵌 ChartConfigPanel",
    "渲染与配置分层破坏",
    "配置上提 inspector", "Worth exploring")
add("P2", "leak", "charts", "buildMapOption 内 registerMap",
    "纯函数副作用",
    "模块级一次注册", "Worth exploring")
add("P2", "leak", "backend", "dashboard theme → reports.engine",
    "跨域编排",
    "query facade", "Speculative")
add("P2", "leak", "backend", "core NFR 含 _USER_*_SCOPE",
    "NFR 与生产 ACL 混",
    "分离", "Worth exploring")
add("P2", "shallow", "backend", "17+ _db() session 工厂重复",
    "entry 样板重复",
    "core/deps.py", "Worth exploring")
add("P2", "shallow", "fe", "DashboardPreviewThumb 忽略 grid 坐标",
    "缩略图与画布漂移",
    "读坐标或标注示意", "Speculative")

# SIZE
for f, n in [
    ("DashboardEditPage.tsx", 478), ("DashboardListPage.tsx", 339), ("ChartConfigPanel.tsx", 306),
    ("WidgetInspector.tsx", 294), ("designer-panels.tsx", 531), ("RoleListPage.tsx", 507),
    ("themes-panel.tsx", 383), ("DatasourceListPage.tsx", 346), ("ChartExplorePage.tsx", 344),
    ("RlsAdminPage.tsx", 321), ("dimensions-panel.tsx", 313), ("SchedulePanel.tsx", 305),
    ("WorkflowInstancesPanel.tsx", 302),
]:
    add("P2", "size", "fe", f"fe … {f} (~{n} lines)",
        f"超 fe ≤300 软约束", "拆 hook/子组件", "Worth exploring")

for f, n in [
    ("api/v1/gov.py", 936), ("datasources/dialects/errors.py", 700), ("api/v1/nfr.py", 517),
    ("api/v1/metadata.py", 433), ("api/v1/designer.py", 375), ("datasources/service.py", 346),
    ("auth/rls/groups/service.py", 322), ("api/v1/ingestion/sync.py", 318), ("api/v1/rls.py", 285),
    ("api/v1/dashboards.py", 275), ("auth/users/service.py", 273), ("api/v1/reports/__init__.py", 262),
    ("api/v1/datasources.py", 228), ("api/v1/query.py", 226), ("metadata/dimensions/service.py", 215),
    ("metadata/physical/service.py", 205),
]:
    add("P2", "size", "backend", f"backend/app/{f} (~{n} lines)",
        f"超 py ≤200 软约束", "按子域拆文件", "Worth exploring")

# MORE FE misc
add("P2", "bug", "fe", "routes * → /admin",
    "未知 URL 不 404，可能送进 admin 壳",
    "404 页", "Worth exploring")
add("P2", "dead", "fe", "AdminLayout authUser fallback viewer",
    "缺失时造假用户造 nav",
    "skeleton 加载态", "Worth exploring")
add("P2", "shallow", "fe", "SOURCE_TYPE_LABELS vs connector-taxonomy",
    "展示名双源",
    "统一 displayName", "Worth exploring")
add("P2", "dead", "fe", "metadata glossary 双路由同页",
    "不读 URL，无法深链 tab",
    "searchParams 同步", "Worth exploring")
add("P2", "bug", "fe", "nav 主题分析 /admin/themes/default",
    "default 非 UUID",
    "动态入口", "Worth exploring")
add("P3", "shallow", "fe", "删除确认对话框两套",
    "Inspector vs Widget 标题栏",
    "共用 ConfirmDelete", "Speculative")
add("P3", "shallow", "fe", "view/edit 空态两套",
    "文案样式分叉",
    "empty variant", "Speculative")
add("P3", "shallow", "fe", "薄 lib chartPaths/dashboardDnd 分散",
    "类型常量分散",
    "合并域模块", "Speculative")
add("P3", "leak", "fe", "DashboardEditPage 编排 10+ 模块",
    "编排层过厚",
    "useDashboardLayoutEditor", "Worth exploring")
add("P3", "bug", "backend", "row_span 默认 1 vs FE DEFAULT 3",
    "默认值不一致",
    "对齐", "Speculative")
add("P3", "patch", "fe", "dev-user-switch password changeme",
    "默认口令",
    "生产 tree-shake + 后端禁用", "Worth exploring")
add("P3", "dead", "fe", "OPTIONAL_ROLE_CAPABILITY_MAP 空壳",
    "仅测试注入",
    "迁 test helper", "Speculative")
add("P3", "shallow", "fe", "usePrefabReports / useReportTemplates 薄包装",
    "可接受浅 hook",
    "可选合并 reports-api", "Speculative")
add("P3", "size", "fe", "alert.tsx ~278 CVA 过多",
    "UI 膨胀",
    "减 appearance 组合", "Speculative")
add("P3", "shallow", "backend", "api/v1/charts 薄转发 viz",
    "可接受若 viz=charts 域",
    "文档明确", "Speculative")
add("P3", "leak", "backend", "metadata → datasources.metadata 直依赖",
    "缺 anti-corruption",
    "边界 exception", "Speculative")
add("P3", "bug", "backend", "pool/close except pass",
    "关闭连接静默失败",
    "debug 日志", "Speculative")
add("P3", "patch", "backend", "ingestion BLE001 递归重试",
    "掩盖系统性故障",
    "限定可重试异常", "Worth exploring")
add("P3", "dead", "charts", "safeColIndex 未统一",
    "其他 builder 用 unsafe colIndex",
    "统一 safeColIndex", "Worth exploring")
add("P3", "shallow", "fe", "双调度 UI ReportSchedules vs SchedulePanel",
    "key 形状不同",
    "共用 hook", "Worth exploring")
add("P3", "shallow", "fe", "EtlRulesPage 手写 load 非 react-query",
    "风格不一致",
    "对齐 useQuery", "Speculative")
add("P3", "bug", "fe", "entities canRead 仅 admin/analyst",
    "viewer 空卡片但路由可达",
    "路由守卫", "Worth exploring")

# Deepening candidates (architecture cards)
CANDIDATES = [
    ("C1", "Strong", "Deepen Dashboard layout module",
     "gridLayoutAdapter · layoutUtils · DashboardGrid · schemas.LayoutWidget",
     "grid 坐标跨 FE/BE 与 edit/view 三处分叉，接口几乎等于实现碎片",
     "单一 DashboardLayout module：读写 gridX/Y、normalize、toRGL、toPreview；后端 schema 同构",
     ["locality: 布局 bug 集中一处", "leverage: edit/view/share/thumb 共用", "接口缩短；实现吸收补丁"]),
    ("C2", "Strong", "Deepen Chart execute seam",
     "useChartExecute · ChartRenderer · ChartConfigPanel · WidgetInspector",
     "执行/渲染/配置浅模块互不接线；charts→dashboard 泄漏",
     "ChartRuntime module：execute+render；Inspector 为唯一配置 adapter",
     ["locality: 出图路径可测", "leverage: edit/view/embed 共用", "删除 WidgetEditPreview 分叉"]),
    ("C3", "Strong", "Collapse dialect dual registries",
     "datasources/dialects · query/dialects · native/executor",
     "两套 dialect + native 能力声明与实现脱节",
     "单一 ConnectorCapability 表驱动 SQL/native/alias",
     ["depth: 一族一基类", "删除 10+ 浅包装", "UnsupportedDialect 消失"]),
    ("C4", "Strong", "AuthZ seam: grants everywhere",
     "dashboard/service · routes RequireCapability · middleware roles",
     "Dashboard 无 ACL；FE 路由与 nav capability 不一致；middleware 失败升 admin",
     "统一 ResourceGrant module + FE RequireCapability 镜像",
     ["security locality", "leverage: 一处策略", "删除角色字符串散落"]),
    ("C5", "Worth exploring", "Replace in-memory _store patches",
     "metadata/* · views/store · embed_token · governance scopes",
     "多域内存 dict 补丁态，无持久化/多实例",
     "按域落库；测试 scope 仅 fixture",
     ["删除补丁残留", "多实例正确性"]),
    ("C6", "Worth exploring", "Unify FE queryKeys + ErrorBanner",
     "queryKeys.ts · 18 ErrorBanner · chartRegistry",
     "浅重复导致缓存分裂与 UI 漂移",
     "强制 queryKeys；PageErrorBanner；单一 catalog fetch",
     ["locality: 缓存失效可预测", "删除 18 份横幅"]),
]

PLAN_PHASES = [
    ("P0 · 安全与正确性（1–2 周）", [
        "修 middleware 禁止默认 admin",
        "Dashboard ACL + theme SQL 参数化 + global-filters ACL",
        "gridX/Y 进 schema；SharePage layoutJson；pie 渲染；view 布局对齐",
        "FE 路由 RequireCapability；Embed origin/stub",
        "dialect alias；native 对齐；update 时 evict_pool",
        "保存不清空 globalFilters；就绪判据对齐",
    ]),
    ("P1 · M-DASH-UX 接线 + 高风险债（并行 graduation）", [
        "F-A 编辑态 ChartRenderer；F-B Inspector←ChartConfigPanel",
        "F-C undo；F-D 编辑页 GlobalFilterBar",
        "抽 sqlParameters；删死 prop/死导出",
        "dataset 传 filterParameters",
        "gov/kingbase 移出生产 mock.patch",
    ]),
    ("P2 · 加深模块（架构）", [
        "C1 DashboardLayout module",
        "C3 ConnectorCapability 统一注册表 + MySQL/PG 族基类",
        "C6 queryKeys + ErrorBanner 统一",
        "拆 God 页：DashboardEditPage / designer-panels / RoleListPage / gov.py",
    ]),
    ("P3 · 补丁清扫与持久化", [
        "metadata/views/embed_token 落库",
        "推送/总线真实 adapter；移除 DrillStub 生产路径",
        "ACTIVE_MILESTONES 配置化",
        "报表 placeholder / xinchuang stub 收口",
    ]),
    ("P4 · 可选深化（非毕业阻塞）", [
        "对齐/多选、组件联动（plan 可选）",
        "M-PRODUCT F-F companion",
        "AntV / 大数据虚拟化 / GIS",
        "leave-guard 迁 data router + useBlocker",
    ]),
]

def esc(s: str) -> str:
    return html.escape(s)

def badge(sev: str) -> str:
    colors = {"P0": "bg-red-600", "P1": "bg-orange-500", "P2": "bg-amber-500", "P3": "bg-slate-500"}
    return f'<span class="px-2 py-0.5 rounded text-xs font-bold text-white {colors.get(sev,"bg-slate-500")}">{sev}</span>'

def cat_badge(cat: str) -> str:
    return f'<span class="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700 font-mono">{esc(cat)}</span>'

def strength_badge(s: str) -> str:
    c = {"Strong": "bg-emerald-600 text-white", "Worth exploring": "bg-amber-400 text-slate-900", "Speculative": "bg-slate-400 text-white"}
    return f'<span class="px-2 py-0.5 rounded text-xs font-semibold {c.get(s,"bg-slate-300")}">{esc(s)}</span>'

# counts
from collections import Counter
sev_c = Counter(f[1] for f in FINDINGS)
cat_c = Counter(f[2] for f in FINDINGS)

rows = []
for fid, sev, cat, area, files, problem, fix, strength in FINDINGS:
    rows.append(f"""
    <tr class="border-b border-slate-100 hover:bg-stone-100/80" data-sev="{sev}" data-cat="{cat}">
      <td class="px-2 py-2 text-xs text-slate-500">{fid}</td>
      <td class="px-2 py-2">{badge(sev)}</td>
      <td class="px-2 py-2">{cat_badge(cat)}</td>
      <td class="px-2 py-2 text-xs font-mono text-slate-600">{esc(area)}</td>
      <td class="px-2 py-2 text-sm">{esc(problem)}</td>
      <td class="px-2 py-2 text-xs font-mono text-slate-500 max-w-xs truncate" title="{esc(files)}">{esc(files)}</td>
      <td class="px-2 py-2 text-sm text-slate-700">{esc(fix)}</td>
      <td class="px-2 py-2">{strength_badge(strength)}</td>
    </tr>""")

cand_html = []
for cid, strength, title, files, problem, solution, wins in CANDIDATES:
    wins_li = "".join(f"<li>{esc(w)}</li>" for w in wins)
    cand_html.append(f"""
    <article id="{cid}" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="font-serif text-xl text-slate-900">{esc(title)}</h3>
        {strength_badge(strength)}
        <span class="text-xs uppercase tracking-wider text-slate-400">{esc(cid)}</span>
      </div>
      <p class="font-mono text-xs text-slate-500">{esc(files)}</p>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <p class="text-xs uppercase tracking-wider text-red-700 mb-2">Before — shallow / leak</p>
          <pre class="mermaid">flowchart TB
  A[Page] --> B[Grid]
  A --> C[Widget]
  A --> D[Inspector]
  B -.leak.-> E[RGL patches]
  C -.fork.-> F[EditPreview]
  C --> G[ChartRenderer]
  D -.dead.-> H[ChartConfigPanel]
  classDef leak stroke:#dc2626,stroke-width:2px;
  class E,F,H leak</pre>
        </div>
        <div class="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <p class="text-xs uppercase tracking-wider text-emerald-800 mb-2">After — deep module</p>
          <pre class="mermaid">flowchart TB
  A[Page] --> M[Deep module]
  M --> I[one interface]
  I --> Impl[implementation absorbs patches]
  classDef deep fill:#0f172a,color:#fff;
  class M,I deep</pre>
        </div>
      </div>
      <p><strong>Problem:</strong> {esc(problem)}</p>
      <p><strong>Solution:</strong> {esc(solution)}</p>
      <ul class="list-disc pl-5 text-sm space-y-1">{wins_li}</ul>
    </article>""")

phase_html = []
for title, items in PLAN_PHASES:
    lis = "".join(f"<li>{esc(i)}</li>" for i in items)
    phase_html.append(f"""
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h3 class="font-serif text-lg mb-3">{esc(title)}</h3>
      <ol class="list-decimal pl-5 space-y-1 text-sm text-slate-700">{lis}</ol>
    </div>""")

doc = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Architecture review — VitalSpan</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({{ startOnLoad: true, theme: "neutral", securityLevel: "loose" }});
  </script>
  <style>
    .seam {{ stroke-dasharray: 4 4; }}
    .deep {{ background: linear-gradient(135deg, #0f172a, #1e293b); }}
  </style>
</head>
<body class="bg-stone-50 text-slate-900 font-sans">
<main class="max-w-6xl mx-auto px-6 py-12 space-y-12">
  <header class="space-y-4">
    <p class="text-xs uppercase tracking-widest text-slate-500">VitalSpan · {date.today().isoformat()}</p>
    <h1 class="font-serif text-4xl">Architecture review</h1>
    <p class="text-slate-600 max-w-3xl">全量扫描：可重构浅模块、死代码、补丁残留、风险 Bug。词汇：module · interface · depth · seam · adapter · leverage · locality。无 CONTEXT.md / ADR 目录（未发现）。</p>
    <div class="flex flex-wrap gap-3 text-sm">
      <span class="rounded-full bg-white border px-3 py-1">Findings: <b>{len(FINDINGS)}</b></span>
      <span class="rounded-full bg-red-100 text-red-800 px-3 py-1">P0: {sev_c['P0']}</span>
      <span class="rounded-full bg-orange-100 text-orange-800 px-3 py-1">P1: {sev_c['P1']}</span>
      <span class="rounded-full bg-amber-100 text-amber-900 px-3 py-1">P2: {sev_c['P2']}</span>
      <span class="rounded-full bg-slate-200 px-3 py-1">P3: {sev_c['P3']}</span>
    </div>
    <div class="flex flex-wrap gap-2 text-xs">
      {"".join(f'<span class="bg-white border rounded px-2 py-1">{k}: {v}</span>' for k,v in sorted(cat_c.items()))}
    </div>
    <div class="text-xs text-slate-500 space-x-3">
      <span>solid = module</span><span>dashed = seam</span><span class="text-red-600">red = leak</span><span>thick dark = deep</span>
    </div>
  </header>

  <section class="space-y-3">
    <h2 class="font-serif text-2xl">Top recommendation</h2>
    <div class="rounded-2xl deep text-white p-6 space-y-2">
      <p class="text-emerald-300 text-xs uppercase tracking-wider">Start here</p>
      <p class="text-xl font-serif">C1 + C4 并行：DashboardLayout 加深 + AuthZ seam</p>
      <p class="text-slate-300 text-sm">先修 P0 安全/坐标丢失/分享页/饼图，再推进 M-DASH-UX 接线（C2）。C3 dialect 统一可与 FE 并行 worktree。</p>
      <a href="#C1" class="inline-block mt-2 text-emerald-300 underline text-sm">→ C1 card</a>
    </div>
  </section>

  <section id="candidates" class="space-y-8">
    <h2 class="font-serif text-2xl">Deepening candidates</h2>
    {"".join(cand_html)}
  </section>

  <section class="space-y-4">
    <h2 class="font-serif text-2xl">Phased remediation plan</h2>
    <div class="grid md:grid-cols-2 gap-4">{"".join(phase_html)}</div>
  </section>

  <section class="space-y-4">
    <h2 class="font-serif text-2xl">Complete finding inventory ({len(FINDINGS)})</h2>
    <p class="text-sm text-slate-600">不过滤、不截断。可用浏览器 Ctrl+F 搜索。</p>
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full text-left">
        <thead class="bg-stone-100 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-2 py-3">#</th>
            <th class="px-2 py-3">Sev</th>
            <th class="px-2 py-3">Cat</th>
            <th class="px-2 py-3">Area</th>
            <th class="px-2 py-3">Problem</th>
            <th class="px-2 py-3">Files</th>
            <th class="px-2 py-3">Fix</th>
            <th class="px-2 py-3">Rec</th>
          </tr>
        </thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </div>
  </section>

  <footer class="text-xs text-slate-400 pt-8 border-t">
    Generated by improve-codebase-architecture · interactive mode · {len(FINDINGS)} findings · 6 deepening candidates
  </footer>
</main>
</body>
</html>
"""

OUT.write_text(doc, encoding="utf-8")
print(f"HTML: {OUT} ({OUT.stat().st_size} bytes)")

# markdown audit
md = [f"# Architecture full audit — {date.today().isoformat()}", "",
      f"> Findings: **{len(FINDINGS)}** · P0={sev_c['P0']} P1={sev_c['P1']} P2={sev_c['P2']} P3={sev_c['P3']}",
      f"> HTML: `{OUT}`", "",
      "## Category counts", ""]
for k, v in sorted(cat_c.items()):
    md.append(f"- `{k}`: {v}")
md += ["", "## Phased plan", ""]
for title, items in PLAN_PHASES:
    md.append(f"### {title}")
    for i in items:
        md.append(f"- {i}")
    md.append("")
md += ["## Full inventory", "", "| # | Sev | Cat | Area | Problem | Files | Fix |",
       "|---|-----|-----|------|---------|-------|-----|"]
for fid, sev, cat, area, files, problem, fix, strength in FINDINGS:
    md.append(f"| {fid} | {sev} | {cat} | {area} | {problem.replace('|','/')} | {files.replace('|','/')} | {fix.replace('|','/')} |")

AUDIT.write_text("\n".join(md), encoding="utf-8")
print(f"MD: {AUDIT}")
