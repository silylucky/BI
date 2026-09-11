# VitalSpan 并发安全重构计划（request-refactor-plan）

> **日期**：2026-07-09  
> **输入**：`docs/automate/audits/2026-07-09-architecture-full.md`（145 findings）+ `improve-codebase-architecture` HTML 报告  
> **目标**：产出无文件重叠、可 `dispatching-parallel-agents` 分发的重构任务清单  
> **栈约束**：`fe/` + FastAPI `backend/app/`；API `/api/v1/`；零第三方 BI 运行时；fe≤300 / py≤200 软约束  
> **兼容铁律**：无业务断流；HTTP 契约向后兼容；存量调用方可编译可测  

---

## 【串行前置任务】（Subagent-Driven 先行，禁止并发）

> 凡触及公共契约、新建共享模块、全局注册表、跨域抽离的改动，一律本区执行完毕并合并后，再开并发队列。

### S-PRE-01 · LayoutWidget 坐标契约（gridX/gridY）【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | `backend/app/dashboard/schemas.py`；`backend/app/dashboard/service.py`（仅 layout normalize/validate 相关函数）；`backend/app/views/validate.py`；对应 pytest（`backend/tests/**/test_*dashboard*layout*` 或新建 `test_layout_grid_xy.py`） |
| **root_architecture_problem** | Finding #13：前端持久化 gridX/gridY，后端 schema 无字段，保存后坐标丢失重排 |
| **refactor_step_detail** | 1) 在 `LayoutWidget` 增加可选 `grid_x`/`grid_y`（alias `gridX`/`gridY`，ge=0） 2) `validate_layout_dict` / dump 保留字段 3) 默认缺省时由现有 `normalize` 补齐 4) 契约测试：round-trip JSON 含坐标 5) Spec 评审：OpenAPI/schemas 与 FE `LayoutWidget` 对齐 6) 质量评审：无破坏既有无坐标旧 layout |
| **risk & test_strategy** | 风险：旧 layout 缺字段 → 必须 Optional + 服务端补齐。验证：`pytest` layout round-trip；手工保存编辑页再加载坐标不变 |

### S-PRE-02 · 抽离 sqlParameters 共享模块【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | **新建** `fe/src/lib/sqlParameters.ts`；`fe/src/components/dashboard/dashboardFilterUtils.ts`；`fe/src/components/charts/useChartExecute.ts`；`fe/src/components/dashboard/dashboardFilterUtils.test.ts`；新建/改 `fe/src/lib/sqlParameters.test.ts` |
| **root_architecture_problem** | Finding #74：charts 依赖 dashboard 域（`useChartExecute → dashboardFilterUtils`） |
| **refactor_step_detail** | 1) 将 `injectSqlParameters` 等纯函数迁入 `lib/sqlParameters.ts` 2) `dashboardFilterUtils` re-export 保持兼容 3) `useChartExecute` 改 import 自 `@/lib/sqlParameters` 4) vitest 绿 5) Spec：无行为变化 6) 质量：禁止 charts→dashboard 反向依赖 |
| **risk & test_strategy** | 风险：漏迁符号。验证：`vitest` filter/sql 相关；`rg "dashboardFilterUtils" fe/src/components/charts` 应为 0 |

### S-PRE-03 · datasources 公开 connection API【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | **新建** `backend/app/datasources/connection.py`；`backend/app/datasources/service.py`（仅抽出 `_resolve_connection_options` 为公开函数，保留旧名 wrapper）；`backend/app/query/executor.py`（改 import）；`backend/app/query/native/executor.py`（改 import）；`backend/app/datasources/metadata/service.py`（改 import） |
| **root_architecture_problem** | Finding #77/#81：跨域 import 私有 `_resolve_connection_options`；三处 `_connector_and_kwargs` 复制 |
| **refactor_step_detail** | 1) 公开 `resolve_connection_options` + `connector_and_kwargs` 2) 三处改为调用公开 API 3) 删除重复私有拷贝 4) pytest query/datasource 回归 5) Spec：outbound 不再依赖私有符号 6) 质量：依赖方向 datasources←query |
| **risk & test_strategy** | 风险：签名漂移。验证：既有 execute/metadata pytest；无新公开 HTTP 变更 |

### S-PRE-04 · SQL dialect alias 注册表扩容【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | `backend/app/query/dialects/__init__.py`；必要时 `backend/app/query/dialects/*.py`（仅 alias 映射表，不改各连接器实现）；对应 pytest dialect resolve |
| **root_architecture_problem** | Finding #17：SQL dialect 仅 mysql/pg/clickhouse，30+ 连接器 UnsupportedDialect |
| **refactor_step_detail** | 1) 建立 `DIALECT_ALIASES`（mariadb/tidb/doris/starrocks→mysql；timescale/gauss/kingbase/redshift→postgresql 等） 2) resolve 走 alias 3) 单测覆盖 10+ alias 4) Spec：不改 SQL 生成语义 5) 质量：未知 type 仍明确报错 |
| **risk & test_strategy** | 风险：错误 alias。验证：各 alias `resolve_dialect` 单测；抽样 mysql 系 execute |

