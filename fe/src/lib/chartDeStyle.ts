import type { CSSProperties } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type {
  DashboardStyleConfig,
  NumberFormatConfig,
  TitleStyleConfig,
  WidgetStyleConfig,
  ColorScheme,
} from "@/components/dashboard/dashboardStyleConfig";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import {
  mergeTitleStyle,
  mergeWidgetShellStyle,
} from "@/components/dashboard/dashboardStyleConfig";
import { getDashboardThemeTokens, isOppositeThemeTitleColor } from "@/components/dashboard/dashboardThemeTokens";
import type { WidgetBackgroundPresentation } from "@/lib/widgetSurfaceBackground";
import { buildWidgetBackgroundPresentation } from "@/lib/widgetStylePresentation";
import { parseWidgetBackgroundImageUrl } from "@/components/dashboard/imageSourceUtils";
import { isDecorativeWidgetBackgroundUrl } from "@/lib/widgetBackgroundImageFit";
import type { ChartSeriesColorItem } from "@/lib/chartSeriesColor";
import { resolveChartColors, resolvePaletteId } from "@/lib/chartPalette";
import type { ChartDrillFrame } from "@/lib/chartDrill";
import type { ChartDeStyleBlocks } from "@/lib/chartDeStyleBlocks";
export {
  DEFAULT_PIE_INNER_RADIUS_PERCENT,
  DEFAULT_PIE_MERGE_TOP_N,
  DEFAULT_PIE_OTHER_LABEL,
  DEFAULT_PIE_OUTER_RADIUS_PERCENT,
  PIE_INNER_RADIUS_MAX,
  PIE_INNER_RADIUS_MIN,
} from "@/lib/chartDeStyleBlocks";
import {
  patchChartDeTablePalette,
  stripChartTableColorOverrides,
} from "@/lib/chartDeTableStyle";

export type { ChartSeriesColorItem } from "@/lib/chartSeriesColor";

export type ChartLegendStyle = {
  show?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  /** 图例项排列：水平 / 垂直（对标 DE「方向」） */
  orient?: "horizontal" | "vertical";
  /** 对标 DE 位置 · 水平对齐（左/中/右） */
  hAlign?: "left" | "center" | "right";
  /** 对标 DE 位置 · 垂直对齐（上/中/下） */
  vAlign?: "top" | "middle" | "bottom";
  fontSize?: number;
  color?: string;
  /** 对标 ECharts legend.icon */
  icon?: ChartLegendIconShape;
  iconSize?: number;
};

export type ChartLegendIconShape =
  | "circle"
  | "rect"
  | "roundRect"
  | "triangle"
  | "diamond";

/** 看板内嵌图例默认：开启 + 底部居中 */
export const DEFAULT_CHART_LEGEND_STYLE: Required<
  Pick<ChartLegendStyle, "show" | "position" | "hAlign" | "vAlign">
> &
  ChartLegendStyle = {
  show: true,
  position: "bottom",
  hAlign: "center",
  vAlign: "bottom",
};

export type ChartLabelStyle = {
  show?: boolean;
  fontSize?: number;
  color?: string;
  /** 饼图等：标签相对扇区位置（对标 DE 内/外） */
  position?: "inside" | "outside";
  /** 饼图：显示维度名 */
  showDimension?: boolean;
  /** 饼图：显示指标值（对标 DE「指标」） */
  showIndicator?: boolean;
  /** 饼图：显示占比（对标 DE「占比」） */
  showPercent?: boolean;
  /** 饼图占比小数位 */
  percentDecimals?: number;
  formatType?: NumberFormatConfig["type"];
  thousandSeparator?: boolean;
  decimals?: number;
  unit?: string;
  /** 水波图指标行：格式（不含 percent，占比单独配置） */
  metricFormatType?: NumberFormatConfig["type"];
  metricDecimals?: number;
  metricUnit?: string;
  metricThousandSeparator?: boolean;
  /** 水波图：显示指标原值（对标 DE「指标」，默认开） */
  showMetric?: boolean;
  /** 水波图：显示占比（对标 DE「占比」，默认关） */
  showRatio?: boolean;
  /** 水波图占比保留小数位 */
  ratioDecimals?: number;
  /** 全量显示外置标签（饼图/玫瑰图，允许重叠） */
  showAll?: boolean;
  /** 数量单位语言（对标 DE） */
  unitLanguage?: "zh" | "en";
};

export type ChartBorderStyle = {
  show?: boolean;
  color?: string;
  width?: number;
  style?: "solid" | "dashed" | "dotted";
  radius?: number;
};

export type ChartRemarkStyle = {
  show?: boolean;
  text?: string;
};

export type ChartGeoAreaMappingEntry = {
  id: string;
  /** 业务维度原始值 */
  from: string;
  /** 标准省/市/区县名称（须能匹配离线 GeoJSON properties.name） */
  to: string;
};

export type { ChartGeo3dOrbitView, ChartGeoViewTransform } from "@/lib/chartGeoViewState";

