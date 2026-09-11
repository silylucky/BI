import type { ChartDeStyle } from "@/lib/chartDeStyle";
import {
  DEFAULT_TREEMAP_CELL_RADIUS,
  DEFAULT_TREEMAP_PADDING_INNER,
  DEFAULT_TREEMAP_PADDING_OUTER,
} from "@/lib/chartDeStyleBlocks";

/** 新建矩形树图默认 deStyle：无内间距、外间距 4、多维分行标签 */
export const DEFAULT_TREEMAP_CHART_DE_STYLE: Pick<ChartDeStyle, "treemap" | "label"> = {
  treemap: {
    paddingInner: DEFAULT_TREEMAP_PADDING_INNER,
    paddingOuter: DEFAULT_TREEMAP_PADDING_OUTER,
    cellRadius: DEFAULT_TREEMAP_CELL_RADIUS,
  },
  label: {
    show: true,
    showDimension: true,
    showIndicator: true,
    showPercent: true,
    percentDecimals: 2,
    thousandSeparator: true,
  },
};

export function buildDefaultTreemapDeStyle(): Pick<ChartDeStyle, "treemap" | "label"> {
  return DEFAULT_TREEMAP_CHART_DE_STYLE;
}
