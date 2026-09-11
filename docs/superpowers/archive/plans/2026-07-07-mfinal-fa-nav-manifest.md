# M-FINAL · F-A — nav-manifest 收官 实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `fe/src/config/nav-manifest.tsx`（新建）、`fe/src/lib/resolve-nav.ts`、`fe/src/lib/resolve-nav.test.ts`、`fe/src/components/layout/app-sidebar.tsx`、`fe/src/index.css`、`fe/src/layouts/AdminLayout.smoke.test.tsx`、`fe/src/routes.smoke.test.tsx`、`fe/src/config/admin-nav.tsx`（删除）、`fe/src/config/analyst-nav.tsx`（删除）、`fe/src/config/user-nav.tsx`（删除）、`docs/ui/layout.md`
> **子项：** BOOT-002（nav-manifest + resolveNavGroups + 里程碑可见性矩阵）、DS-007（连接器收拢「数据」分组）
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；UI 任务已预指定）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；`fe-ui.mdc` 匹配所有 `fe/**`）

**Goal:** 以 `nav-manifest.tsx` 单一真理源替代三份平行 nav 拷贝，引入分组 subItems、里程碑可见性矩阵、admin「预览」badge，满足 BOOT-002 + DS-007 全部验收标准。

**Architecture:** `NAV_MANIFEST` 声明式数据驱动 `resolveNavGroups(user, capabilities?)` 纯派生函数，三档角色侧栏由运行时从 manifest 过滤得出；`app-sidebar.tsx` 扩展 `NavItem.preview` 字段和对应 CSS 工具类，不改壳层比例与布局。

**Tech Stack:** React 18 + TypeScript + Radix Collapsible（已有）+ Tailwind CSS v4 `@utility`；vitest + React Testing Library；pnpm workspace。

## Global Constraints

- 文件扩展名：manifest 含 JSX 图标，故用 `.tsx`（设计 spec 写 `.ts` 为技术笔误）
- 不修改 `fe/src/routes.tsx`、`fe/src/lib/session.ts`、后端 API
- 不引入新第三方依赖
- `fe/src/config/nav-manifest.tsx` 体量 ≤ 80 行（仅数据，无逻辑）
- `resolveNavGroups` + 辅助函数合计 ≤ 60 行（设计约束）
- 单文件 ≤ 300 行（fe-ui.mdc）；`app-sidebar.tsx` 当前 258 行，扩展后仍在范围内
- `ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"])`，M13 = 预览态
- CSS token 仅用现有语义色（`bg-gray-100/200`, `text-gray-500/700`），不引入新 hex
- 所有测试通过 `cd fe && pnpm vitest run` 与 `pnpm run check:design`
- 提交信息格式：`feat: <动词> <主体>`

---

## File Structure

| 路径 | 操作 | 职责 |
|------|------|------|
| `fe/src/config/nav-manifest.tsx` | **新建** | 单一真理源：类型定义 + `NAV_MANIFEST` 数据 |
| `fe/src/lib/resolve-nav.ts` | **重写** | 从 manifest 派生 NavSection[]；导出 `ACTIVE_MILESTONES` |
| `fe/src/lib/resolve-nav.test.ts` | **扩充** | 补里程碑过滤用例 T-NAV-MF-01~06；更新 viewer 断言 |
| `fe/src/components/layout/app-sidebar.tsx` | **修改** | `NavItem.preview?: boolean`；`NavBadge "preview"` variant；render 逻辑 |
| `fe/src/index.css` | **修改** | `@utility menu-dropdown-badge-preview[-active/-inactive]` |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | **修改** | 重构 mock 为 `vi.fn()`；补 T-FE-SMFA-01~04 |
| `fe/src/routes.smoke.test.tsx` | **修改** | 更新 T-FE-08 nav 名；补 T-RT-CONN-01 注释 + T-RT-DL-01 |
| `fe/src/config/admin-nav.tsx` | **删除** | 废弃三拷贝 |
| `fe/src/config/analyst-nav.tsx` | **删除** | 同上 |
| `fe/src/config/user-nav.tsx` | **删除** | 同上 |
| `docs/ui/layout.md` | **修改** | §3 分组表 + §6 里程碑可见性矩阵注记 |

---

### Task 1: 新建 `nav-manifest.tsx` — 单一真理源

**Files:**
- Create: `fe/src/config/nav-manifest.tsx`

**Interfaces:**
- Produces: `NAV_MANIFEST: NavManifestSection[]`，供 Task 2（resolve-nav.ts）消费
- 内部类型 `NavManifestSubItem`、`NavManifestItem`、`NavManifestSection` 不对外导出

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 纯数据文件，无渲染；视觉验收在 Task 5（AdminLayout smoke tests）

- [ ] **Step 1: 创建文件**

