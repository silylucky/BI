# Design Spec: M-FINAL · F-B — RBAC 资源授权 FE + 能力驱动侧栏

```yaml
date: 2026-07-07
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fb.md
prd_ids: [AUTH-004, BOOT-002]
phase: P1
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
scope_file_count: 16
```

---

## 1. 批量主题与子项映射

| 子项 | PRD ID | 描述 |
|------|--------|------|
| 1 | AUTH-004 | 资源授权列表页 `/admin/system/grants`，对接 `GET /api/v1/resource-grants` |
| 2 | AUTH-004 | 授权绑定与撤销表单，对接 `POST` / `DELETE /api/v1/resource-grants/{id}` |
| 3 | BOOT-002 | manifest `capability` 字段 + `resolveNavGroups` 能力过滤，替代硬编码三档 |
| 4 | BOOT-002 | grants 路由注册 + dev-switch / smoke 闭环（侧栏与路由可达性一致） |

---

## 2. 上下文与问题陈述

### 2.1 当前痛点

- **AUTH-004 FE 缺口**：后端 `GET/POST/DELETE /api/v1/resource-grants` 已在 M2 交付（`resource_grants.py` + `T-AUTH-G01~G12`），但 Admin 无浏览器内管理入口；租户管理员须 curl/脚本配置授权。
- **BOOT-002 能力导航未落地**：F-A 已建立 `nav-manifest.tsx` + `resolveNavGroups(user, milestones?)`，但第二参数实为**里程碑集合**（`ACTIVE_MILESTONES`），非 RBAC capability；侧栏可见性仍靠 manifest `roles: SessionRole[]` 三档硬编码 + `session.ts` 中 `canManagePlatform` / `canEditDashboards` 散落判断。
- **验收链未闭环**：plan F-B 要求 viewer 不见系统管理 grants、admin 可见；manifest 系统分组缺「资源授权」项；`routes.tsx` 无 grants 路由。

### 2.2 目标

1. 交付 **Grants Admin 页**（列表 + 创建/撤销），行为对齐 `RoleListPage` 数据层模式（TanStack Query + `AdminPageShell` + Dialog/AlertDialog）。
2. 引入 **客户端 capability 词汇表** 与 manifest `capability` 声明，使 `resolveNavGroups` 按能力过滤；内置 admin/analyst/viewer 行为与 F-A 一致。
3. 以 vitest smoke 闭环：capability 过滤 ≥3 场景、AdminLayout grants 入口、routes 可达、GrantsPage 列表渲染。

### 2.3 方案对比（已选推荐项）

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A（推荐） | FE 静态 `BUILTIN_ROLE_CAPABILITIES` + manifest `capability`；`/me` 不扩展 | 纯 FE、与 round-target 范围一致；可测 | 自定义 role 能力须静态映射或二期 `/me.capabilities` | **选用** |
| B | 扩展 `GET /api/v1/me` 返回 `capabilities[]` | 自定义 role 准确 | 超出 FE 范围、需后端迁移 | 非目标 |
| C | 保留三档 `roles`，grants 页独立交付不做 capability nav | 改动小 | 不满足 plan F-B 第二行与 round-target 子项 3/4 | 否决 |

---

## 3. 范围框定文件列表

| 文件 | 操作 |
|------|------|
| `fe/src/pages/admin/system/grants/GrantsPage.tsx` | **新建** — 列表 + 创建/撤销 |
| `fe/src/pages/admin/system/grants/grantFormSchema.ts` | **新建** — zod 校验 |
| `fe/src/pages/admin/system/grants/grantErrors.ts` | **新建** — API 错误映射 |
| `fe/src/pages/admin/system/grants/grants.smoke.test.tsx` | **新建** — 列表/表单 smoke |
| `fe/src/lib/capabilities.ts` | **新建** — 能力词汇、角色映射、`matchesCapability` |
| `fe/src/config/nav-manifest.tsx` | **修改** — 各 section/item 增 `capability`；系统分组增 grants 项 |
| `fe/src/lib/resolve-nav.ts` | **修改** — 能力过滤；options 对象区分 milestones vs capabilities |
| `fe/src/lib/resolve-nav.test.ts` | **修改** — capability ≥3 场景；里程碑用例改 options 签名 |
| `fe/src/lib/session.ts` | **修改** — `canManagePlatform`/`canEditDashboards` 委托 `hasCapability` |
| `fe/src/lib/queryKeys.ts` | **修改** — `resourceGrants` query keys |
| `fe/src/routes.tsx` | **修改** — 注册 `system/grants` |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | **修改** — capability 菜单 + grants 入口 |
| `fe/src/routes.smoke.test.tsx` | **修改** — grants 路由可达 |
| `fe/src/pages/admin/dashboard/DashboardListPage.tsx` | **修改** — `canEditDashboards` → `hasCapability` |
| `fe/src/pages/admin/AdminHomePage.tsx` | **修改** — `canManagePlatform` → `hasCapability` |
| `docs/ui/layout.md` | **修改** — §3 系统分组补「资源授权」行 |

