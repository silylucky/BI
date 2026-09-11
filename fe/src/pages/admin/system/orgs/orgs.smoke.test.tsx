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

import { OrgTreePage } from "./OrgTreePage";

const ORG_A = "00000000-0000-4000-8000-000000000030";

function renderOrgs() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={["/admin/system/orgs"]}>
          <Routes>
            <Route path="/admin/system/orgs" element={<OrgTreePage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

const ORG_LIST = {
  items: [{ id: ORG_A, parent_id: null, name: "总部", path: "/hq", level: 0 }],
  total: 1,
  limit: 50,
  offset: 0,
};

function orgListResponse(items = ORG_LIST.items, total = items.length) {
  return { items, total, limit: 50, offset: 0 };
}

describe("OrgTreePage smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("renders org tree", async () => {
    mockApiFetch.mockResolvedValue(orgListResponse());
    renderOrgs();
    expect(await screen.findByText("总部")).toBeInTheDocument();
  });

  it("edit org triggers PUT", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === `/api/v1/orgs/${ORG_A}` && init?.method === "PUT") {
        return { id: ORG_A, parent_id: null, name: "总部（改）", path: "/hq", level: 0 };
      }
      if (path.startsWith("/api/v1/orgs")) {
        return orgListResponse();
      }
      return {};
    });
    renderOrgs();
    await userEvent.click(await screen.findByRole("button", { name: "编辑 总部" }));
    const input = screen.getByLabelText("名称");
    await userEvent.clear(input);
    await userEvent.type(input, "总部（改）");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/orgs/${ORG_A}` && (c[1] as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String((putCall![1] as RequestInit).body));
      expect(body.name).toBe("总部（改）");
    });
  });

  it("delete org triggers DELETE", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path.startsWith("/api/v1/orgs/") && init?.method === "DELETE") return {};
      if (path.startsWith("/api/v1/orgs")) {
        return orgListResponse();
      }
      return {};
    });
    renderOrgs();
    await userEvent.click(await screen.findByRole("button", { name: "删除 总部" }));
    await userEvent.click(await screen.findByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      const delCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === `/api/v1/orgs/${ORG_A}` && (c[1] as RequestInit)?.method === "DELETE",
      );
      expect(delCall).toBeTruthy();
    });
  });

  it("create org triggers POST", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/orgs" && init?.method === "POST") {
        return { id: "org-new", parent_id: null, name: "华东区", path: "/east", level: 0 };
      }
      if (path.startsWith("/api/v1/orgs")) {
        return orgListResponse([]);
      }
      return {};
    });
    renderOrgs();
    await userEvent.click(await screen.findByRole("button", { name: "新建组织" }));
    await userEvent.type(screen.getByLabelText("名称"), "华东区");
    await userEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === "/api/v1/orgs" && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String((postCall![1] as RequestInit).body));
      expect(body.name).toBe("华东区");
      expect(body.parent_id).toBeNull();
    });
  });

  it("add child org preselects parent and POST", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path === "/api/v1/orgs" && init?.method === "POST") {
        return {
          id: "org-child",
          parent_id: ORG_A,
          name: "综合处",
          path: "/hq/office",
          level: 1,
        };
      }
      if (path.startsWith("/api/v1/orgs")) {
        return orgListResponse();
      }
      return {};
    });
    renderOrgs();
    await userEvent.click(await screen.findByRole("button", { name: "为 总部 添加子组织" }));
    expect(screen.getByRole("heading", { name: "添加子组织" })).toBeInTheDocument();
    expect(screen.getByText("上级组织：总部")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("总部", { selector: "p[aria-readonly='true']" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("名称"), "综合处");
    await userEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c) => c[0] === "/api/v1/orgs" && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String((postCall![1] as RequestInit).body));
      expect(body.name).toBe("综合处");
      expect(body.parent_id).toBe(ORG_A);
    });
  });

  it("batch delete triggers DELETE for selected orgs", async () => {
    const ORG_B = "00000000-0000-4000-8000-000000000031";
    const deleted: string[] = [];
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path.startsWith("/api/v1/orgs/") && init?.method === "DELETE") {
        deleted.push(path.split("/").pop() ?? "");
        return {};
      }
      if (path.startsWith("/api/v1/orgs")) {
        return orgListResponse(
          [
            { id: ORG_A, parent_id: null, name: "总部", path: "/hq", level: 0 },
            { id: ORG_B, parent_id: null, name: "华东区", path: "/east", level: 0 },
          ],
          2,
        );
      }
      return {};
    });
    renderOrgs();
    await userEvent.click(await screen.findByRole("button", { name: "批量操作" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "选择组织 总部" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "选择组织 华东区" }));
    await userEvent.click(screen.getByRole("button", { name: "删除 (2)" }));
    await userEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(deleted.sort()).toEqual([ORG_A, ORG_B].sort());
    });
  });
});
