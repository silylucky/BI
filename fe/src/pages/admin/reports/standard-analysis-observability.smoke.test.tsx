import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisSnapshotStrip } from "./components/StandardAnalysisSnapshotStrip";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path.includes("/api/v1/reports/schedules")) {
      return {
        items: [
          {
            id: "sched-1",
            sourceType: "standard",
            sourceKey: "equipment-overview",
            status: "scheduled",
            cron: "0 8 * * *",
            timezone: "Asia/Shanghai",
            allowedActions: [],
          },
        ],
        total: 1,
      };
    }
    throw new Error(`unmocked ${path}`);
  }),
}));

const pack = {
  packKey: "equipment-overview",
  displayName: "设备标准分析",
  datasetId: "demo-dataset",
  fieldMapping: { status: "status", region: "region", createdAt: "created_at" },
  enabledThemes: ["lifecycle"],
  allowedRoles: ["admin"],
  snapshotCronPreset: "daily" as const,
  snapshotRetentionPeriods: 12,
};

describe("StandardAnalysisSnapshotStrip observability", () => {
  afterEach(() => cleanup());

  it("shows compact latest snapshot and full ops in collapsible", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <StandardAnalysisSnapshotStrip
              pack={pack}
              activeTheme="lifecycle"
              snapshots={[
                {
                  packKey: pack.packKey,
                  theme: "lifecycle",
                  periodKind: "daily",
                  periodKey: "2026-08-19",
                  capturedAt: "2026-08-19T01:00:00Z",
                  renderSpec: { sections: [] },
                },
              ]}
              viewMode="live"
              canManage
            />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const strip = await screen.findByTestId("standard-analysis-observability-strip");
    expect(strip).toHaveTextContent("最近快照");
    expect(strip).toHaveTextContent("2026-08-19");
    expect(screen.queryByText("保存本期快照")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("standard-analysis-ops-toggle"));
    const detail = await screen.findByTestId("standard-analysis-ops-detail");
    expect(detail).toHaveTextContent("口径");
    expect(detail).toHaveTextContent("保留最近 12 期");
    expect(detail).toHaveTextContent("1 条已调度");
  });

  it("compare mode shows period summary only in compact row", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <StandardAnalysisSnapshotStrip
              pack={pack}
              activeTheme="lifecycle"
              snapshots={[]}
              viewMode="compare"
              canManage={false}
              compareSummary={{ currentPeriodKey: "2026-08-20", previousPeriodKey: "2026-08-19" }}
            />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const compact = screen.getByTestId("standard-analysis-observability-compact");
    expect(compact).toHaveTextContent("2026-08-19");
    expect(compact).not.toHaveTextContent("快照节奏");
  });
});
