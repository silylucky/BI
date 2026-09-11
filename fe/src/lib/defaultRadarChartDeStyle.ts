import type { ChartDeStyle } from "@/lib/chartDeStyle";

import {
  DEFAULT_RADAR_RADIUS_PERCENT,
} from "@/lib/chartDeStyleBlocks";

/** 新建雷达图默认 deStyle：对标 DataEase 圆形网格 + 外围轴名 + 点上指标 */
export const DEFAULT_RADAR_CHART_DE_STYLE: Pick<ChartDeStyle, "radar" | "label"> = {
  radar: {
    shape: "circle",
    showAxisName: true,
    showArea: true,
    areaOpacity: 0.25,
    axisLineColor: "#cbd5e1",
    axisLineWidth: 1,
    splitNumber: 5,
    showSymbol: false,
    radiusPercent: DEFAULT_RADAR_RADIUS_PERCENT,
  },
  label: {
    show: true,
    showDimension: false,
    showIndicator: true,
    showPercent: false,
    thousandSeparator: true,
  },
};

export function buildDefaultRadarDeStyle(): Pick<ChartDeStyle, "radar" | "label"> {
  return DEFAULT_RADAR_CHART_DE_STYLE;
}
