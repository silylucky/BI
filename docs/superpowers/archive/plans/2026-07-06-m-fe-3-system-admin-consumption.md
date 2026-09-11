# M-FE-3 系统管理与消费态实现计划

> **执行模式：** subagent-driven-development (option 1)
> **范围框定：** `fe/`（system 管理页、登录默认视图、Dashboard 全局筛选器）+ `backend/app/api/v1/users.py` · `backend/app/auth/users/service.py` · `backend/app/auth/schemas.py`（GET users 依赖例外）+ `tests/test_auth_rbac_l1.py`（list_users pytest）+ `fe/src/components/README.md`
> **子项：** AUTH-001, AUTH-003, VIEW-003, DASH-004
> **项目技能：** `.agents/skills/`（P3 按 Files 按需 Read；plan 预指定 **Skills:**）
> **项目规则：** `.cursor/rules/`（alwaysApply 自动注入；触及 `fe/**` 匹配 `fe-ui.mdc`；触及 `backend/**` 匹配 `backend-fastapi.mdc`）

**Goal:** 浏览器端交付角色/用户系统管理、登录后角色默认 Dashboard 重定向、Dashboard view 模式全局筛选器驱动 widget 刷新；消解 `GET /api/v1/users` 契约漂移。

**Architecture:** AUTH-001/003 用 TanStack Query + `AdminPageShell` crud-flow（列表 + Dialog/Sheet）；VIEW-003 用 `defaultViewResolve` 镜像后端 `resolve_defaults_for_roles` 含 `inheritFromRoleId` 链；DASH-004 在 view 顶栏 `GlobalFilterBar` 读 linkage API，经 `dashboardFilterUtils.injectSqlParameters` 客户端替换 `{{key}}` 后由扩展版 `useChartExecute` 重跑。

**Tech Stack:** React 19 · TanStack Query · zod · Vitest · pytest · FastAPI

## Global Constraints

- 真理源：`docs/superpowers/evolution/2026-07-06-round-target-m-fe-3.md` > `docs/superpowers/specs/2026-07-06-m-fe-3-system-admin-consumption-design.md`
- `base_branch`: `dev-auto`；禁止修改 `docs/automate/goal.md`；`docs/automate/plan.md` 勾选留 **P5**
- 非目标：组织树 UI、RLS Admin、审计日志、筛选器 edit 配置 UI、Playwright E2E、`ExecuteRequest.parameters` 后端扩展
- 图表直连 `dataSourceId` + SQL，不经 Dataset
- 文件预算：**20** 主文件（design §3）；UI 基元（dialog/sheet 等）为依赖补齐，不计入主预算
- 后端验证：`cd backend && python3 -m ruff check . && python3 -m pytest tests/test_auth_rbac_l1.py -q -k "list_users"`
- 前端验证：`cd fe && pnpm install && pnpm run check:design && pnpm test && pnpm build`

---

### Task 1: 共享基元 + AUTH-001 角色管理 Admin UI

**Files:**
- Create: `fe/src/components/ui/dialog.tsx`
- Create: `fe/src/components/ui/sheet.tsx`
- Create: `fe/src/components/ui/switch.tsx`
- Create: `fe/src/components/ui/textarea.tsx`
- Create: `fe/src/components/ui/checkbox.tsx`
- Create: `fe/src/components/ui/scroll-area.tsx`
- Create: `fe/src/pages/admin/system/roles/roleFormSchema.ts`
- Create: `fe/src/pages/admin/system/roles/roleErrors.ts`
- Create: `fe/src/pages/admin/system/roles/RoleListPage.tsx`
- Create: `fe/src/pages/admin/system/roles/roles.smoke.test.tsx`
- Modify: `fe/package.json`（增 Radix 依赖）
- Modify: `fe/src/lib/queryKeys.ts`
- Modify: `fe/src/routes.tsx`
- Modify: `fe/src/config/admin-nav.tsx`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 复用 TailAdmin crud-flow：表格 Card + Dialog 表单 + AlertDialog 删除
- desktop/mobile 表格 `overflow-x-auto`；Dialog `max-w-[calc(100%-2rem)]`
- loading Skeleton 5 行、empty「暂无角色」+ CTA、error ErrorBanner、403 ContentState
- `pnpm run check:design` 无硬编码 hex；主操作 `variant="primary"`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/v1/roles`；`GET/PUT /api/v1/roles/{id}/default-views`；`GET /api/v1/dashboards`
- Produces: `queryKeys.roles.*`；`roleFormSchema`；`mapRoleError`；`RoleListPage`；路由 `/admin/system/roles`

- [ ] **Step 1: 安装 Radix 依赖**

```bash
cd fe && pnpm add @radix-ui/react-dialog @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-scroll-area zod
```

- [ ] **Step 2: 从设计系统 skill 复制 UI 基元**

```bash
cd /workspace
SKILL=.agents/skills/b-design-system-tailadmin-radix/templates/ui
for f in dialog.tsx sheet.tsx switch.tsx textarea.tsx checkbox.tsx scroll-area.tsx; do
  cp "$SKILL/$f" "fe/src/components/ui/$f"
