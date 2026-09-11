/** NFR-001: vitest P95 ≤3000ms 为 CI 稳定门槛；SRS/API budgetMs 默认 5000ms。 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { DashboardEditPage } from "./DashboardEditPage";

const DS = "00000000-0000-4000-8000-000000000010";
const mockApiFetch = vi.fn();
const P95_BUDGET_MS = 3000;
const SAMPLES = 5;

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

function extendedWidgets(): LayoutWidget[] {
  const types = ["map", "heatmap", "kpi", "timeline"] as const;
  return types.map((type, order) => {
    const id = `w-${type}`;
    return {
      id,
      type: "chart",
      title: type,
      colSpan: 6,
      rowSpan: 1,
      order,
      chartConfig: { ...defaultChartConfig(type), chartId: id, dataSourceId: DS },
    };
  });
}

function setupMocks(widgets: LayoutWidget[]) {
  mockApiFetch.mockImplementation(async (...args: unknown[]) => {
    const path = String(args[0] ?? "");
    if (path.includes("/global-filters")) {
      return { filters: [], linkageRules: [], refreshMode: "eager" };
    }
    if (path.includes("/dashboards/")) {
      return { id: "d1", name: "Perf", layoutJson: { version: 1, widgets, globalFilters: [] } };
    }
    if (path === "/api/v1/query/execute") {
      return { columns: ["x", "y"], rows: [[1, 2]], rowCount: 1 };
    }
    if (path === "/api/v1/charts/render-spec") {
      const body = (args[1] as { body?: string } | undefined)?.body;
      let chartType = "map";
      if (typeof body === "string") {
        try {
          chartType = String(JSON.parse(body).chartType ?? "map");
        } catch {
          chartType = "map";
        }
      }
      const engine = chartType === "table" ? "table" : "antv";
      return {
        engine,
        chartType,
        encoding: { dimensions: [], metrics: [] },
        source: {},
      };
    }
    return {};
  });
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe("NFR-001 dashboard first screen perf smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("NFR-001-03: view mode 4 widgets P95 within budget", async () => {
    const widgets = extendedWidgets();
    setupMocks(widgets);
    const timings: number[] = [];

    for (let i = 0; i < SAMPLES; i += 1) {
      const start = performance.now();
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { unmount } = render(
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/admin/dashboards/d1"]}>
            <Routes>
              <Route path="/admin/dashboards/:id" element={<DashboardEditPage mode="view" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await waitFor(
        () => {
          expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
        },
        { timeout: 5000 },
      );
      timings.push(performance.now() - start);
      unmount();
    }

    expect(p95(timings)).toBeLessThanOrEqual(P95_BUDGET_MS);
  });
});
