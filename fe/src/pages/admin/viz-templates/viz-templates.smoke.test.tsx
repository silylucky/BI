import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VizTemplatesHubPage } from "./VizTemplatesHubPage";

vi.mock("@/lib/exportLayoutJson", () => ({
  downloadJsonFile: vi.fn(),
}));

import { downloadJsonFile } from "@/lib/exportLayoutJson";
import { apiFetch } from "@/lib/api";

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { username: "admin", roles: ["admin"], permissions: [] },
  }),
}));

const mockTemplateItem = {
  id: "tpl-1",
  templateKey: "builtin-gov-efficiency",
  name: "政务效能分析看板",
  description: "浅灰画布 · 顶行 KPI/仪表 + 柱线双图",
  categoryKey: "government",
  surfaceKind: "dashboard" as const,
  status: "published" as const,
  thumbnailRef: null,
  visibility: "builtin" as const,
  contentRevision: 1,
  updatedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
};

const mockExportEnvelope = {
  templateVersion: 1,
  kind: "viz-layout",
  surfaceKind: "dashboard",
  name: "政务效能分析看板",
  layout: { version: 1, widgets: [], globalFilters: [] },
};

const mockScreenGovItem = {
  id: "tpl-screen-gov",
  templateKey: "builtin-gov-smart-city",
  name: "智慧城市运行监测",
  description: "政务大屏",
  categoryKey: "government",
  surfaceKind: "data-screen" as const,
  status: "published" as const,
  thumbnailRef: null,
  visibility: "builtin" as const,
  contentRevision: 1,
  updatedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
};

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/v1/dashboard-templates?")) {
      const params = new URL(url, "http://local").searchParams;
      const surfaceKind = params.get("surfaceKind");
      const categoryKey = params.get("categoryKey");
      let items = [mockTemplateItem, mockScreenGovItem];
      if (surfaceKind) {
        items = items.filter((item) => item.surfaceKind === surfaceKind);
      }
      if (categoryKey) {
        items = items.filter((item) => item.categoryKey === categoryKey);
      }
      return {
        items,
        total: items.length,
        limit: 100,
        offset: 0,
      };
    }
    if (url === "/api/v1/dashboard-templates/tpl-1") {
      return {
        ...mockTemplateItem,
        layoutJson: {
          version: 1,
          widgets: [
            {
              id: "w1",
              type: "text",
              title: "占位",
              order: 0,
              colSpan: 12,
              rowSpan: 2,
            },
          ],
          globalFilters: [],
        },
        sourceDashboardId: null,
        ownerUserId: null,
        orgScope: null,
        createdAt: new Date().toISOString(),
      };
    }
    if (url === "/api/v1/dashboard-templates/tpl-1/export") {
      return mockExportEnvelope;
    }
    if (url === "/api/v1/datasources") {
      return { items: [] };
    }
    if (url === "/api/v1/dashboards/from-template" && init?.method === "POST") {
      return { id: "dash-new" };
    }
    throw new Error(`unexpected ${url}`);
  }),
}));

function renderHub(initialEntries = ["/admin/viz-templates"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={initialEntries}>
          <VizTemplatesHubPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function hubFilters() {
  const nodes = screen.getAllByTestId("viz-templates-hub-filters");
  return nodes[nodes.length - 1]!;
}

describe("VizTemplatesHubPage smoke", () => {
  it("renders hub title, tabs and template card", async () => {
    renderHub();
    expect(screen.getByRole("heading", { name: "可视化模板" })).toBeInTheDocument();
    expect(within(hubFilters()).getByRole("button", { name: /仪表板/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(hubFilters()).getByRole("button", { name: /数据大屏/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /导入 JSON/ })).toBeInTheDocument();
    expect(await screen.findByText("政务效能分析看板")).toBeInTheDocument();
    expect(screen.queryByText("空白看板")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "预览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用模板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "政务效能分析看板 更多操作" })).toBeInTheDocument();
  });

  it("shows archive for builtin templates and hides delete", async () => {
    const user = userEvent.setup();
    renderHub();
    const [card] = await screen.findAllByTestId("viz-template-card-tpl-1");
    await user.click(within(card).getByRole("button", { name: "政务效能分析看板 更多操作" }));
    expect(await screen.findByRole("menuitem", { name: "下架" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "删除" })).not.toBeInTheDocument();
  });

  it("exports template json from card menu", async () => {
    const user = userEvent.setup();
    const downloadMock = vi.mocked(downloadJsonFile);
    downloadMock.mockClear();
    renderHub();
    const [card] = await screen.findAllByTestId("viz-template-card-tpl-1");
    await user.click(within(card).getByRole("button", { name: "政务效能分析看板 更多操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "导出" }));
    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(
        mockExportEnvelope,
        "政务效能分析看板-template.json",
      );
    });
  });

  it("opens preview dialog from card", async () => {
    const user = userEvent.setup();
    renderHub();
    const [card] = await screen.findAllByTestId("viz-template-card-tpl-1");
    await user.click(within(card).getByRole("button", { name: "预览" }));
    expect(await screen.findByTestId("template-preview-dialog")).toBeInTheDocument();
  });

  it("keeps surface tabs when 政务 category is selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderHub();
    await waitFor(() => {
      expect(within(hubFilters()).getByRole("button", { name: /仪表板/ })).toBeInTheDocument();
    });
    await user.click(within(hubFilters()).getByRole("button", { name: "政务" }));
    await waitFor(() => {
      expect(within(hubFilters()).getByRole("button", { name: "政务" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(within(hubFilters()).getByRole("button", { name: /仪表板/ })).toBeInTheDocument();
    expect(within(hubFilters()).getByRole("button", { name: /数据大屏/ })).toBeInTheDocument();
    expect(within(hubFilters()).queryByText("政务 · 大屏与看板")).not.toBeInTheDocument();
  });

  it("loads combined 政务 + 数据大屏 filters from URL", async () => {
    renderHub(["/admin/viz-templates?categoryKey=government&surfaceKind=data-screen"]);
    await waitFor(() => {
      expect(within(hubFilters()).getByRole("button", { name: /数据大屏/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(hubFilters()).getByRole("button", { name: "政务" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await waitFor(() => {
      expect(vi.mocked(apiFetch).mock.calls.some(([url]) => {
        const params = new URL(String(url), "http://local").searchParams;
        return (
          params.get("surfaceKind") === "data-screen" && params.get("categoryKey") === "government"
        );
      })).toBe(true);
    });
    expect(screen.getAllByTestId("viz-template-card-tpl-screen-gov").length).toBeGreaterThan(0);
  });

  it("preserves 政务 category when switching surface type", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderHub(["/admin/viz-templates?categoryKey=government"]);
    await waitFor(() => {
      expect(within(hubFilters()).getByRole("button", { name: "政务" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(within(hubFilters()).getByRole("button", { name: /数据大屏/ }));
    await waitFor(() => {
      expect(within(hubFilters()).getByRole("button", { name: /数据大屏/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(hubFilters()).getByRole("button", { name: "政务" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});
