import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { normalizeBasemapHexColor } from "@/components/charts/engine/maplibre/gisBasemapPalette";
import {
  normalizeGisProjectHalo,
  type GisProjectHalo,
} from "@/components/charts/engine/maplibre/gisProjectHalo";
import {
  normalizeGisProjectSun,
  type GisProjectSun,
} from "@/components/charts/engine/maplibre/gisProjectSun";
import {
  normalizeGisProjectLayers,
  type GisProjectLayer,
} from "@/components/charts/engine/maplibre/gisProjectLayers";
import {
  normalizeGisProjectEffects,
  type GisEffectsSettings,
} from "@/components/charts/engine/maplibre/gisProjectEffects";

export type { GisProjectHalo } from "@/components/charts/engine/maplibre/gisProjectHalo";
export type { GisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";
export type { GisEffectsSettings } from "@/components/charts/engine/maplibre/gisProjectEffects";
export type { GisLayerKind, GisProjectLayer } from "@/components/charts/engine/maplibre/gisProjectLayers";

/** gis-map 仅支持管理员登记的全球 PMTiles 外部底图。 */
export type GisBasemapId = "pmtiles";
export type GisLabelLang = "zh-Hans" | "en";
export type GisProjection = "mercator" | "globe";
export type GisBasemapFlavor = "light" | "dark" | "grayscale" | "white" | "black";
export type GisAtmospherePreset = "day" | "night";

export type GisProjectView = {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
};

/** GIS 初始视角各字段合法范围（与 MapLibre 相机一致） */
export const GIS_VIEW_BOUNDS = {
  lng: { min: -180, max: 180 },
  lat: { min: -85, max: 85 },
  zoom: { min: 0, max: 22 },
  bearing: { min: -180, max: 180 },
  pitch: { min: 0, max: 85 },
} as const;

export type GisViewBoundField = keyof typeof GIS_VIEW_BOUNDS;

export const GIS_VIEW_DECIMALS = 2;

export type GisViewDraftFields = {
  centerLng: string;
  centerLat: string;
  zoom: string;
  bearing: string;
  pitch: string;
};

export function clampGisViewScalar(field: GisViewBoundField, value: number): number {
  const { min, max } = GIS_VIEW_BOUNDS[field];
  return Number(Math.min(max, Math.max(min, value)).toFixed(GIS_VIEW_DECIMALS));
}

export function formatGisViewScalar(value: number, decimals = GIS_VIEW_DECIMALS): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimals);
}

export function formatGisViewDraftFromView(view: GisProjectView): GisViewDraftFields {
  return {
    centerLng: formatGisViewScalar(view.center[0]),
    centerLat: formatGisViewScalar(view.center[1]),
    zoom: formatGisViewScalar(view.zoom),
    bearing: formatGisViewScalar(view.bearing ?? 0),
    pitch: formatGisViewScalar(view.pitch ?? 0),
  };
}

export function finalizeGisViewDraftField(
  field: keyof GisViewDraftFields,
  raw: string,
): string {
  if (raw.trim() === "") return raw;
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  const boundField: GisViewBoundField =
    field === "centerLng" ? "lng" : field === "centerLat" ? "lat" : field;
  return formatGisViewScalar(clampGisViewScalar(boundField, num));
}

export function parseGisViewDraft(draft: GisViewDraftFields): GisProjectView | null {
  if (
    draft.centerLng.trim() === "" ||
    draft.centerLat.trim() === "" ||
    draft.zoom.trim() === "" ||
    draft.bearing.trim() === "" ||
    draft.pitch.trim() === ""
  ) {
    return null;
  }
  const lng = Number(draft.centerLng);
  const lat = Number(draft.centerLat);
  const zoom = Number(draft.zoom);
  const bearing = Number(draft.bearing);
  const pitch = Number(draft.pitch);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) return null;
  if (!Number.isFinite(bearing) || !Number.isFinite(pitch)) return null;
  if (lng < GIS_VIEW_BOUNDS.lng.min || lng > GIS_VIEW_BOUNDS.lng.max) return null;
  if (lat < GIS_VIEW_BOUNDS.lat.min || lat > GIS_VIEW_BOUNDS.lat.max) return null;
  if (zoom < GIS_VIEW_BOUNDS.zoom.min || zoom > GIS_VIEW_BOUNDS.zoom.max) return null;
  if (bearing < GIS_VIEW_BOUNDS.bearing.min || bearing > GIS_VIEW_BOUNDS.bearing.max) return null;
  if (pitch < GIS_VIEW_BOUNDS.pitch.min || pitch > GIS_VIEW_BOUNDS.pitch.max) return null;
  return normalizeGisProjectView({
    center: [lng, lat],
    zoom,
    bearing,
    pitch,
  });
}

