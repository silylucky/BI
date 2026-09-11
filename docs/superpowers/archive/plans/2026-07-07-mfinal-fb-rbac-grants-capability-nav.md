# M-FINAL · F-B — RBAC 资源授权 FE + 能力驱动侧栏 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `fe/src/lib/capabilities.ts`（新建）、`fe/src/lib/session.ts`、`fe/src/config/nav-manifest.tsx`、`fe/src/lib/resolve-nav.ts`、`fe/src/lib/resolve-nav.test.ts`、`fe/src/lib/queryKeys.ts`、`fe/src/pages/admin/system/grants/`（4 新建）、`fe/src/routes.tsx`、`fe/src/layouts/AdminLayout.tsx`、`fe/src/layouts/AdminLayout.smoke.test.tsx`、`fe/src/routes.smoke.test.tsx`、`fe/src/pages/admin/AdminHomePage.tsx`、`fe/src/pages/admin/dashboard/DashboardListPage.tsx`、`docs/ui/layout.md`
> **子项：** AUTH-004（资源授权列表页 + 绑定/撤销表单）、BOOT-002（manifest capability + resolveNavGroups 过滤 + grants 路由 smoke）
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；UI 任务已预指定）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`fe-ui.mdc` 匹配所有 `fe/**`）

**Goal:** 交付 Grants Admin 页（列表 + 创建/撤销）对接 `resource-grants` API，并以客户端 capability 词汇表驱动侧栏过滤，替代硬编码三档 `roles` 分支，闭环 F-B 四项验收。

**Architecture:** `capabilities.ts` 纯函数模块导出 `resolveUserCapabilities` / `matchesCapability` / `hasCapability`；`nav-manifest.tsx` 声明 `capability` 字段；`resolveNavGroups(user, ResolveNavOptions?)` 先 capability 门控、再 role 回退、再里程碑 preview；`GrantsPage` 复用 `RoleListPage` 的 TanStack Query + `AdminPageShell` + Dialog/AlertDialog 模式。

**Tech Stack:** React 18 + TypeScript + TanStack Query + zod + vitest + RTL；TailAdmin 视觉（b-design-system-tailadmin-radix）；pnpm workspace。

## Global Constraints

- 不修改后端 API、`/me` 响应、`backend/` 任何文件
- 不引入新第三方依赖
- `RequirePlatformAdmin` 路由守卫语义不变（仍要求 `admin` role）
- `fe/src/config/nav-manifest.tsx` 仅数据 + 类型，逻辑放 `resolve-nav.ts`
- `resolve-nav.ts` + 辅助函数合计 ≤ 120 行（设计允许较 F-A 扩展 capability 分支）
- 单业务文件 ≤ 300 行（fe-ui.mdc）；`GrantsPage.tsx` 超 250 行时拆 `useGrantsMutations` 到同目录 hooks
- `ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"])` 保持 F-A 行为
- 所有测试通过 `cd fe && pnpm vitest run` 与 `pnpm run check:design`
- 提交信息格式：`feat: <动词> <主体>`
- 文档同步：`docs/ui/layout.md` §3 系统分组补「资源授权」

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `fe/src/lib/capabilities.ts` | **新建** | 能力词汇表、内置角色映射、`matchesCapability` / `hasCapability` |
| `fe/src/lib/session.ts` | **修改** | `canManagePlatform` / `canEditDashboards` 委托 `hasCapability` |
| `fe/src/config/nav-manifest.tsx` | **修改** | 各 section/item/subItem 增 `capability`；系统分组增 grants 项 |
| `fe/src/lib/resolve-nav.ts` | **修改** | `ResolveNavOptions` 签名；capability 优先过滤 |
| `fe/src/lib/resolve-nav.test.ts` | **修改** | T-NAV-CAP-01~04；T-NAV-MF-04/05 改 options 签名 |
| `fe/src/lib/queryKeys.ts` | **修改** | `resourceGrants` query keys |
| `fe/src/pages/admin/system/grants/grantFormSchema.ts` | **新建** | zod 校验：roleId、resourceType 枚举、resourceId UUID |
| `fe/src/pages/admin/system/grants/grantErrors.ts` | **新建** | GRANT_* 错误码中文映射 |
| `fe/src/pages/admin/system/grants/GrantsPage.tsx` | **新建** | 列表 + 筛选 + 新建 Dialog + 撤销 AlertDialog |
| `fe/src/pages/admin/system/grants/grants.smoke.test.tsx` | **新建** | T-AUTH-004-FE-01~04 |
| `fe/src/routes.tsx` | **修改** | 注册 `system/grants` + `RequirePlatformAdmin` |
| `fe/src/layouts/AdminLayout.tsx` | **修改** | `useMemo` 缓存 `resolveNavGroups` |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | **修改** | T-FE-SMFB-01~03 |
| `fe/src/routes.smoke.test.tsx` | **修改** | T-RT-GRANTS-01；T-RT-DL-01 含 grants path |
| `fe/src/pages/admin/AdminHomePage.tsx` | **修改** | `canManagePlatform` → `hasCapability(user, "system:*")` 间接（经 session 委托，无需改 import 若仍用 canManagePlatform） |
| `fe/src/pages/admin/dashboard/DashboardListPage.tsx` | **修改** | 同上，`canEditDashboards` 已委托 |
| `docs/ui/layout.md` | **修改** | §3 路由树 + 侧栏分组表补资源授权 |

