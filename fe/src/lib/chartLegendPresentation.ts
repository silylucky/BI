import type { CSSProperties } from "react";
import type { ChartDeStyle, ChartLegendIconShape, ChartLegendStyle } from "./chartDeStyle";
import { readChartLegendPosition } from "./chartDeStyle";
import { CHART_FONT_SIZE_OPTIONS } from "./chartFontSizes";

/** 图例图标边长（px）：小屏 4px 起，大屏可到 32px */
export const CHART_LEGEND_ICON_SIZE_OPTIONS = [
  4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32,
] as const;

/** 图例文本字号：与轴标签/标题统一的 6–48 档位 */
export const CHART_LEGEND_FONT_SIZE_OPTIONS: readonly number[] = [...CHART_FONT_SIZE_OPTIONS];

export const DEFAULT_CHART_LEGEND_ICON: ChartLegendIconShape = "triangle";
export const DEFAULT_CHART_LEGEND_ICON_SIZE = 6;
export const DEFAULT_CHART_LEGEND_FONT_SIZE = 12;

export function readChartLegendIcon(deStyle: ChartDeStyle): ChartLegendIconShape {
  return deStyle.legend?.icon ?? DEFAULT_CHART_LEGEND_ICON;
}

export function readChartLegendIconSize(deStyle: ChartDeStyle): number {
  return deStyle.legend?.iconSize ?? DEFAULT_CHART_LEGEND_ICON_SIZE;
}

/** 当前图标尺寸不在预设档位时，追加后排序（保留历史配置可编辑） */
export function resolveLegendIconSizeOptions(
  current: number | undefined,
  fallback: number = DEFAULT_CHART_LEGEND_ICON_SIZE,
): number[] {
  const size = current ?? fallback;
  const base = CHART_LEGEND_ICON_SIZE_OPTIONS as readonly number[];
  if (base.includes(size)) return [...base];
  return [...base, size].sort((a, b) => a - b);
}

/** 图例项排列方向（对标 DE「方向」；未配置时随位置推断） */
export function readChartLegendOrient(
  deStyle: ChartDeStyle,
): NonNullable<ChartLegendStyle["orient"]> {
  if (deStyle.legend?.orient) return deStyle.legend.orient;
  const pos = readChartLegendPosition(deStyle);
  return pos === "left" || pos === "right" ? "vertical" : "horizontal";
}

/** 看板 HTML 外壳图例：左右侧位时强制垂直排列，避免横向占满挤压绘图区（对标 DE） */
export function resolveEmbeddedLegendOrient(
  position: NonNullable<ChartLegendStyle["position"]>,
  orient: NonNullable<ChartLegendStyle["orient"]>,
): NonNullable<ChartLegendStyle["orient"]> {
  if (position === "left" || position === "right") return "vertical";
  return orient;
}

/** 左右侧图例最大宽度（相对组件宽度的比例上限） */
export const EMBEDDED_SIDE_LEGEND_MAX_WIDTH = "min(38%,6.5rem)";

export type ChartLegendHAlign = NonNullable<ChartLegendStyle["hAlign"]>;
export type ChartLegendVAlign = NonNullable<ChartLegendStyle["vAlign"]>;

/** DE 图例形状下拉（仅保留差异明显的四种） */
export const LEGEND_ICON_SHAPE_LABELS: Record<
  Exclude<ChartLegendIconShape, "roundRect">,
  string
> = {
  circle: "圆形",
  rect: "矩形",
  triangle: "三角形",
  diamond: "菱形",
};

export const LEGEND_ICON_SHAPE_SELECT_OPTIONS = (
  Object.entries(LEGEND_ICON_SHAPE_LABELS) as [Exclude<ChartLegendIconShape, "roundRect">, string][]
).map(([value, label]) => ({ value, label }));

export function normalizeLegendIconShape(icon: ChartLegendIconShape): Exclude<ChartLegendIconShape, "roundRect"> {
  return icon === "roundRect" ? "rect" : icon;
}

export function readChartLegendHAlign(deStyle: ChartDeStyle): ChartLegendHAlign {
  if (deStyle.legend?.hAlign) return deStyle.legend.hAlign;
  const pos = readChartLegendPosition(deStyle);
  if (pos === "left") return "left";
  if (pos === "right") return "right";
  return "center";
}

export function readChartLegendVAlign(deStyle: ChartDeStyle): ChartLegendVAlign {
  if (deStyle.legend?.vAlign) return deStyle.legend.vAlign;
  const pos = readChartLegendPosition(deStyle);
  if (pos === "top") return "top";
  if (pos === "bottom") return "bottom";
  return "middle";
}

/** 由 DE 双轴对齐推导外壳分区位置 */
export function resolveLegendPositionFromAlign(
  h: ChartLegendHAlign,
  v: ChartLegendVAlign,
): NonNullable<ChartLegendStyle["position"]> {
  if (v === "top") return "top";
  if (v === "bottom") return "bottom";
  if (h === "left") return "left";
  if (h === "right") return "right";
  return "bottom";
}

export function legendStripJustifyClass(h: ChartLegendHAlign): string {
  if (h === "left") return "justify-start";
  if (h === "right") return "justify-end";
  return "justify-center";
}

export function legendSideAlignClass(v: ChartLegendVAlign): string {
  if (v === "top") return "justify-start";
  if (v === "bottom") return "justify-end";
  return "justify-center";
}

export function legendMarkerStyle(
  shape: ChartLegendIconShape,
  color: string,
  size: number,
): CSSProperties {
  switch (shape) {
    case "circle":
      return {
        width: size,
        height: size,
        borderRadius: "9999px",
        backgroundColor: color,
      };
    case "rect":
      return { width: size, height: size, backgroundColor: color };
    case "roundRect":
      return {
        width: size,
        height: size,
        borderRadius: Math.max(1, Math.round(size * 0.2)),
        backgroundColor: color,
      };
    case "diamond":
      return {
        width: size,
        height: size,
        backgroundColor: color,
        transform: "rotate(45deg)",
      };
    case "triangle":
      return {
        width: 0,
        height: 0,
        borderLeft: `${size / 2}px solid transparent`,
        borderRight: `${size / 2}px solid transparent`,
        borderBottom: `${size}px solid ${color}`,
        backgroundColor: "transparent",
      };
    default:
      return { width: size, height: size, backgroundColor: color };
  }
}