export function normalizeGisProjectView(view: GisProjectView): GisProjectView {
  return {
    center: [clampGisViewScalar("lng", view.center[0]), clampGisViewScalar("lat", view.center[1])],
    zoom: clampGisViewScalar("zoom", view.zoom),
    bearing: clampGisViewScalar("bearing", view.bearing ?? 0),
    pitch: clampGisViewScalar("pitch", view.pitch ?? 0),
  };
}

export type GisProjectFog = {
  color?: string;
  "high-color"?: string;
  "horizon-blend"?: number;
  "space-color"?: string;
  "star-intensity"?: number;
};

export type GisBasemapLayerVisibility = {
  /** 道路网络（含铁路、桥梁、隧道） */
  roads?: boolean;
  /** 地名、道路名、POI 等文字标注 */
  labels?: boolean;
  /** 国界/省界等边界线 */
  boundaries?: boolean;
  /** 绿地、工业用地等 landcover/landuse 细分 */
  landDetail?: boolean;
};

/** 对标 GeoLibre「地图控件」菜单的可挂载 UI（非整应用 iframe）。 */
export type GisMapControls = {
  /** 导航 + 指南针（NavigationControl） */
  navigation?: boolean;
  /** 比例尺（ScaleControl） */
  scale?: boolean;
  /** 归属信息（AttributionControl） */
  attribution?: boolean;
  /** 经纬网 overlay */
  graticule?: boolean;
};

export type ResolvedGisMapControls = Required<GisMapControls>;

const DEFAULT_GIS_MAP_CONTROLS: ResolvedGisMapControls = {
  navigation: false,
  scale: false,
  attribution: true,
  graticule: false,
};

export function resolveGisMapControls(project: Pick<GisProject, "mapControls" | "showControls">): ResolvedGisMapControls {
  const legacy = project.showControls === true;
  const raw = project.mapControls;
  return {
    navigation: raw?.navigation ?? legacy ?? DEFAULT_GIS_MAP_CONTROLS.navigation,
    scale: raw?.scale ?? legacy ?? DEFAULT_GIS_MAP_CONTROLS.scale,
    attribution: raw?.attribution ?? DEFAULT_GIS_MAP_CONTROLS.attribution,
    graticule: raw?.graticule ?? DEFAULT_GIS_MAP_CONTROLS.graticule,
  };
}

export type GisProjectOverlay = {
  /** 散点填充色；缺省取图表 palette 首色 */
  color?: string;
  /** 圆点半径下限（px） */
  radiusMin?: number;
  /** 圆点半径上限（px） */
  radiusMax?: number;
  /** 圆点不透明度 0–1 */
  opacity?: number;
  /** 是否显示散点标签 */
  showLabels?: boolean;
  /** 低于该 zoom 不显示标签 */
  labelMinZoom?: number;
  /** 是否按指标值缩放圆点大小 */
  scaleByMetric?: boolean;
  /** 描边色 */
  strokeColor?: string;
  /** 描边宽度（px） */
  strokeWidth?: number;
  /** 有散点时自动 fitBounds（首次或数据变更） */
  autoFit?: boolean;
  /** 低 zoom 聚合散点 */
  cluster?: boolean;
  /** 聚合停止的最大 zoom */
  clusterMaxZoom?: number;
  /** 按标签/类别字段分色（palette） */
  colorByCategory?: boolean;
  /** 热力色带预设 */
  heatmapPreset?: "ember" | "night" | "scientific";
  /** 散点/热力光晕强度 0–1 */
  glowStrength?: number;
  /** 热力全局强度 0.4–2 */
  heatmapIntensity?: number;
  /** 热力模糊半径上限（px，随 zoom 插值） */
  heatmapRadiusMax?: number;
  /** 高于此 zoom 热力淡出并显示圆点 */
  heatmapCrossfadeZoom?: number;
  /** 聚合像素半径 */
  clusterRadius?: number;
  /** 散点大小编码曲线 */
  sizeCurve?: "linear" | "perceptual";
  /** 圆点柔边 0–1 */
  circleBlur?: number;
};