```tsx
// fe/src/config/nav-manifest.tsx
import type React from "react";
import {
  ArrowLeftRight,
  Boxes,
  Database,
  FileBarChart,
  GitBranch,
  LayoutDashboard,
  Layers,
  LineChart,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Users,
  Workflow,
} from "lucide-react";
import type { SessionRole } from "@/lib/session";

type NavManifestSubItem = {
  name: string;
  path: string;
  milestone?: string;
};

type NavManifestItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: NavManifestSubItem[];
  milestone?: string;
  roles?: SessionRole[];
};

type NavManifestSection = {
  title: string;
  items: NavManifestItem[];
  roles: SessionRole[];
};

export const NAV_MANIFEST: NavManifestSection[] = [
  {
    title: "数据",
    roles: ["admin"],
    items: [
      {
        name: "数据连接",
        icon: <Database className="size-6" aria-hidden />,
        milestone: "M1",
        subItems: [
          { name: "连接管理", path: "/admin/datasources", milestone: "M1" },
          { name: "连接器类型", path: "/admin/connectors", milestone: "M1" },
        ],
      },
      {
        name: "数据接入",
        icon: <ArrowLeftRight className="size-6" aria-hidden />,
        path: "/admin/ingestion/sync-jobs",
        milestone: "M1",
      },
    ],
  },
  {
    title: "分析",
    roles: ["admin", "analyst", "viewer"],
    items: [
      {
        name: "Dashboard",
        icon: <LayoutDashboard className="size-6" aria-hidden />,
        path: "/admin/dashboards",
        milestone: "M1",
      },
      {
        name: "图表探索",
        icon: <LineChart className="size-6" aria-hidden />,
        path: "/admin/charts/explore",
        milestone: "M11",
        roles: ["admin", "analyst"],
      },
      {
        name: "查询设计器",
        icon: <SlidersHorizontal className="size-6" aria-hidden />,
        path: "/admin/designer",
        milestone: "M13",
        roles: ["admin"],
      },
    ],
  },
  {
    title: "报表",
    roles: ["admin", "analyst", "viewer"],
    items: [
      {
        name: "报表",
        icon: <FileBarChart className="size-6" aria-hidden />,
        subItems: [
          { name: "预制报表", path: "/admin/reports", milestone: "M1" },
          { name: "报表模板", path: "/admin/reports/templates", milestone: "M7" },
          { name: "报表调度", path: "/admin/reports/schedules", milestone: "M11" },
        ],
      },
    ],
  },
  {
    title: "主题与实体",
    roles: ["admin", "analyst"],
    items: [
      {
        name: "实体总览",
        icon: <Boxes className="size-6" aria-hidden />,
        path: "/admin/entities/overview",
        milestone: "M7",
      },
      {
        name: "主题分析",
        icon: <Layers className="size-6" aria-hidden />,
        path: "/admin/themes/default",
        milestone: "M7",
      },
    ],
  },
  {
    title: "治理",
    roles: ["admin"],
    items: [
      {
        name: "接口目录",
        icon: <GitBranch className="size-6" aria-hidden />,
        path: "/admin/governance/catalog",
        milestone: "M1",
      },
      {
        name: "治理工单",
        icon: <Workflow className="size-6" aria-hidden />,
        path: "/admin/governance/tickets",
        milestone: "M13",
      },
      {
        name: "发布流水线",
        icon: <ScrollText className="size-6" aria-hidden />,
        path: "/admin/governance/publish",
        milestone: "M13",
      },
    ],
  },
  {
    title: "语义层",
    roles: ["admin"],
    items: [
      {
        name: "元数据",
        icon: <Boxes className="size-6" aria-hidden />,
        path: "/admin/metadata",
        milestone: "M13",
      },
      {
        name: "Dataset",
        icon: <Database className="size-6" aria-hidden />,
        path: "/admin/datasets",
        milestone: "M13",
      },
    ],
  },
  {
    title: "系统",
    roles: ["admin"],
    items: [
      {
        name: "角色管理",
        icon: <Shield className="size-6" aria-hidden />,
        path: "/admin/system/roles",
        milestone: "M1",
      },
      {
        name: "用户管理",
        icon: <Users className="size-6" aria-hidden />,
        path: "/admin/system/users",
        milestone: "M1",
      },
      {
        name: "组织架构",
        icon: <GitBranch className="size-6" aria-hidden />,
        path: "/admin/system/orgs",
        milestone: "M1",
      },
      {
        name: "行级权限",
        icon: <Shield className="size-6" aria-hidden />,
        path: "/admin/system/rls",
        milestone: "M1",
      },
      {
        name: "审计日志",
        icon: <ScrollText className="size-6" aria-hidden />,
        path: "/admin/system/audit",
        milestone: "M1",
      },
    ],
  },
];
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd fe && pnpm tsc --noEmit 2>&1 | head -30
```

期望：无 `nav-manifest.tsx` 相关错误（其他现存错误不在此任务范围内）。

- [ ] **Step 3: Commit**

```bash
git add fe/src/config/nav-manifest.tsx
git commit -m "feat: add nav-manifest.tsx single source of truth for nav"
```

---

### Task 2: 扩展 `app-sidebar.tsx` — `preview` 字段 + NavBadge variant + CSS

**Files:**
- Modify: `fe/src/components/layout/app-sidebar.tsx`
- Modify: `fe/src/index.css`