export type ChartGeoStyle = {
  /** 对标 DE「地区」：离线中国省级底图（GEO-IRON-01 仅 china） */
  mapArea?: "china";
  /** 对标 DE 数据页「地区」手动下钻路径（预览/编辑共用） */
  manualDrillStack?: ChartDrillFrame[];
  roam?: boolean;
  showRegionLabel?: boolean;
  visualMap?: boolean;
  showCellLabel?: boolean;
  /** 省/市/区县行政边界线（随下钻层级切换 GeoJSON 轮廓） */
  showRegionBorder?: boolean;
  /** 行政边界线颜色（#rrggbb）；未设置时跟随 3D 样式预设或主题 */
  regionBorderColor?: string;
  /** 无数据/零值区块填充色（#rrggbb，2D 地图） */
  regionFillColor?: string;
  /** 地图右下角缩放 +/- 按钮（2D 地图） */
  showZoomControl?: boolean;
  /** 高级 · 气泡动效（2D 地图区域中心水波） */
  bubbleEffect?: boolean;
  /** 动效类型（当前仅水波） */
  bubbleEffectType?: "ripple";
  /** 动效速率倍率（对标 DE，默认 1.1） */
  bubbleEffectSpeed?: number;
  /** 水波环数（对标 DE，默认 4） */
  bubbleEffectRingCount?: number;
  /** 水波颜色（#rrggbb；未设置时用系列色/默认琥珀） */
  bubbleEffectColor?: string;
  /** 区域标签颜色（#rrggbb） */
  regionLabelColor?: string;
  /** 区域标签字号（px，默认 9） */
  regionLabelFontSize?: number;
  /** 行政区边线宽度倍率（相对自适应基准，0.5–3，默认 1） */
  regionBorderWidth?: number;
  /** 高级 · 地名映射：业务值 → 标准地名（map / map-3d 共用） */
  areaMapping?: ChartGeoAreaMappingEntry[];
  /** 2D 地图缩放平移（按 mapId 分桶，编辑态交互后写回） */
  viewTransforms?: Record<string, import("@/lib/chartGeoViewState").ChartGeoViewTransform>;
};

export type ChartGeo3dStyle = {
  /** 视觉预设：卫星 / 科技 / 经典 / 简洁（对标 sc-datav Demo0–2） */
  stylePreset?: "satellite" | "tech" | "classic" | "minimal" | "glass" | "glass-warm" | "glass-night";
  extrudeIntensity?: number;
  quality?: "auto" | "high" | "medium" | "low";
  /** 离线卫星地形贴图（diffuse） */
  terrainTexture?: boolean;
  /** 场景云（科技预设默认开启，可手动覆盖；配置键 sceneFog 保持兼容） */
  sceneFog?: boolean;
  /** 场景云密度 0.1–1 */
  sceneCloudDensity?: number;
  /** 场景云漂移速度倍率 0–2 */
  sceneCloudSpeed?: number;
  /** 场景云高度倍率 0.2–2（相对地图尺度） */
  sceneCloudHeight?: number;
  /** 底座装饰（双环/网格/涟漪；科技预设默认开启） */
  platformEffects?: boolean;
  /** 底座层：中心高光 */
  platformHighlight?: boolean;
  /** 底座层：旋转双环 */
  platformRings?: boolean;
  /** 底座层：底网格 */
  platformGrid?: boolean;
  /** 底座层：扩散涟漪 */
  platformRipple?: boolean;
  /** 底座层：径向光晕（shader） */
  platformGlow?: boolean;
  /** 底座层：脉冲波（shader） */
  platformPulse?: boolean;
  /** 底座层：旋转扫光（shader） */
  platformSweep?: boolean;
  /** 高光/双环颜色（#rrggbb） */
  platformHighlightColor?: string;
  /** 网格颜色（#rrggbb） */
  platformGridColor?: string;
  /** 底网格样式：圆点纹理 / 正方形格 */
  platformGridStyle?: "texture" | "square";
  /** 正方形网格密度倍率 0.3–2 */
  platformGridDensity?: number;
  /** 扩散涟漪速度倍率 0.2–3（默认 1） */
  platformRippleSpeed?: number;
  /** 扩散涟漪频率（同时存在的波数）1–5 */
  platformRippleFrequency?: number;
  /** 涟漪颜色（#rrggbb） */
  platformRippleColor?: string;
  /** 光晕颜色（#rrggbb） */
  platformGlowColor?: string;
  /** 脉冲波颜色（#rrggbb） */
  platformPulseColor?: string;
  /** 扫光颜色（#rrggbb） */
  platformSweepColor?: string;
  /** 高光不透明度 0–1 */
  platformHighlightOpacity?: number;
  /** 双环不透明度 0–1 */
  platformRingOpacity?: number;
  /** 双环旋转速度倍率 0.2–3 */
  platformRingSpeed?: number;
  /** 网格不透明度 0–1 */
  platformGridOpacity?: number;
  /** 涟漪不透明度 0–1 */
  platformRippleOpacity?: number;
  /** 光晕不透明度 0–1 */
  platformGlowOpacity?: number;
  /** 脉冲波不透明度 0–1 */
  platformPulseOpacity?: number;
  /** 脉冲波速度倍率 0.2–3 */
  platformPulseSpeed?: number;
  /** 扫光不透明度 0–1 */
  platformSweepOpacity?: number;
  /** 旋转扫光速度倍率 0.2–3 */
  platformSweepSpeed?: number;
  /** 环/高光尺寸倍率 0.4–1.6（相对地图） */
  platformSizeScale?: number;
  /** 3D 地图 orbit 视角（按 mapId 分桶，编辑态交互后写回） */
  orbitViews?: Record<string, import("@/lib/chartGeoViewState").ChartGeo3dOrbitView>;
  /** 点位特效（热力 blob / 光柱 / 浮动标签；科技预设默认开启） */
  pointEffects?: boolean;
  /** 贴地热力 blob */
  heatBlob?: boolean;
  heatBlobOpacity?: number;
  /** 热力 splat 半径（像素） */
  heatBlobRadius?: number;
  heatBlobBlur?: number;
  /** 热力顶面抬升倍率 */
  heatBlobLift?: number;
  heatBlobColor?: string;
  /** 热力开启时降低 choropleth 顶面着色强度 0–1 */
  heatBlobDimChoropleth?: number;
  /** 垂直光柱 */
  pointPillar?: boolean;
  pointPillarColorTop?: string;
  pointPillarColorBottom?: string;
  pointPillarOpacity?: number;
  pointPillarHeightScale?: number;
  pointPillarBaseRingOpacity?: number;
  /** 脚底环相对地图点位单位的尺寸倍率 */
  pointPillarBaseRingScale?: number;
  pointPillarRingSpeed?: number;
  /** 浮动区域标签（map-3d） */
  floatingLabels?: boolean;
  floatingLabelFontSize?: number;
  floatingLabelTextColor?: string;
  floatingLabelBgColor?: string;
  floatingLabelBorderColor?: string;
  floatingLabelOffset?: number;
  /** 挤出侧壁/底板颜色（#rrggbb）；未设置时跟随样式预设 */
  shellColor?: string;
  /** 挤出侧壁/底板不透明度（0–1，默认 1） */
  shellOpacity?: number;
  /** @deprecated 不再渲染背景装饰 */
  effectsEnabled?: boolean;
  groundMirror?: boolean;
  beamScan?: boolean;
};