export type GisProject = {
  basemap: GisBasemapId;
  tileServiceId?: string;
  labelLang?: GisLabelLang;
  basemapFlavor?: GisBasemapFlavor;
  /** 覆写 Protomaps 陆地底色（earth 层），如 #e2dfda */
  landColor?: string;
  /** 覆写 Protomaps 海洋/水体色（water 层），如 #80deea */
  waterColor?: string;
  /** 控制底图矢量图层显隐；缺省均为显示 */
  basemapLayers?: GisBasemapLayerVisibility;
  projection?: GisProjection;
  atmospherePreset?: GisAtmospherePreset;
  fog?: GisProjectFog;
  view?: GisProjectView;
  /** 球面模式下慢速自转（大屏待机） */
  autoRotate?: boolean;
  /** 自转速度（度/秒）；默认大屏慢速 ≈8 分钟/圈 */
  autoRotateSpeed?: number;
  /** 显示缩放/罗盘/比例尺控件（legacy；优先 mapControls） */
  showControls?: boolean;
  /** GeoLibre 对齐的地图 UI 控件开关 */
  mapControls?: GisMapControls;
  /** 矢量底图建筑 3D 挤出（高 zoom） */
  buildings3d?: boolean;
  /** 地球表面（矢量底图）不透明度 0–1，默认 1；不影响星空/大气 */
  earthOpacity?: number;
  /** 经纬度散点叠加样式（legacy；优先 layers[]） */
  overlay?: GisProjectOverlay;
  /** 业务图层栈（散点/热力等） */
  layers?: GisProjectLayer[];
  /** 数据 Tab 当前编辑的图层 id */
  activeLayerId?: string;
  /** GeoLibre 对齐的大气光晕/深空（优先于 legacy halo/fog） */
  effects?: GisEffectsSettings;
  /** legacy：GeoLibre 对齐的大气光晕参数 */
  halo?: GisProjectHalo;
  /** GeoLibre「太阳」：驱动 MapLibre light 与日弧动画 */
  sun?: GisProjectSun;
};

export const DEFAULT_GIS_OVERLAY: Required<
  Pick<
    GisProjectOverlay,
    | "radiusMin"
    | "radiusMax"
    | "opacity"
    | "showLabels"
    | "labelMinZoom"
    | "scaleByMetric"
    | "strokeColor"
    | "strokeWidth"
    | "autoFit"
    | "cluster"
    | "clusterMaxZoom"
    | "colorByCategory"
    | "heatmapPreset"
    | "heatmapIntensity"
    | "heatmapRadiusMax"
    | "heatmapCrossfadeZoom"
    | "clusterRadius"
    | "sizeCurve"
    | "circleBlur"
    | "glowStrength"
  >
> = {
  radiusMin: 6,
  radiusMax: 20,
  opacity: 0.9,
  showLabels: false,
  labelMinZoom: 10,
  scaleByMetric: true,
  strokeColor: "rgba(255,255,255,0.92)",
  strokeWidth: 0.75,
  autoFit: true,
  cluster: true,
  clusterMaxZoom: 12,
  colorByCategory: false,
  heatmapPreset: "ember",
  heatmapIntensity: 1.4,
  heatmapRadiusMax: 32,
  heatmapCrossfadeZoom: 8.5,
  clusterRadius: 56,
  sizeCurve: "perceptual",
  circleBlur: 0.28,
  glowStrength: 0.78,
};

