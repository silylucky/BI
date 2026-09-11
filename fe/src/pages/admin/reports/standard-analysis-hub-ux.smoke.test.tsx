import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { StandardAnalysisPackList } from "./components/StandardAnalysisPackList";
import { StandardAnalysisResultPanel } from "./components/StandardAnalysisResultPanel";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes("/api/v1/reports/schedules")) {
      return { items: [], total: 0 };
    }
    throw new Error(`unmocked ${path}`);
  }),
}));

const pack = {
  packKey: "demo-pack",
  displayName: "演示包",
  datasetId: "demo-dataset",
  fieldMapping: { status: "status", region: "region", createdAt: "created_at" },
  enabledThemes: ["lifecycle", "distribution"] as const,
  allowedRoles: ["admin"],
  snapshotCronPreset: "daily" as const,
  snapshotRetentionPeriods: 12,
};

describe("standard analysis hub UX-R2", () => {
  afterEach(() => cleanup());

  it("pack list omits theme chips and exposes delivery link", () => {
    render(
      <MemoryRouter>
        <StandardAnalysisPackList
          packs={[pack]}
          activePackKey={pack.packKey}
          onSelect={() => undefined}
          deliveryByPackKey={new Map()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("区域分布")).not.toBeInTheDocument();
    expect(screen.getByTestId("standard-analysis-pack-delivery")).toBeInTheDocument();
    expect(screen.getByText("每日快照")).toBeInTheDocument();
  });

  it("result panel hides meta row on xl and shows capture in toolbar", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <StandardAnalysisResultPanel
          pack={pack}
          activeTheme="lifecycle"
          viewMode="live"
          canManage
          capturePending={false}
          onCaptureCurrent={() => undefined}
          onCapturePreviousBaseline={() => undefined}
          compareLayout="pair"
          onCompareLayoutChange={() => undefined}
          livePeriodKey="2026-08-20"
          currentPeriodValue="__live__"
          baselinePeriodValue="__auto__"
          matrixPeriodKeys={[]}
          onCurrentPeriodChange={() => undefined}
          onBaselinePeriodChange={() => undefined}
          onMatrixPeriodKeysChange={() => undefined}
          matrixQuery={{
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
            refetch: () => undefined,
          }}
          onThemeChange={() => undefined}
          onViewModeChange={() => undefined}
          runQuery={{
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
            refetch: () => undefined,
            data: {
              status: "ready",
              renderSpec: { sections: [{ kind: "table", columns: ["dim", "cnt"], rows: [["A", 1]] }] },
            },
          }}
          compareQuery={{
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
            refetch: () => undefined,
          }}
          snapshots={[]}
          mapError={(err) => String(err)}
        />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("standard-analysis-capture-toolbar")).toHaveTextContent("保存本期快照");
    expect(screen.getByTestId("standard-analysis-observability-strip")).toBeInTheDocument();
  });
});