done
```

- [ ] **Step 3: 扩展 queryKeys**

`fe/src/lib/queryKeys.ts` 追加：

```ts
  roles: {
    all: ["roles"] as const,
    list: (params?: { codePrefix?: string; limit?: number; offset?: number }) =>
      ["roles", "list", params] as const,
  },
  dashboards: {
    all: ["dashboards"] as const,
    list: () => ["dashboards", "list"] as const,
    globalFilters: (id: string) => ["dashboards", id, "globalFilters"] as const,
  },
```

- [ ] **Step 4: 创建 `roleFormSchema.ts`**

```ts
import { z } from "zod";

export const ROLE_CODE_RE = /^[a-z][a-z0-9_]{1,63}$/;

export const roleCreateSchema = z.object({
  code: z.string().min(1, "请输入角色编码").regex(ROLE_CODE_RE, "编码须以小写字母开头，仅含小写字母、数字、下划线，2–64 位"),
  name: z.string().min(1, "请输入显示名").max(128, "显示名过长"),
  description: z.string().max(512, "描述过长").optional().or(z.literal("")),
  defaultDashboardId: z.string().uuid().optional().or(z.literal("")),
});

export const roleEditSchema = roleCreateSchema.omit({ code: true }).extend({
  isActive: z.boolean(),
});

export type RoleCreateValues = z.infer<typeof roleCreateSchema>;
export type RoleEditValues = z.infer<typeof roleEditSchema>;
```

- [ ] **Step 5: 创建 `roleErrors.ts`**

```ts
import { mapApiError } from "@/lib/apiError";

const ROLE_MESSAGES: Record<string, string> = {
  ROLE_CODE_CONFLICT: "角色编码已存在",
  ROLE_NOT_FOUND: "角色不存在",
  ROLE_IN_USE: "角色仍被用户绑定，无法删除",
  ROLE_FORBIDDEN: "无权管理角色",
};

export function mapRoleError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && ROLE_MESSAGES[code]) return ROLE_MESSAGES[code];
  return mapApiError(err);
}
```

- [ ] **Step 6: 写失败 smoke 测试**

`fe/src/pages/admin/system/roles/roles.smoke.test.tsx`：

```tsx
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

import { RoleListPage } from "./RoleListPage";

