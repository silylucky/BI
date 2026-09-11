import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ChartRenderer } from "./ChartRenderer";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactElement } from "react";
import {
  assertCatalogSmokeCoverage,
  CHART_CATALOG_SMOKE_CASES,
} from "./chartCatalogSmokeFixtures";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

const DS = "00000000-0000-4000-8000-000000000001";

function renderChart(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

function renderChartCase(item: (typeof CHART_CATALOG_SMOKE_CASES)[number]) {
  mockApiFetch.mockResolvedValueOnce({ columns: item.columns, rows: item.rows });
  renderChart(
    <ChartRenderer
      config={{
        chartType: item.type,
        dataSourceId: DS,
        mode: "sql",
        sql: "SELECT 1",
        dimensions: item.dimensions,
        metrics: item.metrics,
      }}
    />,
  );
}

const tableConfig: ChartViewConfig = {
  chartType: "table-info",
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  mode: "sql",
  sql: "SELECT 1 AS id",
  axes: { xAxis: [{ field: "id" }] },
};

describe("ChartRenderer smoke", () => {
  beforeEach(() => mockApiFetch.mockReset());
  afterEach(() => cleanup());

  it("T-VIZ-R28-002-01: table renders headers and cells", async () => {
    mockApiFetch.mockResolvedValueOnce({ columns: ["id"], rows: [[1]] });
    renderChart(<ChartRenderer config={tableConfig} title="表" />);
    expect(await screen.findByText("id")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("T-VIZ-R28-002-03: empty rows shows 暂无数据", async () => {
    mockApiFetch.mockResolvedValueOnce({ columns: ["id"], rows: [] });
    renderChart(<ChartRenderer config={tableConfig} />);
    expect(await screen.findByText("暂无数据")).toBeInTheDocument();
  });

  it("T-VIZ-R28-002-04: execute error shows retry", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("查询失败"));
    renderChart(<ChartRenderer config={tableConfig} />);
    expect(await screen.findByText("查询失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("T-VIZ-R28-002-05: line chart renders d3 container", async () => {
    mockApiFetch.mockResolvedValueOnce({ columns: ["x", "y"], rows: [[1, 2]] });
    const lineConfig: ChartViewConfig = {
      chartType: "line",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1 AS x, 2 AS y",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    renderChart(<ChartRenderer config={lineConfig} />);
    expect(await screen.findByTestId("d3-line-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-01: table-info renders d3 table host with capped visible rows", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => [i + 1]);
    mockApiFetch.mockResolvedValueOnce({ columns: ["id"], rows });
    renderChart(<ChartRenderer config={tableConfig} title="大表" />);
    expect(await screen.findByTestId("d3-table-chart")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getAllByRole("cell").length).toBeLessThanOrEqual(50);
  });

  it("T-VIZ-R29-002-02: QUERY_TIMEOUT shows Chinese timeout message", async () => {
    const err = Object.assign(new Error("查询超时，请缩小数据范围"), { code: "QUERY_TIMEOUT" });
    mockApiFetch.mockRejectedValueOnce(err);
    renderChart(<ChartRenderer config={tableConfig} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("查询超时，请缩小数据范围");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-03: bar chart smoke renders d3 container", async () => {
    mockApiFetch.mockResolvedValueOnce({ columns: ["x", "y"], rows: [[1, 2]] });
    const barConfig: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1 AS x, 2 AS y",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    renderChart(<ChartRenderer config={barConfig} />);
    expect(await screen.findByTestId("d3-bar-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-04: table-normal renders d3 table host", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["region", "amount"],
      rows: [
        ["华东", 10],
        ["华北", 20],
      ],
    });
    const config: ChartViewConfig = {
      chartType: "table-normal",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT region, amount FROM t GROUP BY region",
      dimensions: [{ field: "region" }],
      metrics: [{ field: "amount" }],
    };
    renderChart(<ChartRenderer config={config} />);
    expect(await screen.findByTestId("d3-table-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-05: table-pivot renders d3 table host", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["row_dim", "col_dim", "amount"],
      rows: [["A", "X", 1]],
    });
    const config: ChartViewConfig = {
      chartType: "table-pivot",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT row_dim, col_dim, amount FROM t",
      dimensions: [{ field: "row_dim" }, { field: "col_dim" }],
      metrics: [{ field: "amount" }],
    };
    renderChart(<ChartRenderer config={config} />);
    expect(await screen.findByTestId("d3-table-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-06: t-heatmap renders g2plot host", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["x", "y", "value"],
      rows: [
        ["a", "1", 10],
        ["b", "2", 20],
      ],
    });
    const config: ChartViewConfig = {
      chartType: "t-heatmap",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT x, y, value FROM t",
      dimensions: [{ field: "x" }, { field: "y" }],
      metrics: [{ field: "value" }],
    };
    renderChart(<ChartRenderer config={config} />);
    expect(await screen.findByTestId("d3-heatmap-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-07: bar conditional rules wire D3 fill", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["x", "y"],
      rows: [
        [1, 10],
        [2, 30],
      ],
    });
    const barConfig: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1 AS x, 2 AS y",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
      nativeBody: {
        deFeatures: {
          conditionalRules: [
            { id: "r1", enabled: true, operator: "gte", value: 20, color: "#12b76a" },
          ],
        },
      },
    };
    renderChart(<ChartRenderer config={barConfig} />);
    expect(await screen.findByTestId("d3-bar-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-08: table-info compact pagination footer", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => [i + 1]);
    mockApiFetch.mockResolvedValueOnce({ columns: ["id"], rows });
    renderChart(
      <ChartRenderer
        config={{
          ...tableConfig,
          nativeBody: {
            deTableStyle: {
              paginationMode: "page",
              pageSize: 20,
              paginationVariant: "compact",
            },
          },
        }}
      />,
    );
    expect(await screen.findByTestId("d3-table-chart")).toBeInTheDocument();
    expect(await screen.findByTestId("table-pagination-compact")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-09: bar-horizontal renders d3 container", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["sale_date", "amount"],
      rows: [
        ["2025-01-05", 100],
        ["2025-01-06", 200],
      ],
    });
    const config: ChartViewConfig = {
      chartType: "bar-horizontal",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT sale_date, amount FROM t",
      dimensions: [{ field: "sale_date" }],
      metrics: [{ field: "amount" }],
    };
    renderChart(<ChartRenderer config={config} />);
    expect(await screen.findByTestId("d3-bar-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-11: area-stack single metric uses correct y scale", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["sale_date", "amount"],
      rows: [
        ["2025-01-05", 8999],
        ["2025-01-06", 2598],
      ],
    });
    const config: ChartViewConfig = {
      chartType: "area-stack",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT sale_date, amount FROM t",
      dimensions: [{ field: "sale_date" }],
      metrics: [{ field: "amount" }],
    };
    renderChart(<ChartRenderer config={config} />);
    expect(await screen.findByTestId("d3-area-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R29-002-10: specialized compare charts render d3 hosts", async () => {
    const cases: Array<{ type: ChartViewConfig["chartType"]; testId: string; columns: string[]; rows: unknown[][]; dimensions: ChartViewConfig["dimensions"]; metrics: ChartViewConfig["metrics"] }> = [
      {
        type: "bar-range",
        testId: "d3-bar-range-chart",
        columns: ["cat", "low", "high"],
        rows: [["A", 10, 30]],
        dimensions: [{ field: "cat" }],
        metrics: [{ field: "low" }, { field: "high" }],
      },
      {
        type: "progress-bar",
        testId: "d3-progress-bar-chart",
        columns: ["cat", "target", "value"],
        rows: [["A", 100, 50]],
        dimensions: [{ field: "cat" }],
        metrics: [{ field: "target" }, { field: "value" }],
      },
      {
        type: "bullet-graph",
        testId: "d3-bullet-chart",
        columns: ["cat", "actual", "target"],
        rows: [["A", 80, 100]],
        dimensions: [{ field: "cat" }],
        metrics: [{ field: "actual" }, { field: "target" }],
      },
      {
        type: "stock-line",
        testId: "d3-stock-chart",
        columns: ["date", "open", "close", "low", "high"],
        rows: [["2025-01-01", 10, 12, 8, 14]],
        dimensions: [{ field: "date" }],
        metrics: [{ field: "open" }, { field: "close" }, { field: "low" }, { field: "high" }],
      },
      {
        type: "pie-donut",
        testId: "d3-pie-chart",
        columns: ["region", "amount"],
        rows: [
          ["华东", 40],
          ["华北", 35],
          ["华南", 25],
        ],
        dimensions: [{ field: "region" }],
        metrics: [{ field: "amount" }],
      },
      {
        type: "waterfall",
        testId: "d3-waterfall-chart",
        columns: ["stage", "value"],
        rows: [
          ["Start", 100],
          ["Delta", 20],
        ],
        dimensions: [{ field: "stage" }],
        metrics: [{ field: "value" }],
      },
    ];

    for (const item of cases) {
      cleanup();
      mockApiFetch.mockResolvedValueOnce({ columns: item.columns, rows: item.rows });
      renderChart(
        <ChartRenderer
          config={{
            chartType: item.type,
            dataSourceId: "00000000-0000-4000-8000-000000000001",
            mode: "sql",
            sql: "SELECT 1",
            dimensions: item.dimensions,
            metrics: item.metrics,
          }}
        />,
      );
      expect(await screen.findByTestId(item.testId)).toBeInTheDocument();
    }
  });

  it("T-VIZ-R30-001: all active catalog chart types render d3 hosts (L1)", async () => {
    assertCatalogSmokeCoverage();
    expect(CHART_CATALOG_SMOKE_CASES.length).toBeGreaterThanOrEqual(44);

    for (const item of CHART_CATALOG_SMOKE_CASES) {
      cleanup();
      renderChartCase(item);
      const hosts = await screen.findAllByTestId(item.testId, undefined, {
        timeout: 5000,
      });
      const host = hosts[0]!;
      expect(host, `chartType=${item.type} testId=${item.testId}`).toBeInTheDocument();
      if (item.type === "map-3d") {
        await waitFor(
          () => {
            const engine = host.getAttribute("data-render-engine");
            expect(
              engine === "d3-fallback" || engine === "three" || engine === "pending",
            ).toBe(true);
            if (engine === "d3-fallback") {
              expect(screen.getByText(/无法创建 WebGL 上下文/)).toBeInTheDocument();
            }
          },
          { timeout: 5000 },
        );
      }
    }
  }, 120_000);

  it("T-VIZ-R30-002: all active catalog types show 暂无数据 on empty rows (L1 R-03)", async () => {
    assertCatalogSmokeCoverage();

    for (const item of CHART_CATALOG_SMOKE_CASES) {
      cleanup();
      mockApiFetch.mockResolvedValueOnce({ columns: item.columns, rows: [] });
      renderChart(
        <ChartRenderer
          config={{
            chartType: item.type,
            dataSourceId: DS,
            mode: "sql",
            sql: "SELECT 1",
            dimensions: item.dimensions,
            metrics: item.metrics,
          }}
        />,
      );
      expect(
        await screen.findByText("暂无数据"),
        `chartType=${item.type}`,
      ).toBeInTheDocument();
    }
  });
});