const DEFAULT_GIS_OVERLAY_COLOR = "#2563eb";

export type ResolvedGisOverlayStyle = {
  color: string;
  radiusMin: number;
  radiusMax: number;
  opacity: number;
  showLabels: boolean;
  labelMinZoom: number;
  scaleByMetric: boolean;
  strokeColor: string;
  strokeWidth: number;
  autoFit: boolean;
  cluster: boolean;
  clusterMaxZoom: number;
  colorByCategory: boolean;
  heatmapPreset: "ember" | "night" | "scientific";
  heatmapIntensity: number;
  heatmapRadiusMax: number;
  heatmapCrossfadeZoom: number;
  clusterRadius: number;
  sizeCurve: "linear" | "perceptual";
  circleBlur: number;
  glowStrength: number;
};

export function resolveGisOverlayStyle(
  overlay: GisProjectOverlay | undefined,
  chartColors?: string[],
): ResolvedGisOverlayStyle {
  const radiusMinRaw = Number(overlay?.radiusMin);
  const radiusMaxRaw = Number(overlay?.radiusMax);
  const radiusMin =
    Number.isFinite(radiusMinRaw) && radiusMinRaw >= 0 ? radiusMinRaw : DEFAULT_GIS_OVERLAY.radiusMin;
  const radiusMax =
    Number.isFinite(radiusMaxRaw) && radiusMaxRaw >= radiusMin
      ? radiusMaxRaw
      : Math.max(radiusMin, DEFAULT_GIS_OVERLAY.radiusMax);
  const opacityRaw = Number(overlay?.opacity);
  const opacity =
    Number.isFinite(opacityRaw) && opacityRaw >= 0 && opacityRaw <= 1
      ? opacityRaw
      : DEFAULT_GIS_OVERLAY.opacity;
  const labelMinZoomRaw = Number(overlay?.labelMinZoom);
  const labelMinZoom =
    Number.isFinite(labelMinZoomRaw) && labelMinZoomRaw >= 0
      ? labelMinZoomRaw
      : DEFAULT_GIS_OVERLAY.labelMinZoom;
  const strokeWidthRaw = Number(overlay?.strokeWidth);
  const strokeWidth =
    Number.isFinite(strokeWidthRaw) && strokeWidthRaw >= 0
      ? strokeWidthRaw
      : DEFAULT_GIS_OVERLAY.strokeWidth;
  const color =
    typeof overlay?.color === "string" && overlay.color.trim()
      ? overlay.color.trim()
      : chartColors?.[0]?.trim() || DEFAULT_GIS_OVERLAY_COLOR;
  const strokeColor =
    typeof overlay?.strokeColor === "string" && overlay.strokeColor.trim()
      ? overlay.strokeColor.trim()
      : DEFAULT_GIS_OVERLAY.strokeColor;
  const clusterMaxZoomRaw = Number(overlay?.clusterMaxZoom);
  const clusterMaxZoom =
    Number.isFinite(clusterMaxZoomRaw) && clusterMaxZoomRaw >= 0
      ? clusterMaxZoomRaw
      : DEFAULT_GIS_OVERLAY.clusterMaxZoom;
  const heatmapIntensityRaw = Number(overlay?.heatmapIntensity);
  const heatmapIntensity =
    Number.isFinite(heatmapIntensityRaw) && heatmapIntensityRaw >= 0.4 && heatmapIntensityRaw <= 2
      ? heatmapIntensityRaw
      : DEFAULT_GIS_OVERLAY.heatmapIntensity;
  const heatmapRadiusMaxRaw = Number(overlay?.heatmapRadiusMax);
  const heatmapRadiusMax =
    Number.isFinite(heatmapRadiusMaxRaw) && heatmapRadiusMaxRaw >= 6 && heatmapRadiusMaxRaw <= 48
      ? heatmapRadiusMaxRaw
      : DEFAULT_GIS_OVERLAY.heatmapRadiusMax;
  const heatmapCrossfadeZoomRaw = Number(overlay?.heatmapCrossfadeZoom);
  const heatmapCrossfadeZoom =
    Number.isFinite(heatmapCrossfadeZoomRaw) && heatmapCrossfadeZoomRaw >= 6 && heatmapCrossfadeZoomRaw <= 14
      ? heatmapCrossfadeZoomRaw
      : DEFAULT_GIS_OVERLAY.heatmapCrossfadeZoom;
  const clusterRadiusRaw = Number(overlay?.clusterRadius);
  const clusterRadius =
    Number.isFinite(clusterRadiusRaw) && clusterRadiusRaw >= 24 && clusterRadiusRaw <= 96
      ? clusterRadiusRaw
      : DEFAULT_GIS_OVERLAY.clusterRadius;
  const circleBlurRaw = Number(overlay?.circleBlur);
  const circleBlur =
    Number.isFinite(circleBlurRaw) && circleBlurRaw >= 0 && circleBlurRaw <= 1
      ? circleBlurRaw
      : DEFAULT_GIS_OVERLAY.circleBlur;
  const heatmapPreset =
    overlay?.heatmapPreset === "scientific"
      ? "scientific"
      : overlay?.heatmapPreset === "night"
        ? "night"
        : DEFAULT_GIS_OVERLAY.heatmapPreset;
  const sizeCurve =
    overlay?.sizeCurve === "linear" ? "linear" : DEFAULT_GIS_OVERLAY.sizeCurve;
  const glowStrengthRaw = Number(overlay?.glowStrength);
  const glowStrength =
    Number.isFinite(glowStrengthRaw) && glowStrengthRaw >= 0 && glowStrengthRaw <= 1
      ? glowStrengthRaw
      : DEFAULT_GIS_OVERLAY.glowStrength;

  return {
    color,
    radiusMin,
    radiusMax,
    opacity,
    showLabels: overlay?.showLabels ?? DEFAULT_GIS_OVERLAY.showLabels,
    labelMinZoom,
    scaleByMetric: overlay?.scaleByMetric !== false,
    strokeColor,
    strokeWidth,
    autoFit: overlay?.autoFit !== false,
    cluster: overlay?.cluster !== false,
    clusterMaxZoom,
    colorByCategory: overlay?.colorByCategory ?? DEFAULT_GIS_OVERLAY.colorByCategory,
    heatmapPreset,
    heatmapIntensity,
    heatmapRadiusMax,
    heatmapCrossfadeZoom,
    clusterRadius,
    sizeCurve,
    circleBlur,
    glowStrength,
  };
}