### S-PRE-05 · 新建 core/deps.get_db【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | **新建** `backend/app/core/deps.py`（仅新增，**本阶段不改**各 `api/v1/*.py`） |
| **root_architecture_problem** | Finding #93：17+ `_db()` session 工厂重复 |
| **refactor_step_detail** | 1) 实现 `get_db` Depends 生成器 2) 文档注释用法 3) 本阶段零消费者迁移（迁移见并发任务按 router 拆分） 4) Spec：与现有 session 生命周期一致 5) 质量：单测 deps 可 yield/close |
| **risk & test_strategy** | 风险：无。验证：新建单元测试即可；不跑全量 API 迁移 |

### S-PRE-06 · queryKeys 登记缺失键 + PageErrorBanner 组件【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | `fe/src/lib/queryKeys.ts`；`fe/src/lib/queryKeys` 相关测试（若有）；**新建或扩展** `fe/src/components/layout/list-page-kit.tsx` / `fe/src/components/ui/page-error-banner.tsx`（二选一，只新增导出，不改各业务页） |
| **root_architecture_problem** | Finding #84/#82：Query Key 手写漂移；ErrorBanner 18+ 重复 |
| **refactor_step_detail** | 1) 在 `queryKeys` 补齐 `users.views`、`reports.scheduleExecutions`、`themes.executePlan`、`datasources.detail` invalidate 形状 2) 导出稳定 `PageErrorBanner` 3) 本阶段不改业务页（由并发任务替换） 4) Spec：键名稳定文档化 5) 质量：无 breaking rename |
| **risk & test_strategy** | 风险：键改名导致缓存分裂。验证：仅新增键，旧键保留；vitest queryKeys |

### S-PRE-07 · 默认环境与 RLS 生产开关（配置契约）【串行前置任务】

| 字段 | 内容 |
|------|------|
| **target_file_scope** | `backend/app/core/config.py`；相关 settings 测试；**不改** reports/query 业务文件（业务强制 RLS 见并发 P 任务） |
| **root_architecture_problem** | Finding #2 部分：默认 `vitalspan_env=development` 可关 RLS |
| **refactor_step_detail** | 1) 文档化生产必须 `production` 2) 增加 `rls_force_enabled` 或收紧默认 3) 开发环境显式 opt-out 4) Spec：配置项向后兼容 5) 质量：无密钥进仓库 |
| **risk & test_strategy** | 风险：本地开发体验。验证：settings 单测；README/arch 一句说明 |

**串行前置完成门禁**：上述 7 项全部 commit 合并到工作基线后，才允许启动【并发任务列表】。

---

## 【并发任务列表】（文件集互不重叠 · 可并行分发）

> 每条任务 6 项元数据齐全。`target_file_scope` 经预检无交叉。  
> 建议 Wave-A（P0 安全/正确性）与 Wave-B（体验/债）可同波次并行，只要文件不撞车。

---

### task_id: P01

- **task_name**：AuthMiddleware 禁止 DB 失败升 admin  
- **target_file_scope**：`backend/app/auth/middleware.py`；`backend/tests/**/test_*auth*middleware*`（或新建 `test_auth_middleware_roles.py`）  
- **root_architecture_problem**：Finding #1：DB 角色查询失败时 `roles=db_roles or ["admin"]`，有效 JWT 可获超权  
- **refactor_step_detail**：  
  1. 将 `db_roles or ["admin"]` 改为失败路径返回 503/401（`OperationalError`/`ProgrammingError`）  
  2. 空角色列表保持空或 viewer，**禁止**默认 admin  
  3. 补单测：模拟 DB 异常 → 非 200 / 无 admin  
  4. Spec 评审：对照 AUTH/BOOT 公开路径与错误码  
  5. 质量评审：无吞异常；日志不含 token  
- **risk & test_strategy**：风险：运维期 meta DB 抖动导致全站 503（可接受，优于超权）。回归：`pytest` auth middleware；手工无效/有效 JWT  

---

### task_id: P02

- **task_name**：报表引擎强制 RLS（禁显式关闭）  
- **target_file_scope**：`backend/app/reports/engine/execute.py`；相关 `backend/tests/**/test_*report*execute*`  
- **root_architecture_problem**：Finding #2：报表/主题 drill 显式 `rls={"enabled": False}`  
- **refactor_step_detail**：  
  1. 删除/忽略调用方 `enabled: False`（生产强制 True）  
  2. 仅当 settings 显式允许且 env≠production 时可关  
  3. 单测覆盖强制路径  
  4. Spec：报表出数仍成功且带 RLS  
  5. 质量：不改 HTTP path  
- **risk & test_strategy**：风险：依赖无 RLS 的旧测试失败 → 改测试夹具。验证：reports execute pytest  

---

### task_id: P03

- **task_name**：Native 执行对齐 guard + 最小 RLS/可见性门  
- **target_file_scope**：`backend/app/query/native/executor.py`；`backend/app/query/native/guard.py`；对应 native pytest  
- **root_architecture_problem**：Finding #3/#18：Native 无 RLS；guard 声明与 executor 支持集不一致  
- **refactor_step_detail**：  
  1. 对齐 capabilities：executor 支持集 = guard 声明，或缩小 guard  
  2. 执行前强制 datasource ACL；文档化 native 无 SQL-RLS 时的阻断策略（生产拒绝未支持类型）  
  3. 单测：未支持类型 422；已支持类型 ACL 403  
  4. Spec：与 QUERY native 契约一致  
  5. 质量：无静默降级  
