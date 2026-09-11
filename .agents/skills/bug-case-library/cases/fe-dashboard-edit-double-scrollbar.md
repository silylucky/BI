# 看板编辑页双滚动条（背景展开后更明显）

## 症状

- 仪表板编辑页右侧出现两条纵向滚动线：一条在画布右缘，一条在配置栏右缘或页面最右侧
- 开启「图表样式 → 背景」后配置项增多，问题更突出
- 有时伴随 `html`/`body` 出现页面级滚动条（视口高度被撑破）

## 根因（分层）

| 层级 | 原因 | 证据 |
|------|------|------|
| Flex 泄漏 | 右栏内容 `scrollHeight` 大于视口，子级 `flex-1` 未 `min-h-0 h-0`，高度链断裂 | `DashboardContextInspector` 内嵌 `overflow-y-auto` |
| Grid min-height | Grid 子项默认 `min-height: auto`，长配置撑破高度链 | `DashboardEditWorkspace` 右栏格未 `[&>*]:min-h-0` |
| 嵌套滚动 | 配置面板与 `DashboardEditWorkspace` 各设一层 `overflow-y-auto` | 背景 ON 后内容 ~1807px |
| 页面级滚动 | 仅壳层 `h-dvh overflow-hidden` 不足，`html` 仍可滚动 | `document.documentElement.scrollHeight > clientHeight` |
| 视觉双轨 | 画布 `pixel-canvas-host.dashboard-scroll` 显示细滚动条；配置栏若未隐藏则并排 | `index.css` `dashboard-scroll` vs 配置栏 |
| CSS 脆弱 | `html:has(...)` 选择器在部分环境不可靠 | 已改为 `admin-fill-lock` JS 挂载 |
| 图表编辑 | `ChartInspectorTabs` / `DatasetFieldGroups` 内层 `overflow-y-auto` | 与右栏壳层形成第三轨 |

## 修复（单轨原则）

1. **唯一滚动壳**：`DashboardEditWorkspace` 在 header 下包 `dashboard-edit-rail-scroll`（`data-testid="dashboard-edit-rail-scroll"`）
2. **子面板不滚动**：`DashboardContextInspector` `embedded` 模式不再内嵌 `overflow-y-auto`
3. **Grid 约束**：`DashboardEditWorkspace` 网格加 `[&>*]:min-h-0`
4. **隐藏右栏滚动条**：`.dashboard-edit-rail-scroll { scrollbar-width: none !important }`（滚轮仍可滚动）
5. **锁住 fill 路由**：`useAdminFillScrollLock` → `html.admin-fill-lock { overflow: hidden !important }`
6. **主题 scope 排除**：`.dashboard-theme-scope :where(.overflow-y-auto):not(.dashboard-edit-rail-scroll)`
7. **图表编辑**：`ChartInspectorTabs scrollMode="parent"`；`DatasetFieldGroups` 去掉内层滚动

## 回归测试

- `DashboardEditWorkspace.test.tsx`：断言唯一 `dashboard-edit-rail-scroll`
- `DashboardContextInspector.test.tsx`：embedded 模式无内层滚动容器
- `AdminLayout.smoke.test.tsx`：fill 路由挂载 `admin-fill-lock`

## 预防

- 新增右栏配置块时：**禁止**在 `chartRail` 子树再设 `overflow-y-auto`；滚动只由 `DASHBOARD_EDIT_RAIL_SCROLL_CLASS` 承担
- Flex/Grid 纵向链：`flex-1 min-h-0 h-0` + 父级 `overflow-hidden` + Grid 子项 `min-h-0`
- fill 高度页必须走 `useAdminFillScrollLock`，勿依赖 `:has()` 全局 CSS