/** 本地/演示默认登记的全球 PMTiles 服务（运维 register 脚本同名 id）。 */
export const DEFAULT_PMTILES_TILE_SERVICE_ID = "planet-z15";

export const GIS_BASEMAP_FLAVORS: GisBasemapFlavor[] = ["light", "dark", "grayscale", "white", "black"];

/** MapLibre 球面地球默认大气（黑夜星空，接近 GeoLibre 球面观感）。 */
export const DEFAULT_GLOBE_FOG: GisProjectFog = {
  color: "rgb(186, 210, 235)",
  "high-color": "rgb(36, 92, 223)",
  "horizon-blend": 0.02,
  "space-color": "rgb(11, 11, 25)",
  "star-intensity": 0.6,
};

export const GIS_ATMOSPHERE_PRESETS: Record<GisAtmospherePreset, GisProjectFog> = {
  day: {
    color: "rgb(186, 210, 235)",
    "high-color": "rgb(36, 92, 223)",
    "horizon-blend": 0.02,
    "space-color": "rgb(186, 210, 235)",
    "star-intensity": 0,
  },
  night: DEFAULT_GLOBE_FOG,
};

export const GIS_ATMOSPHERE_PRESET_ORDER: GisAtmospherePreset[] = ["night"];

/** 球面地球默认远视图（亚洲—印度洋半球，接近 GeoLibre 初始观感）。 */
export const DEFAULT_GIS_GLOBE_VIEW: GisProjectView = {
  center: [100.0, 28.0],
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
};