- **risk & test_strategy**：风险：部分连接器暂时不可 native。验证：native pytest；明确错误码  

---

### task_id: P04

- **task_name**：Dashboard CRUD 所有权/ACL  
- **target_file_scope**：`backend/app/dashboard/service.py`（ACL 相关，**不含**已在 S-PRE-01 改完的 schema 字段定义）；`backend/app/api/v1/dashboards.py`；dashboard ACL pytest  
- **root_architecture_problem**：Finding #4：Dashboard CRUD 无 owner/租户 ACL  
- **refactor_step_detail**：  
  1. list/get/update/delete 校验 `created_by` 或 resource grant（与 AUTH-004 模式对齐）  
  2. admin 可全局；其余仅己有  
  3. 403 统一错误码  
  4. Spec：对照 DASH/AUTH  
  5. 质量：不改响应 schema 字段名  
- **risk & test_strategy**：风险：既有测试用共享 dashboard。验证：补 ACL 用例；全量 dashboard pytest  

---

### task_id: P05

- **task_name**：Theme drill SQL 参数化  
- **target_file_scope**：`backend/app/dashboard/theme/query.py`；theme execute pytest  
- **root_architecture_problem**：Finding #5：drill filter `f"{k} = '{v}'"` 注入  
- **refactor_step_detail**：  
  1. 参数化绑定或严格标识符白名单  
  2. 拒绝非法 key  
  3. 注入攻击单测  
  4. Spec：theme execute 契约不变  
  5. 质量：无字符串拼值  
- **risk & test_strategy**：风险：复杂表达式。验证：恶意 payload 422；正常 drill 通过  

---

### task_id: P06

- **task_name**：Global-filters execute 所有权校验  
- **target_file_scope**：`backend/app/dashboard/global_filters/execute.py`；相关 pytest  
- **root_architecture_problem**：Finding #6：从 layout 读 SQL 执行无 dashboard 所有权校验  
- **refactor_step_detail**：  
  1. 执行前加载 dashboard 并复用 P04 同款 ACL helper（**只读 import**，不改 service 文件若 P04 未合入则复制最小 check 函数到本包私有 `_acl.py`）  
  2. 优先：若 P04 已合并，import `dashboard.service.assert_can_access`；若并行同波次，在 `global_filters/_access.py` **新建**私有校验避免改 service  
  3. Spec + 质量双评审  
- **risk & test_strategy**：为避免与 P04 文件冲突：**本任务不得修改 `dashboard/service.py`**。验证：越权 403 pytest  

---

### task_id: P07

- **task_name**：RLS guard 异常语义修正  
- **target_file_scope**：`backend/app/query/rls/guard.py`；rls pytest  
- **root_architecture_problem**：Finding #37：异常一律 `1=0` 难区分；#7 部分（bypass 审计日志可在本文件加）  
- **refactor_step_detail**：  
  1. `RlsConfigError` → 明确 422/配置错误；未知异常 → 500  
  2. admin bypass 打 audit log  
  3. Spec：错误码表  
  4. 质量：无裸 except  
- **risk & test_strategy**：验证：配置坏/未知异常分测  

---

### task_id: P08

- **task_name**：datasources ACL 旁路审计（独立文件）  
- **target_file_scope**：`backend/app/datasources/acl.py`；相关 pytest  
- **root_architecture_problem**：Finding #7：admin 全局 bypass datasource 可见性  
- **refactor_step_detail**：  
  1. 保留 bypass 但强制 audit；可选拆 `system_admin` vs `tenant_admin` 若枚举已存在  
  2. 不改 HTTP  
  3. Spec/质量评审  
- **risk & test_strategy**：验证：bypass 路径有日志断言  

---

### task_id: P09

- **task_name**：FE 路由 RequireCapability 对齐 nav  
- **target_file_scope**：`fe/src/routes.tsx`；`fe/src/layouts/AdminLayout.smoke.test.tsx`（或 routes smoke）  
- **root_architecture_problem**：Finding #8/#124：designer/charts/reports/themes 仅 RequireAuth；`*` → `/admin`  
- **refactor_step_detail**：  
  1. 为上述路由包 `RequireCapability`（capability 与 `nav-manifest` 一致）  
  2. `*` 改为 NotFound 或登录分支  
  3. smoke  
  4. Spec：layout.md IA  
  5. 质量：不改页面组件文件  
- **risk & test_strategy**：风险：深链 403。验证：vitest 路由守卫；手工无权限跳转  

---

### task_id: P10