---

### Task 1: 新建 `capabilities.ts` 并委托 `session.ts`

**Files:**
- Create: `fe/src/lib/capabilities.ts`
- Modify: `fe/src/lib/session.ts`

**Interfaces:**
- Produces: `resolveUserCapabilities(roles: string[]): Set<string>`
- Produces: `matchesCapability(userCaps: Set<string>, required: string): boolean`
- Produces: `hasCapability(user: SessionUser, required: string): boolean`
- Consumes: `SessionUser` from `@/lib/session`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 创建 `capabilities.ts`**

```typescript
// fe/src/lib/capabilities.ts
import type { SessionRole, SessionUser } from "@/lib/session";

const BUILTIN_ROLE_CAPABILITIES: Record<SessionRole, readonly string[]> = {
  admin: [
    "system:*",
    "datasource:*",
    "dashboard:edit",
    "report:*",
    "governance:*",
    "theme:*",
    "metadata:*",
    "dataset:*",
  ],
  analyst: ["dashboard:edit", "report:*", "theme:*"],
  viewer: ["dashboard:read", "report:read"],
};

/** 测试或二期可注入自定义 role → capability 映射 */
export const OPTIONAL_ROLE_CAPABILITY_MAP: Record<string, readonly string[]> = {};

export function resolveUserCapabilities(roles: string[]): Set<string> {
  const caps = new Set<string>();
  for (const role of roles) {
    const builtin = BUILTIN_ROLE_CAPABILITIES[role as SessionRole];
    if (builtin) {
      builtin.forEach((c) => caps.add(c));
      continue;
    }
    const custom = OPTIONAL_ROLE_CAPABILITY_MAP[role];
    if (custom) custom.forEach((c) => caps.add(c));
  }
  return caps;
}

export function matchesCapability(userCaps: Set<string>, required: string): boolean {
  if (userCaps.has(required)) return true;
  const colon = required.indexOf(":");
  if (colon === -1) return false;
  const prefix = required.slice(0, colon);
  if (!required.endsWith(":*")) return false;
  for (const cap of userCaps) {
    if (cap === required) return true;
    if (cap.startsWith(`${prefix}:`)) return true;
  }
  return false;
}

export function hasCapability(user: SessionUser, required: string): boolean {
  return matchesCapability(resolveUserCapabilities(user.roles), required);
}
```

- [ ] **Step 2: 修改 `session.ts` 委托 capability**

```typescript
// fe/src/lib/session.ts — 在文件顶部增加 import，替换两个函数体
import { hasCapability } from "@/lib/capabilities";

export function canManagePlatform(user: SessionUser): boolean {
  return hasCapability(user, "system:*");
}

export function canEditDashboards(user: SessionUser): boolean {
  return hasCapability(user, "dashboard:edit");
}
```

- [ ] **Step 3: 运行类型检查**

Run: `cd fe && pnpm exec tsc -b --pretty false 2>&1 | head -20`
Expected: 无 `capabilities.ts` / `session.ts` 相关错误（其余文件可能因 resolve-nav 未迁移而暂有错误，Task 3 修复）

- [ ] **Step 4: Commit**

```bash
git add fe/src/lib/capabilities.ts fe/src/lib/session.ts
git commit -m "feat: add client capability vocabulary and delegate session helpers"
```

