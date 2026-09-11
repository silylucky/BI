import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiRequestError } from "@/lib/api";
import { GrantsPage } from "./GrantsPage";

const ROLE_ID = "11111111-1111-4111-8111-111111111111";
const RES_ID = "22222222-2222-4222-8222-222222222222";
const GRANT_ID = "33333333-3333-4333-8333-333333333333";
const DASH_NAME = "销售看板";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const REPORT_NAME = "月报模板";

function renderGrants() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/system/grants"]}>
          <Routes>
            <Route path="/admin/system/grants" element={<GrantsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

describe("GrantsPage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-AUTH-004-FE-01: renders table with role name, resource type, resource id", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return {
          items: [
            { id: GRANT_ID, roleId: ROLE_ID, resourceType: "dashboard", resourceId: RES_ID },
          ],
        };
      }
      return {};
    });
    renderGrants();
    expect(await screen.findByRole("table", { name: "资源授权列表" })).toBeInTheDocument();
    expect(await screen.findByText("分析师")).toBeInTheDocument();
    expect(await screen.findByText("仪表板")).toBeInTheDocument();
    expect(await screen.findByText(RES_ID)).toBeInTheDocument();
  });

  it("T-AUTH-004-FE-02: create dialog shows field errors on empty submit", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
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
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/resource-grants" && init?.method === "POST") {
        return { id: GRANT_ID, roleId: ROLE_ID, resourceType: "dashboard", resourceId: RES_ID };
      }
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true },
          ],
          total: 1,
        };
      }
      if (path.includes("/api/v1/dashboards")) {
        return { items: [{ id: RES_ID, name: DASH_NAME }], total: 1, limit: 100, offset: 0 };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        listCalls += 1;
        if (listCalls === 1) return { items: [] };
        return {
          items: [
            { id: GRANT_ID, roleId: ROLE_ID, resourceType: "dashboard", resourceId: RES_ID },
          ],
        };
      }
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "新建授权" }));
    await userEvent.click(screen.getByLabelText("角色"));
    await userEvent.click(await screen.findByRole("option", { name: "分析师" }));
    await userEvent.click(screen.getByLabelText("资源类型"));
    await userEvent.click(await screen.findByRole("option", { name: "仪表板" }));
    await userEvent.click(screen.getByLabelText("选择仪表板"));
    await userEvent.click(await screen.findByRole("option", { name: DASH_NAME }));
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(DASH_NAME)).toBeInTheDocument();
  });

  it("T-AUTH-004-FE-04: revoke AlertDialog calls DELETE", async () => {
    const deletePaths: string[] = [];
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (init?.method === "DELETE") deletePaths.push(path);
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return {
          items: [
            { id: GRANT_ID, roleId: ROLE_ID, resourceType: "datasource", resourceId: RES_ID },
          ],
        };
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

  it("T-AUTH-004-FE-05: shows pagination when filtered grants exceed page size", async () => {
    const manyGrants = Array.from({ length: 25 }, (_, i) => ({
      id: `grant-${i}`,
      roleId: ROLE_ID,
      resourceType: "dashboard",
      resourceId: `res-${String(i).padStart(4, "0")}`,
    }));
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [{ id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true }],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return { items: manyGrants };
      }
      return {};
    });
    renderGrants();
    expect(await screen.findByRole("navigation", { name: "分页" })).toBeInTheDocument();
    expect(screen.getByText("res-0000")).toBeInTheDocument();
    expect(screen.queryByText("res-0020")).not.toBeInTheDocument();
  });

  it("T-AUTH-004-FE-06: role filter hides grants for other roles", async () => {
    const ROLE_B = "44444444-4444-4444-8444-444444444444";
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true },
            { id: ROLE_B, code: "viewer", name: "查看者", description: null, isActive: true },
          ],
          total: 2,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        return {
          items: [
            { id: GRANT_ID, roleId: ROLE_ID, resourceType: "dashboard", resourceId: RES_ID },
            { id: "grant-b", roleId: ROLE_B, resourceType: "dashboard", resourceId: "res-viewer" },
          ],
        };
      }
      return {};
    });
    renderGrants();
    expect(await screen.findByText(RES_ID)).toBeInTheDocument();
    expect(screen.getByText("res-viewer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "筛选角色" }));
    await userEvent.click(await screen.findByRole("option", { name: "分析师" }));
    expect(await screen.findByText(RES_ID)).toBeInTheDocument();
    expect(screen.queryByText("res-viewer")).not.toBeInTheDocument();
  });

  it("T-AUTH-004-FE-07: report picker creates grant and shows template name", async () => {
    let listCalls = 0;
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/resource-grants" && init?.method === "POST") {
        return {
          id: GRANT_ID,
          roleId: ROLE_ID,
          resourceType: "report",
          resourceId: REPORT_ID,
        };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes")) {
        return {
          items: [
            {
              id: REPORT_ID,
              name: REPORT_NAME,
              parentId: null,
              nodeType: "template",
              templateKind: "excel",
              templateKey: "monthly",
              sortOrder: 0,
            },
          ],
        };
      }
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "analyst", name: "分析师", description: null, isActive: true },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) {
        listCalls += 1;
        if (listCalls === 1) return { items: [] };
        return {
          items: [
            { id: GRANT_ID, roleId: ROLE_ID, resourceType: "report", resourceId: REPORT_ID },
          ],
        };
      }
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "新建授权" }));
    await userEvent.click(screen.getByLabelText("角色"));
    await userEvent.click(await screen.findByRole("option", { name: "分析师" }));
    await userEvent.click(screen.getByLabelText("资源类型"));
    await userEvent.click(await screen.findByRole("option", { name: "报表" }));
    await userEvent.click(screen.getByLabelText("选择报表模板"));
    await userEvent.click(await screen.findByRole("option", { name: REPORT_NAME }));
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(REPORT_NAME)).toBeInTheDocument();
    const postCall = mockApiFetch.mock.calls.find(
      (c) => c[0] === "/api/v1/resource-grants" && (c[1] as RequestInit)?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    expect(body.resource_type).toBe("report");
    expect(body.resource_id).toBe(REPORT_ID);
  });

  it("T-AUTH-C1-02: org-scoped grant POST shows scope error", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/resource-grants" && init?.method === "POST") {
        throw new ApiRequestError(
          "该角色不在你可管理的组织范围内",
          "ORG_SCOPE_FORBIDDEN",
        );
      }
      if (path.startsWith("/api/v1/roles")) {
        return {
          items: [
            { id: ROLE_ID, code: "orphan", name: "外部角色", description: null, isActive: true },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      if (path.includes("/api/v1/dashboards")) {
        return { items: [{ id: RES_ID, name: DASH_NAME }], total: 1, limit: 100, offset: 0 };
      }
      return {};
    });
    renderGrants();
    await userEvent.click(await screen.findByRole("button", { name: "新建授权" }));
    await userEvent.click(screen.getByLabelText("角色"));
    await userEvent.click(await screen.findByRole("option", { name: "外部角色" }));
    await userEvent.click(screen.getByLabelText("资源类型"));
    await userEvent.click(await screen.findByRole("option", { name: "仪表板" }));
    await userEvent.click(screen.getByLabelText("选择仪表板"));
    await userEvent.click(await screen.findByRole("option", { name: DASH_NAME }));
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(
      await screen.findByText("该角色不在你可管理的组织范围内"),
    ).toBeInTheDocument();
  });
});