- **task_name**：Embed 安全与去 stub  
- **target_file_scope**：`fe/src/embed/**`；`fe/src/pages/embed/**`（若存在）；embed 相关 vitest  
- **root_architecture_problem**：Finding #9/#53：parentOrigin 校验自身；硬编码 funnel/SQL；/embed 无鉴权  
- **refactor_step_detail**：  
  1. 父 origin 用 referrer/postMessage/token 声明校验  
  2. 去掉硬编码，接 embed-config API 或明确 DEV-only stub 门闸  
  3. demo 路由 `import.meta.env.DEV`  
  4. Spec：VIZ embed  
  5. 质量：无默认密钥  
- **risk & test_strategy**：验证：vitest embed；生产构建无 stub 数据  

---

### task_id: P11

- **task_name**：DashboardSharePage layoutJson 修复  
- **target_file_scope**：`fe/src/pages/admin/dashboard/DashboardSharePage.tsx`；其 smoke（若有，同目录测试）  
- **root_architecture_problem**：Finding #16：读 `layout.widgets`，API 为 `layoutJson`，分享页恒空  
- **refactor_step_detail**：  
  1. 类型与取值改为 `layoutJson`  
  2. 复用 PageErrorBanner（仅 import S-PRE-06 导出）  
  3. Spec/质量  
- **risk & test_strategy**：验证：mock API 含 layoutJson 时列表非空  

---

### task_id: P12

- **task_name**：饼图渲染路径修正  
- **target_file_scope**：`fe/src/lib/chartViewConfig.ts`；`fe/src/components/charts/ChartRenderer.tsx`；`fe/src/lib/chartViewConfig.test.ts`；`fe/src/components/charts/charts.advanced.smoke.test.tsx`（仅 pie 相关断言）  
- **root_architecture_problem**：Finding #15：pie 被排除 advanced，落入 Apex 折线/柱  
- **refactor_step_detail**：  
  1. pie 走 ECharts/render-spec 或专用 `buildPieOption`  
  2. 单测 pie  
  3. Spec：VIZ-002/004  
  4. 质量：不改 DashboardWidget（留给 P18）  
- **risk & test_strategy**：验证：vitest pie；目视环形/饼  

---

### task_id: P13

- **task_name**：Datasource 更新 evict + 创建角色门  
- **target_file_scope**：`backend/app/datasources/service.py`；datasources service pytest  
- **root_architecture_problem**：Finding #19/#35：更新不 evict_pool；任意用户可建源  
- **refactor_step_detail**：  
  1. 连接参数变更调用 `pool_manager.evict_pool`  
  2. create 校验 admin/analyst  
  3. Spec：DS-002/003  
  4. 质量：凭证不入日志  
- **risk & test_strategy**：验证：update 后旧池不可用；viewer create 403  

---

### task_id: P14

- **task_name**：连接池计数与关闭日志  
- **target_file_scope**：`backend/app/datasources/pool.py`；pool pytest  
- **root_architecture_problem**：Finding #36/#140：connect_count 只增不减；close `except pass`  
- **refactor_step_detail**：  
  1. evict/close 维护计数  
  2. close 失败 debug 日志  
  3. Spec/质量  
- **risk & test_strategy**：验证：池单测计数归零  

---

### task_id: P15

- **task_name**：Ingestion 表名白名单 + scheduler 日志  
- **target_file_scope**：`backend/app/ingestion/sync_executor.py`；`backend/app/ingestion/scheduler.py`；ingestion pytest  
- **root_architecture_problem**：Finding #12/#31/#32：表名注入；cron `except pass`；硬编码 mysql  
- **refactor_step_detail**：  
  1. 标识符白名单  
  2. scheduler 记录异常  
  3. 源类型经 registry（最小：拒绝非支持并明确错误）  
  4. Spec：DATA-001  
  5. 质量：无 BLE001 静默  
- **risk & test_strategy**：验证：恶意表名失败；cron 失败有 log  

---

### task_id: P16

- **task_name**：Login 深链 from 优先 + auth-api 抽离  
- **target_file_scope**：`fe/src/pages/login/LoginPage.tsx`；**新建** `fe/src/lib/auth-api.ts`；`fe/src/lib/dev-user-switch.ts`；login / auth-api 测试  
- **root_architecture_problem**：Finding #25/#88：有默认 Dashboard 时忽略 `from`；login 裸 fetch 绕过 apiFetch  
- **refactor_step_detail**：  
  1. 新建 `auth-api.ts` 统一 login  
  2. LoginPage / dev-user-switch 改用 auth-api  
  3. 合法站内 `from` 优先，再 fallback landing  
  4. Spec：BOOT-003  
  5. 质量：开放重定向防护（仅站内 path）  
- **risk & test_strategy**：验证：带 from 登录回到原页；vitest auth-api  

---

### task_id: P17

- **task_name**：RequirePlatformAdmin 对齐 capability  
- **target_file_scope**：`fe/src/components/auth/require-capability.tsx`；auth 相关 vitest  
- **root_architecture_problem**：Finding #26：查 `admin` 角色而非 `system:*`  
- **refactor_step_detail**：  
  1. 改用 `hasCapability(user,"system:*")` 或等价  
  2. Spec：AUTH  
  3. 质量：与 `capabilities.ts` 一致（只读 import）  
- **risk & test_strategy**：验证：非 admin capability 拒绝  

---

### task_id: P18