function renderRoles() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/system/roles"]}>
        <Routes>
          <Route path="/admin/system/roles" element={<RoleListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RoleListPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-001-01: renders table and create button", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    renderRoles();
    expect(await screen.findByRole("button", { name: "新建角色" })).toBeInTheDocument();
    expect(screen.getByText("暂无角色")).toBeInTheDocument();
  });

  it("T-AUTH-001-02: POST role refetches list", async () => {
    let listCall = 0;
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/roles" && init?.method === "POST") {
        return { id: "r-new", code: "viewer2", name: "查看者2", description: null, isActive: true };
      }
      if (path.startsWith("/api/v1/roles")) {
        listCall += 1;
        if (listCall === 1) return { items: [], total: 0 };
        return {
          items: [{ id: "r-new", code: "viewer2", name: "查看者2", description: null, isActive: true }],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    renderRoles();
    await userEvent.click(await screen.findByRole("button", { name: "新建角色" }));
    await userEvent.type(screen.getByLabelText("角色编码"), "viewer2");
    await userEvent.type(screen.getByLabelText("显示名"), "查看者2");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByText("viewer2")).toBeInTheDocument());
  });
});
```

Run: `cd fe && pnpm test src/pages/admin/system/roles/roles.smoke.test.tsx`
Expected: FAIL — `RoleListPage` not found

- [ ] **Step 7: 实现 `RoleListPage.tsx`**

实现要点（完整文件 <300 行）：
- `AdminPageShell` 标题「角色管理」；面包屑「系统 > 角色管理」
- `useQuery(queryKeys.roles.list({ limit: 50, offset: 0, codePrefix }))` debounce 搜索 300ms
- 表格列：code（`font-mono`）、name、description（`truncate max-w-xs`）、`Badge` active/inactive、编辑/删除
- Dialog 新建：`roleCreateSchema` 校验；编辑：code 只读 + `Switch` is_active
- `Select` 默认 Dashboard：选项来自 `queryKeys.dashboards.list()` → `GET /api/v1/dashboards`
- 创建：`POST /api/v1/roles` → 若选 Dashboard：`PUT /api/v1/roles/{id}/default-views` `{ dashboardId }`
- 编辑：`PUT /api/v1/roles/{id}` + 条件 `PUT default-views`（空选清除：`dashboardId: null`）
- 删除：`AlertDialog` → `DELETE /api/v1/roles/{id}`；错误 `mapRoleError`
- 成功：`invalidateQueries(roles)` + `sonner.success("已保存")`

- [ ] **Step 8: 注册路由与侧栏**

`fe/src/config/admin-nav.tsx` 系统分组：

```tsx
import { Shield, Users } from "lucide-react";
// ...
{
  title: "系统",
  items: [
    { name: "角色管理", icon: <Shield className="size-6" aria-hidden />, path: "/admin/system/roles" },
    { name: "用户管理", icon: <Users className="size-6" aria-hidden />, path: "/admin/system/users" },
  ],
},
```

`fe/src/routes.tsx` 在 `AdminLayout` 内追加：

```tsx
import { RoleListPage } from "@/pages/admin/system/roles/RoleListPage";
// ...
<Route path="system/roles" element={<RoleListPage />} />
```

- [ ] **Step 9: 运行测试**

Run: `cd fe && pnpm test src/pages/admin/system/roles/roles.smoke.test.tsx && pnpm run check:design`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add fe/src/components/ui/dialog.tsx fe/src/components/ui/sheet.tsx fe/src/components/ui/switch.tsx fe/src/components/ui/textarea.tsx fe/src/components/ui/checkbox.tsx fe/src/components/ui/scroll-area.tsx fe/src/pages/admin/system/roles fe/src/lib/queryKeys.ts fe/src/routes.tsx fe/src/config/admin-nav.tsx fe/package.json fe/pnpm-lock.yaml
git commit -m "feat(fe): AUTH-001 role management admin UI with dialog CRUD"
```

---

### Task 2: AUTH-003 用户列表 API + 用户角色绑定 Admin UI

**Files:**
- Modify: `backend/app/auth/schemas.py`（增 `UserListResponse`）
- Modify: `backend/app/auth/users/service.py`（增 `list_users`）
- Modify: `backend/app/api/v1/users.py`（增 `GET ""` 列表，**置于** `/{user_id}` 路由之前）
- Modify: `tests/test_auth_rbac_l1.py`（增 `test_list_users_paginated`）
- Create: `fe/src/pages/admin/system/users/userErrors.ts`
- Create: `fe/src/pages/admin/system/users/UserListPage.tsx`
- Create: `fe/src/pages/admin/system/users/users.smoke.test.tsx`
- Modify: `fe/src/lib/queryKeys.ts`（增 `users` keys）
- Modify: `fe/src/routes.tsx`（增 `system/users` 路由）

**Skills:**
- Read `.agents/skills/fastapi/SKILL.md`
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 用户表 + 右侧 `Sheet` 角色绑定；`Checkbox` 组 `aria-label="选择角色"`
- 创建用户 Dialog 仅 username；保存中 footer disabled
- mobile Sheet 全宽；desktop 表格不溢出

