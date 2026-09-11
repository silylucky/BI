import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();

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

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: () => <div data-testid="chart-mock" />,
}));

vi.mock("@/pages/admin/reports/components/DashboardScheduleSheet", () => ({
  DashboardScheduleSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="schedule-sheet">schedule sheet</div> : null,
}));

import { DashboardEditPage } from "./DashboardEditPage";

function mockDashboardLoad() {
  mockApiFetch.mockImplementation(async (path: unknown) => {
    const url = String(path ?? "");
    if (url === "/api/v1/datasources") {
      return { items: [{ id: "00000000-0000-4000-8000-000000000010", name: "分析库", code: "a" }] };
    }
    if (url.includes("/api/v1/datasets")) return { items: [] };
    if (url.includes("/charts/types")) return [];
    if (url.includes("/global-filters")) return { filters: [], linkageRules: [] };
    if (url.includes("/dashboards/")) {
      return { id: "d1", name: "Schedule Dash", layoutJson: { version: 1, widgets: [], globalFilters: [] } };
    }
    return { items: [], total: 0 };
  });
}

function renderEditPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={["/admin/dashboards/d1/edit"]}>
          <Routes>
            <Route path="/admin/dashboards/:id/edit" element={<DashboardEditPage mode="edit" />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mockDashboardLoad();
});

describe("DashboardEditPage schedule entry", () => {
  it("opens schedule sheet from toolbar button", async () => {
    const user = userEvent.setup();
    renderEditPage();
    await screen.findByTestId("dashboard-name-field");
    const btn = await screen.findByRole("button", { name: "定时推送" });
    await user.click(btn);
    expect(await screen.findByTestId("schedule-sheet")).toBeInTheDocument();
  });
});
