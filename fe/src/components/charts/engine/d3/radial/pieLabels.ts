import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";
import { formatChartValue } from "@/lib/chartValueFormat";

export type PieLabelRenderOptions = {
  position: "inside" | "outside";
  showDimension: boolean;
  showIndicator: boolean;
  showPercent: boolean;
  percentDecimals: number;
};

export function resolvePieLabelRenderOptions(
  label: ChartLabelStyle | undefined,
): PieLabelRenderOptions {
  const position = label?.position === "outside" ? "outside" : "inside";
  const outside = position === "outside";
  return {
    position,
    showDimension: label?.showDimension ?? outside,
    showIndicator: label?.showIndicator !== false,
    showPercent: label?.showPercent ?? outside,
    percentDecimals: label?.percentDecimals ?? label?.ratioDecimals ?? 2,
  };
}

export function formatPieSliceLabel(
  row: Record<string, unknown>,
  colorField: string,
  angleField: string,
  total: number,
  opts: PieLabelRenderOptions,
  valueFormat: NumberFormatConfig | undefined,
): string {
  const dim =
    opts.showDimension ? String(row[colorField] ?? "").trim() : "";
  const indicator =
    opts.showIndicator ? formatChartValue(row[angleField], valueFormat) : "";
  const v = Number(row[angleField] ?? 0);
  const pct = total > 0 ? (v / total) * 100 : 0;
  const percent =
    opts.showPercent ? `${pct.toFixed(opts.percentDecimals)}%` : "";

  if (opts.position === "outside") {
    let text = dim;
    if (indicator) text = text ? `${text} ${indicator}` : indicator;
    if (percent) text = text ? `${text} (${percent})` : percent;
    return text;
  }

  const parts: string[] = [];
  if (dim) parts.push(dim);
  if (indicator) parts.push(indicator);
  if (percent) parts.push(percent);
  return parts.join("\n");
}

/** Tooltip 行：数值 (占比%)，对标 DE total_amount: 14,998 (6.28%) */
export function formatPieTooltipValue(
  value: unknown,
  total: number,
  valueFormat: NumberFormatConfig | undefined,
  percentDecimals = 2,
): string {
  const indicator = formatChartValue(value, valueFormat);
  const n = Number(value ?? 0);
  const pct = total > 0 ? (n / total) * 100 : 0;
  return `${indicator} (${pct.toFixed(percentDecimals)}%)`;
}

/**
 * 外置标签几何（对标 ECharts/DataEase labelLine）：
 * 扇区边缘 → 径向 length1 → 水平 length2；避让时水平段随 textY 整体平移，无共享竖直导轨。
 */
export type PieOutsideLabelGeometry = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  textX: number;
  textY: number;
  anchor: "start" | "end" | "middle";
  isRight: boolean;
};

export function pieOutsideLabelPolyline(geo: PieOutsideLabelGeometry): string {
  return `${geo.x0},${geo.y0} ${geo.x1},${geo.y1} ${geo.x2},${geo.y2}`;
}

const OUTSIDE_LABEL_TEXT_GAP = 3;

function outsideLabelLineLengths(outerR: number, fontSize: number): { length1: number; length2: number } {
  return {
    length1: Math.max(10, outerR * 0.1, fontSize * 0.7),
    length2: Math.max(14, outerR * 0.14, fontSize * 1.1),
  };
}

/** 圆心到外标签右/左外沿的水平占用（半径 + 引线 + 字宽） */
export function pieOutsideLabelExtentFromCenter(
  outerR: number,
  fontSize: number,
  textWidth: number,
): number {
  const { length1, length2 } = outsideLabelLineLengths(outerR, fontSize);
  return outerR + length1 + length2 + OUTSIDE_LABEL_TEXT_GAP + textWidth;
}

export function estimatePieOutsideLabelWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 0xff ? fontSize : fontSize * 0.58;
  }
  return width + OUTSIDE_LABEL_TEXT_GAP;
}