**不在范围内（明确不做）**：

- 不修改后端 API、`/me` 响应、auth 域服务
- 不实现 Playwright E2E
- 不扩展 resource grant 到 datasource/dashboard/report 以外的资源类型
- 不做 grants 列表服务端分页（API 当前返回全量 `items`；FE 客户端过滤即可）
- 不实现资源 ID 自动补全/选择器（M-FINAL 仅 UUID 文本输入 + 格式校验）
- 不修改 `RequirePlatformAdmin` 路由守卫语义（仍要求 `admin` role；与侧栏 capability 解耦）
- 不触及 F-C/F-G 连接器域

---

## 4. 详细设计

### 4.1 Capability 词汇表（`fe/src/lib/capabilities.ts`）

与 `docs/ui/layout.md` §3 分组表对齐：

| Capability | 含义 | 典型 manifest 绑定 |
|------------|------|-------------------|
| `datasource:*` | 数据源/连接器/接入 | 数据 section |
| `dashboard:read` | 查看 Dashboard | Dashboard 叶项（viewer） |
| `dashboard:edit` | 编辑 Dashboard | 图表探索、Dashboard 编辑态 |
| `report:read` | 查看报表 | 报表 subItems（viewer 可见子集） |
| `report:*` | 报表全能力 | 报表模板/调度（analyst+） |
| `theme:*` | 主题与实体 | 主题与实体 section |
| `governance:*` | 治理 | 治理 section |
| `metadata:*` | 元数据 | 语义层元数据 |
| `dataset:*` | Dataset 管理 | 语义层 Dataset |
| `system:*` | 系统管理含 grants | 系统 section 全部叶项 |

**内置角色 → 能力集合**（并集，支持多角色）：

```typescript
const BUILTIN_ROLE_CAPABILITIES: Record<SessionRole, readonly string[]> = {
  admin: [
    "system:*", "datasource:*", "dashboard:edit", "report:*",
    "governance:*", "theme:*", "metadata:*", "dataset:*",
  ],
  analyst: ["dashboard:edit", "report:*", "theme:*"],
  viewer: ["dashboard:read", "report:read"],
};
```

**自定义 role code**（plan 要求「能力满足时可见」）：

- `resolveUserCapabilities(roles: string[])`：对每个 role code，若在 `BUILTIN_ROLE_CAPABILITIES` 则并入；否则查 `OPTIONAL_ROLE_CAPABILITY_MAP: Record<string, string[]>`（初始为空，测试可注入 `reports_editor → ["report:*"]`）。
- 未知 code 无映射 → 不贡献能力（等价最严只读），避免越权。

**匹配规则** `matchesCapability(userCaps, required)`：

- 精确匹配：`userCaps.has(required)`
- 通配：`required` 为 `foo:*` 时，任一 `userCap` 满足 `userCap === required` 或 `userCap.startsWith("foo:")` 或 `userCap === "foo:*"`

导出 API：

```typescript
export function resolveUserCapabilities(roles: string[]): Set<string>;
export function matchesCapability(userCaps: Set<string>, required: string): boolean;
export function hasCapability(user: SessionUser, required: string): boolean;
```

`session.ts` 中：

```typescript
export function canManagePlatform(user) { return hasCapability(user, "system:*"); }
export function canEditDashboards(user) {
  return hasCapability(user, "dashboard:edit");
}
```

### 4.2 Manifest capability 绑定（`nav-manifest.tsx`）

类型扩展：

```typescript
type NavManifestSubItem = {
  name: string;
  path: string;
  milestone?: string;
  capability?: string;  // 新增：子项级（报表 subItems 差异化）
};

type NavManifestItem = {
  // ...existing
  capability?: string;  // 新增
};

type NavManifestSection = {
  // ...existing
  capability?: string;  // 新增：section 级默认（可选）
};
```