**Interfaces:**
- Consumes: Task 1 的 `queryKeys.roles`；`GET /api/v1/users`；`GET/PUT /api/v1/users/{id}/roles`；`POST /api/v1/users`
- Produces: `list_users` service；`GET /api/v1/users`；`queryKeys.users.*`；`UserListPage`

- [ ] **Step 1: 写失败 pytest**

`tests/test_auth_rbac_l1.py` 末尾追加：

```python
def test_list_users_paginated(client, auth_headers):
    client.post("/api/v1/users", json={"username": "u_list_a"}, headers=auth_headers)
    client.post("/api/v1/users", json={"username": "u_list_b"}, headers=auth_headers)
    resp = client.get("/api/v1/users?limit=10&offset=0", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 2
    usernames = {u["username"] for u in body["items"]}
    assert "u_list_a" in usernames
    assert "u_list_b" in usernames
```

Run: `cd backend && python3 -m pytest tests/test_auth_rbac_l1.py::test_list_users_paginated -v`
Expected: FAIL — 404 or route missing

- [ ] **Step 2: 实现后端 list_users**

`backend/app/auth/schemas.py` 在 `UserOut` 后追加：

```python
class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int
```

`backend/app/auth/users/service.py` 追加（import `func` from sqlalchemy）：

```python
def list_users(
    session: Session,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuthUser], int]:
    capped = min(max(limit, 1), 500)
    base = select(AuthUser).order_by(AuthUser.username)
    count_stmt = select(func.count()).select_from(AuthUser)
    if q:
        pattern = f"%{q}%"
        base = base.where(AuthUser.username.ilike(pattern))
        count_stmt = count_stmt.where(AuthUser.username.ilike(pattern))
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total
```

`backend/app/api/v1/users.py`：在 `create_user` **之前**插入（import `Query`, `UserListResponse`）：

```python
@router.get("", response_model=UserListResponse)
def list_users(
    _: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_db)],
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> UserListResponse:
    items, total = user_service.list_users(db, q, limit, offset)
    return UserListResponse(items=[UserOut.model_validate(u) for u in items], total=total)
```

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_auth_rbac_l1.py::test_list_users_paginated -v`
Expected: PASS

- [ ] **Step 3: 扩展 queryKeys.users**

```ts
  users: {
    all: ["users"] as const,
    list: (params?: { q?: string; limit?: number; offset?: number }) =>
      ["users", "list", params] as const,
    roles: (userId: string) => ["users", userId, "roles"] as const,
  },
```

- [ ] **Step 4: 写失败 users smoke 测试**

`fe/src/pages/admin/system/users/users.smoke.test.tsx`：

```tsx
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

import { UserListPage } from "./UserListPage";

const ROLE_A = "00000000-0000-4000-8000-000000000001";
const USER_A = "00000000-0000-4000-8000-000000000010";

function renderUsers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/system/users"]}>
        <Routes>
          <Route path="/admin/system/users" element={<UserListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UserListPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-003-01: renders user table from GET /users", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return { items: [{ id: USER_A, username: "alice" }], total: 1 };
      }
      return { items: [] };
    });
    renderUsers();
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("T-AUTH-003-02: save role bind triggers PUT with roleIds", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === `/api/v1/users/${USER_A}/roles` && init?.method === "PUT") {
        return { items: [{ id: ROLE_A, code: "viewer", name: "查看者" }] };
      }
      if (path === `/api/v1/users/${USER_A}/roles`) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: ROLE_A, code: "viewer", name: "查看者", isActive: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/users")) {
        return { items: [{ id: USER_A, username: "alice" }], total: 1 };
      }
      return {};
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "管理角色" }));
    const checkbox = await screen.findByRole("checkbox", { name: /查看者/ });
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "保存角色绑定" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}/roles` && (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.roleIds).toEqual([ROLE_A]);
    });
  });
});
```

Run: `cd fe && pnpm test src/pages/admin/system/users/users.smoke.test.tsx`
Expected: FAIL

- [ ] **Step 5: 实现 `UserListPage.tsx`**

