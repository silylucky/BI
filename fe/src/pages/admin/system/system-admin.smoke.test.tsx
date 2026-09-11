import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

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

import { SystemAdminHomePage } from "./SystemAdminHomePage";

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={["/admin/system"]}>
          <Routes>
            <Route path="/admin/system" element={<SystemAdminHomePage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("SystemAdminHomePage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("renders setup wizard and progress", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/orgs")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/users")) return { total: 1, items: [{ id: "1", username: "admin" }] };
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: "r1", code: "admin", name: "管理员", isRoot: true },
            { id: "r2", code: "analyst", name: "分析师", isRoot: false },
          ],
          total: 2,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      if (path.startsWith("/api/v1/platform/delivery/email/slots")) {
        return { items: [{ configured: false }] };
      }
      return {};
    });
    renderHome();
    expect(await screen.findByText("首租户配置向导")).toBeInTheDocument();
    expect(await screen.findByText("权限怎么配？")).toBeInTheDocument();
    expect(await screen.findByText("基础配置（必做）")).toBeInTheDocument();
    expect(await screen.findByText("建立组织架构")).toBeInTheDocument();
    expect(await screen.findByText("配置岗位角色")).toBeInTheDocument();
  });

  it("links to org setup step", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/orgs")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/users")) return { total: 1, items: [] };
      if (path.startsWith("/api/v1/roles")) return { items: [{ id: "r1", isRoot: true }], total: 1 };
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      if (path.startsWith("/api/v1/platform/delivery/email/slots")) {
        return { items: [{ configured: false }] };
      }
      return {};
    });
    renderHome();
    const link = await screen.findByRole("link", { name: /建立组织架构/ });
    expect(link).toHaveAttribute("href", "/admin/system/orgs");
  });

  it("marks users step incomplete when only current admin exists", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/orgs")) return { items: [{ id: "o1", name: "总部" }], total: 1 };
      if (path.startsWith("/api/v1/users")) {
        return { total: 1, items: [{ id: "1", username: "admin" }] };
      }
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: "r1", isRoot: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      if (path.startsWith("/api/v1/platform/delivery/email/slots")) {
        return { items: [{ configured: false }] };
      }
      return {};
    });
    renderHome();
    const usersStep = await screen.findByRole("link", { name: /开通用户账号/ });
    expect(usersStep).toHaveTextContent("去配置");
  });

  it("marks users step complete when another user exists", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/orgs")) return { items: [{ id: "o1", name: "总部" }], total: 1 };
      if (path.startsWith("/api/v1/users")) {
        return {
          total: 2,
          items: [
            { id: "1", username: "admin" },
            { id: "2", username: "alice" },
          ],
        };
      }
      if (path.startsWith("/api/v1/roles")) {
        return { items: [{ id: "r1", isRoot: true }], total: 1 };
      }
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      if (path.startsWith("/api/v1/platform/delivery/email/slots")) {
        return { items: [{ configured: false }] };
      }
      return {};
    });
    renderHome();
    const usersStep = await screen.findByRole("link", { name: /开通用户账号/ });
    expect(usersStep).toHaveTextContent("查看或调整");
  });
});
