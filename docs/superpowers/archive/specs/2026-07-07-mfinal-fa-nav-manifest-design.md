# Design Spec: M-FINAL · F-A — 壳层 IA nav-manifest 收官

```yaml
date: 2026-07-07
round_target: docs/superpowers/evolution/2026-07-07-round-target-mfinal-fa.md
prd_ids: [BOOT-002, DS-007]
phase: P1
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
scope_file_count: 12
```

---

## 1. 批量主题与子项映射

| 子项 | PRD ID | 描述 |
|------|--------|------|
| 1 | BOOT-002 | `fe/src/config/nav-manifest.ts` 单一真理源 + `resolveNavGroups` 派生三档侧栏 |
| 2 | DS-007 | 连接器收拢为「数据」分组 `subItems`（连接管理 + 连接器类型） |
| 3 | BOOT-002 | 里程碑可见性矩阵：viewer/analyst 过滤 M13 未开放项；admin 显示「预览」badge |

---

## 2. 上下文与问题陈述

### 2.1 当前痛点

现有导航由三份**平行拷贝**驱动：`admin-nav.tsx`、`analyst-nav.tsx`、`user-nav.tsx`。三者分散在 `fe/src/config/`，由 `resolve-nav.ts` 按角色直接返回对应数组。存在的问题：

- **维护漂移**：新增/改名导航项需同步三文件，易遗漏
- **无里程碑语义**：四期未交付项（M13 语义层/治理工单/设计器）对 viewer/analyst 可见，存在死链风险；admin 侧无任何"预览"提示
- **IA 结构不一致**：`连接器` 与 `数据源` 同级平铺，layout.md §3 期望 DS-007 的「数据」分组含 subItems
- **`resolveNavGroups` 签名固化**：无 `capabilities` 参数，F-B ability-nav 无法扩展

### 2.2 目标

以 **`nav-manifest.ts` 单一真理源** 替代三份平行拷贝，同时引入：
1. **分组 `subItems`**：「数据连接」父项含连接管理/连接器类型；「报表」父项含预制报表/模板/调度
2. **里程碑可见性矩阵**：admin 对 M13 项显示「预览」badge；viewer/analyst 仅见 `ACTIVE_MILESTONES` 内的项
3. **可扩展签名**：`resolveNavGroups(user, capabilities?)` 为 F-B ability-nav 奠基

---

## 3. 范围框定文件列表

| 文件 | 操作 |
|------|------|
| `fe/src/config/nav-manifest.ts` | **新建** — 单一真理源，导出 `NAV_MANIFEST` |
| `fe/src/lib/resolve-nav.ts` | **修改** — 重写为基于 manifest 的派生逻辑 |
| `fe/src/lib/resolve-nav.test.ts` | **修改** — 补充里程碑过滤 / viewer / analyst 场景 |
| `fe/src/components/layout/app-sidebar.tsx` | **修改** — `NavItem` 增 `preview?`；`NavBadge` 增 `"preview"` variant |
| `fe/src/index.css` | **修改** — 补充 `menu-dropdown-badge-preview[-active/-inactive]` 工具类 |
| `fe/src/config/admin-nav.tsx` | **删除** |
| `fe/src/config/analyst-nav.tsx` | **删除** |
| `fe/src/config/user-nav.tsx` | **删除** |
| `fe/src/layouts/AdminLayout.tsx` | **无需改动**（已调用 `resolveNavGroups(sessionUser)`，签名兼容） |
| `fe/src/layouts/AdminLayout.smoke.test.tsx` | **修改** — 补充 报表 subItems / 数据分组 subItems / 预览 badge 测试 |
| `fe/src/routes.smoke.test.tsx` | **修改** — 确认 `/admin/connectors` 可达 + 无死链断言 |
| `docs/ui/layout.md` | **修改** — §3 侧栏导航分组表 + §6 分期导航可见性与 manifest 字段对齐 |