function sliceDirection(midAngle: number): { cos: number; sin: number; isRight: boolean } {
  const cos = Math.cos(midAngle - Math.PI / 2);
  const sin = Math.sin(midAngle - Math.PI / 2);
  return { cos, sin, isRight: cos >= 0 };
}

/** 初始引线：径向 length1（玫瑰图补 outerR-connectR）+ 水平 length2 */
export function pieOutsideLabelGeometry(
  midAngle: number,
  outerR: number,
  fontSize: number,
  connectR?: number,
): PieOutsideLabelGeometry {
  const edgeR = connectR ?? outerR;
  const { length1, length2 } = outsideLabelLineLengths(outerR, fontSize);
  const { cos, sin, isRight } = sliceDirection(midAngle);
  const anchor: "start" | "end" = isRight ? "start" : "end";
  const dir = isRight ? 1 : -1;

  const x0 = cos * edgeR;
  const y0 = sin * edgeR;
  const radialLen = length1 + (outerR - edgeR);
  const x1 = x0 + cos * radialLen;
  const y1 = y0 + sin * radialLen;
  const x2 = x1 + dir * length2;
  const y2 = y1;
  const textX = x2 + dir * OUTSIDE_LABEL_TEXT_GAP;
  const textY = y2;

  return {
    x0,
    y0,
    x1,
    y1,
    x2,
    y2,
    textX,
    textY,
    anchor,
    isRight,
  };
}

export type PieOutsideLabelCandidate = {
  key: string;
  midAngle: number;
  sliceAngle: number;
  text: string;
  connectR?: number;
  priority?: number;
};

export type PieOutsideLabelPlaced = {
  visible: boolean;
  text: string;
  points: string;
  textX: number;
  textY: number;
  anchor: "start" | "end" | "middle";
};

const MIN_SLICE_ANGLE_RAD = 0.035;

export function outsideLabelRowGap(fontSize: number): number {
  return Math.max(fontSize + 6, Math.round(fontSize * 1.35));
}

type LabelBBox = { left: number; right: number; top: number; bottom: number };