export const DEFAULT_GEO3D_EXTRUDE_INTENSITY = 0.85;
export const DEFAULT_GEO3D_SHELL_OPACITY = 1;

/** 饼图/环形图样式（对标 DE attr-style · 基础样式） */
export type ChartPieStyle = {
  /** 环形内径，占外径百分比 */
  innerRadiusPercent?: number;
  outerRadiusPercent?: number;
  padAngle?: number;
  /** 合并小项为「其他」 */
  mergeOthers?: boolean;
  /** 合并前保留的 Top N */
  topN?: number;
  /** 合并项名称 */
  otherLabel?: string;
};

export type ChartTooltipStyle = {
  show?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
};

export type ChartDeStyle = {
  paletteId?: string;
  /** 自定义色板序列（对标 DE 自定义配色；优先于 paletteId 预设） */
  paletteColors?: string[];
  paletteOpacity?: number;
  /** 系列渐变填充（对标 DE「渐变颜色」） */
  seriesGradient?: boolean;
  /** 立体视觉：关 / 标准 / 增强（VCDS 2.5D） */
  depthVisual?: "off" | "standard" | "enhanced";
  /** 柱/线等系列级配色（对标 DE seriesColor；优先于调色板循环色） */
  seriesColor?: ChartSeriesColorItem[];
  title?: TitleStyleConfig & { show?: boolean };
  legend?: ChartLegendStyle;
  label?: ChartLabelStyle;
  tooltip?: ChartTooltipStyle;
  background?: WidgetStyleConfig;
  border?: ChartBorderStyle;
  remark?: ChartRemarkStyle;
  geo?: ChartGeoStyle;
  geo3d?: ChartGeo3dStyle;
  pie?: ChartPieStyle;
} & ChartDeStyleBlocks;

export function readChartGeoStyle(deStyle: ChartDeStyle) {
  return deStyle.geo ?? {};
}

export function readChartGeo3dStyle(deStyle: ChartDeStyle): ChartGeo3dStyle {
  return deStyle.geo3d ?? {};
}

export type GeoVisualMapChartType = "map" | "map-3d" | "heatmap";

/** map-3d 默认关闭数值图例；2D 地图/热力默认开启，均可显式覆盖 */
export function resolveGeoVisualMapEnabled(
  geo: ChartGeoStyle,
  chartType: GeoVisualMapChartType,
): boolean {
  if (chartType === "map-3d") return geo.visualMap === true;
  return geo.visualMap !== false;
}

export function readChartPieStyle(deStyle: ChartDeStyle): ChartPieStyle {
  return deStyle.pie ?? {};
}

export function readChartDeStyle(cfg: ChartViewConfig): ChartDeStyle {
  const raw = cfg.nativeBody?.deStyle;
  if (!raw || typeof raw !== "object") return {};
  return raw as ChartDeStyle;
}

/** D3 画布 contentKey：deStyle 任一绘制字段变更须触发重绘 */
export function chartDeStyleRenderFingerprint(deStyle: ChartDeStyle): string {
  return JSON.stringify(deStyle);
}

/** 组件 override → 看板默认；均未配置时 undefined（由 resolveChartColors 回退 default） */
export function resolveEffectivePaletteId(
  cfg: ChartViewConfig,
  dashboardPaletteId?: string,
): string | undefined {
  const own = readChartDeStyle(cfg).paletteId;
  if (own != null) return resolvePaletteId(own);
  if (dashboardPaletteId != null) return resolvePaletteId(dashboardPaletteId);
  return undefined;
}