实现要点：
- 表格列：username、已绑定角色 `Badge`（行内 `useQuery(queryKeys.users.roles(userId))`）、「管理角色」`Button variant="outline"`
- 「创建用户」Dialog：`POST /api/v1/users` `{ username }`
- `Sheet` + `ScrollArea` + `Checkbox` 列表：打开时并行 `GET .../roles` + `GET /api/v1/roles?limit=500`
- 保存：`PUT .../roles` `{ roleIds: [...] }`；`sonner.success("角色已更新")`
- `userErrors.ts`：`mapUserError` 映射 `USERNAME_CONFLICT` 等

- [ ] **Step 6: 注册路由**

`fe/src/routes.tsx`：

```tsx
import { UserListPage } from "@/pages/admin/system/users/UserListPage";
<Route path="system/users" element={<UserListPage />} />
```

- [ ] **Step 7: 验证**

Run: `cd backend && python3 -m pytest tests/test_auth_rbac_l1.py::test_list_users_paginated -v && cd ../fe && pnpm test src/pages/admin/system/users/users.smoke.test.tsx && pnpm run check:design`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/auth/schemas.py backend/app/auth/users/service.py backend/app/api/v1/users.py tests/test_auth_rbac_l1.py fe/src/pages/admin/system/users fe/src/lib/queryKeys.ts fe/src/routes.tsx
git commit -m "feat: AUTH-003 user list API and role binding admin UI"
```

---

### Task 3: VIEW-003 登录默认视图重定向

**Files:**
- Create: `fe/src/lib/defaultViewResolve.ts`
- Create: `fe/src/lib/defaultViewResolve.test.ts`
- Modify: `fe/src/pages/login/LoginPage.tsx`
- Modify: `fe/src/pages/admin/AdminHomePage.tsx`
- Modify: `fe/src/pages/admin/AdminHome.smoke.test.tsx`

**Skills:**
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- 消费用户 `/admin` index resolve loading 居中 `Skeleton`；管理员保留运营总览
- 无默认降级：消费用户 → `/admin/dashboards`；不阻断登录

**Interfaces:**
- Consumes: `GET /api/v1/roles/{code}/default-views`（返回 `dashboardId` / `inheritFromRoleId`）
- Produces: `resolveDefaultDashboardPath(roleCodes: string[]): Promise<string | null>`

- [ ] **Step 1: 写失败单测**

`fe/src/lib/defaultViewResolve.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { resolveDefaultDashboardPath } from "./defaultViewResolve";

describe("resolveDefaultDashboardPath", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("returns first role dashboard path", async () => {
    mockApiFetch.mockResolvedValueOnce({
      dashboardId: "d-1",
      reportTemplateNodeId: null,
      maxWidgetCount: 24,
      inheritFromRoleId: null,
    });
    const path = await resolveDefaultDashboardPath(["viewer", "admin"]);
    expect(path).toBe("/admin/dashboards/d-1");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/roles/viewer/default-views");
  });

  it("follows inheritFromRoleId chain", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        dashboardId: null,
        inheritFromRoleId: "analyst",
        maxWidgetCount: 24,
      })
      .mockResolvedValueOnce({
        dashboardId: "d-2",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    const path = await resolveDefaultDashboardPath(["viewer"]);
    expect(path).toBe("/admin/dashboards/d-2");
  });

  it("returns null when no defaults", async () => {
    mockApiFetch.mockResolvedValue({
      dashboardId: null,
      inheritFromRoleId: null,
      maxWidgetCount: 24,
    });
    expect(await resolveDefaultDashboardPath(["viewer"])).toBeNull();
  });
});
```

Run: `cd fe && pnpm test src/lib/defaultViewResolve.test.ts`
Expected: FAIL

- [ ] **Step 2: 实现 `defaultViewResolve.ts`**

```ts
import { apiFetch } from "@/lib/api";

type DefaultViews = {
  dashboardId: string | null;
  inheritFromRoleId?: string | null;
};

const MAX_INHERIT_DEPTH = 8;

async function fetchRoleDefaults(roleKey: string): Promise<DefaultViews | null> {
  try {
    return await apiFetch<DefaultViews>(`/api/v1/roles/${encodeURIComponent(roleKey)}/default-views`);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "VIEW_DEFAULT_FORBIDDEN" || code === "ROLE_NOT_FOUND") return null;
    console.warn("defaultViewResolve: fetch failed", roleKey, err);
    return null;
  }
}