---

### Task 2: `nav-manifest.tsx` capability 绑定 + 资源授权项

**Files:**
- Modify: `fe/src/config/nav-manifest.tsx`

**Interfaces:**
- Produces: `NAV_MANIFEST` 各节点含 `capability?: string`；系统 section 含「资源授权」叶项
- Consumes: Task 1 无直接依赖（纯数据）

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin 侧栏图标 `Shield` `size-6`；与系统分组其他叶项对齐
- desktop 与 mobile 截图无明显错位（smoke 在 Task 7 验证）
- 侧栏项路径 `/admin/system/grants` 与 layout.md 一致
- 通过 `pnpm run check:design`（无硬编码 hex）

- [ ] **Step 1: 扩展类型定义**

在 `NavManifestSubItem`、`NavManifestItem`、`NavManifestSection` 各增 `capability?: string`：

```typescript
type NavManifestSubItem = {
  name: string;
  path: string;
  milestone?: string;
  capability?: string;
};

type NavManifestItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: NavManifestSubItem[];
  milestone?: string;
  roles?: SessionRole[];
  capability?: string;
};

type NavManifestSection = {
  title: string;
  items: NavManifestItem[];
  roles: SessionRole[];
  capability?: string;
};
```

- [ ] **Step 2: 为各 section/item 绑定 capability（与 design §4.2 表一致）**

关键绑定摘要（完整文件由 implementer 按表补全每一项）：

| Section | section.capability | 代表 item |
|---------|-------------------|-----------|
| 数据 | `datasource:*` | 继承 section |
| 分析 | — | Dashboard `dashboard:read`；图表探索/查询设计器 `dashboard:edit` |
| 报表 | — | subItems: 预制 `report:read`；模板/调度 `report:*` |
| 主题与实体 | `theme:*` | — |
| 治理 | `governance:*` | — |
| 语义层 | — | 元数据 `metadata:*`；Dataset `dataset:*` |
| 系统 | `system:*` | 各叶项继承 |

- [ ] **Step 3: 系统 section 新增资源授权项（插在「角色管理」之后）**

```typescript
{
  name: "资源授权",
  icon: <Shield className="size-6" aria-hidden />,
  path: "/admin/system/grants",
  milestone: "M1",
  capability: "system:*",
},
```

- [ ] **Step 4: 验证**

Run: `cd fe && pnpm run check:design`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/config/nav-manifest.tsx
git commit -m "feat: add capability fields and grants nav item to manifest"
```

---

### Task 3: 重构 `resolve-nav.ts` + capability 测试

**Files:**
- Modify: `fe/src/lib/resolve-nav.ts`
- Modify: `fe/src/lib/resolve-nav.test.ts`

**Interfaces:**
- Produces: `export type ResolveNavOptions = { activeMilestones?: Set<string>; userCapabilities?: Set<string> }`
- Produces: `resolveNavGroups(user, options?: ResolveNavOptions): NavSection[]`
- Consumes: `matchesCapability`, `resolveUserCapabilities` from `@/lib/capabilities`
- Consumes: `NAV_MANIFEST` from `@/config/nav-manifest`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 先写失败测试 T-NAV-CAP-01（admin 含资源授权）**

在 `resolve-nav.test.ts` 追加：

```typescript
import { OPTIONAL_ROLE_CAPABILITY_MAP } from "./capabilities";

// T-NAV-CAP-01
it("T-NAV-CAP-01: admin sees 系统 section with 资源授权 item", () => {
  const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
  const system = groups.find((g) => g.title === "系统");
  expect(system).toBeDefined();
  const names = system?.items.map((i) => i.name) ?? [];
  expect(names).toContain("资源授权");
});
```

Run: `cd fe && pnpm vitest run fe/src/lib/resolve-nav.test.ts -t "T-NAV-CAP-01" 2>&1 | tail -5`
Expected: FAIL（资源授权不可见或函数签名未迁移）

- [ ] **Step 2: 重写 `resolve-nav.ts`**

```typescript
// fe/src/lib/resolve-nav.ts
import { NAV_MANIFEST } from "@/config/nav-manifest";
import { matchesCapability, resolveUserCapabilities } from "@/lib/capabilities";
import type { NavSection, NavItem, NavSubItem } from "@/components/layout/app-sidebar";
import type { SessionUser, SessionRole } from "@/lib/session";

