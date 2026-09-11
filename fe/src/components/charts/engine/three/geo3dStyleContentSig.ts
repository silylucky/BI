import type { ChartGeo3dStyle, ChartGeoStyle } from "@/lib/chartDeStyle";
import {
  DEFAULT_GEO3D_EXTRUDE_INTENSITY,
  resolveGeoVisualMapEnabled,
} from "@/lib/chartDeStyle";
import {
  buildPlatformEffectsStructureSig,
  buildPlatformEffectsVisualSig,
} from "@/components/charts/engine/three/geo3dPlatformStyle";
import {
  buildPointEffectsStructureSig,
  buildPointEffectsVisualSig,
} from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import {
  resolveGeo3dSceneCloudDensity,
  resolveGeo3dSceneCloudHeight,
} from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import { resolveGeo3dSceneCloudSpeed } from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import {
  resolveGeo3dPlatformEffects,
  resolveGeo3dPointEffects,
  resolveGeo3dSceneClouds,
  resolveGeo3dShellOpacity,
  resolveGeo3dStylePreset,
} from "@/components/charts/engine/three/geo3dVisualStyle";

/**  choropleth 网格 / 预设 / 地形等：变更需全量或核心 rebuild */
export function buildGeo3dCoreStructureSig(
  style: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle = {},
): string {
  return [
    resolveGeo3dStylePreset(style),
    style.extrudeIntensity ?? DEFAULT_GEO3D_EXTRUDE_INTENSITY,
    style.quality ?? "auto",
    style.terrainTexture !== false ? 1 : 0,
    style.shellColor?.toLowerCase() ?? "",
    geoStyle.showRegionBorder !== false ? 1 : 0,
    geoStyle.regionBorderColor?.toLowerCase() ?? "",
    resolveGeoVisualMapEnabled(geoStyle, "map-3d") ? 1 : 0,
  ].join(",");
}

export function buildGeo3dCloudStructureSig(style: ChartGeo3dStyle): string {
  return [
    resolveGeo3dSceneClouds(style) ? 1 : 0,
    resolveGeo3dSceneCloudDensity(style),
    resolveGeo3dSceneCloudHeight(style),
  ].join(",");
}

export function buildGeo3dStructureContentSig(
  style: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle = {},
): string {
  const platformOn = resolveGeo3dPlatformEffects(style);
  const pointOn = resolveGeo3dPointEffects(style);
  return [
    buildGeo3dCoreStructureSig(style, geoStyle),
    buildGeo3dCloudStructureSig(style),
    platformOn ? 1 : 0,
    buildPlatformEffectsStructureSig(style, platformOn),
    pointOn ? 1 : 0,
    buildPointEffectsStructureSig(style, pointOn),
  ].join("§");
}

export function buildGeo3dVisualContentSig(
  style: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle = {},
): string {
  const platformOn = resolveGeo3dPlatformEffects(style);
  const pointOn = resolveGeo3dPointEffects(style);
  return [
    resolveGeo3dShellOpacity(style),
    resolveGeo3dSceneClouds(style) ? resolveGeo3dSceneCloudSpeed(style) : 0,
    buildPlatformEffectsVisualSig(style, platformOn),
    buildPointEffectsVisualSig(style, pointOn),
    geoStyle.regionBorderColor?.toLowerCase() ?? "",
  ].join("§");
}

/** 兼容旧逻辑：结构 + 视觉合并签名 */
export function buildGeo3dStyleContentSig(
  style: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle = {},
): string {
  return `${buildGeo3dStructureContentSig(style, geoStyle)}§${buildGeo3dVisualContentSig(style, geoStyle)}`;
}

export type Geo3dLayerStructureSigs = {
  core: string;
  cloud: string;
  platform: string;
  point: string;
};

export function buildGeo3dLayerStructureSigs(
  style: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle = {},
): Geo3dLayerStructureSigs {
  const platformOn = resolveGeo3dPlatformEffects(style);
  const pointOn = resolveGeo3dPointEffects(style);
  return {
    core: buildGeo3dCoreStructureSig(style, geoStyle),
    cloud: buildGeo3dCloudStructureSig(style),
    platform: `${platformOn ? 1 : 0},${buildPlatformEffectsStructureSig(style, platformOn)}`,
    point: `${pointOn ? 1 : 0},${buildPointEffectsStructureSig(style, pointOn)}`,
  };
}