**绑定策略**（与 layout.md §3 一致）：

| Section | capability（section 级，可选） | 代表 item capability |
|---------|-------------------------------|---------------------|
| 数据 | `datasource:*` | 各 item 继承 |
| 分析 | — | Dashboard `dashboard:read`；图表探索 `dashboard:edit`；设计器 `dashboard:edit` |
| 报表 | — | 父项无；subItems：预制 `report:read`，模板/调度 `report:*` |
| 主题与实体 | `theme:*` | — |
| 治理 | `governance:*` | — |
| 语义层 | `metadata:*` / `dataset:*` | 分项绑定 |
| 系统 | `system:*` | 各叶项继承；**新增**资源授权 |

**新增 manifest 项**（系统 section，Shield 图标，M1）：

```typescript
{
  name: "资源授权",
  icon: <Shield className="size-6" aria-hidden />,
  path: "/admin/system/grants",
  milestone: "M1",
  capability: "system:*",
}
```

保留现有 `roles` 字段作为**文档/回退**；过滤主路径改 capability（见 4.3）。

### 4.3 `resolveNavGroups` 重构（`resolve-nav.ts`）

**签名**（打破 F-A 第二参数歧义）：

```typescript
export type ResolveNavOptions = {
  /** 活跃里程碑；默认 ACTIVE_MILESTONES */
  activeMilestones?: Set<string>;
  /** 用户 RBAC 能力；默认 resolveUserCapabilities(user.roles) */
  userCapabilities?: Set<string>;
};

export function resolveNavGroups(
  user: SessionUser,
  options?: ResolveNavOptions,
): NavSection[];
```

**迁移**：原 `resolveNavGroups(user, new Set(["M1"]))` 测试改为 `resolveNavGroups(user, { activeMilestones: new Set(["M1"]) })`。

**`filterItemForRole` 逻辑**（顺序）：

1. **Capability 门控**（优先）：`requiredCap = item.capability ?? section.capability`；若存在且 `!matchesCapability(userCaps, requiredCap)` → `null`。
2. **Role 门控**（仅当 item 无 capability 且 section 无 capability）：`hasRole(user, item.roles ?? section.roles)`。
3. **里程碑门控**（保持 F-A 行为）：`milestone` + `activeMilestones` + admin preview badge。
4. **subItems**：逐项 capability + milestone 过滤；过滤后为空则父项 `null`。

**性能**：`resolveUserCapabilities` 与 `resolveNavGroups` 为纯函数；`AdminLayout` 侧用 `useMemo(() => resolveNavGroups(sessionUser), [sessionUser])` 避免多余 re-render（P3 实现时添加）。

### 4.4 Grants 页（`GrantsPage.tsx`）

**页面结构**（`AdminPageShell` + table-list 模式，对齐 `RoleListPage`）：

```
AdminPageShell
├── actions: [新建授权] Button primary
├── FilterBar（可选轻量行）
│   ├── SearchField — 按资源 ID 前缀过滤（客户端）
│   ├── Select — 角色筛选（全部 / 各 role）
│   └── Select — 资源类型（全部 / datasource / dashboard / report）
├── 列表区 Card
│   ├── loading → Skeleton rows
│   ├── error → ErrorBanner + 重试
│   ├── empty → PanelEmptyState「暂无资源授权」
│   └── Table: 角色名称 | 资源类型 | 资源 ID | 操作[撤销]
└── Dialog — 新建授权
    ├── Select 角色（必填，来自 GET /api/v1/roles）
    ├── Select 资源类型（datasource / dashboard / report）
    ├── Input 资源 ID（UUID，必填）
    └── 校验错误 inline + DialogFooter [取消][确认]
└── AlertDialog — 撤销确认
```

**API 契约**（`docs/api/README.md` 已实现）：

| 操作 | Method | Body / Params | 响应 |
|------|--------|---------------|------|
| 列表 | `GET /api/v1/resource-grants` | `?role_id=&resource_type=` | `{ items: ResourceGrantOut[] }` |
| 创建 | `POST /api/v1/resource-grants` | `{ role_id, resource_type, resource_id }` | `201 ResourceGrantOut` |
| 撤销 | `DELETE /api/v1/resource-grants/{grant_id}` | — | `204` |

`ResourceGrantOut`：`{ id, role_id, resource_type, resource_id }`（snake_case 经 `apiFetch` 转 camelCase）。

**错误映射**（`grantErrors.ts`）：