export const ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"]);

export type ResolveNavOptions = {
  activeMilestones?: Set<string>;
  userCapabilities?: Set<string>;
};

function isAdmin(user: SessionUser): boolean {
  return user.roles.includes("admin");
}

function hasRole(user: SessionUser, roles: SessionRole[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

type ManifestItem = (typeof NAV_MANIFEST)[0]["items"][0];
type ManifestSection = (typeof NAV_MANIFEST)[0];

function filterSubItem(
  sub: NonNullable<ManifestItem["subItems"]>[0],
  sectionCap: string | undefined,
  userCaps: Set<string>,
  activeMilestones: Set<string>,
  user: SessionUser,
): NavSubItem | null {
  const requiredCap = sub.capability ?? sectionCap;
  if (requiredCap && !matchesCapability(userCaps, requiredCap)) return null;
  if (sub.milestone && !activeMilestones.has(sub.milestone) && !isAdmin(user)) return null;
  return { name: sub.name, path: sub.path };
}

function filterItemForRole(
  item: ManifestItem,
  section: ManifestSection,
  user: SessionUser,
  userCaps: Set<string>,
  activeMilestones: Set<string>,
): NavItem | null {
  const sectionCap = section.capability;
  const requiredCap = item.capability ?? sectionCap;

  if (requiredCap) {
    if (!matchesCapability(userCaps, requiredCap)) return null;
  } else {
    const effectiveRoles = (item.roles as SessionRole[] | undefined) ?? section.roles;
    if (!hasRole(user, effectiveRoles)) return null;
  }

  const isInactive = Boolean(item.milestone && !activeMilestones.has(item.milestone));
  if (isInactive && !isAdmin(user)) return null;
  const addPreview = isInactive && isAdmin(user);

  let filteredSubItems: NavSubItem[] | undefined;
  if (item.subItems) {
    filteredSubItems = item.subItems
      .map((sub) => filterSubItem(sub, requiredCap ?? sectionCap, userCaps, activeMilestones, user))
      .filter((s): s is NavSubItem => s !== null);
    if (filteredSubItems.length === 0) return null;
  }

  return {
    name: item.name,
    icon: item.icon,
    ...(item.path ? { path: item.path } : {}),
    ...(addPreview ? { preview: true } : {}),
    ...(filteredSubItems ? { subItems: filteredSubItems } : {}),
  };
}

export function resolveNavGroups(
  user: SessionUser,
  options?: ResolveNavOptions,
): NavSection[] {
  const activeMilestones = options?.activeMilestones ?? ACTIVE_MILESTONES;
  const userCaps = options?.userCapabilities ?? resolveUserCapabilities(user.roles);
  const result: NavSection[] = [];

  for (const section of NAV_MANIFEST) {
    const sectionCap = section.capability;
    if (sectionCap) {
      if (!matchesCapability(userCaps, sectionCap)) continue;
    } else if (!hasRole(user, section.roles)) {
      continue;
    }

    const items: NavItem[] = [];
    for (const item of section.items) {
      const navItem = filterItemForRole(item, section, user, userCaps, activeMilestones);
      if (navItem) items.push(navItem);
    }
    if (items.length > 0) result.push({ title: section.title, items });
  }
  return result;
}
```

- [ ] **Step 3: 迁移既有测试 options 签名**

将 `resolveNavGroups(user, new Set(["M1"]))` 改为：

```typescript
resolveNavGroups(user, { activeMilestones: new Set(["M1"]) })
```

涉及 `T-NAV-MF-04`、`T-NAV-MF-05` 及任何第二参数为 `Set` 的调用。

- [ ] **Step 4: 追加 capability 用例 T-NAV-CAP-02~04**

```typescript
// T-NAV-CAP-02
it("T-NAV-CAP-02: viewer does not see 系统 section", () => {
  const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
  expect(groups.some((g) => g.title === "系统")).toBe(false);
});

// T-NAV-CAP-03
it("T-NAV-CAP-03: custom role with report:* sees 报表 only", () => {
  OPTIONAL_ROLE_CAPABILITY_MAP.reports_editor = ["report:*"];
  try {
    const groups = resolveNavGroups(sessionUserFromAuth("editor", ["reports_editor" as "viewer"]), {
      userCapabilities: new Set(["report:*"]),
    });
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("报表");
    expect(titles).not.toContain("系统");
    expect(titles).not.toContain("数据");
  } finally {
    delete OPTIONAL_ROLE_CAPABILITY_MAP.reports_editor;
  }
});

// T-NAV-CAP-04
it("T-NAV-CAP-04: analyst sees 分析 and 报表, not 数据 or 系统", () => {
  const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
  const titles = groups.map((g) => g.title);
  expect(titles).toContain("分析");
  expect(titles).toContain("报表");
  expect(titles).not.toContain("数据");
  expect(titles).not.toContain("系统");
});
```

- [ ] **Step 5: 运行全量 resolve-nav 测试**

Run: `cd fe && pnpm vitest run fe/src/lib/resolve-nav.test.ts`
Expected: 全部 PASS（含 T-NAV-MF-01~06 回归）

- [ ] **Step 6: Commit**

```bash
git add fe/src/lib/resolve-nav.ts fe/src/lib/resolve-nav.test.ts
git commit -m "feat: capability-driven resolveNavGroups with ResolveNavOptions"
```

---

### Task 4: Grant 脚手架 — queryKeys + form schema + errors

**Files:**
- Modify: `fe/src/lib/queryKeys.ts`
- Create: `fe/src/pages/admin/system/grants/grantFormSchema.ts`
- Create: `fe/src/pages/admin/system/grants/grantErrors.ts`

**Interfaces:**
- Produces: `queryKeys.resourceGrants.all` / `.list(params?)`
- Produces: `grantCreateSchema`, `GrantCreateValues`
- Produces: `mapGrantError(err: unknown): string`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

- [ ] **Step 1: 扩展 queryKeys**

```typescript
// fe/src/lib/queryKeys.ts — 在 roles 块之后追加
resourceGrants: {
  all: ["resourceGrants"] as const,
  list: (params?: { roleId?: string; resourceType?: string }) =>
    ["resourceGrants", "list", params] as const,
},
```

- [ ] **Step 2: 创建 grantFormSchema.ts**

```typescript
// fe/src/pages/admin/system/grants/grantFormSchema.ts
import { z } from "zod";

export const RESOURCE_TYPES = ["datasource", "dashboard", "report"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const grantCreateSchema = z.object({
  roleId: z.string().min(1, "请选择角色").uuid("请选择有效角色"),
  resourceType: z.enum(RESOURCE_TYPES, {
    errorMap: () => ({ message: "请选择资源类型" }),
  }),
  resourceId: z.string().min(1, "请输入资源 ID").uuid("请输入有效的资源 ID（UUID 格式）"),
});

export type GrantCreateValues = z.infer<typeof grantCreateSchema>;

export const EMPTY_GRANT_CREATE: GrantCreateValues = {
  roleId: "",
  resourceType: "datasource",
  resourceId: "",
};
```

- [ ] **Step 3: 创建 grantErrors.ts**

```typescript
// fe/src/pages/admin/system/grants/grantErrors.ts
import { mapApiError } from "@/lib/apiError";

const GRANT_MESSAGES: Record<string, string> = {
  GRANT_ALREADY_EXISTS: "该角色已绑定此资源，请勿重复授权",
  ROLE_NOT_FOUND: "所选角色不存在，请刷新后重试",
  GRANT_NOT_FOUND: "授权记录不存在，可能已被撤销",
  INVALID_RESOURCE_TYPE: "资源类型无效",
};

export function mapGrantError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && GRANT_MESSAGES[code]) return GRANT_MESSAGES[code];
  return mapApiError(err);
}
```

- [ ] **Step 4: 验证**

Run: `cd fe && pnpm exec tsc -b --pretty false 2>&1 | grep -E "grantForm|grantErrors|queryKeys" || echo "no errors in grant scaffolding"`
Expected: `no errors in grant scaffolding`

- [ ] **Step 5: Commit**

```bash
git add fe/src/lib/queryKeys.ts fe/src/pages/admin/system/grants/grantFormSchema.ts fe/src/pages/admin/system/grants/grantErrors.ts
git commit -m "feat: add resource grants query keys and form validation"
```

---

### Task 5: 实现 `GrantsPage.tsx`（列表 + 创建 + 撤销）

**Files:**
- Create: `fe/src/pages/admin/system/grants/GrantsPage.tsx`

**Interfaces:**
- Consumes: `queryKeys.resourceGrants`, `grantCreateSchema`, `mapGrantError`, `EMPTY_GRANT_CREATE`
- Consumes: `apiFetch` from `@/lib/api`
- Produces: `export function GrantsPage()` — 页面标题「资源授权」

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `AdminPageShell`、`Table`+`Card`、`PanelEmptyState`、`Skeleton`、`ErrorBanner`、`Dialog`、`AlertDialog`、`SearchField`、`Select`、`Badge variant="light"`
- desktop 与 mobile 表格 `overflow-x-auto`；UUID 列 `font-mono text-theme-xs truncate`
- loading/error/empty/dialog 提交中状态完整；撤销用 AlertDialog destructive
- 通过 `pnpm run check:design`；无硬编码 hex

- [ ] **Step 1: 实现页面骨架（列表区 + actions）**

```tsx
// fe/src/pages/admin/system/grants/GrantsPage.tsx — 核心结构
export function GrantsPage() {
  // state: search, roleFilter, typeFilter, dialogOpen, deleteTarget, form, formErrors, actionError
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.resourceGrants.list(),
    queryFn: () => apiFetch<{ items: ResourceGrantOut[] }>("/api/v1/resource-grants"),
  });
  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list({ limit: 200, offset: 0 }),
    queryFn: () => apiFetch<{ items: RoleOut[] }>("/api/v1/roles?limit=200&offset=0"),
  });
  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rolesQuery.data?.items ?? []) map.set(r.id, r.name);
    return map;
  }, [rolesQuery.data?.items]);

  const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
    datasource: "数据源",
    dashboard: "Dashboard",
    report: "报表",
  };

  // 客户端过滤 items by search prefix / roleFilter / typeFilter
  // ErrorBanner 复用 RoleListPage 同型组件（可内联复制 ≤15 行）

  return (
    <AdminPageShell
      title="资源授权"
      description="按角色绑定数据源、Dashboard 或报表资源的访问授权。"
      actions={
        <Button type="button" variant="primary" onClick={() => setDialogOpen(true)}>
          新建授权
        </Button>
      }
    >
      {/* FilterBar: SearchField + Select 角色 + Select 资源类型 */}
      {/* Card > Table aria-label="资源授权列表" */}
      {/* columns: 角色名称 | 资源类型 Badge | 资源 ID font-mono | 撤销 Button outline sm aria-label="撤销授权" */}
      {/* loading: 5x Skeleton rows; empty: PanelEmptyState title="暂无资源授权" */}
      {/* Dialog 新建 + AlertDialog 撤销 */}
    </AdminPageShell>
  );
}
```

- [ ] **Step 2: 实现 create mutation**

```typescript
const createMutation = useMutation({
  mutationFn: (body: GrantCreateValues) =>
    apiFetch<ResourceGrantOut>("/api/v1/resource-grants", {
      method: "POST",
      body: JSON.stringify({
        role_id: body.roleId,
        resource_type: body.resourceType,
        resource_id: body.resourceId,
      }),
    }),
  onSuccess: () => {
    toast.success("授权创建成功");
    setDialogOpen(false);
    setForm(EMPTY_GRANT_CREATE);
    setFormErrors({});
    void queryClient.invalidateQueries({ queryKey: queryKeys.resourceGrants.all });
  },
  onError: (err) => setActionError(mapGrantError(err)),
});
```

表单提交：`grantCreateSchema.safeParse(form)` → 字段级 `formErrors`；提交中 `createMutation.isPending` 禁用按钮。

- [ ] **Step 3: 实现 delete mutation**

```typescript
const deleteMutation = useMutation({
  mutationFn: (grantId: string) =>
    apiFetch<void>(`/api/v1/resource-grants/${grantId}`, { method: "DELETE" }),
  onSuccess: () => {
    toast.success("授权已撤销");
    setDeleteTarget(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.resourceGrants.all });
  },
  onError: (err) => setActionError(mapGrantError(err)),
});
```

- [ ] **Step 4: 验证类型与体量**

Run: `wc -l fe/src/pages/admin/system/grants/GrantsPage.tsx`
Expected: ≤ 300 行；超出则拆 `useGrantForm` 到同目录

Run: `cd fe && pnpm run check:design`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fe/src/pages/admin/system/grants/GrantsPage.tsx
git commit -m "feat: add resource grants admin page with create and revoke"
```