**不在范围内（明确不做）**：
- 不修改 `fe/src/routes.tsx` 路由结构（路由已包含 `/admin/connectors`）
- 不修改 `fe/src/lib/session.ts` 的 `SessionRole` 类型
- 不实现 F-B ability-based filtering（本轮只定义 `capabilities?` 签名占位，默认使用 `ACTIVE_MILESTONES`）
- 不修改后端 API
- 不改 ConnectorsPage 内部逻辑（只读目录功能不退化）
- 不引入新的第三方依赖

---

## 4. 详细设计

### 4.1 类型系统（`nav-manifest.ts`）

```typescript
// 内部 manifest 类型（不对外导出类型，只导出数据）

type NavManifestSubItem = {
  name: string;
  path: string;
  milestone?: string;       // "M1" | "M7" | "M11" | "M13"
};

type NavManifestItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;             // 叶子路由；parent 项可不设
  subItems?: NavManifestSubItem[];
  milestone?: string;        // "M1" | "M7" | "M11" | "M13"
  roles?: SessionRole[];     // 可见角色白名单；不设则继承 section 级 roles
};

type NavManifestSection = {
  title: string;
  items: NavManifestItem[];
  roles: SessionRole[];      // 哪些角色可看到整个 section
};

export const NAV_MANIFEST: NavManifestSection[] = [...];
```

**里程碑划分**（与 layout.md §6 对齐）：

| milestone 值 | 对应内容 |
|---|---|
| `"M1"` | 一期（M1–M6）：数据源、Dashboard、系统权限、连接器、数据接入 |
| `"M7"` | 二期（M7–M10）：报表模板、主题分析、实体总览 |
| `"M11"` | 三期（M11–M12）：图表探索、报表调度 |
| `"M13"` | 四期（M-FINAL·F-D/E）：查询设计器、治理工单、发布流水线、元数据、Dataset |

### 4.2 `NAV_MANIFEST` 数据结构

```
Section: 数据  (roles: ["admin"])
  ├── Item: 数据连接 (Database 图标, milestone: "M1")
  │     subItems:
  │       ├── 连接管理   /admin/datasources   [milestone: "M1"]
  │       └── 连接器类型 /admin/connectors    [milestone: "M1"]
  └── Item: 数据接入 (ArrowLeftRight 图标)  /admin/ingestion/sync-jobs  [milestone: "M1"]

Section: 分析  (roles: ["admin", "analyst", "viewer"])
  ├── Item: Dashboard       /admin/dashboards         [milestone: "M1"]
  ├── Item: 图表探索         /admin/charts/explore     [milestone: "M11", roles: ["admin","analyst"]]
  └── Item: 查询设计器       /admin/designer           [milestone: "M13", roles: ["admin"]]

Section: 报表  (roles: ["admin", "analyst", "viewer"])
  └── Item: 报表 (FileBarChart 图标, parent collapsible)
        subItems:
          ├── 预制报表    /admin/reports            [milestone: "M1"]
          ├── 报表模板    /admin/reports/templates  [milestone: "M7"]
          └── 报表调度    /admin/reports/schedules  [milestone: "M11"]

Section: 主题与实体  (roles: ["admin", "analyst"])
  ├── Item: 实体总览  /admin/entities/overview  [milestone: "M7"]
  └── Item: 主题分析  /admin/themes/default     [milestone: "M7"]

Section: 治理  (roles: ["admin"])
  ├── Item: 接口目录   /admin/governance/catalog  [milestone: "M1"]
  ├── Item: 治理工单   /admin/governance/tickets  [milestone: "M13"]
  └── Item: 发布流水线 /admin/governance/publish  [milestone: "M13"]

Section: 语义层  (roles: ["admin"])
  ├── Item: 元数据  /admin/metadata   [milestone: "M13"]
  └── Item: Dataset /admin/datasets   [milestone: "M13"]

Section: 系统  (roles: ["admin"])
  ├── Item: 角色管理  /admin/system/roles
  ├── Item: 用户管理  /admin/system/users
  ├── Item: 组织架构  /admin/system/orgs
  ├── Item: 行级权限  /admin/system/rls
  └── Item: 审计日志  /admin/system/audit
  （以上均 milestone: "M1"）
```

