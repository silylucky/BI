import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartViewModel } from "@/components/charts/engine/types";
import { StandardAnalysisLiveView } from "./components/StandardAnalysisLiveView";
import type { AnalysisPack, RunResult } from "./useStandardAnalysis";

const captured: { viewModel?: ChartViewModel } = {};

vi.mock("@/components/charts/engine/ChartEngineView", () => ({
  ChartEngineView: ({ viewModel }: { viewModel: ChartViewModel }) => {
    captured.viewModel = viewModel;
    return <div data-testid="standard-analysis-chart-capture" />;
  },
}));

const pack: AnalysisPack = {
  packKey: "demo-pack",
  displayName: "演示包",
  datasetId: "demo-dataset",
  boundConfigId: "",
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  fieldMapping: { status: "category_name", region: "province", createdAt: "created_at" },
  enabledThemes: ["lifecycle", "distribution", "trend"],
  allowedRoles: ["admin"],
  snapshotCronPreset: "daily",
  snapshotRetentionPeriods: 12,
};

const runData: RunResult = {
  packKey: pack.packKey,
  theme: "lifecycle",
  dataSourceId: pack.dataSourceId,
  status: "ready",
  renderSpec: {
    sections: [
      {
        kind: "chart",
        chartType: "bar",
        columns: ["dim", "cnt"],
        rows: [
          ["办公耗材", 120],
          ["电子产品", 80],
        ],
      },
    ],
    meta: { sourceRowCount: 200, aggregatedPointCount: 2 },
  },
};

describe("StandardAnalysisLiveView chart data", () => {
  afterEach(() => {
    cleanup();
    captured.viewModel = undefined;
  });

  it("passes numeric metric cells to chart while table uses string cells", () => {
    render(
      <StandardAnalysisLiveView pack={pack} activeTheme="lifecycle" runData={runData} isLoading={false} />,
    );

    expect(screen.getByTestId("standard-analysis-chart-capture")).toBeInTheDocument();
    expect(captured.viewModel?.dataset.rows).toEqual([
      ["办公耗材", 120],
      ["电子产品", 80],
    ]);
    expect(captured.viewModel?.dataset.columns).toEqual(["dim", "cnt"]);
    expect(typeof captured.viewModel?.dataset.rows[0]?.[1]).toBe("number");
  });
});

describe("StandardAnalysisLiveView live summary strip", () => {
  afterEach(() => {
    cleanup();
    captured.viewModel = undefined;
  });

  it("shows chart-aligned summary only in chart mode", () => {
    render(
      <StandardAnalysisLiveView pack={pack} activeTheme="lifecycle" runData={runData} isLoading={false} />,
    );

    const strip = screen.getByTestId("standard-analysis-live-summary");
    expect(strip).toHaveClass("flex");
    expect(strip.textContent).toContain("状态数");
    expect(strip.textContent).toContain("记录总数");
    expect(strip.textContent).toContain("200");
    expect(strip.textContent).toContain("办公耗材");
  });

  it("shows time-series peak aligned with line chart data", () => {
    const trendRun: RunResult = {
      ...runData,
      theme: "trend",
      renderSpec: {
        sections: [
          {
            kind: "chart",
            chartType: "line",
            columns: ["d", "cnt"],
            rows: [
              ["2025-04-05", 2],
              ["2025-04-06", 5],
            ],
          },
        ],
        meta: { sourceRowCount: 106, aggregatedPointCount: 2 },
      },
    };

    render(
      <StandardAnalysisLiveView pack={pack} activeTheme="trend" runData={trendRun} isLoading={false} />,
    );

    const strip = screen.getByTestId("standard-analysis-live-summary");
    expect(strip.textContent).toContain("累计总量");
    expect(strip.textContent).toContain("7");
    expect(strip.textContent).toContain("单日最高");
    expect(strip.textContent).toContain("5");
    expect(captured.viewModel?.dataset.rows).toEqual([
      ["2025-04-05", 2],
      ["2025-04-06", 7],
    ]);
  });

  it("hides summary strip in table mode", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(
      <StandardAnalysisLiveView pack={pack} activeTheme="lifecycle" runData={runData} isLoading={false} />,
    );

    expect(screen.getByTestId("standard-analysis-live-summary")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "数据表" }));
    expect(screen.queryByTestId("standard-analysis-live-summary")).not.toBeInTheDocument();
  });

  it("hides summary strip when there are no rows", () => {
    const emptyRun: RunResult = {
      ...runData,
      renderSpec: {
        sections: [{ kind: "chart", chartType: "bar", columns: ["dim", "cnt"], rows: [] }],
        meta: {},
      },
    };

    render(
      <StandardAnalysisLiveView pack={pack} activeTheme="lifecycle" runData={emptyRun} isLoading={false} />,
    );

    expect(screen.queryByTestId("standard-analysis-live-summary")).not.toBeInTheDocument();
  });
});