- **task_name**：编辑态真出图（DashboardWidget F-A）  
- **target_file_scope**：`fe/src/components/dashboard/DashboardWidget.tsx`；**新建** `fe/src/components/dashboard/DashboardWidget.smoke.test.tsx`  
- **root_architecture_problem**：Finding #73/#61：WidgetEditPreview 挡 ChartRenderer；死 prop `onChartConfigChange`  
- **refactor_step_detail**：  
  1. ready → `ChartRenderer`；未就绪精简占位  
  2. 删除或接入死 prop  
  3. Spec：M-DASH-UX F-A / VIZ-002  
  4. 质量：复用 useChartExecute，无新执行器  
- **risk & test_strategy**：验证：vitest 编辑态无「仅预览才出图」文案  

---

### task_id: P19

- **task_name**：WidgetInspector 嵌入 ChartConfigPanel（F-B）  
- **target_file_scope**：`fe/src/components/dashboard/WidgetInspector.tsx`；`fe/src/components/dashboard/WidgetInspector.smoke.test.tsx`；`fe/src/components/dashboard/widget-inspector-delete.tsx`（若需接线 onDelete）  
- **root_architecture_problem**：Finding #72/#62/#39：未嵌 ChartConfigPanel；onDelete 未用；resolveDataMode 启发式  
- **refactor_step_detail**：  
  1. 嵌入已有 `ChartConfigPanel`  
  2. `mode` 为唯一真理源  
  3. 文档化 onDelete 由页面传入（页面改动见 P20）  
  4. Spec：VIZ-004/005  
  5. 质量：不改 ChartConfigPanel.tsx 本体（避免与 P12/拆分冲突）— **只 import**  
- **risk & test_strategy**：验证：Inspector smoke 见数据/样式控件  

---

### task_id: P20

- **task_name**：DashboardEditPage 筛选/保存/撤销（独占页）  
- **target_file_scope**：`fe/src/pages/admin/dashboard/DashboardEditPage.tsx`；**新建** `fe/src/pages/admin/dashboard/DashboardEditPage.smoke.test.tsx`  
- **root_architecture_problem**：Finding #23/#42/#95：`globalFilters:[]`；僵尸 missing；God 页编排过厚  
- **refactor_step_detail**：  
  1. 保存合并已有 globalFilters  
  2. `loadFilters` 允许 edit；挂载 GlobalFilterBar  
  3. 最小 undo/redo 栈（布局 fingerprint）  
  4. 传 `onDelete` 给 Inspector  
  5. Spec：M-DASH-UX F-C/F-D  
  6. 质量：不改 DashboardGrid/Widget 文件  
- **risk & test_strategy**：验证：vitest 保存 payload 含 filters；undo 恢复  

**预检说明**：P18/P19/P20 文件互不重叠（Widget / Inspector / EditPage）；测试文件强制独立新建，禁止抢 `dashboard.smoke.test.tsx`。

---

### task_id: P21

- **task_name**：DashboardGrid 预览布局对齐坐标  
- **target_file_scope**：`fe/src/components/dashboard/DashboardGrid.tsx`；`fe/src/components/dashboard/gridLayoutAdapter.ts`；`fe/src/components/dashboard/DashboardCanvasEmpty.tsx`；grid 相关测试  
- **root_architecture_problem**：Finding #14/#24/#43：edit/view 布局分叉；行高 120 vs 48；RGL 补丁堆  
- **refactor_step_detail**：  
  1. view 复用 `widgetsToGridLayout` 或只读 RGL  
  2. 共用 `GRID_ROW_HEIGHT`  
  3. 收敛注释补丁点（不扩大 scope 重写 RGL）  
  4. Spec：DASH-002  
  5. 质量：不改 EditPage  
- **risk & test_strategy**：验证：view 与 edit 同坐标快照测试  

---

### task_id: P22

- **task_name**：createLayoutWidget 就绪判据对齐  
- **target_file_scope**：`fe/src/components/dashboard/createLayoutWidget.ts`；其测试  
- **root_architecture_problem**：Finding #22：datasetId 即 ready，执行要 dataSourceId+configId  
- **refactor_step_detail**：  
  1. `isWidgetConfigReady` 与 `useChartExecute` 前置条件对齐  
  2. Spec/质量  
- **risk & test_strategy**：验证：单元测试假就绪为 false  

---

### task_id: P23

- **task_name**：GlobalFilterBar 错误态  
- **target_file_scope**：`fe/src/components/dashboard/GlobalFilterBar.tsx`；其测试  
- **root_architecture_problem**：Finding #29/#65：非 404 静默 null；死导出 `useGlobalFiltersQuery`  
- **refactor_step_detail**：  
  1. 5xx 展示错误；404 可空  
  2. 删除或使用死导出  
  3. Spec/质量  
- **risk & test_strategy**：验证：mock 500 可见错误  

---

### task_id: P24