/** 组件 override → 看板默认；自定义色优先于预设模板 */
export function resolveEffectivePaletteColors(
  cfg: ChartViewConfig,
  dashboardPaletteId?: string,
  dashboardPaletteColors?: readonly string[],
): string[] {
  const de = readChartDeStyle(cfg);
  if (de.paletteId != null) {
    return resolveChartColors(resolvePaletteId(de.paletteId), de.paletteColors);
  }
  return resolveChartColors(
    dashboardPaletteId,
    dashboardPaletteColors?.length ? [...dashboardPaletteColors] : undefined,
  );
}

/** 合并图表配色 patch（继承时清除 override 字段） */
export function patchChartPaletteDeStyle(
  cfg: ChartViewConfig,
  paletteId: string | undefined,
  colors: readonly string[],
): ChartViewConfig {
  const prev = readChartDeStyle(cfg);
  const nextDe: ChartDeStyle = { ...prev };
  delete nextDe.seriesColor;

  if (paletteId == null) {
    delete nextDe.paletteId;
    delete nextDe.paletteColors;
    delete nextDe.paletteOpacity;
  } else {
    nextDe.paletteId = paletteId;
    nextDe.paletteColors = [...colors];
  }

  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: nextDe,
    },
  };
}

/** 默认显示；组件 deStyle.title.show > 看板 titleStyle.show */
export function readChartTitleVisible(
  cfg: ChartViewConfig | undefined,
  globalTitleStyle?: Pick<TitleStyleConfig, "show">,
): boolean {
  if (cfg) {
    const show = readChartDeStyle(cfg).title?.show;
    if (show !== undefined) return show !== false;
  }
  return globalTitleStyle?.show !== false;
}

/** 新建内置图默认写入 title/label.show，与看板 chartLabelShow / titleStyle 语义一致 */
export function buildDefaultChartTitleLabelStyle(): Pick<ChartDeStyle, "title" | "label"> {
  return {
    title: { show: true },
    label: { show: true },
  };
}

/** 图例显隐：显式 false 隐藏；未配置或 true 时显示（含看板内嵌） */
export function readChartLegendVisible(
  deStyle: ChartDeStyle,
  _options?: { embedded?: boolean },
): boolean {
  return deStyle.legend?.show !== false;
}

/** 由 hAlign/vAlign 推导分区位置（与 chartLegendPresentation 一致，避免 position 字段陈旧） */
function reconcileLegendPositionFromAlign(
  legend: ChartLegendStyle,
): NonNullable<ChartLegendStyle["position"]> {
  const storedPos = legend.position;
  if (legend.hAlign == null && legend.vAlign == null) {
    return storedPos ?? DEFAULT_CHART_LEGEND_STYLE.position;
  }
  const h =
    legend.hAlign ??
    (storedPos === "left" ? "left" : storedPos === "right" ? "right" : "center");
  const v =
    legend.vAlign ??
    (storedPos === "top" ? "top" : storedPos === "bottom" ? "bottom" : "middle");
  if (v === "top") return "top";
  if (v === "bottom") return "bottom";
  if (h === "left") return "left";
  if (h === "right") return "right";
  return storedPos ?? DEFAULT_CHART_LEGEND_STYLE.position;
}

/** 图例位置：未配置时默认底部；hAlign/vAlign 与 position 不一致时以对齐推导为准 */
export function readChartLegendPosition(
  deStyle: ChartDeStyle,
): NonNullable<ChartLegendStyle["position"]> {
  const legend = deStyle.legend;
  if (!legend) return DEFAULT_CHART_LEGEND_STYLE.position;
  return reconcileLegendPositionFromAlign(legend);
}

export function mergeChartTitleStyle(
  global: DashboardStyleConfig["titleStyle"] | undefined,
  cfg: ChartViewConfig | undefined,
  colorScheme: ColorScheme = "light",
): CSSProperties {
  const override = cfg ? readChartDeStyle(cfg).title : undefined;
  const tokens = getDashboardThemeTokens(colorScheme);
  const mergedOverride =
    override?.color && isOppositeThemeTitleColor(override.color, colorScheme)
      ? { ...override, color: tokens.title }
      : override;
  return mergeTitleStyle(global, mergedOverride);
}

/** 看板「图表标题」修改后清除组件级 title override（含 show） */
export function stripChartTitleOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  if (!de.title) return cfg;
  const nextDe: ChartDeStyle = { ...de };
  delete nextDe.title;
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: nextDe,
    },
  };
}

/** @deprecated 使用 stripChartTitleOverrides */
export function stripChartTitlePresentationOverrides(cfg: ChartViewConfig): ChartViewConfig {
  return stripChartTitleOverrides(cfg);
}

export function syncChartWidgetsForDashboardTitleStyle(
  widgets: LayoutWidget[],
): LayoutWidget[] {
  return syncChartWidgetsForDashboardScopes(widgets, new Set(["title"]));
}

export type DashboardWidgetSyncScope =
  | "title"
  | "widgetAppearance"
  | "palette"
  | "numberFormat"
  | "queryLimit";

export function inferWidgetSyncScopes(
  patch: Partial<DashboardStyleConfig>,
): Set<DashboardWidgetSyncScope> {
  const scopes = new Set<DashboardWidgetSyncScope>();
  if (patch.titleStyle) scopes.add("title");
  if (patch.widgetStyle) scopes.add("widgetAppearance");
  if (patch.paletteId !== undefined || patch.paletteColors !== undefined) {
    scopes.add("palette");
  }
  if (
    patch.paletteOpacity !== undefined ||
    patch.seriesGradient !== undefined ||
    patch.depthVisual !== undefined ||
    patch.chartLabelShow !== undefined ||
    patch.tooltipShow !== undefined ||
    patch.chartLabelStyle !== undefined ||
    patch.chartTooltipStyle !== undefined ||
    patch.tableColorStyle !== undefined
  ) {
    scopes.add("palette");
  }
  if (patch.numberFormat) scopes.add("numberFormat");
  if (patch.defaultQueryLimit !== undefined) scopes.add("queryLimit");
  return scopes;
}