export const DEFAULT_GIS_PROJECT: GisProject = {
  basemap: "pmtiles",
  labelLang: "zh-Hans",
  basemapFlavor: "light",
  projection: "globe",
  atmospherePreset: "night",
  fog: GIS_ATMOSPHERE_PRESETS.night,
  view: DEFAULT_GIS_GLOBE_VIEW,
  buildings3d: true,
};

export function readGisProject(config: ChartViewConfig | undefined): GisProject {
  const raw = config?.nativeBody?.gisProject;
  if (raw && typeof raw === "object") {
    return normalizeGisProject(raw);
  }
  const legacy = config?.nativeBody?.geolibreProject;
  if (legacy && typeof legacy === "object") {
    return migrateGeolibreProject(legacy);
  }
  return DEFAULT_GIS_PROJECT;
}

export function writeGisProject(
  config: ChartViewConfig,
  patch: Partial<GisProject>,
): ChartViewConfig {
  const current = readGisProject(config);
  const next = normalizeGisProject({ ...current, ...patch });
  return {
    ...config,
    nativeBody: {
      ...config.nativeBody,
      gisProject: next,
    },
  };
}

function isCanonicalPresetFog(fog: GisProjectFog): boolean {
  return (Object.keys(GIS_ATMOSPHERE_PRESETS) as GisAtmospherePreset[]).some((key) => {
    const presetFog = GIS_ATMOSPHERE_PRESETS[key];
    return (
      presetFog.color === fog.color &&
      presetFog["high-color"] === fog["high-color"] &&
      presetFog["horizon-blend"] === fog["horizon-blend"] &&
      presetFog["space-color"] === fog["space-color"] &&
      presetFog["star-intensity"] === fog["star-intensity"]
    );
  });
}

export function resolveGisAtmosphereFog(
  preset: GisAtmospherePreset | undefined,
  fogOverride: GisProjectFog | undefined,
): GisProjectFog {
  const base = preset ? GIS_ATMOSPHERE_PRESETS[preset] : DEFAULT_GLOBE_FOG;
  if (!fogOverride || Object.keys(fogOverride).length === 0) return base;
  if (isCanonicalPresetFog(fogOverride)) return base;
  return { ...base, ...fogOverride };
}

function normalizeGisProject(raw: unknown): GisProject {
  const candidate = raw as Partial<GisProject>;
  const tileServiceId =
    typeof candidate.tileServiceId === "string" && candidate.tileServiceId.trim()
      ? candidate.tileServiceId.trim()
      : undefined;
  const labelLang =
    candidate.labelLang === "en" || candidate.labelLang === "zh-Hans"
      ? candidate.labelLang
      : DEFAULT_GIS_PROJECT.labelLang;
  const basemapFlavor = normalizeBasemapFlavor(candidate.basemapFlavor);
  const projection =
    candidate.projection === "globe" || candidate.projection === "mercator"
      ? candidate.projection
      : DEFAULT_GIS_PROJECT.projection;
  const atmospherePreset = normalizeAtmospherePreset(candidate.atmospherePreset);
  const view =
    normalizeGisView(candidate.view) ??
    (projection === "globe" ? DEFAULT_GIS_GLOBE_VIEW : DEFAULT_GIS_PROJECT.view);
  const fog =
    projection === "globe"
      ? resolveGisAtmosphereFog(atmospherePreset, candidate.fog)
      : undefined;
  const autoRotateSpeed = Number(candidate.autoRotateSpeed);
  const earthOpacityRaw = Number(
    candidate.earthOpacity ?? (candidate as { mapOpacity?: number }).mapOpacity,
  );
  const landColor = normalizeBasemapHexColor(candidate.landColor);
  const waterColor = normalizeBasemapHexColor(candidate.waterColor);
  const basemapLayers = normalizeBasemapLayerVisibility(candidate.basemapLayers);
  const overlay = normalizeGisProjectOverlay(candidate.overlay);
  const layers = normalizeGisProjectLayers(candidate.layers);
  const halo = normalizeGisProjectHalo(candidate.halo);
  const effects = normalizeGisProjectEffects(candidate.effects);
  const sun = normalizeGisProjectSun(candidate.sun);
  const mapControls = normalizeGisMapControls(candidate.mapControls);
  const activeLayerId =
    typeof candidate.activeLayerId === "string" && candidate.activeLayerId.trim()
      ? candidate.activeLayerId.trim()
      : undefined;
  return {
    basemap: "pmtiles",
    tileServiceId,
    labelLang,
    basemapFlavor,
    landColor,
    waterColor,
    basemapLayers,
    projection,
    atmospherePreset: projection === "globe" ? atmospherePreset : undefined,
    fog,
    view,
    autoRotate: candidate.autoRotate === true,
    autoRotateSpeed: Number.isFinite(autoRotateSpeed) && autoRotateSpeed > 0 ? autoRotateSpeed : undefined,
    showControls: candidate.showControls === true,
    mapControls,
    buildings3d: candidate.buildings3d !== false,
    earthOpacity:
      Number.isFinite(earthOpacityRaw) && earthOpacityRaw >= 0 && earthOpacityRaw <= 1
        ? earthOpacityRaw
        : undefined,
    overlay,
    layers,
    activeLayerId,
    effects,
    halo,
    sun,
  };
}