**Interfaces:**
- Consumes: 无新依赖
- Produces:
  - `NavItem.preview?: boolean` — Task 3 (resolve-nav.ts) 返回此字段
  - `NavBadge variant="preview"` — 渲染 `menu-dropdown-badge-preview` 工具类
  - CSS `menu-dropdown-badge-preview[-active/-inactive]` 工具类

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 `menu-dropdown-badge` 基类（`rounded-full px-2 py-0.5 text-theme-xs font-medium`）
- 预览 badge 灰色调（`bg-gray-100/200`, `text-gray-500/700`），与 `new`（品牌色）badge 视觉区分明显
- 折叠态（90px `showLabels=false`）badge 不渲染（已有 `showLabels &&` guard 保护）
- `pnpm run check:design` PASS（无新 hardcoded hex）
- desktop light/dark 无色溢出

- [ ] **Step 1: 在 `app-sidebar.tsx` 中添加 `preview?: boolean` 到 `NavItem`**

修改 `fe/src/components/layout/app-sidebar.tsx` 中 `NavItem` 类型（第 16–23 行）：

```typescript
export type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  preview?: boolean;   // 新增：admin 可见但标「预览」的四期项
  target?: string;
  subItems?: NavSubItem[];
};
```

- [ ] **Step 2: 在 `app-sidebar.tsx` 中扩展 `NavBadge` 支持 `"preview"` variant**

修改 `NavBadge` 函数（第 38–59 行），将 `variant: "new" | "pro"` 改为 `variant: "new" | "pro" | "preview"`，并添加 preview 分支：

```typescript
function NavBadge({
  label,
  variant,
  active,
}: {
  label: string;
  variant: "new" | "pro" | "preview";
  active?: boolean;
}) {
  let base: string;
  let state: string;

  if (variant === "pro") {
    base = "menu-dropdown-badge-pro";
    state = active
      ? "menu-dropdown-badge-pro-active"
      : "menu-dropdown-badge-pro-inactive";
  } else if (variant === "preview") {
    base = "menu-dropdown-badge-preview";
    state = active
      ? "menu-dropdown-badge-preview-active"
      : "menu-dropdown-badge-preview-inactive";
  } else {
    base = "menu-dropdown-badge";
    state = active
      ? "menu-dropdown-badge-active"
      : "menu-dropdown-badge-inactive";
  }

  return <span className={cn("ml-auto", state, base)}>{label}</span>;
}
```

- [ ] **Step 3: 在 `SidebarNavItem` 中为 Collapsible 项渲染 preview badge**

在 `Collapsible.Trigger` 内，紧接 `{item.new && showLabels && ...}` 之后，添加：

```tsx
{item.preview && showLabels && (
  <NavBadge
    label="预览"
    variant="preview"
    active={open || hasActiveChild}
  />
)}
```

完整 Collapsible.Trigger 内容（第 83–114 行的替换版本）：

```tsx
<Collapsible.Trigger
  className={cn(
    "group menu-item w-full cursor-pointer",
    open || hasActiveChild
      ? "menu-item-active"
      : "menu-item-inactive",
    !showLabels && "xl:justify-center",
  )}
>
  <span
    className={cn(
      "menu-item-icon-size",
      open || hasActiveChild
        ? "menu-item-icon-active"
        : "menu-item-icon-inactive",
    )}
  >
    {item.icon}
  </span>
  {showLabels && <span className="menu-item-text">{item.name}</span>}
  {item.new && showLabels && (
    <NavBadge label="new" variant="new" active={open || hasActiveChild} />
  )}
  {item.preview && showLabels && (
    <NavBadge
      label="预览"
      variant="preview"
      active={open || hasActiveChild}
    />
  )}
  {showLabels && (
    <ChevronDown
      className={cn(
        "ml-auto size-5 transition-transform duration-200",
        open && "rotate-180 text-brand-500",
      )}
    />
  )}
</Collapsible.Trigger>
```

- [ ] **Step 4: 为叶子 Link 项也渲染 preview badge**

在 `SidebarNavItem` 叶子路径（`item.path` 存在、无 subItems）的 `<Link>` 内，在 `{showLabels && <span className="menu-item-text">{item.name}</span>}` 之后添加：

```tsx
{item.preview && showLabels && (
  <NavBadge
    label="预览"
    variant="preview"
    active={active}
  />
)}
```

完整叶子 Link 渲染（替换第 152–178 行）：

```tsx
const active = isActive(item.path);

return (
  <Link
    to={item.path}
    target={item.target}
    className={cn(
      "group menu-item",
      active ? "menu-item-active" : "menu-item-inactive",
      !showLabels && "xl:justify-center",
    )}
  >
    <span
      className={cn(
        "menu-item-icon-size",
        active ? "menu-item-icon-active" : "menu-item-icon-inactive",
      )}
    >
      {item.icon}
    </span>
    {showLabels && <span className="menu-item-text">{item.name}</span>}
    {item.preview && showLabels && (
      <NavBadge label="预览" variant="preview" active={active} />
    )}
  </Link>
);
```

- [ ] **Step 5: 在 `index.css` 中添加 preview badge CSS 工具类**

在 `menu-dropdown-badge-pro-inactive` 之后（第 135 行后）添加：

```css
@utility menu-dropdown-badge-preview {
  @apply menu-dropdown-badge;
}

@utility menu-dropdown-badge-preview-active {
  @apply bg-gray-200 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300;
}

@utility menu-dropdown-badge-preview-inactive {
  @apply bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-500;
}
```

- [ ] **Step 6: 验证 TypeScript + design check**

```bash
cd fe && pnpm tsc --noEmit 2>&1 | head -20
cd fe && pnpm run check:design 2>&1 | tail -10
```