---

### Task 6: `grants.smoke.test.tsx` — AUTH-004 FE 验收

**Files:**
- Create: `fe/src/pages/admin/system/grants/grants.smoke.test.tsx`

**Interfaces:**
- Consumes: `GrantsPage`, mock `apiFetch` 同 `roles.smoke.test.tsx` 模式

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- smoke 覆盖列表渲染、Dialog 校验、POST 刷新、DELETE 确认
- mock 数据含中文资源类型标签

- [ ] **Step 1: 创建 smoke 文件**

```typescript
// fe/src/pages/admin/system/grants/grants.smoke.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { GrantsPage } from "./GrantsPage";

const ROLE_ID = "11111111-1111-4111-8111-111111111111";
const RES_ID = "22222222-2222-4222-8222-222222222222";
const GRANT_ID = "33333333-3333-4333-8333-333333333333";

function renderGrants() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/system/grants"]}>
        <Routes>
          <Route path="/admin/system/grants" element={<GrantsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GrantsPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-004-FE-01: renders table with role name, resource type, resource id", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return {
          items: [{ id: GRANT_ID, roleId: ROLE_ID, resourceType: "dashboard", resourceId: RES_ID }],
        };
      }
      return {};
    });
    renderGrants();
    expect(await screen.findByRole("table", { name: "资源授权列表" })).toBeInTheDocument();
    expect(await screen.findByText("分析师")).toBeInTheDocument();
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(await screen.findByText(RES_ID)).toBeInTheDocument();
  });

  it("T-AUTH-004-FE-02: create dialog shows field errors on empty submit", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "新建授权" }));
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(await screen.findByText("请选择角色")).toBeInTheDocument();
  });

  it("T-AUTH-004-FE-03: POST success closes dialog and refreshes list", async () => {
    let listCalls = 0;
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/resource-grants" && init?.method === "POST") {
        return { id: GRANT_ID, roleId: ROLE_ID, resourceType: "report", resourceId: RES_ID };
      }
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        listCalls += 1;
        if (listCalls === 1) return { items: [] };
        return { items: [{ id: GRANT_ID, roleId: ROLE_ID, resourceType: "report", resourceId: RES_ID }] };
      }
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "新建授权" }));
    // 选择角色、资源类型、填写 resourceId 后点确认 — implementer 按 GrantsPage Select/Input label 补全
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("报表")).toBeInTheDocument();
  });

  it("T-AUTH-004-FE-04: revoke AlertDialog calls DELETE", async () => {
    const deletePaths: string[] = [];
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") deletePaths.push(path);
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return { items: [{ id: GRANT_ID, roleId: ROLE_ID, resourceType: "datasource", resourceId: RES_ID }] };
      }
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "撤销授权" }));
    await userEvent.click(screen.getByRole("button", { name: "确认撤销" }));
    await waitFor(() =>
      expect(deletePaths.some((p) => p.includes(GRANT_ID))).toBe(true),
    );
  });
});
```

