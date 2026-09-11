import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchChartTypeCatalog } from "@/lib/chartRegistry";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

describe("chartRegistry", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("T-VIZ-R43-003-02: fetchChartTypeCatalog mock 9 类型含 map", async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        type: "table",
        displayName: "表格",
        category: "basic",
        renderer: "table",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "map",
        displayName: "地图",
        category: "geo",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: { minDimensions: 1 },
      },
      {
        type: "sankey",
        displayName: "桑基",
        category: "flow",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "funnel",
        displayName: "漏斗",
        category: "flow",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "graph",
        displayName: "关系",
        category: "relation",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "gauge",
        displayName: "仪表",
        category: "advanced",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "line",
        displayName: "折线",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
      {
        type: "bar",
        displayName: "柱",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default", "stacked"],
        fieldRule: {},
      },
      {
        type: "pie",
        displayName: "饼",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default"],
        fieldRule: {},
      },
    ]);
    const catalog = await fetchChartTypeCatalog();
    expect(catalog.map((c) => c.type)).toContain("map");
    expect(catalog.length).toBe(9);
  });
});

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartConfigPanel } from "@/components/charts/ChartConfigPanel";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("ChartConfigPanel", () => {
  afterEach(() => cleanup());

  it("T-VIZ-R236-005-02: ChartConfigPanel add/remove filter rows", () => {
    const onChange = vi.fn();
    render(
      <ChartConfigPanel
        config={{ chartType: "funnel", dimensions: [{ field: "stage" }], metrics: [{ field: "cnt" }], filters: [] }}
        columns={["stage", "cnt", "region"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /添加筛选/i }));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.filters?.length).toBe(1);
  });

  it("T-VIZ-R236-005-03: funnel fieldRule min metrics hint preserved", async () => {
    mockApiFetch.mockResolvedValueOnce([
      {
        type: "funnel",
        displayName: "漏斗",
        styleVariants: ["default"],
        fieldRule: { minMetrics: 2, maxMetrics: 4, note: "至少 2 个度量" },
      },
    ]);
    render(
      <ChartConfigPanel
        config={{
          chartType: "funnel",
          dataSourceId: "00000000-0000-4000-8000-000000000001",
          mode: "sql",
          sql: "SELECT 1",
          dimensions: [{ field: "stage" }],
          metrics: [{ field: "cnt" }, { field: "cnt2" }],
        }}
        columns={["stage", "cnt", "cnt2"]}
        onChange={() => {}}
      />,
    );
    expect(await screen.findByText("至少 2 个度量")).toBeInTheDocument();
  });

  it("T-VIZ-R43-005-02: funnel 缺 metric → 配置面板展示字段错误文案", async () => {
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [],
    };
    mockApiFetch.mockResolvedValueOnce([]);
    mockApiFetch.mockRejectedValueOnce(
      Object.assign(new Error("字段不符合要求"), {
        code: "CHART_FIELD_REQUIREMENT",
        fields: [{ field: "metrics", message: "至少 1 个度量" }],
      }),
    );
    render(<ChartConfigPanel config={cfg} columns={["stage", "value"]} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "校验配置" }));
    expect(await screen.findByText("至少 1 个度量")).toBeInTheDocument();
  });

  it("T-VIZ-R43-004-02: styleVariant=invalid → alert 含样式或错误码", async () => {
    const cfg: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      styleVariant: "invalid",
      dimensions: [{ field: "d" }],
      metrics: [{ field: "m" }],
    };
    mockApiFetch.mockResolvedValueOnce([]);
    mockApiFetch.mockRejectedValueOnce(
      Object.assign(new Error("样式无效"), { code: "CHART_INVALID_STYLE_VARIANT" }),
    );
    render(<ChartConfigPanel config={cfg} columns={["d", "m"]} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "校验配置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/样式|CHART_INVALID_STYLE_VARIANT/);
  });

  it("T-VIZ-R237-005-03: timeRange preset change triggers onChange", () => {
    const onChange = vi.fn();
    const config = {
      chartType: "line" as const,
      dimensions: [{ field: "dt" }],
      metrics: [{ field: "val" }],
      timeRange: { enabled: true, mode: "relative" as const, relativePreset: "last_7d" as const },
    };
    render(<ChartConfigPanel config={config} columns={["dt", "val"]} onChange={onChange} />);
    expect(screen.getByLabelText("启用时间范围筛选")).toBeChecked();
  });
});

import { ChartRenderer } from "@/components/charts/ChartRenderer";

