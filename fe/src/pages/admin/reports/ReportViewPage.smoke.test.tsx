import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "analyst", roles: ["analyst"], isRoot: false },
    isAuthenticated: true,
  }),
}));

import { ReportViewPage } from "./ReportViewPage";

const NODE_ID = "tpl-view-1";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={[`/admin/reports/view/${NODE_ID}`]}>
          <Routes>
            <Route path="/admin/reports/view/:nodeId" element={<ReportViewPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("ReportViewPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === `/api/v1/reports/catalog/nodes/${NODE_ID}`) {
        return {
          id: NODE_ID,
          name: "季度经营报表",
          parentId: null,
          nodeType: "template",
          templateKind: "pdf",
          templateKey: "quarterly",
          sortOrder: 0,
        };
      }
      if (path === "/api/v1/reports/catalog/templates/readiness" && init?.method === "POST") {
        return { items: [{ nodeId: NODE_ID, readiness: "demo" }] };
      }
      if (path === `/api/v1/reports/templates/${NODE_ID}/run` && init?.method === "POST") {
        return {
          status: "ready",
          renderSpec: {
            sections: [{ kind: "table", columns: ["region", "revenue"], rows: [["华东", 100]] }],
          },
        };
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("auto-runs template once on mount and shows result table", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "季度经营报表" })).toBeInTheDocument();
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/v1/reports/templates/${NODE_ID}/run`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("region")).toBeInTheDocument();
    expect(screen.getByText("revenue")).toBeInTheDocument();
    expect(screen.getByText("华东")).toBeInTheDocument();
    expect(mockApiFetch.mock.calls.filter(([path]) => String(path).endsWith("/run")).length).toBe(1);
  });

  it("links back to report center hub", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /返回全部报表/ })).toHaveAttribute(
      "href",
      "/admin/reports/center",
    );
  });

  it("shows placeholder alert and readiness badge for demo templates", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === `/api/v1/reports/catalog/nodes/${NODE_ID}`) {
        return {
          id: NODE_ID,
          name: "季度经营报表",
          parentId: null,
          nodeType: "template",
          templateKind: "pdf",
          templateKey: "quarterly",
          sortOrder: 0,
        };
      }
      if (path === "/api/v1/reports/catalog/templates/readiness" && init?.method === "POST") {
        return { items: [{ nodeId: NODE_ID, readiness: "demo" }] };
      }
      if (path === `/api/v1/reports/templates/${NODE_ID}/run` && init?.method === "POST") {
        return {
          status: "ready",
          renderSpec: {
            sections: [{ kind: "table", placeholder: true }],
          },
        };
      }
      return {};
    });
    renderPage();
    expect(await screen.findByText("示例态")).toBeInTheDocument();
    expect(screen.getByText("示例态展示")).toBeInTheDocument();
    expect(screen.getByText(/模板尚未接入业务数据/)).toBeInTheDocument();
  });
});