- [ ] **Step 2: 运行 smoke**

Run: `cd fe && pnpm vitest run fe/src/pages/admin/system/grants/grants.smoke.test.tsx`
Expected: 4/4 PASS

- [ ] **Step 3: Commit**

```bash
git add fe/src/pages/admin/system/grants/grants.smoke.test.tsx
git commit -m "test: add resource grants page smoke tests AUTH-004"
```

---

### Task 7: 路由注册 + AdminLayout useMemo + 集成接线

**Files:**
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/layouts/AdminLayout.tsx`

**Interfaces:**
- Produces: `/admin/system/grants` 路由可达，`RequirePlatformAdmin` 包裹 `GrantsPage`
- Consumes: `GrantsPage` from Task 5

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 路由与侧栏 manifest path 一致；`useMemo` 避免多余 nav re-render

- [ ] **Step 1: routes.tsx 注册路由**

```tsx
// import 顶部追加
import { GrantsPage } from "@/pages/admin/system/grants/GrantsPage";

// 在 system/audit 之后追加
<Route
  path="system/grants"
  element={
    <RequirePlatformAdmin>
      <GrantsPage />
    </RequirePlatformAdmin>
  }
/>
```

- [ ] **Step 2: AdminLayout.tsx 增加 useMemo**

```typescript
import { useMemo } from "react";

