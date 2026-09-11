# VitalSpan 前端 UI/UX 可毕业评审 · 2026-08-09

## 总览

| 项 | 内容 |
|----|------|
| 范围 | 整前端（`fe/`）· 52 条业务路由 + Embed 3 条 |
| FE Card | React 19 · Vite · Radix/shadcn · Tailwind v4 · `fe/src/index.css` @theme Token |
| **基准可信度** | **部分不可信** — 8 项过 6；不过：缺 `*-ia.md` 标杆页 IA 分片、anchor 无可信度分级；assumed：页头形态以 `layout.md` + `admin-page-shell` 为准 |
| 路由 | 总数 52 · 通过 12 · fail 38 · 延期 2 · 未扫 0 |
| 扫描方式 | 4 域并行 explore lane + 主 agent 反模式 grep；视觉证据：**无**（Vite 构建报错，见 Blind spots） |
| Blind spots | 暗色/窄屏实机、RBAC 矩阵走查、浏览器截图、构建器极端态 |
| P0 / P1 / P2 | 2 / 22 / 18 |
| 毕业结论 | **修完 P0 再评**（有 P0 + 基准部分不可信 + 无运行时视觉证据） |

> 基准部分不可信：缺 per-page `*-ia.md`；`anchor.md` 为表格式锚点而非完整标杆 IA。本次「与文档一致」结论仅供参考，不得单独作为合规证据。

一句话：共享壳（`AdminPageShell` + `list-page-kit`）在数据源/报表中心/角色列表已成型，但域内漂移严重——同步任务列表壳层、删除确认红、行操作 ghost/`…` 三套范式并存、`window.confirm` 残留、Dataset 搜索分页逻辑错误。

### FE Card（摘要）