function normalizeGisProjectOverlay(input: unknown): GisProjectOverlay | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as GisProjectOverlay;
  const next: GisProjectOverlay = {};
  if (typeof raw.color === "string" && raw.color.trim()) next.color = raw.color.trim();
  const radiusMin = Number(raw.radiusMin);
  if (Number.isFinite(radiusMin) && radiusMin >= 0) next.radiusMin = radiusMin;
  const radiusMax = Number(raw.radiusMax);
  if (Number.isFinite(radiusMax) && radiusMax >= 0) next.radiusMax = radiusMax;
  const opacity = Number(raw.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) next.opacity = opacity;
  if (raw.showLabels === true) next.showLabels = true;
  if (raw.showLabels === false) next.showLabels = false;
  const labelMinZoom = Number(raw.labelMinZoom);
  if (Number.isFinite(labelMinZoom) && labelMinZoom >= 0) next.labelMinZoom = labelMinZoom;
  if (raw.scaleByMetric === false) next.scaleByMetric = false;
  if (typeof raw.strokeColor === "string" && raw.strokeColor.trim()) {
    next.strokeColor = raw.strokeColor.trim();
  }
  const strokeWidth = Number(raw.strokeWidth);
  if (Number.isFinite(strokeWidth) && strokeWidth >= 0) next.strokeWidth = strokeWidth;
  if (raw.autoFit === false) next.autoFit = false;
  if (raw.cluster === false) next.cluster = false;
  const clusterMaxZoom = Number(raw.clusterMaxZoom);
  if (Number.isFinite(clusterMaxZoom) && clusterMaxZoom >= 0) next.clusterMaxZoom = clusterMaxZoom;
  if (raw.colorByCategory === false) next.colorByCategory = false;
  if (
    raw.heatmapPreset === "scientific" ||
    raw.heatmapPreset === "night" ||
    raw.heatmapPreset === "ember"
  ) {
    next.heatmapPreset = raw.heatmapPreset;
  }
  const glowStrength = Number(raw.glowStrength);
  if (Number.isFinite(glowStrength) && glowStrength >= 0 && glowStrength <= 1) {
    next.glowStrength = glowStrength;
  }
  const heatmapIntensity = Number(raw.heatmapIntensity);
  if (Number.isFinite(heatmapIntensity) && heatmapIntensity >= 0.4 && heatmapIntensity <= 2) {
    next.heatmapIntensity = heatmapIntensity;
  }
  const heatmapRadiusMax = Number(raw.heatmapRadiusMax);
  if (Number.isFinite(heatmapRadiusMax) && heatmapRadiusMax >= 6 && heatmapRadiusMax <= 48) {
    next.heatmapRadiusMax = heatmapRadiusMax;
  }
  const heatmapCrossfadeZoom = Number(raw.heatmapCrossfadeZoom);
  if (Number.isFinite(heatmapCrossfadeZoom) && heatmapCrossfadeZoom >= 6 && heatmapCrossfadeZoom <= 14) {
    next.heatmapCrossfadeZoom = heatmapCrossfadeZoom;
  }
  const clusterRadius = Number(raw.clusterRadius);
  if (Number.isFinite(clusterRadius) && clusterRadius >= 24 && clusterRadius <= 96) {
    next.clusterRadius = clusterRadius;
  }
  if (raw.sizeCurve === "linear" || raw.sizeCurve === "perceptual") next.sizeCurve = raw.sizeCurve;
  const circleBlur = Number(raw.circleBlur);
  if (Number.isFinite(circleBlur) && circleBlur >= 0 && circleBlur <= 1) next.circleBlur = circleBlur;
  return Object.keys(next).length > 0 ? next : undefined;
}

