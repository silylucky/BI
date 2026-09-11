import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { ChartConditionalRule, ChartMarkLine } from "@/lib/chartDeFeatures";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartGeoStyle, ChartGeo3dStyle } from "@/lib/chartDeStyle";
import type { ChartGeo3dOrbitView, ChartGeoViewTransform } from "@/lib/chartGeoViewState";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import type { D3LegendPresentation, D3TooltipPresentation } from "@/components/charts/engine/d3/core/presentation";
import type { DataLabelContentOptions } from "@/lib/chartDataLabelFormat";

export type D3Datum = Record<string, unknown>;

import type { DepthVisualLevel } from "@/components/charts/engine/d3/core/chartVisualTokens";

export type D3PresentationConfig = {
  labelFontSize?: number;
  labelColor?: string;
  seriesGradient?: boolean;
  depthVisual?: DepthVisualLevel;
  tooltipPresentation?: D3TooltipPresentation;
  legendLayout?: D3LegendPresentation;
};

export type D3CartesianStyleExtras = {
  barWidthRatio?: number;
  barRadius?: number;
  lineWidth?: number;
  pointSize?: number;
  areaOpacity?: number;
  smooth?: boolean;
  axisStyle?: import("@/lib/chartDeStyleBlocks").ChartAxisStyle;
};

export type D3RenderConfig<TOptions extends Record<string, unknown> = Record<string, unknown>> = {
  width: number;
  height: number;
  colors: string[];
  theme: AntvThemeTokens;
  showLabel: boolean;
  showTooltip: boolean;
  showLegend: boolean;
  labelFontSize: number;
  labelColor?: string;
  labelContent?: DataLabelContentOptions;
  seriesGradient?: boolean;
  tooltipPresentation?: D3TooltipPresentation;
  valueFormat?: NumberFormatConfig;
  conditionalRules?: ChartConditionalRule[];
  onPointClick?: (datum: D3Datum) => void;
  markLines?: ChartMarkLine[];
  legendLayout?: import("@/components/charts/engine/d3/core/d3Legend").D3LegendLayout;
  visualScale?: number;
  renderTier?: Geo3dRenderTier;
  /** WebGL / 力导向等实例槽位 key（widgetId） */
  instanceKey?: string;
  options: TOptions;
};

export type D3RenderConfigBase = Pick<
  D3RenderConfig,
  "width" | "height" | "colors" | "theme" | "showTooltip" | "valueFormat"
> &
  D3PresentationConfig &
  D3CartesianStyleExtras & {
    conditionalRules?: ChartConditionalRule[];
    visualScale?: number;
    renderTier?: Geo3dRenderTier;
  };

export type D3CartesianDatum = Record<string, string | number>;

export type D3CartesianRenderConfig = {
  width: number;
  height: number;
  data: D3CartesianDatum[];
  xField: string;
  yField: string;
  seriesField?: string;
  smooth?: boolean;
  isHorizontal?: boolean;
  isStack?: boolean;
  isGroup?: boolean;
  isPercent?: boolean;
  /** 面积图：true 或空对象 */
  area?: boolean | Record<string, unknown>;
  colors: string[];
  theme: AntvThemeTokens;
  showLabel: boolean;
  showTooltip: boolean;
  showLegend: boolean;
  labelFontSize: number;
  labelColor?: string;
  labelContent?: DataLabelContentOptions;
  seriesGradient?: boolean;
  tooltipPresentation?: D3TooltipPresentation;
  valueFormat?: NumberFormatConfig;
  markLines?: ChartMarkLine[];
  conditionalRules?: ChartConditionalRule[];
  legendLayout?: import("@/components/charts/engine/d3/core/d3Legend").D3LegendLayout;
  onPointClick?: (datum: D3CartesianDatum) => void;
  dataZoom?: boolean;
  barWidthRatio?: number;
  barRadius?: number;
  pointSize?: number;
  areaOpacity?: number;
  axisStyle?: import("@/lib/chartDeStyleBlocks").ChartAxisStyle;
  categoryLevelCount?: number;
  /** 单系列笛卡尔图 tooltip/图例默认系列名（指标 label） */
  defaultSeriesName?: string;
};
export type D3LineDatum = D3CartesianDatum;

export type D3GeoFeature = {
  name: string;
  value: number;
  adcode?: number;
  geometry: GeoJSON.Geometry | null;
};

export type D3GeoStyleProps = {
  roam?: boolean;
  showRegionLabel?: boolean;
  visualMap?: boolean;
  showRegionBorder?: boolean;
  regionBorderColor?: string;
  regionFillColor?: string;
  showZoomControl?: boolean;
  /** 配色不透明度 0–1（deStyle.paletteOpacity） */
  mapOpacity?: number;
  bubbleEffect?: boolean;
  bubbleEffectType?: "ripple";
  bubbleEffectSpeed?: number;
  bubbleEffectRingCount?: number;
  bubbleEffectColor?: string;
  regionLabelColor?: string;
  regionLabelFontSize?: number;
  regionBorderWidth?: number;
  viewTransform?: ChartGeoViewTransform;
};