// 替换：
// const navSections = resolveNavGroups(sessionUser);
const navSections = useMemo(
  () => resolveNavGroups(sessionUser),
  [sessionUser],
);
```

- [ ] **Step 3: 验证（AdminHomePage / DashboardListPage 无需改 import — session 已委托）**

Run: `cd fe && pnpm exec tsc -b --pretty false 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add fe/src/routes.tsx fe/src/layouts/AdminLayout.tsx
git commit -m "feat: register grants route and memoize nav resolution"
```

---

### Task 8: 集成 smoke + `layout.md` 文档同步

**Files:**
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`
- Modify: `fe/src/routes.smoke.test.tsx`
- Modify: `docs/ui/layout.md`

**Interfaces:**
- Produces: T-FE-SMFB-01~03、T-RT-GRANTS-01；layout.md §3 资源授权行

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- admin 侧栏含 grants 链接；viewer 不含「资源授权」文本；报表 subItems 不退化
- grants 路由渲染 h1「资源授权」；死链检测覆盖 grants href

- [ ] **Step 1: AdminLayout.smoke — T-FE-SMFB-01~03**

```typescript
it("T-FE-SMFB-01: admin sidebar 系统 group has 资源授权 link", () => {
  setDesktopViewport(1400);
  render(/* AdminLayout @ /admin */);
  const link = screen.getByRole("link", { name: "资源授权" });
  expect(link).toHaveAttribute("href", "/admin/system/grants");
});

it("T-FE-SMFB-02: viewer sidebar has no 资源授权 text", () => {
  mockUseAuth.mockReturnValueOnce({
    user: { id: "2", username: "viewer", roles: ["viewer"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  } as ReturnType<typeof mockUseAuth>);
  setDesktopViewport(1400);
  render(/* AdminLayout */);
  expect(screen.queryByText("资源授权")).not.toBeInTheDocument();
});

it("T-FE-SMFB-03: admin still has 报表 subItems (no regression T-FE-SMFA-01)", async () => {
  setDesktopViewport(1400);
  const user = userEvent.setup();
  render(/* AdminLayout */);
  await user.click(screen.getByRole("button", { name: "报表" }));
  expect(screen.getByRole("link", { name: "预制报表" })).toBeInTheDocument();
});
```

