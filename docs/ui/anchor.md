# UI 页面锚点

> **定位**：关键产品表面的页面 → 主组件映射；视觉 Token 与布局模式见 **b-design-system** skill · [layout.md](./layout.md)。  
> 路由真源：`fe/src/routes.tsx` · `fe/src/config/nav-manifest.tsx`。

## 可视化模板中心（DASH-009）

| 路由 | 页面 | 关键组件 |
|------|------|----------|
| `/admin/viz-templates` | `VizTemplatesHubPage` | `VizTemplateCard` · `TemplateCardPreview` · `TemplatePreviewDialog` |
| — | 删除确认 | `AlertDialog` + `deleteTemplate()`（`fe/src/lib/dashboardTemplates.ts`） |
| — | 权限 | 路由 `dashboard:read`；写操作 `dashboard:template.manage`；删除 `canDeleteTemplate()` |

## 看板 / 大屏编辑（DASH-002）

| 路由 | 页面 | 关键组件 |
|------|------|----------|
| `/admin/dashboards/:id/edit` | `DashboardEditPage` | `DashboardEditWorkspace` · `DashboardGrid`（v1 栅格） |
| `/admin/data-screens/:id/edit` | `DashboardEditPage` | `DataScreenEditViewport` · `PixelCanvas`（v2 像素） |
| 共用 | 三栏壳层 | `ChartEditRail` · `CanvasEditToolbar` · `PaletteDrawer` |
| 共用 | 图表挂载 | `ChartMountProvider` · `ChartMountInteractionBridge` · `chartMountScheduler.ts` |

## 报表中心（RPT-005）

| 路由 | 页面 | 关键组件 |
|------|------|----------|
| `/admin/reports/center` | `ReportCenterPage` | `ReportCenterScheduleHub` |
| `/admin/reports/templates` | `ReportTemplatesPage` | `useReportTemplates` · `TemplateDetailPanel` |

## 数据源管理（CONN / DS）

| 路由 | 页面 | 关键组件 |
|------|------|----------|
| `/admin/datasources` | `DatasourceListPage` | 列表 · ACL `datasource:*` |
| `/admin/datasources/new` | `DatasourceFormPage` | 创建表单 |
| `/admin/datasources/:id` | `DatasourceDetailPage` | 详情 · 元数据浏览 |
| `/admin/datasources/:id/edit` | `DatasourceFormPage` | 编辑 |

## 系统管理（M7）

| 路由 | 页面 | 关键组件 |
|------|------|----------|
| `/admin/system` | `SystemAdminHomePage` | 管理入口 hub |
| `/admin/system/users` | `UserListPage` | 用户 |
| `/admin/system/roles` | `RoleListPage` | 角色 |
| `/admin/system/orgs` | `OrgTreePage` | 组织树 |
| `/admin/system/rls` | `RlsAdminPage` | 行级权限 |
| `/admin/system/grants` | `GrantsPage` | 资源授权 |
| `/admin/system/audit` | `AuditLogPage` | 审计日志 |

## 设计系统外部锚

- `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- `references/layout-patterns/bi-dashboard-builder.md`
