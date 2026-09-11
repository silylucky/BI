import type { Selection } from "d3";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { ChartLegendIconShape } from "@/lib/chartDeStyle";
import { normalizeLegendIconShape } from "@/lib/chartLegendPresentation";

export type D3LegendMarker = "rect" | "line" | "circle" | "triangle" | "diamond";

export type D3LegendItem = {
  label: string;
  color: string;
  marker?: D3LegendMarker;
  markerWidth?: number;
  markerHeight?: number;
};

export type D3LegendLayout = {
  position?: "top" | "bottom" | "left" | "right";
  orient?: "horizontal" | "vertical";
  icon?: ChartLegendIconShape;
  iconSize?: number;
  fontSize?: number;
  color?: string;
  hAlign?: "left" | "center" | "right";
  vAlign?: "top" | "middle" | "bottom";
};

export type ChartMargin = { top: number; right: number; bottom: number; left: number };

type LayoutOpts = {
  width: number;
  height: number;
  margin: ChartMargin;
  theme: AntvThemeTokens;
  layout?: D3LegendLayout;
  fontSize?: number;
};

const LEGEND_GAP = 6;
const LEGEND_ITEM_GAP = 8;
const LEGEND_TEXT_PAD = 6;
/** 内联横向图例最多绘制行数，超出部分由壳层图例或分页承接 */
const INLINE_HORIZONTAL_LEGEND_MAX_ROWS = 3;

function isWideLegendChar(code: number): boolean {
  return (
    code > 0xFF ||
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x3000 && code <= 0x303F)
  );
}

/** 估算图例文案宽度（中文按整字宽，避免「广西壮族自治区」压到下一项） */
export function estimateLegendLabelWidth(label: string, fontSize: number): number {
  let width = 0;
  for (const ch of label) {
    const code = ch.codePointAt(0) ?? 0;
    width += isWideLegendChar(code) ? fontSize : fontSize * 0.58;
  }
  return width;
}

function resolveMarker(
  item: D3LegendItem,
  layout?: D3LegendLayout,
): { marker: D3LegendMarker; size: number; width: number; height: number } {
  if (item.marker === "line") {
    return {
      marker: "line",
      size: item.markerWidth ?? 14,
      width: item.markerWidth ?? 14,
      height: item.markerHeight ?? 3,
    };
  }
  const size = item.markerWidth ?? layout?.iconSize ?? 10;
  const marker = item.marker ?? normalizeLegendIconShape(layout?.icon ?? "rect");
  return { marker, size, width: size, height: size };
}

function itemLabelWidth(item: D3LegendItem, fontSize: number, iconSize: number): number {
  const iconW = item.marker === "line" ? (item.markerWidth ?? 14) : iconSize;
  const textW = estimateLegendLabelWidth(item.label, fontSize);
  return iconW + 4 + textW + LEGEND_TEXT_PAD;
}

function legendRowHeight(fontSize: number, iconSize: number): number {
  return Math.max(iconSize, fontSize) + 8;
}