- **task_name**：useChartExecute dataset 传 filterParameters  
- **target_file_scope**：`fe/src/components/charts/useChartExecute.ts`；**新建** `fe/src/components/charts/useChartExecute.filters.test.ts`（禁止改 `chartViewConfig.test.ts`，避免与 P12 重叠）  
- **root_architecture_problem**：Finding #21/#28：dataset 忽略 filterParameters / filters  
- **refactor_step_detail**：  
  1. dataset 请求合并 filterParameters（后端已支持则传；不支持则 query 注释 + FE 明确 no-op 文档，优先传参）  
  2. Spec：QUERY-009  
  3. 质量：依赖 S-PRE-02 完成后的 sqlParameters  
- **risk & test_strategy**：验证：vitest dataset+filters；需 S-PRE-02 已合并  

---

### task_id: P25

- **task_name**：leave-guard 补 popstate  
- **target_file_scope**：`fe/src/hooks/use-unsaved-leave-guard.ts`；其测试  
- **root_architecture_problem**：Finding #20：仅拦 `<a>`，不覆盖后退  
- **refactor_step_detail**：  
  1. 增加 `popstate`/`beforeunload` 已有则补齐后退确认策略（不强制上 data router）  
  2. Spec/质量  
- **risk & test_strategy**：验证：单元模拟 popstate  

---

### task_id: P26

- **task_name**：metadata physical ACL 过滤  
- **target_file_scope**：`backend/app/metadata/physical/service.py`；physical pytest  
- **root_architecture_problem**：Finding #11：list 无用户过滤  
- **refactor_step_detail**：  
  1. list 按 actor 过滤（最小：绑定 datasource 可见性）  
  2. Spec：META-005  
  3. 质量：本任务不落库（落库属更大串行，单独立项）  
- **risk & test_strategy**：验证：越权不可见  

---

### task_id: P27

- **task_name**：移出 gov/kingbase 生产 mock.patch  
- **target_file_scope**：`backend/app/api/v1/gov.py`（仅删除 mock.patch 用法，改为可注入依赖）；`backend/app/datasources/dialects/kingbase/probe.py`；将 mock 迁至 `backend/tests/**`  
- **root_architecture_problem**：Finding #48：生产代码 `unittest.mock.patch`  
- **refactor_step_detail**：  
  1. 生产去 patch  
  2. 测试侧保留  
  3. Spec/质量  
- **risk & test_strategy**：验证：gov/kingbase pytest 仍绿  

---

### task_id: P28

- **task_name**：ChartExplorePage 统一 catalog 类型  
- **target_file_scope**：`fe/src/pages/admin/charts/ChartExplorePage.tsx`；其测试  
- **root_architecture_problem**：Finding #83/#103：双类型；God 页可顺带瘦身 import  
- **refactor_step_detail**：  
  1. 改用 `chartRegistry`/`ChartTypeCatalogItem`  
  2. 用 PageErrorBanner  
  3. Spec/质量  
- **risk & test_strategy**：验证：Explore vitest  

---

### task_id: P29

- **task_name**：RoleListPage 筛选走 API + 瘦身入口  
- **target_file_scope**：`fe/src/pages/admin/system/roles/RoleListPage.tsx`；roles 测试  
- **root_architecture_problem**：Finding #27/#100：客户端截断过滤；God 页  
- **refactor_step_detail**：  
  1. status 筛选改服务端参数（若 API 无参数则文档化限制并拉全量再滤，禁止对 50 条假 total）  
  2. 可抽同目录私有组件文件（**仅** `fe/src/pages/admin/system/roles/**`）  
  3. Spec/质量  
- **risk & test_strategy**：验证：total 与筛选一致  

---

### task_id: P30

- **task_name**：ACTIVE_MILESTONES 配置化  
- **target_file_scope**：`fe/src/lib/resolve-nav.ts`；`fe/src/lib/resolve-nav.test.ts`；**新建** `fe/src/config/active-milestones.ts`  
- **root_architecture_problem**：Finding #52：硬编码 M1/M7/M11/M13  
- **refactor_step_detail**：  
  1. 里程碑列表抽到 `active-milestones.ts`  
  2. `resolve-nav` 只读该配置  
  3. Spec：BOOT-002  
  4. 质量：测试覆盖过滤  
- **risk & test_strategy**：验证：resolve-nav tests  

---

### task_id: P31

- **task_name**：UserViewsSection 等单页 queryKeys 对齐（示例包）  
- **target_file_scope**：`fe/src/pages/admin/account/components/UserViewsSection.tsx`；`fe/src/pages/admin/reports/components/SchedulePanel.tsx`；`fe/src/pages/admin/themes/useThemeAnalysis.ts`；`fe/src/pages/admin/datasources/DatasourceDetailPage.tsx`  
- **root_architecture_problem**：Finding #84：手写 query key 漂移  
- **refactor_step_detail**：  
  1. 全部改为 S-PRE-06 已登记的 `queryKeys.*`  
  2. Spec/质量  
- **risk & test_strategy**：验证：各页 vitest/compile  

**预检**：四文件互不与其他 P 任务重叠 ✓  

---

### task_id: P32

- **task_name**：ReportExportCard 去硬编码 UUID  
- **target_file_scope**：`fe/src/pages/admin/reports/components/ReportExportCard.tsx`  
- **root_architecture_problem**：Finding #53 部分：硬编码 templateId  
- **refactor_step_detail**：从选中模板 props 注入；Spec/质量  
- **risk & test_strategy**：无选中时禁用导出  

