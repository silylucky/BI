import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});
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

import { ApiRequestError } from "@/lib/api";
import { UserListPage } from "./UserListPage";

const ROLE_A = "00000000-0000-4000-8000-000000000001";
const USER_A = "00000000-0000-4000-8000-000000000010";
const ORG_A = "00000000-0000-4000-8000-000000000020";
const DASHBOARD_GRANT_ID = "00000000-0000-4000-8000-000000000030";

function renderUsers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={["/admin/system/users"]}>
          <Routes>
            <Route path="/admin/system/users" element={<UserListPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function listUsersResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ id: USER_A, username: "alice", isActive: true, lockedUntil: null, ...overrides }],
    total: 1,
  };
}

describe("UserListPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-003-01: renders user table from GET /users", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/users") && !path.includes("/roles") && !path.includes("/org")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("T-AUTH-003-02: save role bind triggers PUT with roleIds", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/roles` && init?.method === "PUT") {
        return { items: [{ id: ROLE_A, code: "viewer", name: "查看者" }] };
      }
      if (path === `/api/v1/users/${USER_A}/roles`) {
        return { items: [] };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: ROLE_A, code: "viewer", name: "查看者", isActive: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users")) {
        return listUsersResponse();
      }
      return {};
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    const checkbox = await screen.findByRole("checkbox", { name: /查看者/ });
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "保存角色绑定" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}/roles` && (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.role_ids).toEqual([ROLE_A]);
    });
  });

  it("T-AUTH-003-03: create user POST includes initialPassword", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/users" && init?.method === "POST") {
        return { id: "new-id", username: "bob" };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(screen.getByRole("button", { name: "创建用户" }));
    await userEvent.type(screen.getByLabelText("用户名"), "bob");
    await userEvent.type(screen.getByRole("textbox", { name: /初始密码/ }), "Secret123!");
    await userEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === "/api/v1/users" && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String((postCall![1] as RequestInit).body));
      expect(body).toEqual({ username: "bob", initialPassword: "Secret123!" });
    });
    expect(await screen.findByText("用户已创建")).toBeInTheDocument();
    expect(screen.getByText("Secret123!")).toBeInTheDocument();
  });

  it("T-AUTH-003-04: assign org triggers PUT /users/{id}/org", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/org` && init?.method === "PUT") {
        return { id: ORG_A, parent_id: null, name: "总部", path: "/hq", level: 0 };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [{ id: ORG_A, parent_id: null, name: "总部", path: "/hq", level: 0 }] };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.click(screen.getByRole("combobox", { name: "选择组织" }));
    await userEvent.click(await screen.findByRole("option", { name: /总部/ }));
    await userEvent.click(screen.getByRole("button", { name: "保存组织归属" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}/org` && (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.org_node_id).toBe(ORG_A);
    });
  });

  it("saves email via PATCH /users/{id}", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}` && init?.method === "PATCH") {
        return { id: USER_A, username: "alice", email: "alice@example.com" };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.type(await screen.findByLabelText("邮箱"), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: "保存联系方式" }));
    await waitFor(() => {
      const patchCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}` && (c[1] as RequestInit)?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(String((patchCall![1] as RequestInit).body));
      expect(body.email).toBe("alice@example.com");
    });
    expect(screen.queryByLabelText("钉钉账号")).not.toBeInTheDocument();
  });

  it("T-AUTH-003-05: reset password triggers POST /users/{id}/reset-password", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/reset-password` && init?.method === "POST") {
        return { temporaryPassword: "TempPass99!", passwordChangedAt: new Date().toISOString() };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.click(screen.getByRole("button", { name: "重置密码" }));
    await userEvent.click(await screen.findByRole("button", { name: "确认重置" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) =>
          c[0] === `/api/v1/users/${USER_A}/reset-password` &&
          (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
    });
    expect(await screen.findByText("TempPass99!")).toBeInTheDocument();
  });

  it("T-AUTH-003-06: disable user triggers POST /users/{id}/disable", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/disable` && init?.method === "POST") {
        return { id: USER_A, username: "alice", isActive: false, lockedUntil: null };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.click(screen.getByRole("button", { name: "停用账号" }));
    await userEvent.click(await screen.findByRole("button", { name: "确认停用" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}/disable` && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
    });
    expect(await screen.findByRole("button", { name: "重新启用" })).toBeInTheDocument();
    expect(screen.getByText("已停用")).toBeInTheDocument();
  });

  it("T-AUTH-003-07: unlock user triggers POST /users/{id}/unlock", async () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/unlock` && init?.method === "POST") {
        return { id: USER_A, username: "alice", isActive: true, lockedUntil: null };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return listUsersResponse({ lockedUntil });
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.click(screen.getByRole("button", { name: "解除锁定" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}/unlock` && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
    });
    expect(await screen.findByText("正常")).toBeInTheDocument();
  });

  it("T-AUTH-003-08: delete user triggers DELETE /users/{id}", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}` && init?.method === "DELETE") {
        return undefined;
      }
      if (path === `/api/v1/users/${USER_A}/roles`) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /删除 alice/ }));
    await userEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => {
      const delCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/users/${USER_A}` && (c[1] as RequestInit)?.method === "DELETE",
      );
      expect(delCall).toBeTruthy();
    });
  });

  it("T-AUTH-003-09: batch delete triggers DELETE for selected users", async () => {
    const USER_B = "00000000-0000-4000-8000-000000000011";
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (init?.method === "DELETE" && path.startsWith("/api/v1/users/")) {
        return undefined;
      }
      if (path.startsWith("/api/v1/users") && !path.includes("/roles")) {
        return {
          items: [
            { id: USER_A, username: "alice", isActive: true, lockedUntil: null },
            { id: USER_B, username: "bob", isActive: true, lockedUntil: null },
          ],
          total: 2,
        };
      }
      if (path.includes("/roles")) {
        return { items: [] };
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "批量操作" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /选择用户 alice/ }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /选择用户 bob/ }));
    await userEvent.click(screen.getByRole("button", { name: "删除 (2)" }));
    await userEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => {
      const deletes = mockApiFetch.mock.calls.filter(
        (c) => (c[1] as RequestInit)?.method === "DELETE" && String(c[0]).startsWith("/api/v1/users/"),
      );
      expect(deletes.length).toBe(2);
    });
  });

  it("T-AUTH-C2-01: override grants tab PUT resource-grants", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/resource-grants` && init?.method === "PUT") {
        return {
          id: "grant-1",
          userId: USER_A,
          resourceType: "dashboard",
          resourceId: DASHBOARD_GRANT_ID,
          effect: "add",
        };
      }
      if (path === `/api/v1/users/${USER_A}/resource-grants`) {
        return { items: [] };
      }
      if (path === `/api/v1/users/${USER_A}/roles`) {
        return { items: [] };
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return { items: [] };
      }
      if (path.startsWith("/api/v1/users")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "例外授权" }));
    await userEvent.type(await screen.findByLabelText("资源 ID"), DASHBOARD_GRANT_ID);
    await userEvent.click(screen.getByRole("button", { name: "添加例外授权" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) =>
          c[0] === `/api/v1/users/${USER_A}/resource-grants` &&
          (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.resource_type).toBe("dashboard");
      expect(body.resource_id).toBe(DASHBOARD_GRANT_ID);
      expect(body.effect).toBe("add");
    });
  });

  it("T-AUTH-C1-01: org-scoped user list shows subtree members only", async () => {
    const USER_INSIDER = "00000000-0000-4000-8000-000000000011";
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/users") && !path.includes("/roles") && !path.includes("/org")) {
        return {
          items: [
            { id: USER_A, username: "alice", isActive: true, lockedUntil: null },
            { id: USER_INSIDER, username: "bob", isActive: true, lockedUntil: null },
          ],
          total: 2,
        };
      }
      return { items: [] };
    });
    renderUsers();
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("outsider")).not.toBeInTheDocument();
  });

  it("T-AUTH-C1-03: org-scoped org assign shows scope error", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/users/${USER_A}/org` && init?.method === "PUT") {
        throw new ApiRequestError(
          "目标组织不在你可管理的范围内",
          "ORG_SCOPE_FORBIDDEN",
          403,
        );
      }
      if (path === `/api/v1/users/${USER_A}/org`) {
        throw new ApiRequestError("User has no org assignment", "USER_ORG_NOT_SET", 404);
      }
      if (path.startsWith("/api/v1/orgs")) {
        return {
          items: [
            { id: ORG_A, name: "外部组织", path: "/external", level: 0, parentId: null },
          ],
        };
      }
      if (path.startsWith("/api/v1/users")) {
        return listUsersResponse();
      }
      return { items: [] };
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: /管理/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "组织与安全" }));
    await userEvent.click(screen.getByRole("combobox", { name: "选择组织" }));
    await userEvent.click(await screen.findByRole("option", { name: /外部组织/ }));
    await userEvent.click(screen.getByRole("button", { name: "保存组织归属" }));
    expect(
      await screen.findByText("目标组织不在你可管理的范围内"),
    ).toBeInTheDocument();
  });
});
