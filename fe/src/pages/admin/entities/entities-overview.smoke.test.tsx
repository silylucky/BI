import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
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

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

import { EntityOverviewPage } from "./EntityOverviewPage";

function renderOverview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EntityOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function defaultMockApi(path: string) {
  if (path === "/api/v1/metadata/entity-types") {
    return {
      items: [{ typeCode: "order", displayName: "订单", attributes: [], lifecycleStates: [] }],
    };
  }
  if (path.includes("physical-tables")) {
    return {
      items: [
        {
          tableFqn: "sales.orders",
          displayName: "订单表",
          dataSourceId: "00000000-0000-4000-8000-000000000010",
          columns: [{ name: "id", dataType: "bigint", nullable: false }],
        },
      ],
      total: 1,
    };
  }
  if (path.startsWith("/api/v1/dashboards") && !path.includes("entity-overview")) {
    return { items: [{ id: "d1", name: "销售看板" }] };
  }
  if (path.includes("entity-overview")) {
    return {
      dashboardId: "d1",
      entityTypeRef: "order",
      statCards: [{ metricKey: "count", label: "实体数" }],
      filters: [],
      drillTargets: [{ widgetId: "w1", targetDashboardId: "d2" }],
    };
  }
  return { items: [] };
}

describe("EntityOverviewPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => defaultMockApi(path));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("T-DASH-005-01: renders tabs and table with mock APIs", async () => {
    renderOverview();
    expect(await screen.findByText("实体总览")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "订单" })).toBeInTheDocument();
    expect(await screen.findByText("订单表")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "下钻" })).toBeInTheDocument();
  });

  it("T-DASH-005-02: empty entity types state", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/metadata/entity-types") return { items: [] };
      return { items: [] };
    });
    renderOverview();
    expect(await screen.findByText("请先配置实体类型")).toBeInTheDocument();
  });

  it("T-DASH-005-03: error state with retry", async () => {
    const { ApiRequestError } = await import("@/lib/api");
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/metadata/entity-types") {
        throw new ApiRequestError("加载失败", "NETWORK_ERROR");
      }
      return { items: [] };
    });
    renderOverview();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    });
  });
});

describe("EntityOverviewPage DASH-005 completion", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => defaultMockApi(path));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("T-DASH-005-04: viewer role shows forbidden message", async () => {
    vi.doMock("@/context/auth-context", () => ({
      useAuth: () => ({
        user: { id: "v1", username: "viewer", roles: ["viewer"] },
        isLoading: false,
        isAuthenticated: true,
        logout: vi.fn(),
        refresh: vi.fn(async () => {}),
      }),
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));
    vi.resetModules();
    const { EntityOverviewPage: ViewerPage } = await import("./EntityOverviewPage");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ViewerPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("无权查看实体总览")).toBeInTheDocument();
    vi.resetModules();
  });

  it("T-DASH-005-05: empty physical shows datasources link", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/metadata/entity-types") {
        return { items: [{ typeCode: "order", displayName: "订单", attributes: [], lifecycleStates: [] }] };
      }
      if (path.includes("physical-tables")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/dashboards") && !path.includes("entity-overview")) {
        return { items: [{ id: "d1", name: "看板" }] };
      }
      if (path.includes("entity-overview")) {
        return { dashboardId: "d1", entityTypeRef: "order", statCards: [], filters: [], drillTargets: [] };
      }
      return { items: [] };
    });
    renderOverview();
    expect(await screen.findByText("暂无登记的实体表")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "前往数据源浏览 schema" })).toHaveAttribute(
      "href",
      "/admin/datasources",
    );
  });

  it("T-DASH-005-06: detail sheet shows tableFqn", async () => {
    const user = userEvent.setup();
    renderOverview();
    await user.click(await screen.findByRole("button", { name: "详情" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("sales.orders")).toBeInTheDocument();
  });

  it("T-DASH-005-07: drill navigates to dashboard", async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();
    renderOverview();
    await user.click(await screen.findByRole("button", { name: "下钻" }));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/dashboards/d2");
  });

  it("T-DASH-005-08: metricSource resolves widget metricKey value", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === `/api/v1/dashboards/d1`) {
        return {
          id: "d1",
          layoutJson: {
            widgets: [
              {
                id: "w-kpi",
                chartConfig: {
                  chartType: "kpi",
                  mode: "sql",
                  dataSourceId: "00000000-0000-4000-8000-000000000010",
                  sql: "SELECT 42 AS total_orders",
                  metrics: [{ field: "total_orders" }],
                },
              },
            ],
          },
        };
      }
      if (path === "/api/v1/query/execute" && init?.method === "POST") {
        return { columns: ["total_orders"], rows: [[42]] };
      }
      if (path.includes("entity-overview")) {
        return {
          dashboardId: "d1",
          entityTypeRef: "order",
          statCards: [
            { metricKey: "count", label: "实体数" },
            { metricKey: "total_orders", label: "订单", metricSource: { widgetId: "w-kpi" } },
          ],
          filters: [],
          drillTargets: [{ widgetId: "w1", targetDashboardId: "d2" }],
        };
      }
      return defaultMockApi(path);
    });
    renderOverview();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(await screen.findByText("1")).toBeInTheDocument();
  });
});