> **注意**：`图表探索` 和 `查询设计器` 同在「分析」section，但 `图表探索` 通过 `roles: ["admin","analyst"]`（不含 viewer）控制，`查询设计器` 通过 `roles: ["admin"]`（仅 admin）控制。这样 viewer 在「分析」只见 Dashboard，analyst 多见图表探索，admin 全见。

### 4.3 `resolve-nav.ts` 重写

```typescript
import { NAV_MANIFEST } from "@/config/nav-manifest";
import type { NavSection, NavItem } from "@/components/layout/app-sidebar";
import type { SessionUser, SessionRole } from "@/lib/session";

// 当前已交付里程碑集合（M13 = 四期，暂为预览态）
export const ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"]);

/**
 * 从 NAV_MANIFEST 派生侧栏 NavSection[]。
 * @param user         当前会话用户（含角色）
 * @param capabilities 覆盖里程碑集合（测试 / 未来 F-B ability 扩展用）
 */
export function resolveNavGroups(
  user: SessionUser,
  capabilities: Set<string> = ACTIVE_MILESTONES,
): NavSection[] { ... }
```

**派生逻辑**（伪代码）：

```
for each section in NAV_MANIFEST:
  if user.roles ∩ section.roles == ∅: skip section

  filteredItems = []
  for each item in section.items:
    effectiveRoles = item.roles ?? section.roles
    if user.roles ∩ effectiveRoles == ∅: skip item

    // milestone 过滤
    if item.milestone && !capabilities.has(item.milestone):
      if !isAdmin(user): skip item      // viewer/analyst 不见
      // admin: 加 preview badge（通过 navItem.preview=true 传给 AppSidebar）

    // subItems 里程碑过滤
    filteredSubItems = item.subItems?.filter(sub =>
      !sub.milestone || capabilities.has(sub.milestone) || isAdmin(user)
    )

    // 如果 parent 有 subItems 且全部被过滤 → 跳过整个 item（避免空父菜单）
    if item.subItems && filteredSubItems.length === 0: skip item

    filteredItems.push(buildNavItem(item, filteredSubItems, addPreviewBadge))

  if filteredItems.length > 0: include section
```

`isAdmin(user)` = `user.roles.includes("admin")`

**subItems 中的 preview badge**：当 admin 看到某 item 的 `milestone` 不在 `capabilities` 时，构建的 `NavItem` 设 `preview: true`。subItem 本身不设 preview badge（subItem 属于 parent item，parent 已标记则可见即表达了 preview 语义；若需进一步细化可在 NavSubItem 加 `preview` 字段，但 F-A 不做）。

**函数体量约束**：`resolveNavGroups` + 辅助函数合计 ≤ 60 行。可拆为：
- `filterItemForRole(item, user, capabilities): NavItem | null`
- `resolveNavGroups(user, capabilities)` 调用上面函数

### 4.4 `app-sidebar.tsx` 扩展

**类型变更**：

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

**NavBadge 增加 `"preview"` variant**：

```typescript
function NavBadge({
  label,
  variant,
  active,
}: {
  label: string;
  variant: "new" | "pro" | "preview";  // 新增 "preview"
  active?: boolean;
}) { ... }
```

在 `SidebarNavItem` 渲染中补充：

```tsx
{item.preview && showLabels && (
  <NavBadge label="预览" variant="preview" active={open || isActive(item.path ?? "")} />
)}
```

### 4.5 CSS Token（`index.css`）