/** 横向图例按绘图区宽度折行（与绘制逻辑一致） */
export function packHorizontalLegendRows(
  items: D3LegendItem[],
  innerW: number,
  fontSize: number,
  iconSize: number,
): D3LegendItem[][] {
  if (items.length === 0) return [];
  if (innerW <= 0) return [items];

  const rows: D3LegendItem[][] = [];
  let row: D3LegendItem[] = [];
  let rowW = 0;

  for (const item of items) {
    const w = itemLabelWidth(item, fontSize, iconSize);
    if (row.length > 0 && rowW + LEGEND_ITEM_GAP + w > innerW) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    if (row.length > 0) rowW += LEGEND_ITEM_GAP;
    row.push(item);
    rowW += w;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function rowContentWidth(row: D3LegendItem[], fontSize: number, iconSize: number): number {
  if (row.length === 0) return 0;
  return row.reduce((sum, item, index) => {
    const gap = index > 0 ? LEGEND_ITEM_GAP : 0;
    return sum + gap + itemLabelWidth(item, fontSize, iconSize);
  }, 0);
}

export function resolveInlineLegendOrient(layout?: D3LegendLayout): boolean {
  if (layout?.orient) return layout.orient === "horizontal";
  const position = layout?.position ?? "bottom";
  return position === "top" || position === "bottom";
}

/** 估算图例占位（横向时按绘图区宽度折行） */
export function estimateLegendBlockSize(
  items: D3LegendItem[],
  layout: D3LegendLayout | undefined,
  width: number,
  height: number,
  margin: ChartMargin,
): { width: number; height: number } {
  const fontSize = layout?.fontSize ?? 11;
  const iconSize = layout?.iconSize ?? 10;
  const horizontal = resolveInlineLegendOrient(layout);
  const rowH = legendRowHeight(fontSize, iconSize);

  if (items.length === 0) {
    return { width: 0, height: 0 };
  }

  if (!horizontal) {
    return {
      width: Math.max(...items.map((item) => itemLabelWidth(item, fontSize, iconSize)), 48),
      height: items.length * rowH,
    };
  }

  const innerW = Math.max(0, width - margin.left - margin.right);
  const rows = packHorizontalLegendRows(items, innerW, fontSize, iconSize);
  const cappedRows = rows.slice(0, INLINE_HORIZONTAL_LEGEND_MAX_ROWS);
  const rowGap = 2;
  const blockHeight = cappedRows.length * rowH + Math.max(0, cappedRows.length - 1) * rowGap;
  const widthUsed = Math.max(...cappedRows.map((row) => rowContentWidth(row, fontSize, iconSize)), 0);
  return { width: innerW > 0 ? Math.min(innerW, widthUsed) : widthUsed, height: blockHeight };
}

/** 按图例位置扩展绘图边距，避免内联图例压住坐标轴/序列 */
export function reserveLegendMargin(
  margin: ChartMargin,
  width: number,
  height: number,
  layout: D3LegendLayout | undefined,
  items: D3LegendItem[],
): ChartMargin {
  if (items.length === 0) return margin;

  const position = layout?.position ?? "bottom";
  const size = estimateLegendBlockSize(items, layout, width, height, margin);
  const pad = LEGEND_GAP;

  switch (position) {
    case "top":
      return { ...margin, top: margin.top + size.height + pad };
    case "bottom":
      return { ...margin, bottom: margin.bottom + size.height + pad };
    case "left":
      return { ...margin, left: margin.left + size.width + pad };
    case "right":
      return { ...margin, right: margin.right + size.width + pad };
    default:
      return margin;
  }
}

function resolveRowOffsetX(
  row: D3LegendItem[],
  innerW: number,
  hAlign: "left" | "center" | "right",
  fontSize: number,
  iconSize: number,
): number {
  const rowW = rowContentWidth(row, fontSize, iconSize);
  if (hAlign === "center") return Math.max(0, (innerW - rowW) / 2);
  if (hAlign === "right") return Math.max(0, innerW - rowW);
  return 0;
}

function defaultLegendHAlign(
  position: NonNullable<D3LegendLayout["position"]>,
): NonNullable<D3LegendLayout["hAlign"]> {
  if (position === "left") return "left";
  if (position === "right") return "right";
  return "center";
}

function defaultLegendVAlign(
  position: NonNullable<D3LegendLayout["position"]>,
): NonNullable<D3LegendLayout["vAlign"]> {
  if (position === "top") return "top";
  if (position === "bottom") return "bottom";
  return "middle";
}

function legendOrigin(
  opts: LayoutOpts,
  items: D3LegendItem[],
  fontSize: number,
  iconSize: number,
): { x: number; y: number } {
  const position = opts.layout?.position ?? "bottom";
  const hAlign = opts.layout?.hAlign ?? defaultLegendHAlign(position);
  const vAlign = opts.layout?.vAlign ?? defaultLegendVAlign(position);
  const { width, height, margin } = opts;
  const size = estimateLegendBlockSize(items, opts.layout, width, height, margin);
  const innerW = Math.max(0, width - margin.left - margin.right);

  let x = margin.left;
  let y = margin.top;

  switch (position) {
    case "bottom":
      y = height - size.height - LEGEND_GAP;
      break;
    case "left":
      x = Math.max(LEGEND_GAP, (margin.left - size.width) / 2);
      y = margin.top;
      break;
    case "right":
      x = width - size.width - LEGEND_GAP;
      y = margin.top;
      break;
    case "top":
    default:
      y = Math.max(LEGEND_GAP, (margin.top - size.height) / 2);
      break;
  }

  if (position === "top" || position === "bottom") {
    const rows = packHorizontalLegendRows(items, innerW, fontSize, iconSize);
    const firstRow = rows[0] ?? [];
    x = margin.left + resolveRowOffsetX(firstRow, innerW, hAlign, fontSize, iconSize);
    if (rows.length === 0) {
      if (hAlign === "center") x = Math.max(margin.left, (width - size.width) / 2);
      if (hAlign === "right") x = Math.max(margin.left, width - margin.right - size.width);
    }
  }

  if (position === "left" || position === "right") {
    const plotH = Math.max(0, height - margin.top - margin.bottom);
    if (vAlign === "middle") y = margin.top + Math.max(0, (plotH - size.height) / 2);
    if (vAlign === "bottom") y = margin.top + Math.max(0, plotH - size.height);
  }

  return { x, y };
}

function appendLegendIcon(
  g: Selection<SVGGElement, unknown, null, undefined>,
  marker: D3LegendMarker,
  width: number,
  height: number,
  color: string,
) {
  const y = 1;
  switch (marker) {
    case "line":
      g.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("y", y + (10 - height) / 2)
        .attr("rx", 2)
        .attr("fill", color);
      return width;
    case "circle":
      g.append("circle").attr("cx", width / 2).attr("cy", y + height / 2).attr("r", width / 2).attr("fill", color);
      return width;
    case "triangle":
      g.append("path")
        .attr("d", `M ${width / 2} ${y} L ${width} ${y + height} L 0 ${y + height} Z`)
        .attr("fill", color);
      return width;
    case "diamond":
      g.append("path")
        .attr("d", `M ${width / 2} ${y} L ${width} ${y + height / 2} L ${width / 2} ${y + height} L 0 ${y + height / 2} Z`)
        .attr("fill", color);
      return width;
    case "rect":
    default:
      g.append("rect").attr("width", width).attr("height", height).attr("y", y).attr("rx", 2).attr("fill", color);
      return width;
  }
}

function appendLegendItem(
  legend: Selection<SVGGElement, unknown, null, undefined>,
  item: D3LegendItem,
  offsetX: number,
  offsetY: number,
  opts: LayoutOpts,
  fontSize: number,
  textColor: string,
  defaultIconSize: number,
): number {
  const resolved = resolveMarker(item, opts.layout);
  const g = legend.append("g").attr("transform", `translate(${offsetX},${offsetY})`);
  const iconW = appendLegendIcon(g, resolved.marker, resolved.width, resolved.height, item.color);
  g.append("text")
    .attr("x", iconW + 4)
    .attr("y", Math.max(resolved.height, fontSize))
    .attr("fill", textColor)
    .style("font-size", `${fontSize}px`)
    .text(item.label);
  return itemLabelWidth(item, fontSize, defaultIconSize);
}

/** 在 SVG 根节点绘制内联图例（对标 DE 图例位置/方向/图标） */
export function layoutD3InlineLegend(
  root: Selection<SVGSVGElement, unknown, null, undefined>,
  items: D3LegendItem[],
  opts: LayoutOpts,
): void {
  if (items.length === 0) return;

  root.selectAll("g.vs-legend").remove();
  const horizontal = resolveInlineLegendOrient(opts.layout);
  const fontSize = opts.layout?.fontSize ?? opts.fontSize ?? 11;
  const textColor = opts.layout?.color ?? opts.theme.legendText;
  const defaultIconSize = opts.layout?.iconSize ?? 10;
  const position = opts.layout?.position ?? "bottom";
  const hAlign = opts.layout?.hAlign ?? defaultLegendHAlign(position);
  const innerW = Math.max(0, opts.width - opts.margin.left - opts.margin.right);
  const rowH = legendRowHeight(fontSize, defaultIconSize);
  const { x, y } = legendOrigin(opts, items, fontSize, defaultIconSize);
  const legend = root.append("g").attr("class", "vs-legend").attr("transform", `translate(${x},${y})`);

  if (!horizontal) {
    let offsetY = 0;
    for (const item of items) {
      appendLegendItem(legend, item, 0, offsetY, opts, fontSize, textColor, defaultIconSize);
      offsetY += rowH;
    }
    return;
  }

  const rows = packHorizontalLegendRows(items, innerW, fontSize, defaultIconSize).slice(
    0,
    INLINE_HORIZONTAL_LEGEND_MAX_ROWS,
  );
  let offsetY = 0;
  for (const row of rows) {
    let offsetX = resolveRowOffsetX(row, innerW, hAlign, fontSize, defaultIconSize);
    for (const item of row) {
      const rowW = appendLegendItem(legend, item, offsetX, offsetY, opts, fontSize, textColor, defaultIconSize);
      offsetX += rowW + LEGEND_ITEM_GAP;
    }
    offsetY += rowH + 2;
  }
}

/** 按 showLegend 开关绘制内联图例 */
export function renderConfiguredInlineLegend(
  root: Selection<SVGSVGElement, unknown, null, undefined>,
  showLegend: boolean,
  items: D3LegendItem[],
  opts: LayoutOpts,
): void {
  if (!showLegend || items.length === 0) {
    root.selectAll("g.vs-legend").remove();
    return;
  }
  layoutD3InlineLegend(root, items, opts);
}