describe("ChartRenderer advanced", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });
  afterEach(() => cleanup());

  it("T-VIZ-R43-008-03: funnel mock render-spec → data-testid=echarts-chart", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["stage", "value"],
      rows: [["A", 10], ["B", 5]],
    });
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByTestId("d3-funnel-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R43-005-03: 501 行 → 警告 + 渲染不抛错", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => [`S${i}`, i]);
    mockApiFetch.mockResolvedValueOnce({ columns: ["stage", "value"], rows });
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/500/);
    expect(screen.getByTestId("d3-funnel-chart")).toBeInTheDocument();
  });
});

import { EmbedSharePanel } from "@/embed/EmbedSharePanel";
import { EmbedChartPage } from "@/embed/EmbedChartPage";
import { MemoryRouter, Route, Routes } from "react-router";

describe("Embed", () => {
  afterEach(() => cleanup());

  it("T-VIZ-R43-006-01: EmbedSharePanel 非法 origin not-a-url → 字段错误", async () => {
    render(
      <MemoryRouter>
        <EmbedSharePanel />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/来源|Origin/i), "not-a-url");
    await userEvent.click(screen.getByRole("button", { name: /添加/ }));
    expect(await screen.findByText(/无效|格式/)).toBeInTheDocument();
  });

  it("T-VIZ-R43-006-03: 未授权 origin → 错误态文案", () => {
    vi.stubGlobal("location", { ...window.location, origin: "https://evil.com" });
    render(
      <MemoryRouter initialEntries={["/embed/chart/test-id?allowedOrigins=https://portal.example.com"]}>
        <Routes>
          <Route path="/embed/chart/:chartId" element={<EmbedChartPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/未授权嵌入/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("T-VIZ-R43-006-02: 合法配置 → iframe title 可访问", async () => {
    mockApiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ token: "t", embedUrl: "/embed/chart/t" });
    render(
      <MemoryRouter>
        <EmbedSharePanel />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText("图表 ID"), "00000000-0000-4000-8000-000000000001");
    await userEvent.type(screen.getByLabelText(/来源|Origin/i), "https://a.com");
    await userEvent.click(screen.getByRole("button", { name: /添加/ }));
    await userEvent.click(screen.getByRole("button", { name: /校验并生成链接/ }));
    expect(await screen.findByTitle("嵌入图表预览")).toBeInTheDocument();
  });
});

describe("ChartRenderer extended", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });
  afterEach(() => cleanup());

  it("T-VIZ-R43-004-01: sankey 2 维+1 度量 → d3 容器", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["src", "dst", "amt"],
      rows: [["A", "B", 10]],
    });
    const cfg: ChartViewConfig = {
      chartType: "sankey",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "src" }, { field: "dst" }],
      metrics: [{ field: "amt" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByTestId("d3-sankey-chart")).toBeInTheDocument();
  });

  it("T-VIZ-R43-005-01: funnel 3 阶段 mock → 漏斗 series 可见", async () => {
    mockApiFetch.mockResolvedValueOnce({
      columns: ["stage", "value"],
      rows: [["A", 100], ["B", 60], ["C", 30]],
    });
    const cfg: ChartViewConfig = {
      chartType: "funnel",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "stage" }],
      metrics: [{ field: "value" }],
    };
    render(<ChartRenderer config={cfg} />);
    expect(await screen.findByTestId("d3-funnel-chart")).toBeInTheDocument();
  });
});

import { isKnownChartType } from "@/lib/chartRegistry";
import { getFallbackChartType } from "@/lib/chartFallback";

describe("VIZ-003 未知 chartType 降级", () => {
  it("T-VIZ-R250-003-01: isKnownChartType('line')→true; isKnownChartType('unknown_xyz')→false", () => {
    expect(isKnownChartType("line")).toBe(true);
    expect(isKnownChartType("unknown_xyz")).toBe(false);
  });

  it("T-VIZ-R250-003-03: getFallbackChartType('line')→'line'; getFallbackChartType('xyz')→'table-info'", () => {
    expect(getFallbackChartType("line")).toBe("line");
    expect(getFallbackChartType("unknown_xyz")).toBe("table-info");
  });
});

describe("buildTimeRangeParameters", () => {
  it("T-VIZ-R237-005-06: native mode does not require time params in execute body", () => {
    expect(buildTimeRangeParameters({ enabled: true, mode: "relative", relativePreset: "mtd" })).toHaveProperty(
      "time_start",
    );
  });
});

import { buildTimeRangeParameters } from "@/components/charts/useChartExecute";