```css
/* 预览 badge — 灰色调，区别于 new(品牌色)、pro(purple) */
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

### 4.6 测试设计

#### `resolve-nav.test.ts`（扩充）

现有 3 条用例保留，新增 ≥2 条里程碑过滤用例：

| 用例 ID | 描述 |
|---------|------|
| T-NAV-MF-01 | `resolveNavGroups(viewer)` 不包含 M13 项（查询设计器、治理工单 等） |
| T-NAV-MF-02 | `resolveNavGroups(analyst)` 不包含 M13 项 |
| T-NAV-MF-03 | `resolveNavGroups(admin)` 包含 M13 项且对应 NavItem 有 `preview: true` |
| T-NAV-MF-04 | `resolveNavGroups(admin, new Set(["M1"]))` 过滤 M7/M11/M13 项（capabilities 覆盖） |
| T-NAV-MF-05 | `resolveNavGroups(viewer)` 「报表」父项存在，subItems 只含 `预制报表`（M1） |
| T-NAV-MF-06 | `resolveNavGroups(admin)` 「数据」分组中「数据连接」item 有 subItems 含 `连接器类型` |

#### `AdminLayout.smoke.test.tsx`（扩充）

| 用例 ID | 描述 |
|---------|------|
| T-FE-SMFA-01 | admin 侧栏有「报表」父菜单（Collapsible），点击后展开含「预制报表」、「报表模板」、「报表调度」 |
| T-FE-SMFA-02 | admin 侧栏「数据」分组中存在「数据连接」父菜单，子项含「连接管理」和「连接器类型」链接 |
| T-FE-SMFA-03 | admin 侧栏存在文本「预览」（badge，四期未交付项如「查询设计器」旁） |
| T-FE-SMFA-04 | viewer mock 时侧栏**不**存在「系统」/「数据」section（role 过滤正常） |

#### `routes.smoke.test.tsx`（扩充）

| 用例 ID | 描述 |
|---------|------|
| T-RT-CONN-01 | `/admin/connectors` 路由可达，渲染 `连接器类型` heading（已有 M-FE-1 用例覆盖，确认不退化） |
| T-RT-DL-01 | 所有 M1 路由（`/admin/datasources`、`/admin/connectors`、`/admin/dashboards`）nav link 不指向 `#` 或缺失 href |

---

## 5. 验收标准（可测试）

### 子项 1：BOOT-002 nav-manifest + resolveNavGroups

- [ ] `fe/src/config/nav-manifest.ts` 存在，导出 `NAV_MANIFEST: NavManifestSection[]`
- [ ] `resolveNavGroups(sessionUserFromAuth("admin", ["admin"]))` 返回 ≥6 sections
- [ ] `resolveNavGroups(sessionUserFromAuth("analyst", ["analyst"]))` 返回 `分析`、`报表`、`主题与实体` 三 sections，不含「系统」或「数据」
- [ ] `resolveNavGroups(sessionUserFromAuth("viewer", ["viewer"]))` 返回「分析」和「报表」sections，不含「系统」
- [ ] `旧 admin-nav.tsx / analyst-nav.tsx / user-nav.tsx` 已删除，无残留 import
- [ ] `resolve-nav.test.ts` 覆盖 admin/analyst/viewer 三档角色（原有）+ ≥2 里程碑过滤用例
- [ ] `AdminLayout.smoke.test.tsx` PASS（含新增 T-FE-SMFA-01~04）
- [ ] 「报表」父菜单 `subItems` 含 预制报表/报表模板/报表调度

### 子项 2：DS-007 连接器收拢「数据」分组

- [ ] manifest「数据」section 下有 `数据连接` NavItem，其 `subItems` 含 `连接管理`（`/admin/datasources`）和 `连接器类型`（`/admin/connectors`）
- [ ] `ConnectorsPage` 保留只读目录功能（`routes.smoke.test.tsx` T-RT-CONN-01 PASS）
- [ ] `routes.smoke.test.tsx` 覆盖 `/admin/connectors` 路由可达
- [ ] `AdminLayout.smoke.test.tsx` 数据分组「连接器类型」subItem link 存在（T-FE-SMFA-02）

### 子项 3：BOOT-002 里程碑可见性矩阵

- [ ] `nav-manifest.ts` 中相关项含 `milestone` 字段（`"M1"` / `"M7"` / `"M11"` / `"M13"`）
- [ ] `ACTIVE_MILESTONES = new Set(["M1", "M7", "M11"])` 导出，可供测试覆盖
- [ ] `resolveNavGroups(viewer/analyst)` 返回结果中**不含** M13 项（查询设计器、治理工单、发布流水线、元数据、Dataset）
- [ ] `resolveNavGroups(admin)` 返回 M13 项对应 `NavItem.preview === true`
- [ ] admin 侧栏渲染含「预览」badge 文本（T-FE-SMFA-03 PASS）
- [ ] `resolve-nav.test.ts` ≥2 里程碑过滤场景 PASS
- [ ] `docs/ui/layout.md §3/§6` 分组表与 manifest 定义一致（文档同步）