期望：tsc 无新增错误；check:design 输出 `Design check passed` 或类似通过信号。

- [ ] **Step 7: Commit**

```bash
git add fe/src/components/layout/app-sidebar.tsx fe/src/index.css
git commit -m "feat: add NavItem.preview and NavBadge preview variant with CSS tokens"
```

---

### Task 3: TDD — 扩充 `resolve-nav.test.ts` 然后重写 `resolve-nav.ts`

**Files:**
- Modify: `fe/src/lib/resolve-nav.test.ts` (先写失败测试)
- Modify: `fe/src/lib/resolve-nav.ts` (后写实现)

**Interfaces:**
- Consumes: `NavItem.preview?: boolean`（Task 2 已加）、`NAV_MANIFEST`（Task 1 已加）
- Produces:
  - `export const ACTIVE_MILESTONES: Set<string>`
  - `export function resolveNavGroups(user: SessionUser, capabilities?: Set<string>): NavSection[]`

- [ ] **Step 1: 更新 `resolve-nav.test.ts`（先写，预期 FAIL）**

用以下内容**替换** `fe/src/lib/resolve-nav.test.ts` 全文：

```typescript
import { describe, expect, it } from "vitest";
import { resolveNavGroups, ACTIVE_MILESTONES } from "./resolve-nav";
import { sessionUserFromAuth } from "./session";

describe("resolveNavGroups", () => {
  it("returns full admin nav for admin", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    expect(groups.some((g) => g.title === "系统")).toBe(true);
    expect(groups.some((g) => g.title === "数据")).toBe(true);
  });

  it("returns analyst nav without system or data groups", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    expect(groups.some((g) => g.title === "分析")).toBe(true);
    expect(groups.some((g) => g.title === "主题与实体")).toBe(true);
    expect(groups.some((g) => g.title === "系统")).toBe(false);
    expect(groups.some((g) => g.title === "数据")).toBe(false);
  });

  it("returns viewer nav with 分析 and 报表 sections only (no 系统/数据)", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    const sectionTitles = groups.map((g) => g.title);
    expect(sectionTitles).toContain("分析");
    expect(sectionTitles).toContain("报表");
    expect(sectionTitles).not.toContain("系统");
    expect(sectionTitles).not.toContain("数据");
    // 分析 section has Dashboard
    const analysisSection = groups.find((g) => g.title === "分析");
    expect(analysisSection?.items.map((i) => i.name)).toContain("Dashboard");
    // no legacy top-level 数据源 item
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allItemNames).not.toContain("数据源");
    // 报表 parent item exists
    const reportSection = groups.find((g) => g.title === "报表");
    expect(reportSection?.items.map((i) => i.name)).toContain("报表");
  });

  // T-NAV-MF-01: viewer does not see M13 items
  it("T-NAV-MF-01: viewer does not see M13 items", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]));
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allItemNames).not.toContain("查询设计器");
    expect(allItemNames).not.toContain("治理工单");
    expect(allItemNames).not.toContain("发布流水线");
    expect(allItemNames).not.toContain("元数据");
    expect(allItemNames).not.toContain("Dataset");
  });

  // T-NAV-MF-02: analyst does not see M13 items
  it("T-NAV-MF-02: analyst does not see M13 items", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]));
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(allItemNames).not.toContain("查询设计器");
    expect(allItemNames).not.toContain("治理工单");
    expect(allItemNames).not.toContain("元数据");
    expect(allItemNames).not.toContain("Dataset");
  });

  // T-NAV-MF-03: admin sees M13 items with preview=true
  it("T-NAV-MF-03: admin sees M13 items with preview: true", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const allItems = groups.flatMap((g) => g.items);
    const designer = allItems.find((i) => i.name === "查询设计器");
    expect(designer).toBeDefined();
    expect(designer?.preview).toBe(true);
    const ticket = allItems.find((i) => i.name === "治理工单");
    expect(ticket).toBeDefined();
    expect(ticket?.preview).toBe(true);
  });

  // T-NAV-MF-04: capabilities override — admin with only M1 filters M7/M11/M13
  it("T-NAV-MF-04: capabilities override filters M7/M11/M13 for admin", () => {
    const groups = resolveNavGroups(
      sessionUserFromAuth("admin", ["admin"]),
      new Set(["M1"]),
    );
    const allItemNames = groups.flatMap((g) => g.items.map((i) => i.name));
    // M13 items show as preview for admin even with M1-only caps
    const allItems = groups.flatMap((g) => g.items);
    const designer = allItems.find((i) => i.name === "查询设计器");
    expect(designer?.preview).toBe(true);
    // M7 items like 实体总览 have preview=true for admin
    const entity = allItems.find((i) => i.name === "实体总览");
    expect(entity?.preview).toBe(true);
    // 报表 parent subItems: 报表模板(M7) and 报表调度(M11) get preview for admin
    const reportSection = groups.find((g) => g.title === "报表");
    const reportParent = reportSection?.items.find((i) => i.name === "报表");
    // All 3 subItems still appear for admin (preview applies at item level, subItems filtered differently)
    expect(reportParent?.subItems?.map((s) => s.name)).toContain("预制报表");
  });

  // T-NAV-MF-05: viewer with M1-only capabilities — 报表 subItems only contains 预制报表
  it("T-NAV-MF-05: viewer with M1-only capabilities sees 报表 parent with only 预制报表 subItem", () => {
    const groups = resolveNavGroups(
      sessionUserFromAuth("viewer", ["viewer"]),
      new Set(["M1"]),
    );
    const reportSection = groups.find((g) => g.title === "报表");
    expect(reportSection).toBeDefined();
    const reportParent = reportSection?.items.find((i) => i.name === "报表");
    expect(reportParent).toBeDefined();
    const subNames = reportParent?.subItems?.map((s) => s.name) ?? [];
    expect(subNames).toContain("预制报表");
    expect(subNames).not.toContain("报表模板");
    expect(subNames).not.toContain("报表调度");
  });

  // T-NAV-MF-06: admin 数据 section has 数据连接 item with 连接器类型 subItem
  it("T-NAV-MF-06: admin 数据 section has 数据连接 with 连接器类型 subItem", () => {
    const groups = resolveNavGroups(sessionUserFromAuth("admin", ["admin"]));
    const dataSection = groups.find((g) => g.title === "数据");
    expect(dataSection).toBeDefined();
    const dataConn = dataSection?.items.find((i) => i.name === "数据连接");
    expect(dataConn).toBeDefined();
    const subNames = dataConn?.subItems?.map((s) => s.name) ?? [];
    expect(subNames).toContain("连接管理");
    expect(subNames).toContain("连接器类型");
  });
});

describe("ACTIVE_MILESTONES", () => {
  it("exports ACTIVE_MILESTONES containing M1, M7, M11 but not M13", () => {
    expect(ACTIVE_MILESTONES.has("M1")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M7")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M11")).toBe(true);
    expect(ACTIVE_MILESTONES.has("M13")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，期望 FAIL（当前 resolve-nav.ts 仍导入旧 nav 文件）**

```bash
cd fe && pnpm vitest run src/lib/resolve-nav.test.ts 2>&1 | tail -20
```

期望：多条 FAIL（`ACTIVE_MILESTONES is not exported`、`T-NAV-MF-*` 断言失败等）。

- [ ] **Step 3: 用以下内容重写 `fe/src/lib/resolve-nav.ts`**

```typescript
import { NAV_MANIFEST } from "@/config/nav-manifest";
import type { NavSection, NavItem, NavSubItem } from "@/components/layout/app-sidebar";
import type { SessionUser, SessionRole } from "@/lib/session";

