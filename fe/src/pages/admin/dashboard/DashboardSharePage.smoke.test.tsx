import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

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

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: ({ title }: { title?: string }) => <div data-testid="chart-mock">{title}</div>,
}));

import { DashboardSharePage } from "./DashboardSharePage";

function renderSharePage(initialEntry: string, routePath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path={routePath} element={<DashboardSharePage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockApiFetch.mockReset();
});

beforeEach(() => {
  mockApiFetch.mockReset();
});

function mockShareApi(dashboardPayload: object) {
  mockApiFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/reports/schedules")) {
      return Promise.resolve({ items: [], total: 0 });
    }
    if (typeof url === "string" && url.includes("/users")) {
      return Promise.resolve({ items: [{ id: "u1", username: "admin" }], total: 1 });
    }
    if (typeof url === "string" && url.includes("/dashboards/")) {
      return Promise.resolve(dashboardPayload);
    }
    return Promise.resolve({});
  });
}

describe("DashboardSharePage", () => {
  it("P0-01: reads layoutJson.widgets and lists embed links in dialog", async () => {
    mockShareApi({
      id: "d1",
      name: "销售看板",
      layoutJson: {
        version: 1,
        widgets: [
          {
            id: "w1",
            type: "chart",
            title: "销售额",
            colSpan: 6,
            rowSpan: 2,
            order: 0,
            chartConfig: {
              chartType: "bar",
              chartId: "w1",
              dataSourceId: "00000000-0000-4000-8000-000000000010",
              mode: "sql",
              sql: "SELECT 1",
            },
          },
        ],
        globalFilters: [],
      },
    });

    renderSharePage("/admin/dashboards/d1/share", "/admin/dashboards/:id/share");

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("销售看板 · 分享")).toBeInTheDocument();
    });
    expect(screen.getByText("销售额")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "生成公开链接" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/须签发 token 后方可匿名访问/)).toBeInTheDocument();
    expect(screen.queryByText("该看板暂无组件，请先添加图表。")).not.toBeInTheDocument();
    expect(document.querySelector(".dashboard-grid-view")).toBeNull();
  });

  it("B3: renders a v2 layout share dialog without canvas preview", async () => {
    mockShareApi({
      id: "d2",
      name: "像素分享",
      layoutJson: {
        version: 2,
        canvas: { width: 1440, height: 900 },
        widgets: [
          {
            id: "w2",
            type: "chart",
            title: "像素图表",
            order: 5,
            x: 120,
            y: 80,
            width: 480,
            height: 320,
            chartConfig: {
              chartType: "bar",
              chartId: "w2",
              dataSourceId: "00000000-0000-4000-8000-000000000010",
              mode: "sql",
              sql: "SELECT 1",
            },
          },
        ],
        globalFilters: [],
      },
    });

    renderSharePage("/admin/dashboards/d2/share", "/admin/dashboards/:id/share");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("pixel-canvas-host")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "生成公开链接" }).length).toBeGreaterThanOrEqual(1);
  });

  it("A2: renders data-screen share dialog without canvas preview", async () => {
    mockShareApi({
      id: "ds1",
      name: "运营大屏",
      layoutJson: {
        version: 2,
        canvas: { width: 1920, height: 1080 },
        widgets: [
          {
            id: "w-ds1",
            type: "chart",
            title: "核心指标",
            order: 0,
            x: 80,
            y: 60,
            width: 400,
            height: 280,
            chartConfig: {
              chartType: "bar",
              chartId: "w-ds1",
              dataSourceId: "00000000-0000-4000-8000-000000000010",
              mode: "sql",
              sql: "SELECT 1",
            },
          },
        ],
        globalFilters: [],
        styleConfig: { surfaceKind: "data-screen", colorScheme: "dark" },
      },
    });

    renderSharePage("/admin/data-screens/ds1/share", "/admin/data-screens/:id/share");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("运营大屏 · 分享")).toBeInTheDocument();
    expect(screen.getByText("整屏嵌入")).toBeInTheDocument();
    expect(screen.queryByTestId("pixel-canvas-host")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "生成公开链接" }).length).toBeGreaterThanOrEqual(1);
  });

  it("API-006: shows public share link card for dashboard", async () => {
    mockShareApi({
      id: "d3",
      name: "公开看板",
      layoutJson: {
        version: 1,
        widgets: [
          {
            id: "w3",
            type: "chart",
            title: "指标",
            colSpan: 6,
            rowSpan: 2,
            order: 0,
            chartConfig: {
              chartType: "bar",
              chartId: "w3",
              dataSourceId: "00000000-0000-4000-8000-000000000010",
              mode: "sql",
              sql: "SELECT 1",
            },
          },
        ],
        globalFilters: [],
      },
    });

    renderSharePage("/admin/dashboards/d3/share", "/admin/dashboards/:id/share");

    expect(await screen.findByText("公开链接")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "生成公开链接" }).length).toBeGreaterThanOrEqual(1);
  });

  it("G5: share dialog does not embed schedule panel", async () => {
    mockShareApi({
      id: "d4",
      name: "调度看板",
      layoutJson: {
        version: 1,
        widgets: [
          {
            id: "w4",
            type: "chart",
            title: "指标",
            colSpan: 6,
            rowSpan: 2,
            order: 0,
            chartConfig: {
              chartType: "bar",
              chartId: "w4",
              dataSourceId: "00000000-0000-4000-8000-000000000010",
              mode: "sql",
              sql: "SELECT 1",
            },
          },
        ],
        globalFilters: [],
      },
    });

    renderSharePage("/admin/dashboards/d4/share", "/admin/dashboards/:id/share");

    await waitFor(() => {
      expect(screen.getByText("调度看板 · 分享")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "创建定时报告" })).not.toBeInTheDocument();
    expect(screen.queryByText("创建前检查")).not.toBeInTheDocument();
  });
});
