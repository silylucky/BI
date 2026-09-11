import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisPage } from "./StandardAnalysisPage";

const captureMock = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string, init?: RequestInit) => {
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
    if (path.includes("/compare")) {
      return {
        packKey: "s1",
        theme: "distribution",
        currentPeriodKey: "2026-08-18",
        previousPeriodKey: "2026-08-17",
        current: { columns: ["dim", "cnt"], rows: [["南京市", 29]] },
        previous: null,
        deltas: [{ key: "南京市", currentValue: 29, previousValue: null, delta: null, deltaPct: null }],
      };
    }
    if (path.includes("/snapshots") && init?.method === "POST") {
      captureMock();
      return {
        id: "00000000-0000-4000-8000-000000000099",
        packKey: "s1",
        theme: "distribution",
        periodKind: "daily",
        periodKey: "2026-08-18",
        capturedAt: "2026-08-18T08:00:00Z",
        payload: {},
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

describe("StandardAnalysisPage compare mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows honest empty state when previous snapshot is missing", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("南京市").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "周期对比" })[0]!);

    await waitFor(() => {
      expect(screen.getByText("对比期快照缺失")).toBeInTheDocument();
    });
    expect(screen.getByText(/当前实时查询/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("standard-analysis-ops-toggle"));
    expect(screen.getByTestId("standard-analysis-ops-detail")).toHaveTextContent("按城市计数");
    expect(screen.queryByRole("columnheader", { name: "增减" })).not.toBeInTheDocument();
  });

  it("allows admin to capture previous-period baseline snapshot", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("南京市").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "周期对比" })[0]!);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "保存上期基准快照" }).length).toBeGreaterThan(0);
    });

    const captureButtons = screen.getAllByRole("button", { name: "保存上期基准快照" });
    fireEvent.click(captureButtons[captureButtons.length - 1]!);
    await waitFor(() => {
      expect(captureMock).toHaveBeenCalledTimes(1);
    });
  });
});