export function syncChartWidgetsForDashboardScopes(
  widgets: LayoutWidget[],
  scopes: ReadonlySet<DashboardWidgetSyncScope>,
): LayoutWidget[] {
  if (scopes.size === 0) return widgets;

  return widgets.map((widget) => {
    if (widget.type !== "chart" || !widget.chartConfig) return widget;
    let cfg = widget.chartConfig;

    if (scopes.has("title")) cfg = stripChartTitleOverrides(cfg);
    if (scopes.has("widgetAppearance")) cfg = stripChartWidgetAppearanceOverrides(cfg);
    if (scopes.has("palette")) {
      cfg = stripChartPaletteOverrides(cfg);
      cfg = patchChartDeTablePalette(cfg, undefined);
    }
    if (scopes.has("numberFormat")) cfg = stripChartLabelFormatOverrides(cfg);
    if (scopes.has("queryLimit")) cfg = stripChartQueryLimitOverride(cfg);

    return cfg === widget.chartConfig ? widget : { ...widget, chartConfig: cfg };
  });
}

export function stripChartWidgetAppearanceOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  if (!de.background && !de.border) return cfg;
  const nextDe: ChartDeStyle = { ...de };
  delete nextDe.background;
  delete nextDe.border;
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: nextDe,
    },
  };
}

/** 清除组件级背景 override（含底色/图片/装饰边框），回退看板默认 */
export function stripChartBackgroundStyleOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  if (!de.background) return cfg;
  const nextDe: ChartDeStyle = { ...de };
  delete nextDe.background;
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: nextDe,
    },
  };
}

export function stripChartPaletteOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  const features = cfg.nativeBody?.deFeatures;
  const hasShowLabelFeature =
    features && typeof features === "object" && "showLabel" in features;
  const label = de.label;
  const hasLabelPaletteFields =
    label &&
    (label.show !== undefined || label.fontSize !== undefined || label.color !== undefined);
  const tooltip = de.tooltip;
  const hasTooltipFields =
    tooltip &&
    (tooltip.show !== undefined ||
      tooltip.fontSize !== undefined ||
      tooltip.color !== undefined ||
      tooltip.background !== undefined);
  const hasSeriesColor = Boolean(de.seriesColor?.length);
  const hasPaletteFields =
    de.paletteId != null ||
    (de.paletteColors != null && de.paletteColors.length > 0) ||
    de.paletteOpacity != null ||
    de.seriesGradient != null ||
    de.depthVisual != null ||
    hasSeriesColor ||
    hasLabelPaletteFields ||
    hasTooltipFields ||
    hasShowLabelFeature;
  if (!hasPaletteFields) return cfg;

  const nextDe: ChartDeStyle = { ...de };
  delete nextDe.paletteId;
  delete nextDe.paletteColors;
  delete nextDe.paletteOpacity;
  delete nextDe.seriesGradient;
  delete nextDe.depthVisual;
  if (hasSeriesColor) {
    delete nextDe.seriesColor;
  }

  if (label) {
    const nextLabel: ChartLabelStyle = { ...label };
    delete nextLabel.show;
    delete nextLabel.fontSize;
    delete nextLabel.color;
    const hasLabel =
      nextLabel.formatType !== undefined ||
      nextLabel.thousandSeparator !== undefined;
    if (hasLabel) nextDe.label = nextLabel;
    else delete nextDe.label;
  }

  if (tooltip) {
    delete nextDe.tooltip;
  }

  let nativeBody = {
    ...cfg.nativeBody,
    deStyle: nextDe,
  };

  if (hasShowLabelFeature && features && typeof features === "object") {
    const { showLabel: _removed, ...restFeatures } = features as { showLabel?: boolean };
    if (Object.keys(restFeatures).length > 0) {
      nativeBody = { ...nativeBody, deFeatures: restFeatures };
    } else {
      const { deFeatures: _drop, ...restBody } = nativeBody;
      nativeBody = restBody;
    }
  }

  return { ...cfg, nativeBody };
}

function omitEmptyDeStyleField<T extends Record<string, unknown>>(
  value: T | undefined,
): T | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, field]) => field !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/** 仅清除组件级颜色 override，保留字号/圆角/边框宽度等结构字段 */
export function stripChartColorStyleOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  const nextDe: ChartDeStyle = { ...de };
  let changed = false;

  if (de.title?.color !== undefined) {
    nextDe.title = omitEmptyDeStyleField(
      (({ color: _removed, ...rest }) => rest)(de.title),
    );
    changed = true;
  }

  if (de.legend?.color !== undefined) {
    nextDe.legend = omitEmptyDeStyleField(
      (({ color: _removed, ...rest }) => rest)(de.legend),
    );
    changed = true;
  }

  if (de.label?.color !== undefined) {
    nextDe.label = omitEmptyDeStyleField(
      (({ color: _removed, ...rest }) => rest)(de.label),
    );
    changed = true;
  }

  if (de.tooltip && (de.tooltip.color !== undefined || de.tooltip.background !== undefined)) {
    const { color: _c, background: _b, ...rest } = de.tooltip;
    nextDe.tooltip = omitEmptyDeStyleField(rest);
    changed = true;
  }

  if (de.border?.color !== undefined) {
    nextDe.border = omitEmptyDeStyleField(
      (({ color: _removed, ...rest }) => rest)(de.border),
    );
    changed = true;
  }

  if (de.seriesColor?.length) {
    delete nextDe.seriesColor;
    changed = true;
  }

  let nextCfg = cfg;
  if (changed) {
    nextCfg = {
      ...cfg,
      nativeBody: {
        ...cfg.nativeBody,
        deStyle: nextDe,
      },
    };
  }
  return stripChartTableColorOverrides(nextCfg);
}