| code | 用户文案 |
|------|----------|
| `GRANT_ALREADY_EXISTS` | 该角色已绑定此资源，请勿重复授权 |
| `ROLE_NOT_FOUND` | 所选角色不存在，请刷新后重试 |
| `GRANT_NOT_FOUND` | 授权记录不存在，可能已被撤销 |
| `INVALID_RESOURCE_TYPE` | 资源类型无效 |
| 401 / 未登录 | 路由守卫重定向 `/login`（`RequireAuth` 链） |

**TanStack Query**：

```typescript
// queryKeys.ts
resourceGrants: {
  all: ["resourceGrants"] as const,
  list: (params?: { roleId?: string; resourceType?: string }) =>
    ["resourceGrants", "list", params] as const,
},
```

- `useQuery` 列表；`useMutation` 创建/删除；成功后 `invalidateQueries({ queryKey: queryKeys.resourceGrants.all })`。
- 创建提交中 `disabled` + Button `loading`；防重提交。

**角色名称展示**：并行 `useQuery(queryKeys.roles.list())` 建 `roleId → name` Map；加载中显示 UUID 短码或 Skeleton。

**资源类型展示**：中文标签映射 `datasource→数据源`、`dashboard→Dashboard`、`report→报表`。

### 4.5 路由与守卫（`routes.tsx`）

```tsx
<Route
  path="system/grants"
  element={
    <RequirePlatformAdmin>
      <GrantsPage />
    </RequirePlatformAdmin>
  }
/>
```

未登录 → `RequireAuth` 祖先重定向 `/login`；非 admin → `RequirePlatformAdmin` fallback 工作台（与 roles/users 一致）。

### 4.6 测试设计

#### `resolve-nav.test.ts`（新增 capability 用例）

| 用例 ID | 描述 |
|---------|------|
| T-NAV-CAP-01 | `admin` 含「系统」section 且含「资源授权」项 |
| T-NAV-CAP-02 | `viewer` 不含「系统」section（无 `system:*`） |
| T-NAV-CAP-03 | 自定义角色 `reports_editor` + `userCapabilities: Set(["report:*"])` 仅见报表相关，不见系统/数据 |
| T-NAV-CAP-04 | `analyst` 见「分析」「报表」，不见「数据」「系统」 |
| （回归） | 原 T-NAV-MF-01~06 全 PASS；T-NAV-MF-04 改 options 签名 |

#### `AdminLayout.smoke.test.tsx`

| 用例 ID | 描述 |
|---------|------|
| T-FE-SMFB-01 | admin mock：侧栏「系统」分组含链接「资源授权」`href="/admin/system/grants"` |
| T-FE-SMFB-02 | viewer mock：侧栏不存在「资源授权」文本 |
| T-FE-SMFB-03 | admin mock：仍含 F-A 报表 subItems（不退化 T-FE-SMFA-01） |

#### `routes.smoke.test.tsx`

| 用例 ID | 描述 |
|---------|------|
| T-RT-GRANTS-01 | `/admin/system/grants` 路由可达，渲染标题「资源授权」 |
| T-RT-DL-01 | 死链检测含 grants path（不退化） |

#### `grants.smoke.test.tsx`

| 用例 ID | 描述 |
|---------|------|
| T-AUTH-004-FE-01 | mock GET 列表 → 表格渲染 role 名 + 资源类型 + 资源 ID |
| T-AUTH-004-FE-02 | 打开新建 Dialog → 必填校验（空提交显示字段错误） |
| T-AUTH-004-FE-03 | mock POST 成功 → toast + 列表刷新 |
| T-AUTH-004-FE-04 | 撤销 AlertDialog 确认 → DELETE 调用 |

---

## 5. 验收标准（可测试）

### 子项 1：AUTH-004 资源授权列表页

- [ ] `/admin/system/grants` 在 `routes.tsx` 注册，`RequirePlatformAdmin` 包裹
- [ ] manifest 系统分组含「资源授权」，`path: "/admin/system/grants"`
- [ ] `GET /api/v1/resource-grants` 对接成功，表格列：角色、资源类型、资源 ID
- [ ] 支持按角色、资源类型筛选（客户端或 query params）
- [ ] 空态 `PanelEmptyState`、加载 `Skeleton`、错误 `ErrorBanner` 符合设计系统
- [ ] `grants.smoke.test.tsx` T-AUTH-004-FE-01 PASS

### 子项 2：AUTH-004 授权绑定与撤销表单