---

## 6. 非目标（明确不做）

- **不实现 F-B ability-based nav**：`capabilities?` 参数仅为占位，默认 `ACTIVE_MILESTONES`；自定义 role 能力注入留 F-B
- **不删除 ConnectorsPage 功能**：只改 nav 入口，页面逻辑不变
- **不修改后端 API**：纯前端 nav 层变更
- **不修改 `AdminLayout.tsx` 渲染逻辑**：壳层已调用 `resolveNavGroups`，无需改动
- **不做 Playwright E2E**：vitest + RTL smoke 已覆盖；E2E 留二期
- **不重命名现有路由路径**：所有路由 path 保持不变

---

## 7. 与 PRD 8 维薄弱项对齐

| 维度 | BOOT-002 分 | DS-007 分 | 本轮改进方向 |
|------|-------------|-----------|------------|
| 用户价值 | 92 | 88 | DS-007：连接器 subItem 入口提升可达性 |
| 完整度 | 100 | 100 | — |
| 可靠性 | 92 | 94 | — |
| 交互体验 | 94 | 86 ⚠ | DS-007 主攻：sidebar subItem 可见性；父菜单 collapse/expand 交互 |
| 架构健康 | 94 ⚠ | 90 | BOOT-002 主攻：废弃三拷贝漂移 |
| 测试覆盖 | 100 | 100 | 补 milestone 场景覆盖 |
| 性能 | 88 ⚠ | 86 ⚠ | BOOT-002/DS-007 主攻：`resolveNavGroups` 无副作用、纯计算；不引入额外 re-render；subItems collapse 用 Radix Collapsible（已有） |
| 安全性 | 92 | 88 | viewer/analyst 不见未开放项，防止死链与路由猜测 |

---

## 8. UI 设计交付

```
ui_design_skill: .agents/skills/b-design-system-tailadmin-radix/SKILL.md
```

### 8.1 页面信息架构

侧栏为 `AppSidebar`（290px 展开 / 90px 折叠），`app-shell` 模式。本轮仅改 nav sections 数据与 badge，不改壳层比例与布局。

**导航层级变化**（F-A 前 → 后）：

```
前：
数据 > 数据源（叶）
数据 > 连接器（叶）
分析 > 预制报表（叶）
分析 > 报表模板（叶）
分析 > 报表调度（叶）

后：
数据 > 数据连接（parent collapsible）
              > 连接管理（sub-leaf）
              > 连接器类型（sub-leaf）
报表 > 报表（parent collapsible）
              > 预制报表（sub-leaf）
              > 报表模板（sub-leaf）
              > 报表调度（sub-leaf）
分析 > 查询设计器 [预览 badge]（admin only）
```

主内容区宽度不变（`max-w-(--breakpoint-2xl)` 居中）。空/加载/错误态由各页面自行处理，本轮不涉及。

### 8.2 视觉层级

- **主操作**：各 NavSection 标题（分组标签，不可点击）
- **次操作**：NavItem 叶子链接（可点击、active 高亮）
- **折叠父项**：Collapsible.Trigger（`menu-item` class，含 ChevronDown 动效）
- **子项链接**：`menu-dropdown-item` class（indent + 更小字号）
- **「预览」badge**：`menu-dropdown-badge-preview` 灰色系，置于 item 文本右侧，折叠时 badge 随 `showLabels` 隐藏（已有逻辑）

卡片/弹层：本轮无新弹层或卡片，不适用。

### 8.3 组件映射

| UI 元素 | 复用组件 / 类 | 说明 |
|---------|--------------|------|
| 侧栏容器 | `AppSidebar`（`components/layout/app-sidebar.tsx`） | 不改结构 |
| 折叠父菜单 | `Radix Collapsible.Root/Trigger/Content`（已有） | 直接复用 `SidebarNavItem` 已有 subItems 渲染路径 |
| 子项链接 | `Link` + `menu-dropdown-item` class | 已有 |
| 「预览」badge | `NavBadge variant="preview"` | **新增** variant，使用 `menu-dropdown-badge-preview` CSS 工具类 |
| badge CSS | `menu-dropdown-badge-preview[-active/-inactive]` | **新增** 3 条 `@utility`，灰色调（`bg-gray-100/200`），不引入新 Token |