export function stripChartLabelFormatOverrides(cfg: ChartViewConfig): ChartViewConfig {
  const de = readChartDeStyle(cfg);
  const label = de.label;
  if (!label || (label.formatType == null && label.thousandSeparator === undefined)) {
    return cfg;
  }
  const nextLabel: ChartLabelStyle = { ...label };
  delete nextLabel.formatType;
  delete nextLabel.thousandSeparator;
  const hasLabel =
    nextLabel.show !== undefined ||
    nextLabel.fontSize !== undefined ||
    nextLabel.color !== undefined;
  const nextDe: ChartDeStyle = { ...de };
  if (hasLabel) nextDe.label = nextLabel;
  else delete nextDe.label;
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: nextDe,
    },
  };
}

export function stripChartQueryLimitOverride(cfg: ChartViewConfig): ChartViewConfig {
  const raw = cfg.nativeBody?.deDisplay;
  if (!raw || typeof raw !== "object") return cfg;
  const de = raw as { resultLimit?: string; refreshMode?: string };
  if (!de.resultLimit) return cfg;
  const { resultLimit: _removed, ...restDisplay } = de;
  const nativeBody = { ...cfg.nativeBody };
  if (Object.keys(restDisplay).length > 0) {
    nativeBody.deDisplay = restDisplay;
  } else {
    delete nativeBody.deDisplay;
  }
  return { ...cfg, nativeBody };
}

export function patchChartDeStyle(
  cfg: ChartViewConfig,
  patch: Partial<ChartDeStyle>,
): ChartViewConfig {
  const prev = readChartDeStyle(cfg);
  return {
    ...cfg,
    nativeBody: {
      ...cfg.nativeBody,
      deStyle: { ...prev, ...patch },
    },
  };
}

export function patchChartDeStyleNested<
  K extends keyof ChartDeStyle,
>(cfg: ChartViewConfig, key: K, patch: Partial<NonNullable<ChartDeStyle[K]>>): ChartViewConfig {
  const prev = readChartDeStyle(cfg);
  const nested = { ...(prev[key] as object), ...patch };
  return patchChartDeStyle(cfg, { [key]: nested } as Partial<ChartDeStyle>);
}

export function readChartShowLabel(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "chartLabelShow">,
): boolean {
  const labelShow = readChartDeStyle(cfg).label?.show;
  if (labelShow !== undefined) return labelShow;
  const features = cfg.nativeBody?.deFeatures;
  if (features && typeof features === "object" && "showLabel" in features) {
    return Boolean((features as { showLabel?: boolean }).showLabel);
  }
  return defaults?.chartLabelShow !== false;
}

export function readChartTooltipShow(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "tooltipShow">,
): boolean {
  const tooltipShow = readChartDeStyle(cfg).tooltip?.show;
  if (tooltipShow !== undefined) return tooltipShow;
  return defaults?.tooltipShow ?? true;
}

export function readChartSeriesGradient(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "seriesGradient">,
): boolean {
  const gradient = readChartDeStyle(cfg).seriesGradient;
  if (gradient !== undefined) return gradient;
  return defaults?.seriesGradient ?? false;
}

export function readChartDepthVisual(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "depthVisual">,
): "off" | "standard" | "enhanced" {
  const depth = readChartDeStyle(cfg).depthVisual;
  if (depth !== undefined) return depth;
  return defaults?.depthVisual ?? "off";
}

export function readChartPaletteOpacity(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "paletteOpacity">,
): number | undefined {
  const opacity = readChartDeStyle(cfg).paletteOpacity;
  if (opacity !== undefined) return opacity;
  return defaults?.paletteOpacity;
}

export function resolveChartLabelPresentation(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "chartLabelStyle">,
): { fontSize: number; color?: string } {
  const label = readChartDeStyle(cfg).label;
  return {
    fontSize: label?.fontSize ?? defaults?.chartLabelStyle?.fontSize ?? 12,
    color: label?.color ?? defaults?.chartLabelStyle?.color,
  };
}

export function resolveChartTooltipPresentation(
  cfg: ChartViewConfig,
  defaults?: Pick<DashboardStyleConfig, "chartTooltipStyle">,
): { fontSize: number; color?: string; background?: string } {
  const tooltip = readChartDeStyle(cfg).tooltip;
  return {
    fontSize: tooltip?.fontSize ?? defaults?.chartTooltipStyle?.fontSize ?? 12,
    color: tooltip?.color ?? defaults?.chartTooltipStyle?.color,
    background: tooltip?.background ?? defaults?.chartTooltipStyle?.background,
  };
}