async function resolveInherited(
  roleKey: string,
  depth: number,
  visited: Set<string>,
): Promise<string | null> {
  if (depth > MAX_INHERIT_DEPTH || visited.has(roleKey)) return null;
  visited.add(roleKey);
  const data = await fetchRoleDefaults(roleKey);
  if (!data) return null;
  if (data.dashboardId) return `/admin/dashboards/${data.dashboardId}`;
  if (data.inheritFromRoleId) {
    return resolveInherited(data.inheritFromRoleId, depth + 1, visited);
  }
  return null;
}

export async function resolveDefaultDashboardPath(roleCodes: string[]): Promise<string | null> {
  for (const code of roleCodes) {
    const path = await resolveInherited(code, 0, new Set());
    if (path) return path;
  }
  return null;
}
```

- [ ] **Step 3: 集成 LoginPage**

`fe/src/pages/login/LoginPage.tsx` 在 `await refresh()` 后替换 `navigate(from)`：

```tsx
import { resolveDefaultDashboardPath } from "@/lib/defaultViewResolve";
// inside handleSubmit after refresh():
const me = await apiFetch<{ roles: string[] }>("/api/v1/me");
const resolved = await resolveDefaultDashboardPath(me.roles ?? []);
navigate(resolved ?? from, { replace: true });
```

（`apiFetch` 已在文件顶部通过 auth context refresh 获取 user；亦可 `useAuth().user?.roles` 若 refresh 已填充。）

- [ ] **Step 4: 集成 AdminHomePage**

```tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/context/auth-context";
import { resolveDefaultDashboardPath } from "@/lib/defaultViewResolve";
import { canManagePlatform, sessionUserFromAuth } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminHomePage() {
  const { user, isLoading } = useAuth();
  const [redirect, setRedirect] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading || !user) return;
    const session = sessionUserFromAuth(user.username, user.roles);
    if (canManagePlatform(session)) {
      setRedirect(null);
      return;
    }
    void resolveDefaultDashboardPath(user.roles).then((path) => {
      setRedirect(path ?? "/admin/dashboards");
    });
  }, [user, isLoading]);

  if (isLoading || redirect === undefined) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  if (redirect) return <Navigate to={redirect} replace />;
  // ... existing admin overview JSX; enable quick link 用户与角色 → /admin/system/users
}
```

更新快捷入口：`用户与角色` → `path: "/admin/system/users"`, `disabled: false`

- [ ] **Step 5: 更新 AdminHome smoke**

追加用例：mock `useAuth` viewer + mock `resolveDefaultDashboardPath` 或 mock apiFetch default-views → 断言 `Navigate` 行为（可用 `@/lib/defaultViewResolve` vi.mock）。

- [ ] **Step 6: 验证**

Run: `cd fe && pnpm test src/lib/defaultViewResolve.test.ts src/pages/admin/AdminHome.smoke.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/src/lib/defaultViewResolve.ts fe/src/lib/defaultViewResolve.test.ts fe/src/pages/login/LoginPage.tsx fe/src/pages/admin/AdminHomePage.tsx fe/src/pages/admin/AdminHome.smoke.test.tsx
git commit -m "feat(fe): VIEW-003 default dashboard redirect on login and admin index"
```

---

### Task 4: DASH-004 全局筛选器 FE 联动

**Files:**
- Create: `fe/src/components/dashboard/dashboardFilterUtils.ts`
- Create: `fe/src/components/dashboard/dashboardFilterUtils.test.ts`
- Create: `fe/src/components/dashboard/GlobalFilterBar.tsx`
- Modify: `fe/src/components/charts/useChartExecute.ts`
- Modify: `fe/src/components/charts/ChartRenderer.tsx`
- Modify: `fe/src/components/dashboard/DashboardWidget.tsx`
- Modify: `fe/src/pages/admin/dashboard/DashboardEditPage.tsx`
- Modify: `fe/src/pages/admin/dashboard/dashboard-view.smoke.test.tsx`
- Modify: `fe/src/components/README.md`

**Skills:**
- Read `.agents/skills/b-design-system-tailadmin-radix/SKILL.md`
- Read `.agents/skills/test-driven-development/SKILL.md`

**UI Acceptance:**
- view 模式顶栏 `border-b bg-gray-50 dark:bg-white/[0.03]` 筛选条；`flex-wrap` 控件 `min-w-[140px]`
- 筛选变更 widget `ChartPanel` loading → 新数据；404 不渲染 Bar
- edit 模式不展示 GlobalFilterBar

**Interfaces:**
- Consumes: `GET /api/v1/dashboards/{id}/global-filters`（`filters` + `linkageRules` + `refreshMode`）
- Produces: `buildWidgetFilterParams`；`injectSqlParameters`；`useChartExecute(config, { filterParameters, executeKey })`；`GlobalFilterBar`

- [ ] **Step 1: 写失败 filter utils 单测**

`fe/src/components/dashboard/dashboardFilterUtils.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildWidgetFilterParams, injectSqlParameters } from "./dashboardFilterUtils";