**禁止**：不在 nav manifest 或 resolve-nav 中重写 Button/Table/Input；不在页面内创建等价 badge。

### 8.4 Token 与密度

- 颜色：复用现有语义 Token（`bg-gray-100`、`text-gray-500/700`、dark 变体）。badge 不引入新 hex 颜色。
- 间距/圆角/字号：沿用 `menu-dropdown-badge` 基类（`rounded-full px-2 py-0.5 text-theme-xs font-medium`）
- 图标尺寸：`size-6`（与现有 NavItem 图标一致）
- 折叠动效：`data-[state=open]:animate-accordion-down / data-[state=closed]:animate-accordion-up`（已有）

### 8.5 响应式与可访问性

| 方面 | 策略 |
|------|------|
| 桌面（≥1280px） | 侧栏 290px；badge + label 显示 |
| 窄屏折叠态（90px） | `showLabels=false`；badge 随 label 隐藏；subItems collapse 关闭（已有逻辑） |
| 移动端（< xl） | 抽屉式 overlay sidebar；Collapsible 正常展开 |
| 键盘焦点 | `Collapsible.Trigger` 可 Tab 聚焦；`Enter/Space` 展开；已有焦点环（`focus-visible`） |
| ARIA | `<nav aria-label="管理端导航">` 已有；Collapsible 自带 `aria-expanded`；badge `<span>` 不需 role |
| 长文本 | nav 标签固定中文短名，不存在截断问题 |

### 8.6 视觉 QA 清单（P3 验证时执行）

| 检查项 | Desktop light | Desktop dark | Mobile 375px |
|--------|:---:|:---:|:---:|
| 「数据连接」父项 chevron 旋转动效 | ☐ | ☐ | ☐ |
| subItem 缩进对齐（ml-9） | ☐ | ☐ | ☐ |
| 「预览」badge 颜色不与 `new` badge 混淆 | ☐ | ☐ | — |
| 折叠态（90px）无 badge/label 溢出 | ☐ | ☐ | — |
| mobile drawer 「报表」expand 正常 | — | — | ☐ |
| viewer mock 侧栏无「系统」section | ☐ | — | — |
| active link 高亮（brand-500）正常 | ☐ | ☐ | — |

---

## 9. `docs/ui/layout.md` 同步要点

### §3 侧栏导航分组表

补充「数据连接」subItems 说明；「报表」从「分析」section 拆出为独立 section；删除「分析」中的平铺报表项。

### §6 分期与导航可见性

在原表后补注：

> **里程碑可见性矩阵（M-FINAL · F-A）**：
> - `ACTIVE_MILESTONES = {"M1", "M7", "M11"}`；M13 项在 viewer/analyst 侧栏隐藏，admin 侧栏标「预览」
> - 单一真理源：`fe/src/config/nav-manifest.ts`；派生函数：`resolveNavGroups`

---

## 10. Spec Self-Review

- [x] **Placeholder scan**：无 TBD/TODO，所有 T-* 用例 ID 已定义，verifiable
- [x] **内部一致性**：manifest 结构、resolveNavGroups 逻辑、测试用例三者对齐；CSS 新增 token 与 badge variant 一一对应
- [x] **范围检查**：12 文件，在 round-target 估算 10–16 范围内；无超范围变更
- [x] **歧义检查**：
  - `ACTIVE_MILESTONES` 初始值明确（M1/M7/M11）；M13 = 预览
  - `roles` 字段缺省行为明确（item 不设 roles 则继承 section.roles）
  - parent item 无 subItems 且无 path 时的处理：不产生此情况（报表/数据连接均有 subItems）
  - viewer「报表」section 仅见「预制报表」subItem：已在设计中显式说明
  - `AdminLayout.tsx` 无需改动（签名向后兼容）：已确认 `resolveNavGroups(sessionUser)` 不变