function labelTextBBox(
  geo: PieOutsideLabelGeometry,
  text: string,
  fontSize: number,
): LabelBBox {
  const w = estimatePieOutsideLabelWidth(text, fontSize);
  const h = fontSize + 4;
  const cy = geo.textY;
  if (geo.anchor === "start") {
    return { left: geo.textX, right: geo.textX + w, top: cy - h / 2, bottom: cy + h / 2 };
  }
  if (geo.anchor === "end") {
    return { left: geo.textX - w, right: geo.textX, top: cy - h / 2, bottom: cy + h / 2 };
  }
  return { left: geo.textX - w / 2, right: geo.textX + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
}

function boxesOverlap(a: LabelBBox, b: LabelBBox, pad = 2): boolean {
  return (
    a.left < b.right + pad &&
    a.right > b.left - pad &&
    a.top < b.bottom + pad &&
    a.bottom > b.top - pad
  );
}

type LayoutItem = {
  key: string;
  sliceAngle: number;
  midAngle: number;
  text: string;
  connectR: number;
  priority: number;
  visible: boolean;
  geo: PieOutsideLabelGeometry;
};

function segmentSegmentsCross(
  ax0: number,
  ay0: number,
  ax1: number,
  ay1: number,
  bx0: number,
  by0: number,
  bx1: number,
  by1: number,
): boolean {
  const d = (ax1 - ax0) * (by1 - by0) - (ay1 - ay0) * (bx1 - bx0);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((bx0 - ax0) * (by1 - by0) - (by0 - ay0) * (bx1 - bx0)) / d;
  const u = ((bx0 - ax0) * (ay1 - ay0) - (by0 - ay0) * (ax1 - ax0)) / d;
  const eps = 1e-5;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

function leaderSegments(geo: PieOutsideLabelGeometry): [number, number, number, number][] {
  return [
    [geo.x0, geo.y0, geo.x1, geo.y1],
    [geo.x1, geo.y1, geo.x2, geo.y2],
  ];
}

function leaderLinesCross(a: PieOutsideLabelGeometry, b: PieOutsideLabelGeometry): boolean {
  const aSegs = leaderSegments(a);
  const bSegs = leaderSegments(b);
  for (const [ax0, ay0, ax1, ay1] of aSegs) {
    for (const [bx0, by0, bx1, by1] of bSegs) {
      if (segmentSegmentsCross(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1)) {
        return true;
      }
    }
  }
  return false;
}

function resolvePieLabelSide(midAngle: number): "right" | "left" {
  return sliceDirection(midAngle).isRight ? "right" : "left";
}

function rebuildInitialGeo(
  item: LayoutItem,
  outerR: number,
  fontSize: number,
): void {
  item.geo = pieOutsideLabelGeometry(item.midAngle, outerR, fontSize, item.connectR);
}

/** 标签 Y 单调堆叠（对标 ECharts shiftLayoutOnXY Y 维） */
function shiftLayoutOnY(
  items: LayoutItem[],
  bounds: { ymin: number; ymax: number },
  fontSize: number,
): boolean {
  if (items.length < 2) return false;

  const halfH = (fontSize + 4) / 2;
  const minGap = 2;
  items.sort((a, b) => a.geo.textY - b.geo.textY);

  let adjusted = false;
  let lastBottom = bounds.ymin;

  for (const item of items) {
    const top = item.geo.textY - halfH;
    if (top < lastBottom) {
      const delta = lastBottom - top;
      item.geo.textY += delta;
      adjusted = true;
    }
    lastBottom = item.geo.textY + halfH + minGap;
  }

  const overflow = items[items.length - 1].geo.textY + halfH - bounds.ymax;
  if (overflow > 0) {
    for (const item of items) {
      item.geo.textY -= overflow;
    }
    adjusted = true;
  }

  const underflow = bounds.ymin - (items[0].geo.textY - halfH);
  if (underflow > 0) {
    for (const item of items) {
      item.geo.textY += underflow;
    }
    adjusted = true;
  }

  return adjusted;
}

/** alignTo: labelLine — 同侧标签对齐到最远 textX，延长水平段 */
function alignSideToLabelLine(items: LayoutItem[], dir: 1 | -1): void {
  if (items.length === 0) return;

  let farthestX = dir > 0 ? -Infinity : Infinity;
  for (const item of items) {
    farthestX =
      dir > 0
        ? Math.max(farthestX, item.geo.textX)
        : Math.min(farthestX, item.geo.textX);
  }

  for (const item of items) {
    const geo = item.geo;
    const dx = geo.textX - farthestX;
    geo.x1 += dx;
    geo.textX = farthestX;
  }
}

/** 避让后重接引线：水平段与 textY 对齐，无竖直导轨 */
function finalizeLineGeometry(geo: PieOutsideLabelGeometry): void {
  const dist = geo.x1 - geo.x2;
  if (geo.isRight) {
    geo.x2 = geo.textX - OUTSIDE_LABEL_TEXT_GAP;
    geo.x1 = geo.x2 + dist;
  } else {
    geo.x2 = geo.textX + OUTSIDE_LABEL_TEXT_GAP;
    geo.x1 = geo.x2 + dist;
  }
  geo.y1 = geo.textY;
  geo.y2 = geo.textY;
}

export type PieOutsideLabelBounds = {
  ymin: number;
  ymax: number;
  xmin?: number;
  xmax?: number;
};

function layoutSide(
  sideItems: LayoutItem[],
  outerR: number,
  fontSize: number,
  bounds: PieOutsideLabelBounds,
): void {
  const dir: 1 | -1 = sideItems[0]?.geo.isRight ? 1 : -1;

  for (const item of sideItems) {
    item.visible = true;
    rebuildInitialGeo(item, outerR, fontSize);
  }

  const visible = () => sideItems.filter((i) => i.visible);

  for (let iter = 0; iter < 3; iter += 1) {
    shiftLayoutOnY(visible(), bounds, fontSize);
    alignSideToLabelLine(visible(), dir);
    for (const item of visible()) {
      finalizeLineGeometry(item.geo);
    }
  }

  for (const item of sideItems) {
    const box = labelTextBBox(item.geo, item.text, fontSize);
    const overflowY = box.top < bounds.ymin || box.bottom > bounds.ymax;
    const overflowX =
      (bounds.xmin != null && box.left < bounds.xmin) ||
      (bounds.xmax != null && box.right > bounds.xmax);
    if (overflowY || overflowX) {
      item.visible = false;
    }
  }
}

function avoidOutsideLabelOverlap(
  items: LayoutItem[],
  outerR: number,
  fontSize: number,
  bounds: PieOutsideLabelBounds,
  showAll = false,
): void {
  const right: LayoutItem[] = [];
  const left: LayoutItem[] = [];
  for (const item of items) {
    if (resolvePieLabelSide(item.midAngle) === "right") right.push(item);
    else left.push(item);
  }

  if (right.length > 0) layoutSide(right, outerR, fontSize, bounds);
  if (left.length > 0) layoutSide(left, outerR, fontSize, bounds);

  if (!showAll) {
    const visible = items.filter((i) => i.visible);
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = visible[i];
        const b = visible[j];
        const overlap = boxesOverlap(
          labelTextBBox(a.geo, a.text, fontSize),
          labelTextBBox(b.geo, b.text, fontSize),
        );
        const cross = leaderLinesCross(a.geo, b.geo);
        if (overlap || cross) {
          const loser = a.priority >= b.priority ? b : a;
          loser.visible = false;
        }
      }
    }
  }
}