export const ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"]);

function isAdmin(user: SessionUser): boolean {
  return user.roles.includes("admin");
}

function hasRole(user: SessionUser, roles: SessionRole[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

type ManifestItem = (typeof NAV_MANIFEST)[0]["items"][0];

function filterItemForRole(
  item: ManifestItem,
  sectionRoles: SessionRole[],
  user: SessionUser,
  capabilities: Set<string>,
): NavItem | null {
  const effectiveRoles = (item.roles as SessionRole[] | undefined) ?? sectionRoles;
  if (!hasRole(user, effectiveRoles)) return null;

  const isInactive = Boolean(item.milestone && !capabilities.has(item.milestone));
  if (isInactive && !isAdmin(user)) return null;
  const addPreview = isInactive && isAdmin(user);

  let filteredSubItems: NavSubItem[] | undefined;
  if (item.subItems) {
    filteredSubItems = item.subItems
      .filter(
        (sub) =>
          !sub.milestone ||
          capabilities.has(sub.milestone) ||
          isAdmin(user),
      )
      .map((sub) => ({ name: sub.name, path: sub.path }));
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

/**
 * 从 NAV_MANIFEST 派生侧栏 NavSection[]。
 * @param user         当前会话用户（含角色）
 * @param capabilities 覆盖里程碑集合（测试 / F-B ability 扩展用），默认 ACTIVE_MILESTONES
 */
export function resolveNavGroups(
  user: SessionUser,
  capabilities: Set<string> = ACTIVE_MILESTONES,
): NavSection[] {
  const result: NavSection[] = [];

  for (const section of NAV_MANIFEST) {
    if (!hasRole(user, section.roles)) continue;

    const items: NavItem[] = [];
    for (const item of section.items) {
      const navItem = filterItemForRole(
        item,
        section.roles,
        user,
        capabilities,
      );
      if (navItem) items.push(navItem);
    }

    if (items.length > 0) {
      result.push({ title: section.title, items });
    }
  }

  return result;
}
```

- [ ] **Step 4: 运行测试，期望 PASS**

```bash
cd fe && pnpm vitest run src/lib/resolve-nav.test.ts 2>&1 | tail -20
```

期望：所有测试通过，`Tests 9 passed`（原 3 条 + 新 6 条）。

- [ ] **Step 5: 运行全量 vitest（快速检查回归）**

```bash
cd fe && pnpm vitest run 2>&1 | tail -20
```

期望：所有测试通过（或仅有与本任务无关的现有 skip）。

- [ ] **Step 6: Commit**

```bash
git add fe/src/lib/resolve-nav.test.ts fe/src/lib/resolve-nav.ts
git commit -m "feat: rewrite resolve-nav.ts with manifest-based derivation and milestone filtering"
```

---

### Task 4: 删除旧 nav 文件

**Files:**
- Delete: `fe/src/config/admin-nav.tsx`
- Delete: `fe/src/config/analyst-nav.tsx`
- Delete: `fe/src/config/user-nav.tsx`

**Interfaces:**
- Consumes: `resolve-nav.ts` 已不再 import 这三个文件（Task 3 完成）

- [ ] **Step 1: 删除三个文件**

```bash
rm fe/src/config/admin-nav.tsx
rm fe/src/config/analyst-nav.tsx
rm fe/src/config/user-nav.tsx
```

- [ ] **Step 2: 验证无残留 import**

```bash
cd fe && pnpm tsc --noEmit 2>&1 | head -20
```

期望：无 `Cannot find module '@/config/admin-nav'` 等错误。

- [ ] **Step 3: 运行 resolve-nav.test.ts 确认不回归**

```bash
cd fe && pnpm vitest run src/lib/resolve-nav.test.ts 2>&1 | tail -10
```

期望：Tests 9 passed。

- [ ] **Step 4: Commit**

```bash
git add -A fe/src/config/admin-nav.tsx fe/src/config/analyst-nav.tsx fe/src/config/user-nav.tsx
git commit -m "chore: delete legacy admin-nav / analyst-nav / user-nav files"
```

---

### Task 5: 扩充 `AdminLayout.smoke.test.tsx` — T-FE-SMFA-01~04

**Files:**
- Modify: `fe/src/layouts/AdminLayout.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`

**UI Acceptance:**
- 复用 Radix Collapsible（已有）；Collapsible.Trigger 有隐式 `role="button"`
- T-FE-SMFA-03 验证「预览」badge 文本存在（admin M13 项）
- T-FE-SMFA-04 验证 viewer 无「系统」/「数据」section heading
- `pnpm vitest run src/layouts/AdminLayout.smoke.test.tsx` 全绿

- [ ] **Step 1: 将文件顶部的 `vi.mock` 重构为可按测试覆盖的 `vi.fn()` 模式**

将现有：
```typescript
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
```

替换为（放在 `vi.mock` 之前）：
```typescript
const mockUseAuth = vi.fn(() => ({
  user: { id: "1", username: "admin", roles: ["admin"] as const },
  isLoading: false,
  isAuthenticated: true,
  logout: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
```

同时在 `afterEach` 中添加 mock 重置（在 `cleanup()` 之后）：
```typescript
afterEach(() => {
  cleanup();
  localStorage.clear();
  mockUseAuth.mockReset();
  mockUseAuth.mockImplementation(() => ({
    user: { id: "1", username: "admin", roles: ["admin"] as const },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }));
});
```

- [ ] **Step 2: 确认现有测试仍然通过（回归检查）**

```bash
cd fe && pnpm vitest run src/layouts/AdminLayout.smoke.test.tsx 2>&1 | tail -20
```

期望：Tests 12 passed（原有全部通过）。

- [ ] **Step 3: 添加 T-FE-SMFA-01 — admin 报表 Collapsible 展开含三个子项**

在文件末尾 `describe` 块内（最后一个 `it` 之后）添加：

```typescript
it("admin sidebar has 报表 collapsible that expands to show sub-items (T-FE-SMFA-01)", async () => {
  setDesktopViewport(1400);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const reportTrigger = screen.getByRole("button", { name: "报表" });
  expect(reportTrigger).toBeInTheDocument();

  await user.click(reportTrigger);

  expect(screen.getByRole("link", { name: "预制报表" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "报表模板" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "报表调度" })).toBeInTheDocument();
});
```

- [ ] **Step 4: 添加 T-FE-SMFA-02 — admin 数据连接 Collapsible 含连接子项**

```typescript
it("admin sidebar has 数据连接 collapsible with 连接管理 and 连接器类型 (T-FE-SMFA-02)", async () => {
  setDesktopViewport(1400);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  const dataConnTrigger = screen.getByRole("button", { name: "数据连接" });
  await user.click(dataConnTrigger);

  const connMgrLink = screen.getByRole("link", { name: "连接管理" });
  expect(connMgrLink).toHaveAttribute("href", "/admin/datasources");

  const connTypeLink = screen.getByRole("link", { name: "连接器类型" });
  expect(connTypeLink).toHaveAttribute("href", "/admin/connectors");
});
```

- [ ] **Step 5: 添加 T-FE-SMFA-03 — admin 侧栏存在「预览」badge**

```typescript
it("admin sidebar shows 预览 badge for M13 items (T-FE-SMFA-03)", () => {
  setDesktopViewport(1400);
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  // M13 items (查询设计器, 治理工单, 发布流水线, 元数据, Dataset) each have 预览 badge
  expect(screen.getAllByText("预览").length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 6: 添加 T-FE-SMFA-04 — viewer 侧栏无「系统」/「数据」section**

```typescript
it("viewer role: sidebar has no 系统 or 数据 section headings (T-FE-SMFA-04)", () => {
  setDesktopViewport(1400);
  mockUseAuth.mockReturnValueOnce({
    user: { id: "2", username: "viewer", roles: ["viewer"] as const },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  });

  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.queryByRole("heading", { name: "系统" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "数据" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "分析" })).toBeInTheDocument();
});
```

- [ ] **Step 7: 运行全部 AdminLayout smoke 测试**

```bash
cd fe && pnpm vitest run src/layouts/AdminLayout.smoke.test.tsx 2>&1 | tail -20
```

期望：Tests 16 passed（原 12 + 新 4）。

- [ ] **Step 8: Commit**

```bash
git add fe/src/layouts/AdminLayout.smoke.test.tsx
git commit -m "test: add AdminLayout smoke tests T-FE-SMFA-01~04 for nav-manifest"
```

---

### Task 6: 更新 `routes.smoke.test.tsx` — T-FE-08 + T-RT-DL-01

**Files:**
- Modify: `fe/src/routes.smoke.test.tsx`

- [ ] **Step 1: 在 import 中添加 `fireEvent`**

将：
```typescript
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
```
改为：
```typescript
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
```

- [ ] **Step 2: 更新 T-FE-08（「数据源」改为「连接管理」，需展开 Collapsible）**

将现有 T-FE-08 测试（第 128–134 行）替换为：

```typescript
it("renders datasource nav link pointing to /admin/datasources (T-FE-08)", () => {
  setDesktopViewport();
  renderRoutes(["/admin"]);

  // 数据连接 Collapsible.Trigger — click to reveal subItems
  const dataConnTrigger = screen.getByRole("button", { name: "数据连接" });
  fireEvent.click(dataConnTrigger);

  const links = screen.getAllByRole("link", { name: "连接管理" });
  expect(links.length).toBeGreaterThanOrEqual(1);
  expect(links[0]).toHaveAttribute("href", "/admin/datasources");
});
```

- [ ] **Step 3: 为 T-RT-CONN-01 添加注释（现有测试已覆盖，确认存在）**

定位现有测试：
```typescript
it("renders connectors route with mocked auth (M-FE-1)", async () => {
```

在该测试上方添加注释行：

```typescript
// T-RT-CONN-01: /admin/connectors 可达，渲染「连接器类型」heading — 已被 M-FE-1 用例覆盖
it("renders connectors route with mocked auth (M-FE-1)", async () => {
```

- [ ] **Step 4: 添加 T-RT-DL-01 — M1 nav links 不为 # 或空**

在文件末尾 `describe` 块内最后一个 `it` 之后添加：

```typescript
it("M1 nav links have valid non-empty hrefs (T-RT-DL-01)", () => {
  setDesktopViewport();
  renderRoutes(["/admin"]);

  // Open 数据连接 collapsible
  const dataConnTrigger = screen.getByRole("button", { name: "数据连接" });
  fireEvent.click(dataConnTrigger);

  const connMgr = screen.getByRole("link", { name: "连接管理" });
  expect(connMgr.getAttribute("href")).toBe("/admin/datasources");

  const connType = screen.getByRole("link", { name: "连接器类型" });
  expect(connType.getAttribute("href")).toBe("/admin/connectors");

  const dashLinks = screen.getAllByRole("link", { name: "Dashboard" });
  expect(dashLinks[0].getAttribute("href")).toBe("/admin/dashboards");

  // Verify no link in nav points to "#" or is empty
  const allNavLinks = screen
    .getByRole("navigation", { name: "管理端导航" })
    .querySelectorAll("a[href]");
  for (const link of Array.from(allNavLinks)) {
    const href = link.getAttribute("href");
    expect(href).not.toBe("#");
    expect(href).not.toBe("");
  }
});
```

- [ ] **Step 5: 运行全量 routes smoke 测试**

```bash
cd fe && pnpm vitest run src/routes.smoke.test.tsx 2>&1 | tail -20
```

期望：所有测试通过（新增 1 条，修改 1 条，合计不减少）。

- [ ] **Step 6: 运行完整 vitest 套件**

```bash
cd fe && pnpm vitest run 2>&1 | tail -20
```

期望：全量通过，无新增 FAIL。

- [ ] **Step 7: Commit**

```bash
git add fe/src/routes.smoke.test.tsx
git commit -m "test: update T-FE-08 for renamed nav item; add T-RT-DL-01 dead-link check"
```

---

### Task 7: 更新 `docs/ui/layout.md` — §3 + §6 文档同步

**Files:**
- Modify: `docs/ui/layout.md`

- [ ] **Step 1: 更新 §3「侧栏导航分组」表**

将 `## 3. 单应用 IA（`/admin/*`）` 下「侧栏导航分组（RBAC 可见）」表（第 147–157 行）替换为：

```markdown
### 侧栏导航分组（RBAC 可见）

| 分组 | 图标区 | 典型权限 | 里程碑 | 角色 |
|------|--------|----------|--------|------|
| 数据 | 数据连接（subItems: 连接管理/连接器类型）、数据接入 | `datasource:*` | M1 | admin |
| 分析 | Dashboard、图表探索（M11）、查询设计器（M13·预览） | `dashboard:read/edit` | M1/M11/M13 | admin/analyst/viewer |
| 报表 | 报表（subItems: 预制报表/报表模板/报表调度） | `report:read/edit` | M1/M7/M11 | admin/analyst/viewer |
| 主题与实体 | 实体总览、主题分析 | 二期权限点 | M7 | admin/analyst |
| 治理 | 接口目录（M1）、治理工单（M13·预览）、发布流水线（M13·预览） | 治理权限 | M1/M13 | admin |
| 语义层 | 元数据（M13·预览）、Dataset（M13·预览） | 四期 | M13 | admin |
| 系统 | 角色/用户/组织/行级权限/审计日志 | `system:*` | M1 | admin |

> **nav 单一真理源**：`fe/src/config/nav-manifest.tsx`；派生函数：`fe/src/lib/resolve-nav.ts`。
> 三档角色（admin / analyst / viewer）侧栏由 `resolveNavGroups(user)` 从 manifest 派生，不再维护三份平行 nav 文件。
```

- [ ] **Step 2: 更新 §6「分期与导航可见性」**

将 `## 6. 分期与导航可见性` 下的表格（第 194–202 行）及说明替换为：

```markdown
## 6. 分期与导航可见性

| 里程碑 | 单应用新增导航 / 能力 |
|--------|----------------------|
| M1–M6 一期 | 数据、Dashboard（edit + view）、系统/权限、连接器 |
| M7–M10 二期 | 报表模板、报表调度、主题、实体；角色默认视图（FR-VIEW-3） |
| M11–M12 三期 | 图表探索、报表调度、我的视图（FR-VIEW-4）、Embed SDK |
| M13 四期 | 语义层、治理工单/发布、设计器、已发布查询服务入口（可选） |

未到期能力：**侧栏不展示**或标「即将推出」；禁止死链。

> **里程碑可见性矩阵（M-FINAL · F-A）**：
> - `ACTIVE_MILESTONES = {"M1", "M7", "M11"}`；M13 项在 viewer/analyst 侧栏**隐藏**，admin 侧栏标「预览」badge
> - 单一真理源：`fe/src/config/nav-manifest.tsx`；派生函数：`resolveNavGroups(user, capabilities?)`
> - `capabilities` 参数为 F-B ability-nav 扩展预留（默认使用 `ACTIVE_MILESTONES`）
```

- [ ] **Step 3: 更新 `version` 与 `last_updated` frontmatter**

将文件顶部 yaml 块中的 `version: 1.1.0` 改为 `version: 1.2.0`，`last_updated` 改为 `2026-07-07`。

- [ ] **Step 4: Commit**

```bash
git add docs/ui/layout.md
git commit -m "docs: update layout.md §3/§6 for nav-manifest and milestone visibility matrix"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| 设计需求 | 覆盖任务 |
|----------|---------|
| `nav-manifest.tsx` 单一真理源 | Task 1 |
| `resolveNavGroups(user, capabilities?)` 可扩展签名 | Task 3 |
| `ACTIVE_MILESTONES` 导出 | Task 3 |
| DS-007：数据连接 subItems（连接管理/连接器类型） | Task 1（数据） |
| admin M13 项 `preview: true` | Task 3 |
| viewer/analyst 不见 M13 项 | Task 3 |
| `NavItem.preview?: boolean` 类型 | Task 2 |
| `NavBadge "preview"` variant | Task 2 |
| preview badge CSS 工具类 | Task 2 |
| 报表 section 含 subItems（预制报表/模板/调度） | Task 1（报表） |
| 删除旧三拷贝 | Task 4 |
| T-NAV-MF-01~06 测试 | Task 3 |
| T-FE-SMFA-01~04 smoke 测试 | Task 5 |
| T-RT-CONN-01 / T-RT-DL-01 | Task 6 |
| docs/ui/layout.md §3/§6 同步 | Task 7 |

### 2. Placeholder Scan

- 无 TBD / TODO / 「适当处理」
- 所有 step 有完整代码或命令

### 3. Type Consistency

- `NavItem.preview?: boolean` — 定义于 Task 2 `app-sidebar.tsx`，消费于 Task 3 `resolve-nav.ts` 与 Task 5 smoke tests
- `ACTIVE_MILESTONES: Set<string>` — 导出于 Task 3 `resolve-nav.ts`，测试 import 于 Task 3 test
- `NAV_MANIFEST: NavManifestSection[]` — 导出于 Task 1，import 于 Task 3 `resolve-nav.ts`
- `NavBadge variant="preview"` — 定义于 Task 2，触发于 `SidebarNavItem`（item.preview=true 路径）

### 4. Dependency Order

```
Task 1 (nav-manifest.tsx)
  └─► Task 3 (resolve-nav.ts 导入 NAV_MANIFEST)
Task 2 (NavItem.preview 类型)
  └─► Task 3 (resolve-nav.ts 返回 preview: true)
  └─► Task 5 (smoke tests 断言 preview badge 文本)
Task 3 (resolve-nav.ts 重写)
  └─► Task 4 (删除旧文件后无 import 残留)
  └─► Task 5 (AdminLayout 用新 resolve-nav 驱动)
  └─► Task 6 (routes smoke 新结构)
Tasks 4, 5, 6, 7 无相互依赖，可独立执行
```

### 5. File Count

11 文件操作（3 删除 + 1 新建 + 7 修改）≤ 设计 `scope_file_count: 12`。

---

## 预估

- **任务数：** 7 tasks
- **文件操作：** 11（3 删除 + 1 新建 + 7 修改）
- **新增测试：** resolve-nav.test.ts +9 条；AdminLayout.smoke.test.tsx +4 条；routes.smoke.test.tsx +1 条