- 前端根：`fe/` · 标杆（锁定）：`/admin/dashboards`、`/admin/viz-templates`、`/admin/system/users`、`/admin/reports/center`
- 排除：`/login`、纯重定向、`/dev/*`、`/export/*`（chromeless 导出）
- 页头形态：`title-card`（`AdminPageShell` hero）· 右操作槽：标杆有 · 组件：`fe/src/components/layout/admin-page-shell.tsx`
- 列表行操作：菜谱 B 约定 ghost · >4→`…` · 删除红 — **域内执行不一致**
- 已有共享壳：`AdminPageShell`、`list-page-kit`、`ListGhostEmptyState`、`hubCardUi`、`list-batch-delete`
- 响应式：桌面为主（BI 控制台）· 主题：全局 dark · RBAC：路由 gate + 页内 capability
- 设计 skill：`.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

### CRUD 约定（本仓）

- 短表：`DataTable` + `RowActions` ghost · 长表：原生 table（存量）待收敛
- 危险操作：`AlertDialog` + destructive 红 — **多处未达标**；禁 `window.confirm` — **4 处残留**
- 详情：默认只读 — Dataset 缺详情路由（直达编辑）

### 共享壳（本仓）

- 已有：`admin-page-shell`、`list-page-kit`、`panel-empty-state`、`hubCardUi`
- 本轮建议抽取：① `SyncJobRowActions`（溢出菜单）② `DashboardSurfaceListPage`（看板/大屏去重）③ 删除确认 `DestructiveAlertDialog` 升一处

---

## Phase 0.5 · 基准可信度校验

| # | 检查项 | 结果 |
|---|--------|------|
| 1 | `docs/ui/anchor.md` 存在 | ✅ |
| 2 | anchor 组件库与 `package.json` 一致（Radix） | ✅ |
| 3 | Token 真源 `fe/src/index.css` @theme 存在且被引用 | ✅ |
| 4 | 外部锚 b-design-system skill 有路径 | ✅ |
| 5 | `*-ia.md` 标杆页路径 | ❌ 无 per-page IA 文件 |
| 6 | 标杆页为同菜谱最完整 | ✅ 抽查 dashboards / viz-templates |
| 7 | `layout.md` AdminLayout 路径存在 + 页头约定 | ✅ `fe/src/layouts/AdminLayout.tsx` |
| 8 | 可信度标记齐全 | ❌ anchor 无 assumed/verified 分级 |

**结论**：`anchor_trust: partial` → `graduation` 禁止 true

---

## 路由勾选表

| 路径 | 菜谱 | 状态 | 备注 |
|------|------|------|------|
| `/admin/datasources` | B | pass | 标杆域 |
| `/admin/datasources/new` | C | pass | |
| `/admin/datasources/:id` | D | pass | P2 缺页头 icon |
| `/admin/datasources/:id/edit` | C | pass | |
| `/admin/ingestion/sync-jobs` | B | fail | P1 壳层/行操作 |
| `/admin/ingestion/sync-jobs/new` | C | pass | |
| `/admin/ingestion/sync-jobs/:id/edit` | C | pass | |
| `/admin/ingestion/sync-jobs/:id/history` | B | fail | P1 未复用 DataTable |
| `/admin/ingestion/sync-jobs/:id/etl-rules` | C | fail | P1 window.confirm |
| `/admin/datasets` | B | fail | P0 搜索分页 · P1 无详情 |
| `/admin/datasets/new` | C | fail | P1 套 Card |
| `/admin/datasets/:id/edit` | C | fail | P1 套 Card |
| `/admin/dashboards` | B | pass | **锁定标杆** |
| `/admin/dashboards/:id` | F | fail | P1 编辑入口权限 |
| `/admin/dashboards/:id/edit` | F | partial | 构建器豁免布局 |
| `/admin/dashboards/:id/share` | D | pass | |
| `/admin/data-screens` | B | fail | P1 列表删除色 |
| `/admin/data-screens/:id/edit` | F | partial | |
| `/admin/data-screens/:id/preview` | F | pass | |
| `/admin/data-screens/:id/share` | D | pass | |
| `/admin/data-screens/:id` | — | pass | 重定向 preview |
| `/admin/viz-templates` | B | pass | **锁定标杆** · P1 空态 CTA |
| `/admin/viz-components` | B | fail | P1 删除无确认 |
| `/admin/viz-components/:id/edit` | F | pass | |
| `/admin/reports` | E | partial | 主从合理例外 |
| `/admin/reports/center` | A | pass | **标杆** |
| `/admin/reports/view/:nodeId` | D | partial | |
| `/admin/reports/templates` | E | fail | **P0** window.confirm |
| `/admin/reports/schedules` | B | fail | P1 readOnly 硬编码 |
| `/admin/system` | A | pass | 向导首页 |
| `/admin/system/users` | B | fail | P1 行操作 outline |
| `/admin/system/roles` | B | pass | CRUD 金标准 |
| `/admin/system/orgs` | B | partial | P1 删除无红 |
| `/admin/system/rls` | B | fail | P1 删除语义弱 |
| `/admin/system/audit` | B | pass | 只读金标准 |
| `/admin/system/grants` | B | fail | P1 outline 撤销 |
| `/admin/account/profile` | C | pass | |
| `/admin/account/theme` | C | partial | P2 原生 radio |
| `/admin/account/landing` | B | partial | P2 行操作第三套 |
| `/admin/account/security` | C | pass | |
| `/admin/governance/catalog` | B | partial | P2 PRD 编号 |
| `/admin/governance/tickets` | B | partial | |
| `/admin/governance/publish` | B | partial | P2 空态/状态英文 |
| `/admin/services` | B | partial | P2 |
| `/admin/designer` | C | fail | P1 数据集字段错位 |
| `/admin/metadata` | B | partial | 深链 · P2 |
| `/admin/metadata/glossary` | B | partial | 同组件 |
| `/admin/entities/overview` | B | partial | 深链 · P2 字段名 |
| `/admin/themes/:dashboardId` | D | partial | 深链 · P2 英文枚举 |
| `/embed/chart/:chartId` | — | pass | |
| `/embed/screen/:dashboardId` | — | pass | |
| `/embed/share` | — | partial | P3 原生 button |

**菜单对账**：manifest / account-nav / system-admin-nav 路径均有路由 ✅；深链路由（metadata/entities/themes/embed）已在 `layout.md` 登记，非 IA 漂移。

---

## P0 Findings

### P0-1 · 模板目录详情删除用 `window.confirm`

| 字段 | 内容 |
|------|------|
| 路径 | `/admin/reports/templates` · `CatalogNodeMetaPanel.tsx` |
| 类别 | 危险操作 · 违反 fe-ui 禁 `window.confirm` |
| 证据 | L79 `window.confirm` 删除文件夹/节点；树节点删除已用 `AlertDialog`，双路径不一致 |
| 触发场景 | 管理员在文档模板页选中文件夹 → 点详情面板「删除」→ 原生 confirm，无统一 destructive 样式与 a11y |
| 建议 | 复用页级 `AlertDialog`（与树删除一致） |
| 改造方案 | `RP-REPORT-01` |
| 批次 | S1 |

### P0-2 · Dataset 列表搜索仅过滤当前页

| 字段 | 内容 |
|------|------|
| 路径 | `/admin/datasets` · `DatasetListPage.tsx` |
| 类别 | 坏表单/筛选语义错误 |
| 证据 | L95–102 客户端过滤当前页 `items`；有筛选时隐藏分页、无服务端 `q` |
| 触发场景 | 用户数据集 >1 页 → 搜索框输入名称 → 仅匹配当前页 20 条，误以为全库无结果 |
| 建议 | 服务端 `q` 参数或拉全量后统一过滤+分页 |
| 改造方案 | `RP-DATA-01` |
| 批次 | S1 |

---

## P1 Findings（摘要 · 22 项）

| ID | 路径/域 | 标题 |
|----|---------|------|
| P1-01 | sync-jobs | 列表 loading/空态脱离 `ListPageSection` 壳 |
| P1-02 | sync-jobs | 行操作 6 个未 `…` 收起 |
| P1-03 | sync-jobs | 页头缺 icon、metrics 套 Card |
| P1-04 | 数据准备域 | 删除确认非 destructive 红（数据源/Dataset/批量） |
| P1-05 | datasets | 无只读详情路由，列表直达编辑 |
| P1-06 | datasets | `DatasetEditorForm` Card 套层 |
| P1-07 | etl-rules | `window.confirm` 一键对齐 |
| P1-08 | dashboards 列表 | 列表视图删除非红 |
| P1-09 | viz-components | 删除无 `AlertDialog` |
| P1-10 | dashboards/:id view | 「编辑布局」未 gate `dashboard:edit` |
| P1-11 | 看板/大屏列表 | 分享入口未 gate `dashboard:share` |
| P1-12 | viz-templates | 空态无 CTA（无 edit 权限用户） |
| P1-13 | schedules | `readOnly=false` 硬编码 |
| P1-14 | system/users | 行操作 outline「管理」非 ghost 范式 |
| P1-15 | system/orgs | 删除 ghost 无红 hover |
| P1-16 | system/rls | 删除无红 + AlertDialog 非 destructive |
| P1-17 | system/grants | outline「撤销」过重 |
| P1-18 | designer | 数据集 Select `id/name` vs `datasetId/displayName` |
| P1-19 | datasets picker | `DatasetTablePicker` 两处 `window.confirm` |
| P1-20 | sync-history | 手写 table + 文本空态 |
| P1-21 | 分析域 | 看板/大屏列表 ~130 行重复未抽取 |
| P1-22 | Hub 域 | 组件库空态/错误布局与标杆漂移 |

---

## P2 Findings（摘要 · 18 项）

- 术语混用「数据看板/仪表板」；描述含「对标 DataEase」
- 治理/元数据页 description 含 PRD 编号（GOV/META/DESIGN/IF）
- 状态枚举裸英文（catalog/publish/services/theme）
- `ThemeAnalysisPage` 维度/粒度英文 + `widgetId` 上屏
- `EntityOverviewPage` `tableFqn`/`dataSourceId` 字段名上屏
- 原生 `<button>`：`ThemePreferencesSection`、调度展开、模板折叠
- 模板库 limit 100 无分页
- 历史页标题无任务名；ETL 静默 auto-align
- 账户 profile 错误态自绘非 `PageErrorBanner`

---

## 改造方案（待确认）

### RP-DATA-01 · Dataset 搜索服务端化（P0）

| 项 | 内容 |
|----|------|
| 目标页 | `/admin/datasets` |
| 菜谱 | B 列表 |
| 对标 | `DatasourceListPage`（服务端 q + 分页） |
| 区块 | `ListPageToolbar` 搜索 → API `?q=`；分页始终可见 |
| 复用 | `ListPagePagination` · 现有 datasets API |
| 不做 | 改 Dataset 编辑逻辑 |
| 验收 | 多页数据下搜索命中非当前页记录 |

### RP-DATA-02 · 同步列表壳层归一（P1）

| 项 | 内容 |
|----|------|
| 目标页 | `/admin/ingestion/sync-jobs` |
| 菜谱 | B |
| 对标 | `DatasourceListPage` |
| 区块 | icon + `ListPageSection` 包 loading/empty/data；metrics 去 Card 边框 |
| 复用 | `list-page-kit` 全套 · `ListGhostEmptyState` |
| 不做 | 改同步业务/轮询 |

### RP-DATA-03 · 同步行操作溢出菜单（P1）

| 项 | 内容 |
|----|------|
| 目标 | `SyncJobsTable` |
| 对标 | `DashboardListCard` `…` 菜单 |
| 区块 | 常驻 2–3 个；其余 `DropdownMenu`；删除底部 destructive |
| 复用 | 抽 `SyncJobRowActions` |

### RP-DATA-04 · 删除确认 destructive 统一（P1）

| 项 | 内容 |
|----|------|
| 目标 | 数据源/Dataset/批量删除对话框 |
| 对标 | `SyncJobsPage` L442 |
| 区块 | `AlertDialogAction` destructive 或升共享组件 |
| 复用 | `@/components/ui/alert-dialog` |

### RP-REPORT-01 · 模板详情删除 AlertDialog（P0）

| 项 | 内容 |
|----|------|
| 目标 | `CatalogNodeMetaPanel` |
| 对标 | `ReportTemplatesPage` 树删除 |
| 区块 | 删 `window.confirm` → 页级 `deleteTarget` state |
| 不做 | 改树删除逻辑 |

### RP-ANALYSIS-01 · 列表行删除标红（P1）

| 项 | 内容 |
|----|------|
| 目标 | 看板/大屏列表视图 |
| 对标 | `DashboardListCard` 菜单删除 |
| 区块 | `Trash2` `text-error-*` 或收入 `…` |

### RP-ANALYSIS-02 · 组件库删除确认（P1）

| 项 | 内容 |
|----|------|
| 目标 | `VizComponentsHubPage` |
| 对标 | 看板列表 `AlertDialog` |

### RP-ANALYSIS-03 · 权限诚实表面（P1）

| 项 | 内容 |
|----|------|
| 目标 | `DashboardEditPage` view · 列表分享链 |
| 区块 | `dashboard:edit` / `dashboard:share` 分别 gate |
| 不做 | RBAC 模型重构 |

### RP-ANALYSIS-04 · 看板/大屏列表去重 S0（P1）

| 项 | 内容 |
|----|------|
| 目标 | `DashboardListPage` + `DataScreenListPage` |
| 对标 | `DashboardListPage`（锁定） |
| 区块 | 抽 `surfaceKind` prop 共享页或 hook |

### RP-SYSTEM-01 · 行操作对齐 RoleListPage（P1）

| 项 | 内容 |
|----|------|
| 目标 | users/orgs/rls/grants |
| 对标 | `RoleListPage` ghost + 红 hover + AlertDialog |
| 批次 | S0 串行 |

### RP-GOV-01 · Designer 数据集字段修复（P1）

| 项 | 内容 |
|----|------|
| 目标 | `DesignerPage` Select |
| 区块 | `ds.id`/`ds.name` 对齐 API 类型 |
| 验收 | 下拉显示数据集名称 |

### RP-GLOBAL-01 · 禁 `window.confirm` 清扫（P0/P1）

| 项 | 内容 |
|----|------|
| 目标 | `EtlRulesPage` · `DatasetTablePicker` · `CatalogNodeMetaPanel` |
| 对标 | 各域已有 `AlertDialog` |
| 不做 | 改业务确认语义 |

### RP-GLOBAL-02 · PRD 编号与英文枚举文案（P2）

| 项 | 内容 |
|----|------|
| 目标 | 治理/元数据/主题页 description + 状态 Badge |
| 对标 | `workflow-labels.ts` 中文映射 |

---

## 建议修复批次

| 批次 | 范围 | RP |
|------|------|-----|
| **S1（阻塞毕业）** | P0 + 安全/CRUD | RP-DATA-01 · RP-REPORT-01 · RP-GLOBAL-01 |
| **S2** | 列表壳/行操作/删除红 | RP-DATA-02~04 · RP-ANALYSIS-01~03 · RP-SYSTEM-01 |
| **S0（串行优先）** | 共享抽取 | RP-ANALYSIS-04 |
| **S3** | 文案/治理 | RP-GOV-01 · RP-GLOBAL-02 |

---

## Blind spots

| 项 | 原因 |
|----|------|
| 运行时视觉证据 | Vite 报错 `deAttrFieldStyles` 缺失，未截图 |
| 暗色/窄屏 | 未 browser-reviewer 走查 |
| RBAC 矩阵 | 未用只读/viewer 账号实机 |
| 构建器极端态 | `DashboardEditPage` 1800+ 行未逐 widget 点检 |
| Sheet/Dialog 焦点 | 静态扫未验 trap/loading |

**followups**：`browser-reviewer` 标杆+fail 页截图 · `create-ui-docs` 补 `*-ia.md` · `code-reviewer` stub/API 假绿

---

## 毕业闸门

```yaml
status: DONE_WITH_CONCERNS
phase: ui-ux-reviewer
mode: review
fix_mode: confirm
scope: 整前端 fe/
report: docs/material/ui-ux-reviewer/2026-08-09-console-launch.md
graduation: false
anchor_trust: partial
routes:
  total: 52
  passed: 12
  failed: 38
  deferred: 2
findings: 42  # P0:2 P1:22 P2:18
remediation_plans:
  - RP-DATA-01
  - RP-DATA-02
  - RP-DATA-03
  - RP-DATA-04
  - RP-REPORT-01
  - RP-ANALYSIS-01
  - RP-ANALYSIS-02
  - RP-ANALYSIS-03
  - RP-ANALYSIS-04
  - RP-SYSTEM-01
  - RP-GOV-01
  - RP-GLOBAL-01
  - RP-GLOBAL-02
evidence:
  screenshots: []
remaining:
  - 基准补 *-ia.md
  - 模板库 >100 分页（P2 延期）
  - 构建器细粒度 RBAC（随 RP-ANALYSIS-03）
coverage:
  blind_spots:
    - "视觉 | 全站 | Vite 构建失败无截图"
    - "RBAC | 主路径 | 未实机矩阵"
    - "响应式 | 主路径 | 未窄屏走查"
blockers:
  - "2×P0 未修"
  - "anchor_trust=partial"
followups:
  - "确认 S1 批次后 go-fast 修 P0"
  - "browser-reviewer 补视觉证据"
  - "create-ui-docs 补标杆 IA"
```