export function layoutPieOutsideLabels(
  candidates: PieOutsideLabelCandidate[],
  outerR: number,
  fontSize: number,
  bounds: PieOutsideLabelBounds,
  showAll = false,
): Map<string, PieOutsideLabelPlaced> {
  const result = new Map<string, PieOutsideLabelPlaced>();

  const items: LayoutItem[] = [];
  for (const c of candidates) {
    if (c.sliceAngle < MIN_SLICE_ANGLE_RAD) {
      result.set(c.key, {
        visible: false,
        text: c.text,
        points: "",
        textX: 0,
        textY: 0,
        anchor: "start",
      });
      continue;
    }
    const connectR = c.connectR ?? outerR;
    items.push({
      key: c.key,
      sliceAngle: c.sliceAngle,
      midAngle: c.midAngle,
      text: c.text,
      connectR,
      priority: c.priority ?? c.sliceAngle,
      visible: true,
      geo: pieOutsideLabelGeometry(c.midAngle, outerR, fontSize, connectR),
    });
  }

  avoidOutsideLabelOverlap(items, outerR, fontSize, bounds, showAll);

  for (const item of items) {
    if (!item.visible) {
      result.set(item.key, {
        visible: false,
        text: item.text,
        points: "",
        textX: 0,
        textY: 0,
        anchor: item.geo.anchor,
      });
      continue;
    }
    result.set(item.key, {
      visible: true,
      text: item.text,
      points: pieOutsideLabelPolyline(item.geo),
      textX: item.geo.textX,
      textY: item.geo.textY,
      anchor: item.geo.anchor,
    });
  }
  return result;
}

export function pieOutsideLabelBounds(
  outerR: number,
  halfHeight?: number,
): PieOutsideLabelBounds {
  const ymax = halfHeight ?? outerR * 1.42;
  return { ymin: -ymax, ymax };
}

export function pieArcLayoutKey(startAngle: number, endAngle: number): string {
  return `${startAngle}:${endAngle}`;
}
