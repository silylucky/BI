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

import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleListPage } from "./RoleListPage";

function renderRoles() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/system/roles"]}>
          <Routes>
            <Route path="/admin/system/roles" element={<RoleListPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

describe("RoleListPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-001-01: renders table and create button", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    renderRoles();
    expect(await screen.findByRole("button", { name: "新建角色" })).toBeInTheDocument();
    expect(await screen.findByText("暂无角色")).toBeInTheDocument();
  });

  it("T-AUTH-001-03: search shows a single clear control", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    const user = userEvent.setup();
    renderRoles();
    const input = await screen.findByRole("searchbox", { name: "搜索角色" });
    await user.type(input, "阿达");
    expect(screen.getAllByRole("button", { name: "清除搜索" })).toHaveLength(1);
    expect(input).toHaveAttribute("type", "text");
  });

  it("T-AUTH-001-02: POST role refetches list", async () => {
    let listCall = 0;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
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

  it("T-AUTH-001-04: inactive filter sends is_active=false", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) {
        expect(path).toContain("is_active=false");
        return { items: [], total: 0 };
      }
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    const user = userEvent.setup();
    renderRoles();
    await screen.findByRole("button", { name: "新建角色" });
    await user.click(screen.getByRole("combobox", { name: "筛选角色状态" }));
    await user.click(await screen.findByRole("option", { name: "仅停用" }));
    await waitFor(() => {
      expect(
        mockApiFetch.mock.calls.some((c) => String(c[0]).includes("is_active=false")),
      ).toBe(true);
    });
  });

  it("T-AUTH-001-05: edit role triggers PUT", async () => {
    const ROLE_ID = "00000000-0000-4000-8000-000000000099";
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/roles/${ROLE_ID}/default-views`) {
        return { dashboardId: null, reportTemplateNodeId: null };
      }
      if (path === `/api/v1/roles/${ROLE_ID}` && init?.method === "PUT") {
        return {
          id: ROLE_ID,
          code: "analyst",
          name: "高级分析师",
          description: null,
          isActive: true,
        };
      }
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            {
              id: ROLE_ID,
              code: "analyst",
              name: "分析师",
              description: null,
              isActive: true,
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    renderRoles();
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const nameInput = await screen.findByLabelText("显示名");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "高级分析师");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/roles/${ROLE_ID}` && (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.name).toBe("高级分析师");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("T-AUTH-001-06: delete role triggers DELETE", async () => {
    const ROLE_ID = "00000000-0000-4000-8000-000000000099";
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/roles/${ROLE_ID}` && init?.method === "DELETE") {
        return {};
      }
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            {
              id: ROLE_ID,
              code: "analyst",
              name: "分析师",
              description: null,
              isActive: true,
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/dashboards")) return { items: [] };
      return {};
    });
    renderRoles();
    await userEvent.click(await screen.findByRole("button", { name: "删除" }));
    await userEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => {
      const delCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/roles/${ROLE_ID}` && (c[1] as RequestInit)?.method === "DELETE",
      );
      expect(delCall).toBeTruthy();
    });
  });
});