---

### task_id: P33

- **task_name**：dataset executor stub 标注/接线  
- **target_file_scope**：`backend/app/query/dataset/executor.py`；dataset pytest  
- **root_architecture_problem**：Finding #51/#71：四步 stub pass  
- **refactor_step_detail**：接入真实 `execute_dataset_from_config` 或明确 deprecated + 调用方迁移；Spec QUERY-009  
- **risk & test_strategy**：pytest dataset  

---

### task_id: P34

- **task_name**：binding_service 显式拒绝 native  
- **target_file_scope**：`backend/app/query/binding_service.py`；binding pytest  
- **root_architecture_problem**：Finding #38：binding 无 native  
- **refactor_step_detail**：native 请求 422 明确码；不扩展除非单测完备  
- **risk & test_strategy**：pytest  

---

### task_id: P35

- **task_name**：designer-panels 拆分（单目录）  
- **target_file_scope**：`fe/src/pages/admin/designer/**`（仅该目录内拆文件）  
- **root_architecture_problem**：Finding #99：531 行 God  
- **refactor_step_detail**：拆 conditions/compute/output 面板；行为不变；Spec DESIGN  
- **risk & test_strategy**：designer.smoke vitest  

---

### task_id: P36

- **task_name**：errors.py 按引擎拆分（单包）  
- **target_file_scope**：`backend/app/datasources/dialects/errors.py` → 拆为 `backend/app/datasources/dialects/errors/**`；更新 dialects 包内 import（**仅** `backend/app/datasources/dialects/` 下文件）  
- **root_architecture_problem**：Finding #109：700 行 errors  
- **refactor_step_detail**：按引擎拆模块 + `__init__` re-export 保持兼容；Spec/质量  
- **risk & test_strategy**：全量 connector 错误映射 pytest  

---

## 【串行收尾任务】（全部并发完成后）

### S-POST-01 · 接口与分层一致性扫描【串行收尾任务】

1. `rg` 检查：charts 不得 import `components/dashboard`（除文档允许）  
2. `rg`：生产代码无 `unittest.mock.patch`  
3. arch-inspect 或 `check:design` + 依赖方向抽查  
4. `docs/api/README.md` 若有错误码新增则补一行（仅收尾改文档）

### S-POST-02 · 全量回归【串行收尾任务】

1. `pytest`（backend 全量或核心域）  
2. `fe`：`vitest` + `check:design` + `build`  
3. 手工冒烟：登录 → 建源 → Dashboard 编辑出图 → 分享页非空 → 无权限路由 403  

### S-POST-03 · plan/PRD companion 勾选【串行收尾任务】

1. 回写 `docs/automate/plan.md` M-DASH-UX 已完成项  
2. hub 执行范围如需对齐则改 `prd.md`  
3. 更新 `docs/automate/audits/` 修复对照表（可选）

### S-POST-04 · 合并冲突与死代码清扫清单【串行收尾任务】

1. 统一处理各任务新建的 `*.smoke.test.tsx` 重复断言  
2. 删除确认的死导出（`isWorkspaceViewPath` 等）若未被任何任务覆盖，本收尾一次性删（文件：`fe/src/lib/workspace.ts`、`session.ts`、`browserCompat.ts` — **仅收尾改**）

---

## 【并发预检结论】

### 文件重叠自动校验结果

| 检查项 | 结果 |
|--------|------|
| S-PRE 与 P 任务共享文件 | S-PRE 先合并；P13 改 `datasources/service.py` 与 S-PRE-03 同文件 → **必须等 S-PRE-03 完成**；P24 改 `useChartExecute` 必须等 S-PRE-02 |
| P04 vs P06 | P06 **禁止**改 `service.py`；用私有 `_access` 或等 P04 合入后第二波改 import |
| P18 / P19 / P20 / P21 / P22 / P23 | Widget / Inspector / EditPage / Grid / createLayoutWidget / GlobalFilterBar → **无重叠** |
| P12 vs P18 | chartViewConfig+ChartRenderer vs DashboardWidget → **无重叠** |
| P09 vs P10 | routes vs embed → **无重叠** |
| P27 vs P36 | gov.py+kingbase vs dialects/errors → **无重叠** |
| P30 ACTIVE_MILESTONES | 仅 `resolve-nav.ts` + `config/active-milestones.ts`；auth-api 已并入 P16 → **无重叠** |
| 测试文件 | 约定：冲突则各任务 **新建** 独立 `*.smoke.test.tsx`，禁止抢 `dashboard.smoke.test.tsx`；P24 不得改 `chartViewConfig.test.ts`（属 P12） |
| P12 vs P24 | ChartRenderer/chartViewConfig vs useChartExecute → **无重叠**（测试文件已拆） |

### 结论

**并发安全，可直接分发 dispatching-parallel-agents**（前提：【串行前置】S-PRE-01～07 已合并；P13/P24 标记为 **Wave-B after S-PRE**）。

### 推荐分波