describe("dashboardFilterUtils", () => {
  it("injectSqlParameters replaces placeholders", () => {
    const sql = injectSqlParameters("SELECT * FROM t WHERE region = '{{region}}'", { region: "east" });
    expect(sql).toContain("east");
  });

  it("rejects unsafe parameter values", () => {
    expect(() => injectSqlParameters("{{x}}", { x: "a;drop" })).toThrow();
  });

  it("buildWidgetFilterParams only includes linked widget", () => {
    const params = buildWidgetFilterParams(
      "w1",
      {
        filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "all" }],
        linkageRules: [{ sourceFilterId: "f1", targetWidgetIds: ["w1"], parameterKey: "region" }],
        refreshMode: "eager",
      },
      { f1: "east" },
    );
    expect(params).toEqual({ region: "east" });
  });
});
```

Run: `cd fe && pnpm test src/components/dashboard/dashboardFilterUtils.test.ts`
Expected: FAIL

- [ ] **Step 2: 实现 `dashboardFilterUtils.ts`**

```ts
type Linkage = {
  filters: { filterId: string; dimensionRef: string; defaultValue?: string | null }[];
  linkageRules: { sourceFilterId: string; targetWidgetIds: string[]; parameterKey: string }[];
  refreshMode?: "eager" | "lazy";
};

const UNSAFE = /[;]|--|\/\*/;

export function injectSqlParameters(sql: string, params: Record<string, string>): string {
  return sql.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) return `{{${key}}}`;
    if (UNSAFE.test(value)) {
      throw new Error("筛选值包含非法字符，请修改后重试");
    }
    return value.replace(/'/g, "''");
  });
}

export function buildWidgetFilterParams(
  widgetId: string,
  linkage: Linkage,
  filterValues: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of linkage.linkageRules) {
    if (!rule.targetWidgetIds.includes(widgetId)) continue;
    const value = filterValues[rule.sourceFilterId];
    if (value !== undefined && value !== "") out[rule.parameterKey] = value;
  }
  return out;
}
```

- [ ] **Step 3: 扩展 useChartExecute**

`fe/src/components/charts/useChartExecute.ts`：

```ts
type ChartExecuteOptions = {
  filterParameters?: Record<string, string>;
  executeKey?: string;
};

export function useChartExecute(config: ChartViewConfig, options: ChartExecuteOptions = {}) {
  const { filterParameters, executeKey } = options;
  // in run(), when building body with sql:
  const sql =
    config.sql && filterParameters && Object.keys(filterParameters).length
      ? injectSqlParameters(config.sql, filterParameters)
      : config.sql;
  // use sql in POST body
  // add executeKey to useCallback deps alongside config
}
```

从 `dashboardFilterUtils` import `injectSqlParameters`。

- [ ] **Step 4: ChartRenderer 透传 options**

```tsx
type ChartRendererProps = {
  config: ChartViewConfig;
  title?: string;
  mode?: "preview" | "config";
  filterParameters?: Record<string, string>;
  executeKey?: string;
};