/** 图表标签字体色：组件 → 看板 → 主题令牌（供取色器预览真实生效色） */
export function resolveChartLabelDisplayColor(
  cfg: ChartViewConfig | undefined,
  defaults?: Pick<DashboardStyleConfig, "chartLabelStyle" | "colorScheme">,
): string {
  const label = cfg ? readChartDeStyle(cfg).label : undefined;
  const scheme = defaults?.colorScheme ?? "light";
  return label?.color ?? defaults?.chartLabelStyle?.color ?? getDashboardThemeTokens(scheme).chartAxis;
}

/** 图表提示字体色：组件 → 看板 → ECharts 常见默认 */
export function resolveChartTooltipDisplayColor(
  cfg: ChartViewConfig | undefined,
  defaults?: Pick<DashboardStyleConfig, "chartTooltipStyle" | "colorScheme">,
): string {
  const tooltip = cfg ? readChartDeStyle(cfg).tooltip : undefined;
  return tooltip?.color ?? defaults?.chartTooltipStyle?.color ?? "#ffffff";
}

/** 图表提示背景色：组件 → 看板 → 主题近似默认 */
export function resolveChartTooltipDisplayBackground(
  cfg: ChartViewConfig | undefined,
  defaults?: Pick<DashboardStyleConfig, "chartTooltipStyle" | "colorScheme">,
): string {
  const tooltip = cfg ? readChartDeStyle(cfg).tooltip : undefined;
  const scheme = defaults?.colorScheme ?? "light";
  const tokens = getDashboardThemeTokens(scheme);
  return (
    tooltip?.background ??
    defaults?.chartTooltipStyle?.background ??
    (scheme === "dark" ? tokens.dialogBg : "#344054")
  );
}

export function readChartRemark(cfg: ChartViewConfig | undefined): { show: boolean; text: string } {
  if (!cfg) return { show: false, text: "" };
  const remark = readChartDeStyle(cfg).remark;
  const text = remark?.text?.trim() ?? "";
  return { show: Boolean(remark?.show && text), text };
}

export function readChartDataZoom(cfg: ChartViewConfig): boolean {
  const raw = cfg.nativeBody?.deFeatures;
  if (raw && typeof raw === "object" && "dataZoom" in raw) {
    return Boolean((raw as { dataZoom?: boolean }).dataZoom);
  }
  return false;
}

/** 组件内容区内背景/内边距/圆角（对标 DE 样式 Tab · 背景） */
export function widgetStyleToContentCss(
  bg: WidgetStyleConfig | undefined,
  colorScheme: ColorScheme = "light",
): WidgetBackgroundPresentation {
  return buildWidgetBackgroundPresentation(bg, colorScheme, { respectBackgroundShow: true });
}

/** 单图 deStyle 覆盖看板 widgetStyle，统一落到组件外框（pixel-shape-inner） */
export function mergeChartDeStyleIntoWidgetShell(
  global: WidgetStyleConfig | undefined,
  de: ChartDeStyle,
): WidgetStyleConfig {
  const merged: WidgetStyleConfig = { ...(global ?? {}) };
  const bg = de.background;
  if (bg && typeof bg === "object") {
    Object.assign(merged, bg);
  }
  if (de.border?.show) {
    merged.borderEnabled = true;
    if (de.border.color !== undefined) merged.borderColor = de.border.color;
    if (de.border.width !== undefined) merged.borderWidth = de.border.width;
    if (de.border.style !== undefined) merged.borderStyle = de.border.style;
    if (de.border.radius !== undefined) merged.borderRadius = de.border.radius;
  } else if (de.border?.show === false) {
    merged.borderEnabled = false;
  }
  return merged;
}

/** 面板展示用：与渲染链 mergeChartDeStyleIntoWidgetShell 同源 */
export function resolveEffectiveWidgetShellConfig(
  globalWidgetStyle: WidgetStyleConfig | undefined,
  cfg?: ChartViewConfig,
): WidgetStyleConfig {
  const de = cfg ? readChartDeStyle(cfg) : {};
  return mergeChartDeStyleIntoWidgetShell(globalWidgetStyle, de);
}

/** 合并后 widgetStyle → ChartBorderStyle（单图样式 Tab 线框区） */
export function readEffectiveChartBorder(
  cfg: ChartViewConfig | undefined,
  globalWidgetStyle: WidgetStyleConfig | undefined,
): ChartBorderStyle {
  const merged = resolveEffectiveWidgetShellConfig(globalWidgetStyle, cfg);
  return {
    show: merged.borderEnabled,
    color: merged.borderColor,
    width: merged.borderWidth,
    style: merged.borderStyle,
    radius: merged.borderRadius,
  };
}

function widgetStyleAllowsDecorativeFrame(ws: WidgetStyleConfig | undefined): boolean {
  if (!ws?.framePresetId) return false;
  // 有预设即视为装饰边框；仅在明确为图片/线框模式时关闭
  const mode = ws.backgroundMode ?? "frame";
  return mode === "frame";
}