export type D3GeoRenderConfig = D3RenderConfigBase & {
  rows: unknown[][];
  columns: string[];
  regionField: string;
  metricField: string;
  knownRegionNames?: string[];
  mapId?: string;
  drillDepth?: number;
  areaMapping?: ReadonlyMap<string, string>;
  isDark?: boolean;
  geoStyle?: D3GeoStyleProps;
  geo3dStyle?: ChartGeo3dStyle;
  renderTier?: Geo3dRenderTier;
  /** 嵌入 canvas CSS scale，区域标签字号按视觉尺寸反算 */
  visualScale?: number;
  /** WebGL 实例槽位 key（widgetId 等），用于全页实例上限 */
  instanceKey?: string;
  onPointClick?: (datum: { name: string; value: number; adcode?: number }) => void;
  /** 地图双击下钻（与单击跳转/联动分离） */
  onDrillClick?: (datum: { name: string; value: number; adcode?: number }) => void;
  onViewTransformChange?: (transform: ChartGeoViewTransform | undefined) => void;
  onOrbitViewChange?: (view: ChartGeo3dOrbitView | undefined) => void;
  /** 地图缩放条「刷新」：复位视口并重新拉数/重绘 */
  onRefresh?: () => void;
};

export type D3MatrixCell = { x: string; y: string; value: number };

export type D3MatrixRenderConfig = D3RenderConfigBase & {
  data: D3MatrixCell[];
  conditionalRules?: ChartConditionalRule[];
  showCellLabel?: boolean;
  showVisualMap?: boolean;
  onPointClick?: (datum: D3MatrixCell) => void;
};

export type D3DualAxesGeometryOption =
  | { geometry: "line"; smooth?: boolean }
  | { geometry: "column"; isGroup?: boolean; isStack?: boolean };

export type D3DualAxesRenderConfig = D3RenderConfigBase & {
  data: [D3CartesianDatum[], D3CartesianDatum[]];
  xField: string;
  yField: [string, string];
  geometryOptions: [D3DualAxesGeometryOption, D3DualAxesGeometryOption];
  lineLabels?: [string, string];
  /** 柱侧子类别/堆叠系列字段（来自 encodeCartesianRows） */
  columnSeriesField?: string;
  /** 右线侧子类别系列字段（extBubble → encodeCartesianRows seriesField） */
  lineSeriesField?: string;
  /** 左线侧子类别系列字段（dual-line 时 xAxisExt → seriesField） */
  leftLineSeriesField?: string;
  labelContent?: DataLabelContentOptions;
  showLabel?: boolean;
  labelFontSize?: number;
  dataZoom?: boolean;
  showLegend?: boolean;
  markLines?: ChartMarkLine[];
  conditionalRules?: ChartConditionalRule[];
  onPointClick?: (datum: D3CartesianDatum) => void;
  barWidthRatio?: number;
  barRadius?: number;
  axisStyle?: import("@/lib/chartDeStyleBlocks").ChartAxisStyle;
  smooth?: boolean;
  categoryLevelCount?: number;
};

export type D3WaterfallDatum = { type: string; value: number };

export type D3WaterfallRenderConfig = D3RenderConfigBase & {
  data: D3WaterfallDatum[];
  showLabel?: boolean;
  showLegend?: boolean;
  legendLayout?: import("@/components/charts/engine/d3/core/d3Legend").D3LegendLayout;
  labelFontSize?: number;
  onPointClick?: (datum: D3WaterfallDatum & { runningTotal: number }) => void;
};

export type D3BidirectionalBarDatum = { type: string; left: number; right: number };

export type D3BidirectionalBarRenderConfig = D3RenderConfigBase & {
  data: D3BidirectionalBarDatum[];
  showLabel?: boolean;
  showLegend?: boolean;
  legendLayout?: import("@/components/charts/engine/d3/core/d3Legend").D3LegendLayout;
  labelFontSize?: number;
  onPointClick?: (datum: D3BidirectionalBarDatum) => void;
};

export type D3BarRangeDatum = { type: string; low: number; high: number };

export type D3BarRangeRenderConfig = D3RenderConfigBase & {
  data: D3BarRangeDatum[];
  showLabel?: boolean;
  labelFontSize?: number;
  onPointClick?: (datum: D3BarRangeDatum) => void;
};

export type D3ProgressBarDatum = { type: string; value: number; max: number };

export type D3ProgressBarRenderConfig = D3RenderConfigBase & {
  data: D3ProgressBarDatum[];
  showLabel?: boolean;
  labelFontSize?: number;
  onPointClick?: (datum: D3ProgressBarDatum) => void;
  trackOpacity?: number;
};

export type D3BulletDatum = {
  type: string;
  actual: number;
  target: number;
  rangeMax: number;
};

export type D3BulletRenderConfig = D3RenderConfigBase & {
  data: D3BulletDatum[];
  showLabel?: boolean;
  labelFontSize?: number;
  onPointClick?: (datum: D3BulletDatum) => void;
  targetLineWidth?: number;
  rangeOpacity?: number;
};

export type D3StockDatum = {
  type: string;
  open: number;
  close: number;
  low: number;
  high: number;
};

export type D3StockRenderConfig = D3RenderConfigBase & {
  data: D3StockDatum[];
  showLabel?: boolean;
  labelFontSize?: number;
  onPointClick?: (datum: D3StockDatum) => void;
  bodyWidthRatio?: number;
};