- [ ] Dialog 表单：角色必选、资源类型枚举三值、资源 ID UUID 必填
- [ ] `POST /api/v1/resource-grants` 成功关闭 Dialog、toast、invalidate 列表
- [ ] `DELETE /api/v1/resource-grants/{id}` 经 AlertDialog 确认后执行
- [ ] `GRANT_ALREADY_EXISTS` 等错误中文展示，非 toast 字段级错误
- [ ] 提交中防重；未登录访问重定向 `/login`
- [ ] `grants.smoke.test.tsx` T-AUTH-004-FE-02~04 PASS

### 子项 3：BOOT-002 capability 绑定与过滤

- [ ] `nav-manifest.tsx` section/item/subItem 含 `capability` 声明（与 §4.2 表一致）
- [ ] `fe/src/lib/capabilities.ts` 导出 `resolveUserCapabilities` / `matchesCapability` / `hasCapability`
- [ ] `resolveNavGroups` 使用 `ResolveNavOptions`；默认行为与 F-A 三档侧栏一致
- [ ] `canManagePlatform` / `canEditDashboards` 委托 capability（`AdminHomePage`、`DashboardListPage` 已切换）
- [ ] `resolve-nav.test.ts` capability 用例 ≥3 PASS（T-NAV-CAP-01~04）
- [ ] viewer/analyst 侧栏不见未授权分组（系统/数据）

### 子项 4：BOOT-002 grants 路由与 dev-switch smoke

- [ ] `AdminLayout.smoke.test.tsx` T-FE-SMFB-01~02 PASS
- [ ] `routes.smoke.test.tsx` T-RT-GRANTS-01 PASS
- [ ] dev-switch 切换 viewer 后「资源授权」不可见；admin 可见（smoke mock 覆盖，与 T-FE-SMFB 等价）
- [ ] `pnpm run check:design` PASS；`fe` vitest 全绿

### F-B 整体验收信号

```
resolve-nav.test.ts         — capability 过滤 ≥3 场景（T-NAV-CAP-01~04）
AdminLayout.smoke.test.tsx  — 能力驱动侧栏 + grants 入口（T-FE-SMFB-01~02）
routes.smoke.test.tsx       — /admin/system/grants 可达（T-RT-GRANTS-01）
GrantsPage                  — 列表 + 绑定/撤销表单对接 resource-grants API
```

---

## 6. 非目标（明确不做）

见 §3 范围表。补充：二期 `/me.capabilities` 动态下发、资源 ID 选择器、grants 批量导入、Playwright E2E。

---

## 7. 与 PRD 8 维薄弱项对齐

| 维度 | AUTH-004 分 | BOOT-002 分 | 本轮改进方向 |
|------|-------------|-------------|--------------|
| 用户价值 | 84 ⚠ | 95 | AUTH-004：Admin UI 补齐浏览器内授权管理，管理员无需 API/脚本 |
| 完整度 | 98 | 100 | grants 列表+表单覆盖 plan F-B 全文 |
| 可靠性 | 96 | 94 | 表单防重提交、AlertDialog 撤销、错误映射 |
| 交互体验 | — | 96 | 侧栏与路由可见性一致；dev-switch 验收 |
| 架构健康 | 90 | 96 | capability 单一模块替代散落 `canXxx`；manifest 声明式 |
| 测试覆盖 | 100 | 100 | 补 smoke + resolve-nav capability 场景 |
| 性能 | 86 ⚠ | 88 ⚠ | `useMemo` 缓存 nav；Query staleTime 合理；列表全量可接受（元数据规模小） |
| 安全性 | 90 | 92 | 路由 `RequirePlatformAdmin`；viewer 不见 grants；撤销二次确认 |

---

## 8. UI 设计交付

```
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
```

### 8.1 页面信息架构

**Grants 页**（`/admin/system/grants`）：

- 导航层级：管理端壳层 → 系统（侧栏）→ 资源授权（主内容）
- 主内容区：`AdminPageShell` 全宽表格列表，`max-w-(--breakpoint-2xl)` 内居中，与角色/用户管理页一致
- 密度：标准 admin 密度（`text-theme-sm` 表格、`h-11` 表单控件）

**状态矩阵**：

