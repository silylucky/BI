import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const DS_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import { DashboardEditPage } from "./DashboardEditPage";

const viewWidget: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "表",
  colSpan: 6,
  rowSpan: 1,
  order: 0,
  chartConfig: {
    ...defaultChartConfig("table"),
    dataSourceId: DS_ID,
    mode: "sql",
    sql: "SELECT 1 AS id",
  },
};

describe("dashboard view mode chart render", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-VIZ-002-02: view mode renders table headers from ChartRenderer", async () => {
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.includes("/global-filters")) {
        return { filters: [], linkageRules: [], refreshMode: "eager" };
      }
      if (path.includes("/query/execute")) return { columns: ["id"], rows: [[1]] };
      return {
        id: "d1",
        name: "预览",
        layoutJson: { version: 1, widgets: [viewWidget], globalFilters: [] },
      };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/dashboards/d1"]}>
          <Routes>
            <Route path="/admin/dashboards/:id" element={<DashboardEditPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("id")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("T-DASH-004-01: filter change triggers second execute with substituted SQL", async () => {
    const filterWidget: LayoutWidget = {
      ...viewWidget,
      chartConfig: {
        ...viewWidget.chartConfig,
        mode: "sql",
        sql: "SELECT '{{region}}' AS region",
      },
    };
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      const init = args[1] as RequestInit | undefined;
      if (path.includes("/global-filters")) {
        return {
          dashboardId: "d1",
          filters: [{ filterId: "f1", dimensionRef: "区域", defaultValue: "all" }],
          linkageRules: [{ sourceFilterId: "f1", targetWidgetIds: ["w1"], parameterKey: "region" }],
          refreshMode: "eager",
          affectedWidgetCount: 1,
        };
      }
      if (path.includes("/query/execute")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { sql?: string };
        if (body.sql?.includes("east")) {
          return { columns: ["region"], rows: [["east"]] };
        }
        return { columns: ["region"], rows: [["all"]] };
      }
      return {
        id: "d1",
        name: "预览",
        layoutJson: { version: 1, widgets: [filterWidget], globalFilters: [] },
      };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/dashboards/d1"]}>
          <Routes>
            <Route path="/admin/dashboards/:id" element={<DashboardEditPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = await screen.findByLabelText("区域");
    await userEvent.clear(input);
    await userEvent.type(input, "east");
    await waitFor(() => {
      const executeCalls = mockApiFetch.mock.calls.filter((c) =>
        String(c[0]).includes("/query/execute"),
      );
      const withEast = executeCalls.some((c) => {
        const body = JSON.parse(String((c[1] as RequestInit)?.body ?? "{}")) as { sql?: string };
        return body.sql?.includes("east");
      });
      expect(withEast).toBe(true);
    });
    expect(await screen.findByText("east")).toBeInTheDocument();
  });
});
