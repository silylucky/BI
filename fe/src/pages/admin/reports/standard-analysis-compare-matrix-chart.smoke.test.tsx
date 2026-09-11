import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisPage } from "./StandardAnalysisPage";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes("/compare/matrix")) {
      return {
        packKey: "s1",
        theme: "distribution",
        periodKind: "daily",
        periodKeys: ["2026-08-25", "2026-08-24"],
        rows: [
          { key: "上海市", values: { "2026-08-25": 34, "2026-08-24": 30 } },
          { key: "北京市", values: { "2026-08-25": 35, "2026-08-24": 33 } },
        ],
      };
    }
    if (path.includes("/compare")) {
      return {
        packKey: "s1",
        theme: "distribution",
        currentPeriodKey: "2026-08-25",
        previousPeriodKey: "2026-08-24",
        current: { columns: ["dim", "cnt"], rows: [["上海市", 34]] },
        previous: { columns: ["dim", "cnt"], rows: [["上海市", 30]] },
        deltas: [
          { key: "上海市", currentValue: 34, previousValue: 30, delta: 4, deltaPct: 13.3 },
        ],
      };
    }
    if (path === "/api/v1/reports/standard/packs") {
      return {
        items: [
          {
            packKey: "s1",
            displayName: "sss1",
            datasetId: "demo-v-sales-geo",
            dataSourceId: "00000000-0000-4000-8000-000000000001",
            fieldMapping: { region: "city" },
            enabledThemes: ["distribution"],
            allowedRoles: ["admin"],
            snapshotCronPreset: "daily",
          },
        ],
        total: 1,
      };
    }
    if (path.includes("/snapshots")) {
      return {
        items: [
          {
            id: "snap-1",
            packKey: "s1",
            theme: "distribution",
            periodKind: "daily",
            periodKey: "2026-08-24",
            capturedAt: "2026-08-24T01:00:00Z",
          },
        ],
        total: 1,
      };
    }
    if (path.includes("/capabilities")) {
      return {
        packKey: "s1",
        themes: [{ theme: "distribution", available: true }],
        columns: ["city", "amount"],
      };
    }
    if (path.includes("/run")) {
      return {
        packKey: "s1",
        theme: "distribution",
        renderSpec: { sections: [{ kind: "table", columns: ["city", "cnt"], rows: [["上海市", 34]] }] },
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        status: "ready",
      };
    }
    if (path.includes("/api/v1/reports/schedules")) {
      return { items: [], total: 0 };
    }
    throw new Error(`unmocked ${path}`);
  }),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"], isRoot: true },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function renderPage() {
  localStorage.clear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <StandardAnalysisPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("StandardAnalysisPage matrix compare chart", () => {
  it("defaults to chart view for multi-period matrix compare", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("上海市").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "周期对比" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "多期并排" }));

    await waitFor(() => {
      expect(screen.getByTestId("standard-analysis-matrix-chart-toggle")).toBeInTheDocument();
    });
    expect(screen.getByTestId("standard-analysis-matrix-total-summary")).toBeInTheDocument();
    expect(screen.getByLabelText("区域分布多期趋势图表")).toBeInTheDocument();
  });
});
