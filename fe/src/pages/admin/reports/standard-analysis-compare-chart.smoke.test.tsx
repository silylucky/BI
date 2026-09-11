import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisPage } from "./StandardAnalysisPage";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes("/compare/matrix")) {
      throw new Error(`unexpected matrix compare in pair mode: ${path}`);
    }
    if (path.includes("/compare")) {
      return {
        packKey: "s1",
        theme: "distribution",
        currentPeriodKey: "2026-08-18",
        previousPeriodKey: "2026-08-17",
        current: { columns: ["dim", "cnt"], rows: [["南京市", 29]] },
        previous: { columns: ["dim", "cnt"], rows: [["南京市", 25]] },
        deltas: [
          {
            key: "南京市",
            currentValue: 29,
            previousValue: 25,
            delta: 4,
            deltaPct: 16,
          },
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
      return { items: [], total: 0 };
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
        renderSpec: { sections: [{ kind: "table", columns: ["city", "cnt"], rows: [["南京市", 29]] }] },
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

describe("StandardAnalysisPage compare chart", () => {
  it("defaults to chart view when previous snapshot exists", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("南京市").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "周期对比" })[0]!);

    await waitFor(() => {
      expect(screen.getByTestId("standard-analysis-compare-chart-toggle")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("区域分布周期对比图表")).toBeInTheDocument();
  });
});
