import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import type { ChartDrillFrame } from "@/lib/chartDrill";
import type { ChartDeFeatures } from "@/lib/chartDeFeatures";
import type { ChartDeStyle } from "@/lib/chartDeStyle";
import type { ChartFieldRef, ChartViewConfig } from "@/lib/chartViewConfig";
import type { ChartAxesConfig } from "@/lib/chartDeAxis";
import type { ColorScheme, NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { DataLabelContentOptions } from "@/lib/chartDataLabelFormat";

import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";

export type ChartEngineId = "d3" | "antv" | "table";

export type VizDataset = {
  columns: string[];
  rows: unknown[][];
};

export type ChartViewModel = {
  chartType: string;
  styleVariant: string;
  engine: ChartEngineId;
  encoding: {
    dimensions: ChartFieldRef[];
    metrics: ChartFieldRef[];
    axes?: ChartAxesConfig;
  };
  dataset: VizDataset;
  source: Record<string, unknown>;
};

export type ChartStyleContext = {
  scheme: ColorScheme;
  deStyle: ChartDeStyle;
  deFeatures: ChartDeFeatures;
  /** 组件 override 与看板默认合并后的调色板 id */
  effectivePaletteId?: string;
  /** 合并后的配色不透明度 0–1（地图填充 / 饼图等） */
  paletteOpacity?: number;
  chartColors: string[];
  dataScreenSurface: boolean;
  showLabel: boolean;
  showTooltip: boolean;
  seriesGradient: boolean;
  depthVisual: "off" | "standard" | "enhanced";
  dataZoom: boolean;
  valueFormat?: NumberFormatConfig;
  labelContent: DataLabelContentOptions;
  labelPresentation: { fontSize: number; color?: string };
  tooltipPresentation: { fontSize: number; color?: string; background?: string };
  shellLegend: boolean;
  embedEdit: boolean;
  /** 看板组件壳层背景色，表格主题与 legacy EmbeddedChartTable 对齐 */
  widgetShellBg?: string;
  /** 看板级表格配色默认（与 pickChartPaletteDefaults.tableColorStyle 对齐） */
  tableColorStyle?: ChartDeTableStyle;
};

export type ChartInteractionEvent =
  | { kind: "drill"; value: string; label?: string }
  | { kind: "legend-toggle"; seriesName: string };

export type ChartLegendSnapshot = {
  items: ChartLegendItem[];
};

export type ChartEngineViewProps = {
  viewModel: ChartViewModel;
  style: ChartStyleContext;
  ariaLabel: string;
  isDark?: boolean;
  fill?: boolean;
  height?: number;
  width?: number;
  mapPlaceholderHint?: string;
  mapDrillError?: string | null;
  heatmapPlaceholderHint?: string;
  drillLookupRows?: unknown[][];
  chartConfig?: ChartViewConfig;
  drillStack?: ChartDrillFrame[];
  drillClickField?: string;
  onInteraction?: (event: ChartInteractionEvent) => void;
  /** 地图联动：单击区域写入 SQL 参数（优先于下钻） */
  onLinkageClick?: (payload: { name: string; value: string }) => void;
  /** 表格行列拖拽结果写回 deTableStyle（看板编辑态） */
  onTableStylePatch?: (patch: Partial<import("@/lib/chartDeTableStyle").ChartDeTableStyle>) => void;
  /** 2D 地图缩放平移写回 deStyle.geo.viewTransforms */
  onGeoViewTransformChange?: (mapId: string, transform: import("@/lib/chartGeoViewState").ChartGeoViewTransform | undefined) => void;
  /** 3D 地图 orbit 视角写回 deStyle.geo3d.orbitViews */
  onGeo3dOrbitViewChange?: (mapId: string, view: import("@/lib/chartGeoViewState").ChartGeo3dOrbitView | undefined) => void;
  /** 编辑态未选中时限制绘制分辨率（逻辑 px 长边） */
  paintMaxEdge?: number;
  /** 查询/定时刷新世代（executeKey），数据变更须触发重绘 */
  chartDataRevision?: string;
  /** 像素画布逻辑尺寸（松手 commit 后驱动引擎 remeasure） */
  layoutFootprint?: { width: number; height: number };
  /** 3D 地图渲染档位：列表缩略图 / 内嵌 / 全屏预览 */
  geo3dRenderTier?: Geo3dRenderTier;
  /** 是否运行 Three rAF（编辑态未选中时 false） */
  geo3dAnimationActive?: boolean;
  /** WebGL 实例槽位 key */
  instanceKey?: string;
  /** 首帧绘制完成（3D 地图异步渲染结束后通知挂载调度释放 slot） */
  onPaintReady?: () => void;
  /** 2D 地图缩放条「刷新」：复位视口并重新拉数 */
  onChartRefresh?: () => void;
};

/** @deprecated 使用 ChartViewModel；兼容过渡期 */
export type RenderSpec = {
  engine: ChartEngineId;
  chartType: string;
  styleVariant: string;
  encoding: { dimensions: ChartFieldRef[]; metrics: ChartFieldRef[]; axes?: import("@/lib/chartDeAxis").ChartAxesConfig };
  source: Record<string, unknown>;
};