| 波次 | 任务 | 条件 |
|------|------|------|
| Wave-0 | S-PRE-01～07 | 串行 SDD |
| Wave-1 | P01–P12, P14–P23, P25–P29, P30–P36 | 并行 |
| Wave-2 | P13, P24 | S-PRE-03/02 完成后并行 |
| Wave-3 | S-POST-01～04 | 串行收尾 |

### 本轮刻意不下并发的项（避免假隔离）

- 双 dialect 体系彻底合并（Finding #78）→ 需新一轮串行设计  
- metadata/views/embed_token 全面落库（#44/#46）→ 迁移串行专项  
- `api/v1/gov.py` 936 行大拆 + 多 router 同时改 `main.py` include → 串行  
- ErrorBanner 18 页替换 → 可按页再拆 P 任务（本清单以 P28/P31 示范；其余页同模式复制，**每页一任务一文件**）  
- M-PRODUCT F-F / 对齐多选 / 联动 → 非本轮  

---

## 附：调度指令文本（可复制给 dispatching-parallel-agents）

```text
【dispatching-parallel-agents · VitalSpan 重构 Wave-1】

前置条件（必须已完成）：
- 已合并串行前置 S-PRE-01～S-PRE-07（见 docs/superpowers/plans/2026-07-09-concurrent-refactor-plan.md）
- 基线分支干净；每个子代理使用独立 git worktree 或独立分支，禁止改同一文件

并发分发（同一消息内启动多个 generalPurpose subagent，每个只领一个 task_id）：
- P01 AuthMiddleware 禁升 admin → scope: backend/app/auth/middleware.py + tests
- P02 reports execute 强制 RLS → scope: backend/app/reports/engine/execute.py
- P03 native executor+guard 对齐 → scope: backend/app/query/native/**
- P04 Dashboard ACL → scope: dashboard/service.py + api/v1/dashboards.py
- P05 theme SQL 参数化 → scope: dashboard/theme/query.py
- P06 global_filters execute ACL → scope: dashboard/global_filters/**（禁止改 service.py）
- P07 rls/guard.py
- P08 datasources/acl.py
- P09 fe/src/routes.tsx
- P10 fe/src/embed/** + pages/embed/**
- P11 DashboardSharePage.tsx
- P12 chartViewConfig.ts + ChartRenderer.tsx
- P14 datasources/pool.py
- P15 ingestion/sync_executor.py + scheduler.py
- P16 LoginPage.tsx + 新建 auth-api.ts + dev-user-switch.ts
- P17 require-capability.tsx
- P18 DashboardWidget.tsx
- P19 WidgetInspector.tsx
- P20 DashboardEditPage.tsx
- P21 DashboardGrid.tsx + gridLayoutAdapter.ts + DashboardCanvasEmpty.tsx
- P22 createLayoutWidget.ts
- P23 GlobalFilterBar.tsx
- P25 use-unsaved-leave-guard.ts
- P26 metadata/physical/service.py
- P27 gov.py + kingbase/probe.py（mock 迁 tests）
- P28 ChartExplorePage.tsx
- P29 RoleListPage.tsx（仅 roles/**）
- P30 resolve-nav.ts + config/active-milestones.ts
- P31 UserViewsSection + SchedulePanel + useThemeAnalysis + DatasourceDetailPage
- P32 ReportExportCard.tsx
- P33 query/dataset/executor.py
- P34 query/binding_service.py
- P35 fe/src/pages/admin/designer/**
- P36 datasources/dialects/errors/** 拆分

硬性约束：
1) 只改 target_file_scope 内文件；测试冲突则新建独立 *smoke*.test.*
2) 完成后自测 + 写报告到 .superpowers/sdd/refactor-{task_id}-report.md
3) 禁止询问用户；接口保持兼容
4) Wave-2 另发：P13（datasources/service.py）、P24（useChartExecute.ts）

全部 Wave-1/2 DONE 后，主控执行 S-POST-01～04 串行收尾。
```

---

## 附：improve-codebase-architecture 架构缺陷报告（摘要粘贴）

完整 145 条见：`docs/automate/audits/2026-07-09-architecture-full.md`  
HTML：`%TEMP%/architecture-review-20260709-181722.html`

**规模**：P0=16 · P1=52 · P2=60 · P3=17  
**类别**：bug 34 · security 12 · patch 21 · dead 15 · shallow 23 · leak 10 · size 30  

**Top P0 原文要点**：  
1. middleware 失败升 admin  
2. 报表 RLS 关闭 / 默认 development  
3. Native 无 RLS  
4. Dashboard 无 ACL  
5. theme SQL 注入  
6. global-filters 无所有权  
7. admin bypass RLS/datasource  
8. FE 路由缺 capability  
9. Embed origin/stub  
13. gridX/Y 后端丢失  
14. edit/view 布局分叉  
15. pie 渲染错误  
16. SharePage layoutJson  
17. dialect 仅三引擎  
18. native guard/executor 不一致  
19. update 不 evict_pool  

**加深候选**：C1 DashboardLayout · C2 ChartRuntime · C3 dialect 统一 · C4 AuthZ · C5 去内存 store · C6 queryKeys/ErrorBanner  

（全文表格不在此重复粘贴 145 行；调度以本计划 task 映射为准。）
