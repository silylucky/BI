import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/charts/engine/d3/core/animate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/charts/engine/d3/core/animate")>();
  return {
    ...actual,
    animateStrokePath: vi.fn(),
  };
});

import { renderD3DualAxesChart } from "./renderDualAxes";

const theme = {
  legendText: "#333",
  axisLabel: "#666",
  axisLine: "#ddd",
  gridLine: "#eee",
  tooltipBg: "#fff",
  tooltipText: "#333",
  background: "#fff",
} as const;

describe("renderD3DualAxesChart column+line DE parity", () => {
  it("renders column bars and line path for province quantity amount", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [
          { __category__: "华东", __value__: 100 },
          { __category__: "华北", __value__: 200 },
          { __category__: "华南", __value__: 150 },
        ],
        [
          { __category__: "华东", __value__: 10000 },
          { __category__: "华北", __value__: 15000 },
          { __category__: "华南", __value__: 12000 },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "column" }, { geometry: "line" }],
      colors: ["#465fff", "#12b76a"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["quantity", "amount"],
    });

    expect(container.querySelectorAll("g.dual-col").length).toBe(3);
    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
    const labels = Array.from(container.querySelectorAll("g.vs-legend text")).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toEqual(["quantity", "amount"]);
  });
});

describe("renderD3DualAxesChart dual-line legend", () => {
  it("renders left and right line metric names in legend", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [
          { __category__: "A", __value__: 10 },
          { __category__: "B", __value__: 20 },
        ],
        [
          { __category__: "A", __value__: 8 },
          { __category__: "B", __value__: 15 },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "line" }, { geometry: "line" }],
      colors: ["#465fff", "#12b76a"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["左线", "右线"],
    });

    const labels = Array.from(container.querySelectorAll("g.vs-legend text")).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toContain("左线");
    expect(labels).toContain("右线");
  });

  it("includes extBubble sub-series in dual-line legend", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [{ __category__: "A", __value__: 10 }],
        [
          { __category__: "A", __value__: 8, __series__: "华东" },
          { __category__: "A", __value__: 6, __series__: "华北" },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "line" }, { geometry: "line" }],
      lineSeriesField: "__series__",
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["左线", "右线"],
    });

    const labels = Array.from(container.querySelectorAll("g.vs-legend text")).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toContain("左线");
    expect(labels).toContain("华东");
    expect(labels).toContain("华北");
  });

  it("renders multiple line paths for column+line with lineSeriesField", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [
          { __category__: "2025-07-01", __value__: 100 },
          { __category__: "2025-07-02", __value__: 200 },
        ],
        [
          { __category__: "2025-07-01", __value__: 80, __series__: "华东" },
          { __category__: "2025-07-01", __value__: 60, __series__: "华北" },
          { __category__: "2025-07-02", __value__: 120, __series__: "华东" },
          { __category__: "2025-07-02", __value__: 90, __series__: "华北" },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "column", isStack: true }, { geometry: "line" }],
      columnSeriesField: undefined,
      lineSeriesField: "__series__",
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["amount", "quantity"],
    });

    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
    const labels = Array.from(container.querySelectorAll("g.vs-legend text")).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toContain("华东");
    expect(labels).toContain("华北");
  });

  it("renders stacked column with series names containing parentheses", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [
          { __category__: "2025-01-05", __value__: 100, __series__: "墨盒套装" },
          { __category__: "2025-01-05", __value__: 200, __series__: "A4打印纸(箱)" },
          { __category__: "2025-02-15", __value__: 150, __series__: "墨盒套装" },
          { __category__: "2025-02-15", __value__: 180, __series__: "A4打印纸(箱)" },
        ],
        [
          { __category__: "2025-01-05", __value__: 50 },
          { __category__: "2025-02-15", __value__: 60 },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "column", isStack: true }, { geometry: "line" }],
      columnSeriesField: "__series__",
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["amount", "quantity"],
    });

    expect(container.querySelectorAll('[class*="dual-stack-s"]').length).toBeGreaterThan(0);
    const labels = Array.from(container.querySelectorAll("g.vs-legend text")).map((n) =>
      n.textContent?.trim(),
    );
    expect(labels).toContain("A4打印纸(箱)");
    expect(labels).toContain("墨盒套装");
  });

  it("aligns grouped column legend colors with series palette order", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 320, configurable: true });

    renderD3DualAxesChart(container, {
      width: 480,
      height: 320,
      data: [
        [
          { __category__: "A", __value__: 10, __series__: "华东" },
          { __category__: "A", __value__: 20, __series__: "华北" },
          { __category__: "B", __value__: 15, __series__: "华东" },
          { __category__: "B", __value__: 25, __series__: "华北" },
        ],
        [
          { __category__: "A", __value__: 100 },
          { __category__: "B", __value__: 200 },
        ],
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "column", isGroup: true }, { geometry: "line" }],
      columnSeriesField: "__series__",
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme,
      showTooltip: false,
      showLegend: true,
      lineLabels: ["quantity", "amount"],
    });

    expect(container.querySelectorAll('[class*="dual-group-"]').length).toBeGreaterThan(0);

    const legendEntries = Array.from(container.querySelectorAll("g.vs-legend > g")).map((node) => ({
      label: node.querySelector("text")?.textContent?.trim() ?? "",
      color: node.querySelector("rect")?.getAttribute("fill") ?? "",
    }));
    expect(legendEntries.find((entry) => entry.label === "华东")?.color).toBe("#465fff");
    expect(legendEntries.find((entry) => entry.label === "华北")?.color).toBe("#12b76a");
    expect(legendEntries.find((entry) => entry.label === "amount")?.color).toBe("#12b76a");
  });

  it("renders tiered x-axis for multi-part category keys", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 480, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 280, configurable: true });

    const SEP = "\u0001";
    const keys = [
      `2025-06-08${SEP}上海市${SEP}27寸显示器${SEP}显示设备`,
      `2025-06-08${SEP}广东省${SEP}无线鼠标${SEP}外设配件`,
      `2025-07-01${SEP}四川省${SEP}机械键盘${SEP}外设配件`,
    ];

    renderD3DualAxesChart(container, {
      width: 480,
      height: 280,
      data: [
        keys.map((cat, i) => ({ __category__: cat, __value__: 10 + i })),
        keys.map((cat, i) => ({ __category__: cat, __value__: 5 + i })),
      ],
      xField: "__category__",
      yField: ["__value__", "__value__"],
      geometryOptions: [{ geometry: "column" }, { geometry: "line" }],
      colors: ["#465fff", "#12b76a"],
      theme,
      showTooltip: false,
      showLegend: false,
      lineLabels: ["柱", "线"],
      categoryLevelCount: 4,
    });

    expect(container.querySelector(".vs-axis-x-tiered")).toBeTruthy();
    const axisLabels = [...container.querySelectorAll(".vs-axis-x-tiered text")].map((n) => n.textContent);
    expect(axisLabels.some((t) => t?.includes("2025"))).toBe(true);
  });
});
