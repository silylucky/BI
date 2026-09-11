import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReportTemplatesPage } from "./ReportTemplatesPage";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { roles: ["admin"] }, isAuthenticated: true }),
}));

const NODE_ID = "node-1";

describe("report templates smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string, opts?: { method?: string; body?: string }) => {
      if (path === "/api/v1/reports/center/preferences") {
        return { favorites: [], recent: [] };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes") && !path.includes("/extension")) {
        return {
          items: [
            {
              id: NODE_ID,
              name: "销售模板",
              parentId: null,
              nodeType: "template",
              templateKind: "pdf",
              templateKey: "sales_summary",
              sortOrder: 0,
            },
          ],
        };
      }
      if (path.includes("/extension/revisions")) {
        return { items: [], total: 0 };
      }
      if (path === "/api/v1/datasets/demo-daily-kpi") {
        return {
          datasetId: "demo-daily-kpi",
          displayName: "日 KPI",
          boundConfigId: "cfg-1",
          tables: [],
          origin: "manual",
        };
      }
      if (path.startsWith("/api/v1/query/configs/")) {
        return { id: "cfg-1", payload: { dataSourceId: "ds-demo", columns: ["amount"] } };
      }
      if (path.endsWith("/extension") && opts?.method === "PUT") {
        return { catalogNodeId: NODE_ID, metrics: [{ key: "amount", label: "金额" }], filters: [] };
      }
      if (path.endsWith("/extension")) {
        return { catalogNodeId: NODE_ID, metrics: [], filters: [] };
      }
      if (path.endsWith("/render-spec")) {
        return {
          templateNodeId: NODE_ID,
          revision: 1,
          metrics: [{ key: "amount", label: "金额", queryMode: "sql", expression: "SELECT 1" }],
          filters: [],
          renderVersion: "1.0",
        };
      }
      if (path.startsWith("/api/v1/datasources")) {
        return {
          items: [
            { id: "ds-demo", name: "示例数据", code: "demo", type: "mysql" },
            {
              id: "ds-analytics",
              name: "托管分析库",
              code: "analytics",
              type: "postgresql",
              host: "127.0.0.1",
              port: 5433,
              database: "analytics",
            },
          ],
        };
      }
      if (path.startsWith("/api/v1/datasets")) {
        return {
          items: [
            {
              datasetId: "demo-daily-kpi",
              displayName: "日 KPI",
              boundConfigId: "cfg-1",
            },
          ],
        };
      }
      if (path.includes("/run")) {
        return { status: "ready", renderSpec: { sections: [{ placeholder: true }] } };
      }
      return {};
    });
  });
  afterEach(() => cleanup());

  it("shows empty catalog state", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/reports/catalog/nodes")) return { items: [] };
      return {};
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText(/暂无模板目录/)).toBeInTheDocument());
  });

  it("auto-selects first template when opening page without node id", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={["/admin/reports/templates"]}>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(
      () => expect(screen.getByRole("tab", { name: "基本信息" })).toBeInTheDocument(),
      { timeout: 8000 },
    );
    expect(screen.queryByText("从目录选择模板")).not.toBeInTheDocument();
  });

  it("loads tree and shows extension preview", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={[`/admin/reports/templates?node=${NODE_ID}`]}>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "销售模板" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "预览" }));
    await waitFor(() => expect(screen.getByText("渲染版本")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("金额")).toBeInTheDocument());
  });

  it("saves extension with toast on change note", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={[`/admin/reports/templates?node=${NODE_ID}`]}>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: "扩展配置" })).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "扩展配置" }));
    await screen.findByLabelText("变更说明");
    const saveBtn = await screen.findByRole("button", { name: "保存扩展配置" });
    await user.type(screen.getByLabelText("变更说明"), "初始化");
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        ([path, opts]) => path.endsWith("/extension") && opts?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByText("金额")).toBeInTheDocument());
  });

  it("creates template inside selected folder", async () => {
    const FOLDER_ID = "folder-1";
    mockApiFetch.mockImplementation(async (path: string, opts?: { method?: string; body?: string }) => {
      if (path === "/api/v1/reports/center/preferences") {
        return { favorites: [], recent: [] };
      }
      if (path.startsWith("/api/v1/reports/templates/") && opts?.method === "PUT") {
        return JSON.parse(opts.body ?? "{}");
      }
      if (path === "/api/v1/reports/catalog/nodes" && opts?.method === "POST") {
        const body = JSON.parse(opts.body ?? "{}");
        expect(body.parentId).toBe(FOLDER_ID);
        return {
          id: "child-1",
          name: "新建模板",
          parentId: FOLDER_ID,
          nodeType: "template",
          templateKind: body.templateKind ?? "pdf",
          templateKey: body.templateKey ?? "tpl_test1234",
          sortOrder: 0,
        };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes") && !path.includes("/extension")) {
        if (path.includes("parentId=")) {
          return {
            items: [
              {
                id: "child-1",
                name: "演示销售报表",
                parentId: FOLDER_ID,
                nodeType: "template",
                templateKind: "pdf",
                templateKey: "dev_demo_report",
                sortOrder: 0,
              },
            ],
          };
        }
        return {
          items: [
            {
              id: FOLDER_ID,
              name: "演示报表",
              parentId: null,
              nodeType: "folder",
              templateKind: null,
              templateKey: null,
              sortOrder: 0,
            },
          ],
        };
      }
      if (path.endsWith("/extension")) return { catalogNodeId: "child-1", metrics: [], filters: [] };
      return { items: [] };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("演示报表")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "演示报表" }));
    await userEvent.click(screen.getByRole("button", { name: "在此新建模板" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/reports/catalog/nodes",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("saves dataset metric in extension body", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={[`/admin/reports/templates?node=${NODE_ID}`]}>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: "扩展配置" })).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "扩展配置" }));
    await screen.findByLabelText("指标键");
    fireEvent.change(screen.getByLabelText("指标键"), { target: { value: "revenue" } });
    fireEvent.change(screen.getByLabelText("显示名"), { target: { value: "营收" } });
    await user.click(screen.getByLabelText("数据集"));
    await user.click(await screen.findByRole("option", { name: /日 KPI/ }));
    await user.click(screen.getByRole("button", { name: "添加到列表" }));
    await user.type(screen.getByLabelText("变更说明"), "添加数据集指标");
    await user.click(screen.getByRole("button", { name: "保存扩展配置" }));
    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        ([path, opts]) => path.endsWith("/extension") && opts?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall?.[1] as { body: string }).body);
      expect(body.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "revenue",
            label: "营收",
            queryMode: "dataset",
            datasetId: "demo-daily-kpi",
            boundConfigId: "cfg-1",
          }),
        ]),
      );
    });
  });

  it("defaults runtime datasource to managed analytics when extension is new", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={[`/admin/reports/templates?node=${NODE_ID}`]}>
            <ReportTemplatesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: "扩展配置" })).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "扩展配置" }));
    await screen.findByLabelText("运行库");
    await waitFor(() =>
      expect(screen.getByLabelText("运行库")).toHaveValue("托管分析库"),
    );
    expect(screen.queryByLabelText("运行数据源")).not.toBeInTheDocument();
  });
});

const P95_BUDGET_MS = 3000;
const SAMPLES = 5;

function p95(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

describe("NFR-002 report query P95", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/run")) {
        return { status: "ready", renderSpec: { sections: [{ placeholder: true }] }, exportHook: { placeholder: true } };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes")) return { items: [] };
      return {};
    });
  });

  it("mock template run P95 within CI budget", async () => {
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const t0 = performance.now();
      await mockApiFetch(`/api/v1/reports/templates/${NODE_ID}/run`, { method: "POST", body: "{}" });
      samples.push(performance.now() - t0);
    }
    expect(p95(samples)).toBeLessThanOrEqual(P95_BUDGET_MS);
  });
});