/** 看板 widgetStyle 外壳 + 图表 deStyle 外观合并到同一外框层 */
export function resolveChartContentShellStyle(
  globalWidgetStyle: DashboardStyleConfig["widgetStyle"] | undefined,
  cfg: ChartViewConfig | undefined,
  colorScheme: ColorScheme = "light",
): {
  outer: ReturnType<typeof mergeWidgetShellStyle>;
  inner: CSSProperties;
  innerBackgroundLayer: CSSProperties | null;
  innerFrameLayer: CSSProperties | null;
} {
  const de = cfg ? readChartDeStyle(cfg) : {};
  const mergedWidgetStyle = cfg
    ? mergeChartDeStyleIntoWidgetShell(globalWidgetStyle, de)
    : globalWidgetStyle;
  const allowFrame = widgetStyleAllowsDecorativeFrame(mergedWidgetStyle);
  const outer = mergeWidgetShellStyle(mergedWidgetStyle, colorScheme, {
    allowDecorativeFrame: allowFrame,
  });
  const outerStyle = { ...outer.style };
  if (
    outer.backgroundLayer?.backgroundImage &&
    !outerStyle.background &&
    (outerStyle.backgroundColor === "var(--dashboard-widget-surface)" ||
      outerStyle.backgroundColor === "transparent")
  ) {
    outerStyle.backgroundColor = "transparent";
  }

  return {
    outer: { ...outer, style: outerStyle },
    inner: {},
    innerBackgroundLayer: null,
    innerFrameLayer: null,
  };
}

export type ShapePresentationLayers = {
  style: CSSProperties;
  /** 底色 / 底图：位于内容下方 */
  backgroundLayers: Array<CSSProperties | null>;
  /** 装饰边框 overlay：必须盖在内容之上，否则被图表底色挡住 */
  frameLayers: Array<CSSProperties | null>;
};

/** 外壳 widgetStyle + 单图 deStyle → shape-inner；shape-content 仅承载图表 */
export function mergeShapeInnerPresentation(shell: {
  outer: ReturnType<typeof mergeWidgetShellStyle>;
  inner: CSSProperties;
  innerBackgroundLayer: CSSProperties | null;
  innerFrameLayer?: CSSProperties | null;
}): { shell: ShapePresentationLayers; content: ShapePresentationLayers } {
  const shellStyle: CSSProperties = { ...shell.outer.style };
  const hasShellBackground = Boolean(
    shellStyle.background || shellStyle.backgroundColor || shellStyle.backgroundImage,
  );
  const usesBackdropGlass = Boolean(
    shell.outer.backgroundLayer?.backdropFilter ?? shell.outer.backgroundLayer?.WebkitBackdropFilter,
  );
  const usesBackgroundImageLayer = Boolean(
    shell.outer.backgroundLayer?.backgroundImage ||
      shell.innerBackgroundLayer?.backgroundImage,
  );
  const decorBackgroundUrl = [
    shell.outer.backgroundLayer?.backgroundImage,
    shell.innerBackgroundLayer?.backgroundImage,
  ]
    .map((value) =>
      parseWidgetBackgroundImageUrl(typeof value === "string" ? value : undefined),
    )
    .find((url) => isDecorativeWidgetBackgroundUrl(url ?? undefined));
  if (!hasShellBackground && !usesBackdropGlass && !usesBackgroundImageLayer) {
    shellStyle.backgroundColor = "var(--dashboard-widget-surface)";
  } else if (
    (usesBackdropGlass || usesBackgroundImageLayer) &&
    (!hasShellBackground || Boolean(decorBackgroundUrl))
  ) {
    shellStyle.backgroundColor = "transparent";
    delete shellStyle.background;
  }

  const contentStyle: CSSProperties = { ...shell.inner };
  if (
    shell.innerBackgroundLayer?.backgroundImage &&
    !contentStyle.background &&
    !contentStyle.backgroundColor
  ) {
    contentStyle.backgroundColor = "transparent";
  }

  return {
    shell: {
      style: shellStyle,
      backgroundLayers: [shell.outer.backgroundLayer],
      frameLayers: [shell.outer.frameLayer ?? null],
    },
    content: {
      style: contentStyle,
      backgroundLayers: [shell.innerBackgroundLayer],
      frameLayers: [shell.innerFrameLayer ?? null],
    },
  };
}

export function resolveWidgetShellStyle(
  globalWidgetStyle: DashboardStyleConfig["widgetStyle"] | undefined,
  colorScheme: ColorScheme = "light",
): ReturnType<typeof mergeWidgetShellStyle> {
  return mergeWidgetShellStyle(globalWidgetStyle, colorScheme, {
    allowDecorativeFrame: widgetStyleAllowsDecorativeFrame(globalWidgetStyle),
  });
}

export function patchChartShowLabel(cfg: ChartViewConfig, show: boolean): ChartViewConfig {
  const withLabel = patchChartDeStyleNested(cfg, "label", { show });
  const prev = withLabel.nativeBody?.deFeatures;
  const deFeatures =
    prev && typeof prev === "object" ? { ...(prev as object), showLabel: show } : { showLabel: show };
  return { ...withLabel, nativeBody: { ...withLabel.nativeBody, deFeatures } };
}

/** 写入标签样式；设置字体颜色时若标签未开启则自动打开（对标 DataEase 选色即见效果） */
export function patchChartLabelStyle(
  cfg: ChartViewConfig,
  patch: Partial<ChartLabelStyle>,
  options?: { autoEnableShow?: boolean },
): ChartViewConfig {
  let next = patchChartDeStyleNested(cfg, "label", patch);
  const autoEnable = options?.autoEnableShow ?? true;
  if (autoEnable && patch.color !== undefined && !readChartShowLabel(next)) {
    next = patchChartShowLabel(next, true);
  }
  return next;
}
