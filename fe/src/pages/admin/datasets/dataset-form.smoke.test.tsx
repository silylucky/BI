import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
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
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { DatasetFormPage } from "./DatasetFormPage";
import { DatasetListPage } from "./DatasetListPage";

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

function renderCreateForm() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/admin/datasets/new"]}>
      <Routes>
        <Route path="/admin/datasets/new" element={<DatasetFormPage mode="create" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectSelectedCount(selected: number, total: number) {
  const label = `已选 ${selected}/${total}`;
  expect(screen.getByTestId("bind-selected-count")).toHaveTextContent(label);
}

function renderList() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/admin/datasets"]}>
      <Routes>
        <Route path="/admin/datasets" element={<DatasetListPage />} />
        <Route path="/admin/datasets/new" element={<DatasetFormPage mode="create" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Dataset form pages", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it("T1-FE-01: create page renders form with SchemaBrowser picker", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return { items: [{ id: "ds-1", name: "分析库", database: "public", type: "postgresql" }] };
      }
      if (path.endsWith("/schemas")) return { items: [{ name: "public" }] };
      if (path.includes("/tables")) return { items: [{ name: "orders", type: "table" }] };
      if (path.includes("/columns")) {
        return { items: [{ name: "id", dataType: "integer", nullable: false }] };
      }
      return {};
    });

    renderCreateForm();
    expect(await screen.findByRole("heading", { name: "新建 Dataset" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回列表" })).toHaveAttribute("href", "/admin/datasets");
    expect(await screen.findByLabelText("选择数据源")).toBeInTheDocument();
    expect(await screen.findByText("当前数据表")).toBeInTheDocument();
    expect(screen.queryByText("已选表")).not.toBeInTheDocument();
    expect(await screen.findByTestId("schema-browser")).toBeInTheDocument();
    expect(screen.queryByLabelText(/计算字段 JSON/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/datasources/ds-1/schemas"),
    );
  });

  it("T1-FE-02: list links to standalone create page", async () => {
    mockApiFetch.mockResolvedValue({ items: [], total: 0 });
    renderList();
    expect(await screen.findByText("暂无 Dataset")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /新建 Dataset/i })[0]).toHaveAttribute(
      "href",
      "/admin/datasets/new",
    );
  });

  it("T1-FE-07: list shows source health badge when API marks missing", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/datasets")) {
        return {
          items: [
            {
              datasetId: "stale_ds",
              displayName: "失效 Dataset",
              tables: [{ name: "public.orders" }],
              boundConfigId: null,
              sourceHealth: "missing",
            },
          ],
          total: 1,
        };
      }
      return {};
    });
    renderList();
    expect(await screen.findByText("失效 Dataset")).toBeInTheDocument();
    expect(screen.getByText("数据源不可用")).toBeInTheDocument();
  });

  it("T1-FE-03: edit page loads existing dataset with field workbench", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasets/ds-demo") {
        return {
          datasetId: "ds-demo",
          displayName: "演示",
          tables: [{ name: "public.orders" }],
          computedFields: [{ name: "amt2", expression: "amount * 2" }],
          allowedRoles: ["analyst"],
          tableSourceDataSourceId: "ds-1",
          boundConfigId: null,
        };
      }
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return { items: [{ id: "ds-1", name: "分析库", database: "public", type: "postgresql" }] };
      }
      if (path.endsWith("/schemas")) return { items: [{ name: "public" }] };
      if (path.includes("/tables")) return { items: [{ name: "orders", type: "table" }] };
      if (path.includes("/columns")) {
        return {
          items: [
            { name: "id", dataType: "integer", nullable: false },
            { name: "amount", dataType: "numeric", nullable: true },
          ],
        };
      }
      return {};
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/datasets/ds-demo/edit"]}>
        <Routes>
          <Route path="/admin/datasets/:id/edit" element={<DatasetFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "编辑数据集" })).toBeInTheDocument();
    expect(await screen.findByText("当前数据表")).toBeInTheDocument();
    expect(screen.queryByText("已选表")).not.toBeInTheDocument();
    expect(await screen.findByText("字段工作台")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "更换" })).toBeInTheDocument();
    expect(screen.getAllByText("public.orders").length).toBeGreaterThan(0);
    expect(screen.queryByRole("tab", { name: /绑定配置/ })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /计算字段/ }));
    expect(await screen.findByDisplayValue("amt2")).toBeInTheDocument();
  });

  it("T1-FE-04: sync dataset shows merged field workbench without bind tab", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasets/orders_clean_3") {
        return {
          datasetId: "orders_clean_3",
          displayName: "同步：rest REST API2323",
          origin: "sync_job",
          syncJobId: "38da8834-0000-4000-8000-000000000001",
          tables: [{ name: "public.orders_clean_3" }],
          computedFields: [],
          allowedRoles: ["analyst"],
          tableSourceDataSourceId: "ds-analytics",
          boundConfigId: "cfg-bound",
        };
      }
      if (path === "/api/v1/query/configs/cfg-bound") {
        return {
          id: "cfg-bound",
          configType: "dataset_query",
          payload: {
            dataSourceId: "ds-analytics",
            connectorType: "postgresql",
            schema: "public",
            table: "orders_clean_3",
            columns: ["id", "amount", "region", "product_name"],
            columnKinds: { amount: "metric", region: "dimension" },
          },
        };
      }
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return {
          items: [
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
      if (path.endsWith("/schemas")) return { items: [{ name: "public" }] };
      if (path.includes("/tables")) {
        return { items: [{ name: "orders_clean_3", type: "table" }] };
      }
      if (path.includes("/columns")) {
        return {
          items: [
            { name: "id" },
            { name: "amount" },
            { name: "region" },
            { name: "product_name" },
          ],
        };
      }
      return {};
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/datasets/orders_clean_3/edit"]}>
        <Routes>
          <Route path="/admin/datasets/:id/edit" element={<DatasetFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "编辑数据集" })).toBeInTheDocument();
    expect(await screen.findByText("当前数据表")).toBeInTheDocument();
    expect(screen.queryByText("已选表")).not.toBeInTheDocument();
    expect(await screen.findByText("字段工作台")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /绑定配置/ })).not.toBeInTheDocument();
    expect(screen.getByText("同步产物")).toBeInTheDocument();
    expect(await screen.findByText("已绑定")).toBeInTheDocument();
    expect(screen.getByTestId("sync-output-datasource")).toHaveTextContent("托管分析库");
    expect(screen.getByTestId("sync-output-datasource")).toHaveTextContent("127.0.0.1:5433 / analytics");
    expect(screen.getByTestId("sync-output-datasource")).toHaveTextContent("analytics");
    expect(screen.getByText(/图表将查询表/)).toHaveTextContent("public.orders_clean_3");
    await waitFor(() => {
      expect(screen.getByTestId("bind-selected-count").textContent).toContain("已选 4/");
    });
    expect(screen.getByRole("button", { name: "刷新绑定（自动识别）" })).toBeInTheDocument();
    expect(screen.queryByText("加载中…")).not.toBeInTheDocument();
  });

  it("T1-FE-05: bound columns are checked when tableSourceDataSourceId is missing", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasets/gov_budget") {
        return {
          datasetId: "gov_budget",
          displayName: "my",
          tables: [{ name: "sample_db.gov_budget_items" }],
          computedFields: [],
          allowedRoles: ["analyst"],
          tableSourceDataSourceId: null,
          boundConfigId: "cfg-gov",
        };
      }
      if (path === "/api/v1/query/configs/cfg-gov") {
        return {
          id: "cfg-gov",
          configType: "dataset_query",
          payload: {
            dataSourceId: "ds-mysql",
            connectorType: "mysql",
            schema: "sample_db",
            table: "gov_budget_items",
            columns: ["id", "fiscal_year", "category", "budget_amount", "spent_amount"],
            columnKinds: { budget_amount: "metric", spent_amount: "metric" },
          },
        };
      }
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return {
          items: [{ id: "ds-mysql", name: "样例 MySQL-2", database: "sample_db", type: "mysql" }],
        };
      }
      if (path.includes("/columns")) {
        return {
          items: [
            { name: "id" },
            { name: "fiscal_year" },
            { name: "category" },
            { name: "budget_amount" },
            { name: "spent_amount" },
          ],
        };
      }
      return {};
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/datasets/gov_budget/edit"]}>
        <Routes>
          <Route path="/admin/datasets/:id/edit" element={<DatasetFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("字段工作台")).toBeInTheDocument();
    await waitFor(() => expectSelectedCount(5, 5));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "id" })).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "budget_amount" })).toBeChecked();
  });

  it("T1-FE-06: shows bound fields before column metadata finishes loading", async () => {
    const columnsDeferred = new Promise<{ items: Array<{ name: string }> }>(() => {
      /* never resolves — simulates slow columns API */
    });

    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasets/slow_cols") {
        return {
          datasetId: "slow_cols",
          displayName: "同步：样例 REST API",
          origin: "sync_job",
          syncJobId: "cc2cccb0-0000-4000-8000-000000000001",
          tables: [{ name: "api.endpoints" }],
          computedFields: [],
          allowedRoles: ["analyst"],
          tableSourceDataSourceId: "ds-analytics",
          boundConfigId: "cfg-slow",
        };
      }
      if (path === "/api/v1/query/configs/cfg-slow") {
        return {
          id: "cfg-slow",
          configType: "dataset_query",
          payload: {
            dataSourceId: "ds-analytics",
            connectorType: "postgresql",
            schema: "api",
            table: "endpoints",
            columns: ["id", "method", "path", "status", "latency_ms", "created_at"],
            columnKinds: { latency_ms: "metric" },
          },
        };
      }
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return {
          items: [
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
      if (path.includes("/columns")) {
        return columnsDeferred;
      }
      return {};
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/datasets/slow_cols/edit"]}>
        <Routes>
          <Route path="/admin/datasets/:id/edit" element={<DatasetFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("字段工作台")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "id" })).toBeChecked());
    expect(screen.queryByText("加载列信息中…")).not.toBeInTheDocument();
    expect(screen.getByTestId("bind-selected-count").textContent).toContain("已选 6/");
  });

  it("T1-FE-08: demo package dataset locks field workbench controls", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/datasets/demo-sales-detail") {
        return {
          datasetId: "demo-sales-detail",
          displayName: "【官方示例】销售明细",
          isDemoPackage: true,
          tables: [{ name: "sample_db.sales" }],
          computedFields: [],
          allowedRoles: ["analyst"],
          tableSourceDataSourceId: "ds-demo",
          boundConfigId: "cfg-demo",
        };
      }
      if (path === "/api/v1/query/configs/cfg-demo") {
        return {
          id: "cfg-demo",
          configType: "dataset_query",
          payload: {
            dataSourceId: "ds-demo",
            connectorType: "mysql",
            schema: "sample_db",
            table: "sales",
            columns: ["sale_date", "amount", "quantity", "channel"],
            columnKinds: { amount: "metric", quantity: "metric" },
          },
        };
      }
      if (path.includes("/columns")) {
        return {
          items: [
            { name: "id" },
            { name: "sale_date" },
            { name: "region_id" },
            { name: "product_id" },
            { name: "customer_id" },
            { name: "channel" },
            { name: "quantity" },
            { name: "amount" },
          ],
        };
      }
      if (path.startsWith("/api/v1/datasources") && !path.includes("/schemas")) {
        return {
          items: [{ id: "ds-demo", name: "示例数据", code: "demo", database: "sample_db", type: "mysql" }],
        };
      }
      return {};
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/admin/datasets/demo-sales-detail/edit"]}>
        <Routes>
          <Route path="/admin/datasets/:id/edit" element={<DatasetFormPage mode="edit" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("字段工作台")).toBeInTheDocument();
    expect(await screen.findByTestId("demo-fields-locked-alert")).toBeInTheDocument();
    await waitFor(() => expectSelectedCount(4, 8));
    expect(screen.getByRole("checkbox", { name: "sale_date" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "sale_date" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "自动识别" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "全选" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "更换" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("显示名")).toBeDisabled();
  });
});
