import type { ChartGeo3dStyle, ChartDeStyle } from "@/lib/chartDeStyle";

/** 各 3D 样式预设共用的场景云 / 底座 / 点位特效默认值 */
export const GEO3D_SHARED_EFFECTS_DEFAULTS: Omit<
  ChartGeo3dStyle,
  "stylePreset" | "terrainTexture" | "shellOpacity" | "shellColor"
> = {
  extrudeIntensity: 0.85,
  sceneFog: true,
  sceneCloudDensity: 0.7,
  sceneCloudSpeed: 4,
  sceneCloudHeight: 1.55,
  platformEffects: true,
  platformHighlight: true,
  platformHighlightOpacity: 0.7,
  platformRings: true,
  platformRingOpacity: 0.7,
  platformRingSpeed: 2.5,
  platformGrid: true,
  platformGridStyle: "texture",
  platformGridOpacity: 0.1,
  platformRipple: true,
  platformRippleOpacity: 0.85,
  platformRippleSpeed: 0.7,
  platformRippleFrequency: 1,
  platformGlow: false,
  platformPulse: false,
  platformSweep: false,
  platformSizeScale: 1.35,
  pointEffects: true,
  heatBlob: true,
  heatBlobOpacity: 1,
  heatBlobRadius: 15,
  heatBlobBlur: 1.2,
  heatBlobLift: 8,
  heatBlobDimChoropleth: 0.55,
  pointPillar: true,
  pointPillarOpacity: 1,
  pointPillarHeightScale: 3.8,
  pointPillarBaseRingScale: 0.6,
  pointPillarBaseRingOpacity: 0.6,
  pointPillarRingSpeed: 0.9,
  floatingLabels: true,
  floatingLabelFontSize: 13,
  floatingLabelOffset: 0.05,
};

/**
 * 新建 3D 区域地图时的默认 deStyle（geo + geo3d）。
 * 数值 fallback 见各 `DEFAULT_*` 常量；此处写入显式字段以便面板与渲染一致。
 */
export const DEFAULT_MAP_3D_CHART_DE_STYLE: Pick<ChartDeStyle, "geo" | "geo3d"> = {
  geo: {
    roam: true,
    showRegionBorder: true,
    visualMap: true,
  },
  geo3d: {
    stylePreset: "satellite",
    terrainTexture: true,
    shellOpacity: 1,
    ...GEO3D_SHARED_EFFECTS_DEFAULTS,
  },
};