function migrateGeolibreProject(raw: unknown): GisProject {
  const project = raw as { mapView?: { center?: [number, number]; zoom?: number } };
  const view = normalizeGisView(project.mapView) ?? DEFAULT_GIS_PROJECT.view;
  return { ...DEFAULT_GIS_PROJECT, view };
}

function normalizeBasemapFlavor(input: unknown): GisBasemapFlavor {
  if (typeof input === "string" && GIS_BASEMAP_FLAVORS.includes(input as GisBasemapFlavor)) {
    return input as GisBasemapFlavor;
  }
  return DEFAULT_GIS_PROJECT.basemapFlavor ?? "light";
}

function normalizeGisMapControls(input: unknown): GisMapControls | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as GisMapControls;
  const next: GisMapControls = {};
  if (raw.navigation === true) next.navigation = true;
  if (raw.scale === true) next.scale = true;
  if (raw.attribution === false) next.attribution = false;
  if (raw.graticule === true) next.graticule = true;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeBasemapLayerVisibility(input: unknown): GisBasemapLayerVisibility | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as GisBasemapLayerVisibility;
  const next: GisBasemapLayerVisibility = {};
  if (raw.roads === false) next.roads = false;
  if (raw.labels === false) next.labels = false;
  if (raw.boundaries === false) next.boundaries = false;
  if (raw.landDetail === false) next.landDetail = false;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeAtmospherePreset(_input: unknown): GisAtmospherePreset {
  return "night";
}

function normalizeGisView(input: unknown): GisProjectView | undefined {
  if (!input || typeof input !== "object") return undefined;
  const view = input as Partial<GisProjectView>;
  if (!Array.isArray(view.center) || view.center.length !== 2) return undefined;
  const lng = Number(view.center[0]);
  const lat = Number(view.center[1]);
  const zoom = Number(view.zoom);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) return undefined;
  const bearing = Number(view.bearing);
  const pitch = Number(view.pitch);
  const normalized = normalizeGisProjectView({
    center: [lng, lat],
    zoom,
    bearing: Number.isFinite(bearing) ? bearing : 0,
    pitch: Number.isFinite(pitch) ? pitch : 0,
  });
  return {
    center: normalized.center,
    zoom: normalized.zoom,
    bearing: Number.isFinite(bearing) ? normalized.bearing : undefined,
    pitch: Number.isFinite(pitch) ? normalized.pitch : undefined,
  };
}

export {
  listGisProjectLayers,
  resolveActiveGisProjectLayer,
} from "@/components/charts/engine/maplibre/gisProjectLayers";

export function defaultGisProjectNativeBody(): Record<string, unknown> {
  return { gisProject: DEFAULT_GIS_PROJECT };
}

export function gisOverlayFieldsReady(config: ChartViewConfig): boolean {
  const dims = (config.dimensions ?? []).map((d) => d.field?.trim()).filter(Boolean);
  return dims.length >= 2;
}

/** PMTiles 样式就绪后才渲染；未就绪时不回退离线底图。 */
export function resolveGisRenderableBasemap(
  project: GisProject,
  pmtilesReady: boolean,
): "pmtiles" | null {
  if (!project.tileServiceId || !pmtilesReady) return null;
  return "pmtiles";
}
