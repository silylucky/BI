import { describe, expect, it } from "vitest";
import * as d3 from "d3";
import {
  estimateLegendBlockSize,
  estimateLegendLabelWidth,
  layoutD3InlineLegend,
  packHorizontalLegendRows,
  reserveLegendMargin,
  type D3LegendItem,
} from "./d3Legend";

const theme = {
  legendText: "#333",
  axisLabel: "#666",
  gridLine: "#eee",
  accent: "#465fff",
} as const;

function makeItems(count: number): D3LegendItem[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `系列${i + 1}`,
    color: "#465fff",
  }));
}

describe("packHorizontalLegendRows", () => {
  it("wraps items when a single row cannot fit", () => {
    const rows = packHorizontalLegendRows(makeItems(12), 180, 11, 10);
    expect(rows.length).toBeGreaterThan(1);
  });

  it("wraps before long province names collide on the same row", () => {
    const items: D3LegendItem[] = [
      { label: "广西壮族自治区", color: "#465fff" },
      { label: "辽宁省", color: "#12b76a" },
      { label: "北京市", color: "#f79009" },
      { label: "上海市", color: "#8a5cff" },
      { label: "天津市", color: "#00c1d4" },
    ];
    const fontSize = 11;
    const iconSize = 10;
    const firstW = iconSize + 4 + estimateLegendLabelWidth(items[0].label, fontSize) + 6;
    const secondW = iconSize + 4 + estimateLegendLabelWidth(items[1].label, fontSize) + 6;
    const innerW = firstW + 8 + secondW - 4;
    const rows = packHorizontalLegendRows(items, innerW, fontSize, iconSize);
    expect(rows[0]).toHaveLength(1);
    expect(rows[1]?.[0]?.label).toBe("辽宁省");
  });
});

describe("reserveLegendMargin", () => {
  it("extends bottom margin for default bottom legend", () => {
    const base = { top: 8, right: 8, bottom: 8, left: 8 };
    const items = [
      { label: "系列 A", color: "#f00" },
      { label: "系列 B", color: "#0f0" },
    ];
    const margin = reserveLegendMargin(base, 400, 200, { position: "bottom" }, items);
    expect(margin.bottom).toBeGreaterThan(base.bottom);
  });

  it("reserves more bottom space when many legend items wrap", () => {
    const base = { top: 8, right: 8, bottom: 28, left: 8 };
    const few = reserveLegendMargin(base, 400, 220, { position: "bottom" }, makeItems(2));
    const many = reserveLegendMargin(base, 400, 220, { position: "bottom" }, makeItems(16));
    expect(many.bottom).toBeGreaterThan(few.bottom);
  });

  it("does not reserve space when legend items are empty", () => {
    const base = { top: 8, right: 8, bottom: 8, left: 8 };
    const margin = reserveLegendMargin(base, 400, 200, { position: "bottom" }, []);
    expect(margin).toEqual(base);
  });
});

describe("estimateLegendBlockSize", () => {
  it("matches wrapped row count for many items", () => {
    const margin = { top: 8, right: 8, bottom: 28, left: 8 };
    const items = makeItems(16);
    const innerW = 400 - margin.left - margin.right;
    const rows = packHorizontalLegendRows(items, innerW, 11, 10);
    const size = estimateLegendBlockSize(items, { position: "bottom" }, 400, 220, margin);
    expect(size.height).toBeGreaterThanOrEqual(rows.length * 19);
  });
});

describe("layoutD3InlineLegend", () => {
  it("renders legend below axis band at the bottom margin", () => {
    const container = document.createElement("div");
    const root = d3.select(container).append("svg").attr("width", 400).attr("height", 220);
    const base = { top: 8, right: 8, bottom: 28, left: 8 };
    const items = makeItems(16);
    const margin = reserveLegendMargin(base, 400, 220, { position: "bottom" }, items);

    layoutD3InlineLegend(root, items, {
      width: 400,
      height: 220,
      margin,
      theme,
      layout: { position: "bottom" },
    });

    const legend = container.querySelector("g.vs-legend");
    expect(legend).not.toBeNull();
    const transform = legend?.getAttribute("transform") ?? "";
    const y = Number(transform.match(/translate\([^,]+,([^)]+)\)/)?.[1] ?? 0);
    const size = estimateLegendBlockSize(items, { position: "bottom" }, 400, 220, margin);
    expect(y).toBeGreaterThanOrEqual(220 - size.height - 8);
    expect(y + size.height).toBeLessThanOrEqual(220);
  });

  it("places wrapped items on multiple rows instead of one long row", () => {
    const container = document.createElement("motion.div");
    const root = d3.select(container).append("svg").attr("width", 400).attr("height", 220);
    const items = makeItems(16);
    const margin = reserveLegendMargin(
      { top: 8, right: 8, bottom: 28, left: 8 },
      400,
      220,
      { position: "bottom" },
      items,
    );

    layoutD3InlineLegend(root, items, {
      width: 400,
      height: 220,
      margin,
      theme,
      layout: { position: "bottom" },
    });

    const transforms = Array.from(container.querySelectorAll<SVGGElement>("g.vs-legend > g")).map(
      (node) => node.getAttribute("transform") ?? "",
    );
    const ys = new Set(
      transforms.map((value) => Number(value.match(/translate\([^,]+,([^)]+)\)/)?.[1] ?? 0)),
    );
    expect(ys.size).toBeGreaterThan(1);
  });

  it("keeps long Chinese labels from overlapping neighbors on one row", () => {
    const container = document.createElement("div");
    const root = d3.select(container).append("svg").attr("width", 520).attr("height", 120);
    const items: D3LegendItem[] = [
      { label: "广西壮族自治区", color: "#465fff" },
      { label: "辽宁省", color: "#12b76a" },
      { label: "北京市", color: "#f79009" },
    ];
    const margin = { top: 8, right: 8, bottom: 8, left: 8 };

    layoutD3InlineLegend(root, items, {
      width: 520,
      height: 120,
      margin,
      theme,
      layout: { position: "bottom" },
      fontSize: 11,
    });

    const itemGroups = Array.from(container.querySelectorAll<SVGGElement>("g.vs-legend > g"));
    const boxes = itemGroups.map((node) => {
      const transform = node.getAttribute("transform") ?? "";
      const x = Number(transform.match(/translate\(([^,]+),/)?.[1] ?? 0);
      const y = Number(transform.match(/translate\([^,]+,([^)]+)\)/)?.[1] ?? 0);
      const text = node.querySelector("text");
      const textLen = text?.textContent?.length ?? 0;
      const width = 10 + 4 + estimateLegendLabelWidth(text?.textContent ?? "", 11) + 6;
      return { x, y, width };
    });

    const row = boxes.filter((b) => b.y === boxes[0]?.y);
    for (let i = 1; i < row.length; i++) {
      expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].width - 1);
    }
  });
});