- [ ] **Step 2: routes.smoke — T-RT-GRANTS-01**

```typescript
it("T-RT-GRANTS-01: /admin/system/grants route renders 资源授权 heading", async () => {
  setDesktopViewport();
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
    if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
    return {};
  });
  renderRoutes(["/admin/system/grants"]);
  expect(
    await screen.findByRole("heading", { level: 1, name: "资源授权" }),
  ).toBeInTheDocument();
});
```

在 `T-RT-DL-01` 死链循环前，可选断言系统区存在 grants 链接（manifest 已含则自动覆盖）。

- [ ] **Step 3: 更新 docs/ui/layout.md §3**

路由树「系统」下增加：

```
├── /system/grants               # 资源授权 · table-list + dialog form
```

侧栏分组表「系统」行更新为：

> 角色/用户/组织/行级权限/审计日志/资源授权 | `system:*` | M1 | admin

注明 nav 真理源仍为 `nav-manifest.tsx`。

- [ ] **Step 4: 全量 FE 验证**

Run: `cd fe && pnpm run check:design && pnpm vitest run && pnpm run build`
Expected: check:design PASS；vitest 全绿；build exit 0

- [ ] **Step 5: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx fe/src/routes.smoke.test.tsx docs/ui/layout.md
git commit -m "test: add F-B capability nav and grants route smoke; sync layout.md"
```

---

## Self-Review Checklist

| design 子项 | 对应 Task |
|-------------|-----------|
| AUTH-004 列表页 | Task 4–6, 7–8 |
| AUTH-004 绑定/撤销表单 | Task 5–6 |
| BOOT-002 capability 过滤 | Task 1–3 |
| BOOT-002 grants smoke | Task 7–8 |

- [x] 16 文件均在范围框定内
- [x] 无 TBD/TODO/「适当处理」占位
- [x] 每 Task 含验证命令
- [x] UI Task 含 Skills + UI Acceptance
- [x] 预估总文件数 16 ≤ round-target 上限 20

---

**Plan complete.** 执行模式固定为 **subagent-driven-development (option 1)**：P3 按 Task 1→8 顺序派发独立 subagent，每 Task 完成后 spec + quality 两阶段自审，再进入下一 Task。