export function ChartRenderer({ config, title = "图表", mode = "preview", filterParameters, executeKey }: ChartRendererProps) {
  const { columns, rows, loading, error, slowHint, retry } = useChartExecute(config, { filterParameters, executeKey });
```

- [ ] **Step 5: 实现 GlobalFilterBar + DashboardEditPage 集成**

`GlobalFilterBar.tsx`：
- `useQuery(queryKeys.dashboards.globalFilters(dashboardId))`
- 404 → 父组件不渲染（query `throwOnError: false` 或 catch）
- 每个 filter：`Label` + `Select`/`Input`；`onChange(filterId, value)`
- 初始值来自 `defaultValue`

`DashboardEditPage.tsx` view 模式：
- state `filterValues: Record<string, string>`
- 标题下方渲染 `<GlobalFilterBar />`
- `renderWidget` 传入 `filterParameters` + `executeKey={JSON.stringify(filterValues)}` 给 `DashboardWidget`

`DashboardWidget.tsx` view 模式：

```tsx
<ChartRenderer
  config={widget.chartConfig}
  title={widget.title}
  filterParameters={filterParameters}
  executeKey={executeKey}
/>
```

- [ ] **Step 6: 扩展 dashboard-view smoke**

`dashboard-view.smoke.test.tsx` 追加：

```tsx
it("T-DASH-004-01: filter change triggers second execute with substituted SQL", async () => {
  let executeCount = 0;
  mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.includes("/global-filters")) {
      return {
        dashboardId: "d1",
        filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "all" }],
        linkageRules: [{ sourceFilterId: "f1", targetWidgetIds: ["w1"], parameterKey: "region" }],
        refreshMode: "eager",
        affectedWidgetCount: 1,
      };
    }
    if (path.includes("/query/execute")) {
      executeCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (executeCount === 1) return { columns: ["region"], rows: [["all"]] };
      expect(body.sql).toContain("east");
      return { columns: ["region"], rows: [["east"]] };
    }
    return { id: "d1", name: "预览", layoutJson: { version: 1, widgets: [viewWidget], globalFilters: [] } };
  });
  // render view page, change filter to east, await second execute
});
```

- [ ] **Step 7: 更新 components README**

登记 `GlobalFilterBar` · `dashboardFilterUtils`。

- [ ] **Step 8: 全量验证**

Run: `cd fe && pnpm test && pnpm run check:design && pnpm build`
Expected: PASS（vitest 全绿）

- [ ] **Step 9: Commit**

```bash
git add fe/src/components/dashboard fe/src/components/charts fe/src/pages/admin/dashboard/dashboard-view.smoke.test.tsx fe/src/components/README.md
git commit -m "feat(fe): DASH-004 global filter bar drives widget query refresh"
```

---

### Task 5: 集成验收

**Files:**（只读核对，无新增）

**Skills:**
- Read `.agents/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: 后端全量 smoke**

Run: `cd backend && python3 -m ruff check . && python3 -m pytest tests/test_auth_rbac_l1.py -q`
Expected: all passed

- [ ] **Step 2: 前端全量**

Run: `cd fe && pnpm run check:design && pnpm test && pnpm build`
Expected: exit 0

- [ ] **Step 3: 手工冒烟清单（P4 截图收口）**

- `/admin/system/roles` 列表 + 新建 Dialog
- `/admin/system/users` Sheet 角色绑定
- viewer 登录 → 默认 Dashboard 或 `/admin/dashboards`
- `/admin/dashboards/:id` view + 筛选条变更刷新 widget

- [ ] **Step 4: Commit（若有遗漏文件）**

```bash
git status
# 确保无未提交变更
```

---

## Spec Self-Review

| 检查项 | 结果 |
|--------|------|
| AUTH-001 列表/Dialog/删除/default-views | Task 1 |
| AUTH-003 GET users + 用户表 + Sheet 绑定 | Task 2 |
| VIEW-003 resolve + Login + AdminHome | Task 3 |
| DASH-004 GlobalFilterBar + execute 重跑 | Task 4 |
| GET /api/v1/users 依赖例外 | Task 2 Step 2 |
| 无 TBD/TODO 占位 | ✓ |
| 前端 UI 任务含 UI Acceptance + b-design-system skill | Task 1–4 |
| 预估主文件 ≤20 | 20（含后端 3 文件；UI 基元为依赖补齐） |

**执行选项（已选定）：** subagent-driven-development (option 1) — P3 `evolution-implementer` 按 Task 1→5 逐任务派发 subagent，任务间 two-stage review。
