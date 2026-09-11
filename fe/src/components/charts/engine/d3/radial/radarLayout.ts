import {

  DEFAULT_RADAR_RADIUS_PERCENT,

  RADAR_RADIUS_PERCENT_MAX,

  RADAR_RADIUS_PERCENT_MIN,

} from "@/lib/chartDeStyleBlocks";

import { estimateLabelPixelWidth } from "@/components/charts/engine/d3/core/labelOverlap";



const RADAR_PAD = { top: 8, right: 8, bottom: 8, left: 8 };

const RADAR_AXIS_LABEL_GAP = 12;

/** 对标 ECharts：半径占半跨度比例，轴名在 labelR 外排布 */

const RADAR_RADIUS_SPAN_RATIO = 0.97;



export type RadarLayout = {

  cx: number;

  cy: number;

  radius: number;

  axisLabelGap: number;

  legendMode: "none" | "top" | "right";

  legendBox?: { x: number; y: number; w: number; h: number };

};



/** 为外围轴名预留边距（仅用于测试/诊断；布局不再扣减半径） */

export function estimateRadarAxisLabelPad(

  axisTexts: string[],

  fontSize: number,

  showAxisName: boolean,

  showPointLabels: boolean,

): number {

  let pad = showPointLabels ? 20 : 10;

  if (!showAxisName) return pad;



  const maxW = axisTexts.reduce(

    (max, text) => Math.max(max, estimateLabelPixelWidth(String(text).trim(), fontSize)),

    fontSize * 3,

  );

  const radialNeed = Math.min(maxW * 0.45, fontSize * 5) + RADAR_AXIS_LABEL_GAP + 6;

  return Math.max(pad, radialNeed);

}



/** 绘制坐标系字号还原为布局估算用的视觉字号 */

export function resolveRadarLayoutFontSize(paintFontSize: number, visualScale = 1): number {

  const safeScale = visualScale > 0 ? visualScale : 1;

  return Math.max(9, paintFontSize * safeScale);

}



function clampRadiusPercent(percent: number): number {

  return Math.max(RADAR_RADIUS_PERCENT_MIN, Math.min(RADAR_RADIUS_PERCENT_MAX, percent));

}



function resolveMaxRadarRadius(halfSpan: number): number {

  if (halfSpan <= 0) return 0;

  return halfSpan * RADAR_RADIUS_SPAN_RATIO;

}



/** 宽扁组件：图例放右侧，雷达区用满高度 */

export function computeRadarLayout(

  width: number,

  height: number,

  showLegend: boolean,

  radiusPercent = DEFAULT_RADAR_RADIUS_PERCENT,

): RadarLayout {

  const base = RADAR_PAD;

  const innerW0 = Math.max(0, width - base.left - base.right);

  const innerH0 = Math.max(0, height - base.top - base.bottom);

  const wide = innerW0 > innerH0 * 1.35;

  const pct = clampRadiusPercent(radiusPercent) / 100;



  if (showLegend && wide) {

    const legendW = Math.min(72, Math.max(56, innerW0 * 0.22));

    const gap = 6;

    const radarW = innerW0 - legendW - gap;

    const halfSpan = Math.max(0, Math.min(radarW, innerH0) / 2);

    const radius = resolveMaxRadarRadius(halfSpan) * pct;

    return {

      cx: base.left + radarW / 2,

      cy: base.top + innerH0 / 2,

      radius,

      axisLabelGap: RADAR_AXIS_LABEL_GAP,

      legendMode: "right",

      legendBox: { x: base.left + radarW + gap, y: base.top, w: legendW, h: innerH0 },

    };

  }



  const topLegend = showLegend ? 18 : 0;

  const innerW = innerW0;

  const innerH = Math.max(0, innerH0 - topLegend);

  const halfSpan = Math.max(0, Math.min(innerW, innerH) / 2);

  const radius = resolveMaxRadarRadius(halfSpan) * pct;



  return {

    cx: base.left + innerW / 2,

    cy: base.top + topLegend + innerH / 2,

    radius,

    axisLabelGap: RADAR_AXIS_LABEL_GAP,

    legendMode: showLegend ? "top" : "none",

  };

}