| 状态 | 列表区 | 表单 |
|------|--------|------|
| 加载 | `Skeleton` 5 行 | Dialog 内 Select 禁用 |
| 空 | `PanelEmptyState`「暂无资源授权」+ 引导点击「新建授权」 | — |
| 错误 | `ErrorBanner` + 重试 | 字段下 `FormMessage` 样式文案 |
| 权限 | 非 admin 不进入页（fallback 工作台） | — |

**侧栏**：系统分组新增「资源授权」叶项，与「角色管理」同级，Shield 图标复用。

### 8.2 视觉层级

- **主操作**：「新建授权」`Button variant="primary"`（页面 actions 区右上）
- **次操作**：行内「撤销」`Button variant="outline" size="sm"` 或 `IconButton`
- **表格**：`Card` 包裹 `Table`；表头 `text-gray-500`；行 hover `bg-gray-50 dark:bg-white/[0.02]`
- **弹层**：新建 `Dialog`；撤销 `AlertDialog`（destructive 确认）

### 8.3 组件映射

| UI 元素 | 复用组件 | 禁止 |
|---------|----------|------|
| 页面壳 | `AdminPageShell` | 自建 page header |
| 表格 | `Table` + `Card` | 原生 `<table>` |
| 空态 | `PanelEmptyState` | 大面积空白 div |
| 加载 | `Skeleton` | 无反馈空白 |
| 错误 | 页面内 `ErrorBanner`（与 RoleListPage 同型） | toast 报列表级错误 |
| 表单 | `Dialog` + `Label` + `Input` + `Select` + `Button` | `window.confirm` |
| 撤销确认 | `AlertDialog` | — |
| 筛选 | `SearchField` + `Select` | 自建 input 样式 |
| 资源类型标签 | `Badge variant="light"` | 硬编码色块 |
| 侧栏项 | 现有 `AppSidebar` 链路 | 页面内画 nav |

### 8.4 Token 与密度

- 语义色：`brand-500` 主按钮；`error-*` 错误横幅与 destructive；`gray-*` 表格边框/文本
- 表单：`h-11`、`rounded-lg`、`focus-visible:ring-3`
- 间距：页面 `gap-6`；表格 cell `px-4 py-3`；Dialog `gap-4`
- 图标：操作 `size-4`；侧栏 `size-6`（manifest 已有）
- 禁止硬编码 hex；`check:design` 门禁

### 8.5 响应式与可访问性

| 方面 | 策略 |
|------|------|
| Desktop ≥1280px | 表格全列展示；Dialog 居中 `max-w-lg` |
| Tablet | 表格横向 `overflow-x-auto`；筛选器 `flex-wrap` |
| Mobile 375px | 表格关键列优先（角色、类型）；资源 ID `truncate` + `title` 全文 |
| 键盘 | Dialog 内 Tab 顺序；AlertDialog 焦点陷阱（Radix 默认） |
| ARIA | 撤销按钮 `aria-label="撤销授权"`；表格 `aria-label="资源授权列表"` |
| 长文本 | UUID `font-mono text-theme-xs`；过长 `truncate max-w-[12rem]` |

### 8.6 视觉 QA 清单（P3 验证）

| 检查项 | Desktop light | Desktop dark | Mobile 375px |
|--------|:---:|:---:|:---:|
| Grants 表头与数据对齐 | ☐ | ☐ | ☐ |
| 空态居中、非大面积空白 | ☐ | ☐ | ☐ |
| Dialog 表单控件等高 h-11 | ☐ | ☐ | ☐ |
| 错误横幅对比度可读 | ☐ | ☐ | — |
| 侧栏「资源授权」与系统项对齐 | ☐ | ☐ | ☐ |
| viewer 无系统分组 | ☐ | — | ☐ |
| 撤销 AlertDialog 按钮层级清晰 | ☐ | ☐ | ☐ |

---

## 9. `docs/ui/layout.md` 同步要点

§3 路由树「系统」下增加：

```
├── /system/grants               # 资源授权 · table-list + dialog form
```

§3 侧栏分组表「系统」行更新为：

> 角色/用户/组织/行级权限/审计日志/资源授权 | `system:*` | M1 | admin

注明 nav 真理源仍为 `nav-manifest.tsx`。

---

## 10. Spec Self-Review

- [x] 覆盖 round-target 全部 4 子项
- [x] 未超出范围框定（16 文件，仅 `fe/` + layout.md）
- [x] 无 TBD/TODO 占位
- [x] UI 设计交付完整
- [x] `resolveNavGroups` 签名迁移路径明确
- [x] API 契约与后端 `ResourceGrantCreate` / 错误码对齐
