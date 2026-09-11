import type { ChartGeo3dStyle, ChartGeoStyle } from "@/lib/chartDeStyle";
import { DEFAULT_MAP_3D_CHART_DE_STYLE, GEO3D_SHARED_EFFECTS_DEFAULTS } from "@/lib/defaultMap3dChartDeStyle";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";
import {
  buildGeo3dSceneClouds,
  removeGeo3dSceneClouds,
  type Geo3dSceneCloudsHandle,
} from "@/components/charts/engine/three/geo3dSceneClouds";
import {
  buildGeo3dPlatformEffects,
  removeGeo3dPlatformEffects,
  type Geo3dPlatformEffectsHandle,
} from "@/components/charts/engine/three/geo3dPlatformEffects";
import { resolvePlatformEffectsStyle } from "@/components/charts/engine/three/geo3dPlatformStyle";
import {
  resolveGeo3dPointEffects,
  resolvePointEffectsStyle,
} from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import {
  buildGeo3dPointEffects,
  removeGeo3dPointEffectsFromGroup,
  type Geo3dPointEffectsHandle,
} from "@/components/charts/engine/three/geo3dPointEffects";
import type { JoinedMapFeature } from "@/components/charts/engine/three/geo3dRegionCentroid";
import type { HeatBlobSample } from "@/components/charts/engine/three/geo3dHeatSamples";
import * as THREE from "three";

/** 对标 sc-datav Demo0/1/2 的 3D 地图视觉预设 */
export type Geo3dStylePreset =
  | "satellite"
  | "tech"
  | "classic"
  | "minimal"
  | "glass"
  | "glass-warm"
  | "glass-night";

export const GEO3D_STYLE_PRESETS: ReadonlyArray<{
  value: Geo3dStylePreset;
  label: string;
  hint: string;
}> = [
  { value: "satellite", label: "卫星实景", hint: "离线卫星顶面 + 中性侧壁（默认）" },
  { value: "tech", label: "科技深蓝", hint: "深色侧壁发光、青蓝边界、远景云海" },
  { value: "classic", label: "经典暖色", hint: "暖色实体顶面 + 场景云与点位特效" },
  { value: "minimal", label: "简洁纯色", hint: "低饱和扁平色块 + 完整场景特效" },
  { value: "glass", label: "半透明琉璃", hint: "青蓝半透明侧壁，适合浅色大屏" },
  { value: "glass-warm", label: "半透明琥珀", hint: "暖色半透明玻璃质感" },
  { value: "glass-night", label: "半透明墨蓝", hint: "深色半透明玻璃，适合暗色大屏" },
] as const;

type PresetBase = {
  shellColorDark: number;
  shellColorLight: number;
  shellEmissiveDark: number;
  shellEmissiveLight: number;
  shellEmissiveIntensity: number;
  shellMetalness: number;
  shellRoughness: number;
  capEmissiveDark: number;
  capEmissiveLight: number;
  capMetalness: number;
  capRoughness: number;
  borderColorDark: number;
  borderColorLight: number;
  borderOpacityDark: number;
  borderOpacityLight: number;
  ambientDark: number;
  ambientLight: number;
  keyDark: number;
  keyLight: number;
  fillDark: number;
  fillLight: number;
  sceneFog: boolean;
  fogColorDark: number;
  fogColorLight: number;
  preferTerrainTexture: boolean;
  /** 卫星顶面数据色叠加强度倍率 */
  capTintMixScale: number;
  /** 科技预设：卫星顶面加发光质感（MeshStandard） */
  techSatelliteOverlay: boolean;
  /** 地图下方双环/网格/涟漪底座装饰 */
  platformEffects: boolean;
  /** 点位热力/光柱/浮动标签 */
  pointEffects: boolean;
  /** 预设默认底板不透明度（可被 shellOpacity 覆盖） */
  defaultShellOpacity: number;
};

export type ResolvedGeo3dVisualStyle = PresetBase & {
  preset: Geo3dStylePreset;
  sceneFog: boolean;
};

const PRESET_BASE: Record<Geo3dStylePreset, PresetBase> = {
  satellite: {
    shellColorDark: 0x1a2a3d,
    shellColorLight: 0x4a5c6a,
    shellEmissiveDark: 0x000000,
    shellEmissiveLight: 0x000000,
    shellEmissiveIntensity: 0,
    shellMetalness: 0.05,
    shellRoughness: 0.9,
    capEmissiveDark: 0.2,
    capEmissiveLight: 0.12,
    capMetalness: 0.08,
    capRoughness: 0.65,
    borderColorDark: 0x7dd3fc,
    borderColorLight: 0x1e40af,
    borderOpacityDark: 0.7,
    borderOpacityLight: 0.58,
    ambientDark: 0.48,
    ambientLight: 0.38,
    keyDark: 0.95,
    keyLight: 0.78,
    fillDark: 0.34,
    fillLight: 0.26,
    sceneFog: true,
    fogColorDark: 0x020617,
    fogColorLight: 0xe2e8f0,
    preferTerrainTexture: true,
    capTintMixScale: 1,
    techSatelliteOverlay: false,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 1,
  },
  tech: {
    shellColorDark: 0x0b1520,
    shellColorLight: 0x2a3f4f,
    shellEmissiveDark: 0x0e4a6e,
    shellEmissiveLight: 0x1a5a7a,
    shellEmissiveIntensity: 0.42,
    shellMetalness: 0.55,
    shellRoughness: 0.62,
    capEmissiveDark: 0.35,
    capEmissiveLight: 0.22,
    capMetalness: 0.38,
    capRoughness: 0.48,
    borderColorDark: 0xb8e0ff,
    borderColorLight: 0x1d4ed8,
    borderOpacityDark: 0.98,
    borderOpacityLight: 0.88,
    ambientDark: 0.28,
    ambientLight: 0.22,
    keyDark: 1.25,
    keyLight: 1.05,
    fillDark: 0.48,
    fillLight: 0.34,
    sceneFog: true,
    fogColorDark: 0x020617,
    fogColorLight: 0x0f172a,
    preferTerrainTexture: false,
    capTintMixScale: 1.55,
    techSatelliteOverlay: true,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 1,
  },
  classic: {
    shellColorDark: 0x3d2e1f,
    shellColorLight: 0xe8dcc8,
    shellEmissiveDark: 0x2a1f12,
    shellEmissiveLight: 0xf5ebe0,
    shellEmissiveIntensity: 0.12,
    shellMetalness: 0.18,
    shellRoughness: 0.52,
    capEmissiveDark: 0.42,
    capEmissiveLight: 0.28,
    capMetalness: 0.1,
    capRoughness: 0.55,
    borderColorDark: 0xf0c27a,
    borderColorLight: 0xb45309,
    borderOpacityDark: 0.88,
    borderOpacityLight: 0.76,
    ambientDark: 0.55,
    ambientLight: 0.46,
    keyDark: 1.3,
    keyLight: 1.05,
    fillDark: 0.4,
    fillLight: 0.3,
    sceneFog: true,
    fogColorDark: 0x1a1208,
    fogColorLight: 0xfef3c7,
    preferTerrainTexture: false,
    capTintMixScale: 1,
    techSatelliteOverlay: false,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 1,
  },
  minimal: {
    shellColorDark: 0x1e293b,
    shellColorLight: 0xcbd5e1,
    shellEmissiveDark: 0x000000,
    shellEmissiveLight: 0x000000,
    shellEmissiveIntensity: 0,
    shellMetalness: 0.02,
    shellRoughness: 0.96,
    capEmissiveDark: 0.06,
    capEmissiveLight: 0.03,
    capMetalness: 0.02,
    capRoughness: 0.88,
    borderColorDark: 0x64748b,
    borderColorLight: 0x475569,
    borderOpacityDark: 0.28,
    borderOpacityLight: 0.22,
    ambientDark: 0.58,
    ambientLight: 0.48,
    keyDark: 0.75,
    keyLight: 0.62,
    fillDark: 0.22,
    fillLight: 0.16,
    sceneFog: true,
    fogColorDark: 0x0f172a,
    fogColorLight: 0xf1f5f9,
    preferTerrainTexture: false,
    capTintMixScale: 0.75,
    techSatelliteOverlay: false,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 1,
  },
  glass: {
    shellColorDark: 0x0e4a6e,
    shellColorLight: 0x7dd3fc,
    shellEmissiveDark: 0x0891b2,
    shellEmissiveLight: 0x67e8f9,
    shellEmissiveIntensity: 0.28,
    shellMetalness: 0.35,
    shellRoughness: 0.25,
    capEmissiveDark: 0.22,
    capEmissiveLight: 0.35,
    capMetalness: 0.42,
    capRoughness: 0.35,
    borderColorDark: 0x67e8f9,
    borderColorLight: 0x0284c7,
    borderOpacityDark: 0.85,
    borderOpacityLight: 0.72,
    ambientDark: 0.42,
    ambientLight: 0.36,
    keyDark: 1.05,
    keyLight: 0.88,
    fillDark: 0.38,
    fillLight: 0.28,
    sceneFog: true,
    fogColorDark: 0x0c4a6e,
    fogColorLight: 0xe0f2fe,
    preferTerrainTexture: false,
    capTintMixScale: 1.15,
    techSatelliteOverlay: true,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 0.48,
  },
  "glass-warm": {
    shellColorDark: 0x7c2d12,
    shellColorLight: 0xfcd34d,
    shellEmissiveDark: 0xea580c,
    shellEmissiveLight: 0xfbbf24,
    shellEmissiveIntensity: 0.22,
    shellMetalness: 0.28,
    shellRoughness: 0.32,
    capEmissiveDark: 0.38,
    capEmissiveLight: 0.45,
    capMetalness: 0.2,
    capRoughness: 0.42,
    borderColorDark: 0xfbbf24,
    borderColorLight: 0xd97706,
    borderOpacityDark: 0.88,
    borderOpacityLight: 0.76,
    ambientDark: 0.5,
    ambientLight: 0.42,
    keyDark: 1.15,
    keyLight: 0.95,
    fillDark: 0.36,
    fillLight: 0.28,
    sceneFog: true,
    fogColorDark: 0x431407,
    fogColorLight: 0xfff7ed,
    preferTerrainTexture: false,
    capTintMixScale: 1.1,
    techSatelliteOverlay: true,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 0.52,
  },
  "glass-night": {
    shellColorDark: 0x0f172a,
    shellColorLight: 0x334155,
    shellEmissiveDark: 0x1e3a8a,
    shellEmissiveLight: 0x3b82f6,
    shellEmissiveIntensity: 0.35,
    shellMetalness: 0.48,
    shellRoughness: 0.28,
    capEmissiveDark: 0.28,
    capEmissiveLight: 0.18,
    capMetalness: 0.45,
    capRoughness: 0.38,
    borderColorDark: 0x93c5fd,
    borderColorLight: 0x2563eb,
    borderOpacityDark: 0.92,
    borderOpacityLight: 0.8,
    ambientDark: 0.32,
    ambientLight: 0.26,
    keyDark: 1.2,
    keyLight: 1,
    fillDark: 0.45,
    fillLight: 0.32,
    sceneFog: true,
    fogColorDark: 0x020617,
    fogColorLight: 0x1e293b,
    preferTerrainTexture: false,
    capTintMixScale: 1.35,
    techSatelliteOverlay: true,
    platformEffects: true,
    pointEffects: true,
    defaultShellOpacity: 0.45,
  },
};

export function resolveGeo3dStylePreset(style: ChartGeo3dStyle): Geo3dStylePreset {
  const preset = style.stylePreset;
  if (preset && preset in PRESET_BASE) return preset;
  return "satellite";
}

function hexFromColorNumber(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function resolveGeo3dSceneClouds(style: ChartGeo3dStyle): boolean {
  const preset = resolveGeo3dStylePreset(style);
  return style.sceneFog ?? PRESET_BASE[preset].sceneFog;
}

export function resolveGeo3dPlatformEffects(style: ChartGeo3dStyle): boolean {
  const preset = resolveGeo3dStylePreset(style);
  return style.platformEffects ?? PRESET_BASE[preset].platformEffects;
}

export { resolveGeo3dPointEffects } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

/** @deprecated 使用 {@link resolveGeo3dSceneClouds} */
export const resolveGeo3dSceneFog = resolveGeo3dSceneClouds;

/** 布局完成后挂载白色远景云海（替代线性场景雾） */
export function applyGeo3dSceneClouds(
  scene: THREE.Scene,
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "maxY" | "defaultDistance">,
  visual: ResolvedGeo3dVisualStyle,
  geo3dStyle: ChartGeo3dStyle = {},
): Geo3dSceneCloudsHandle | null {
  removeGeo3dSceneClouds(scene);
  if (!visual.sceneFog) return null;
  const handle = buildGeo3dSceneClouds(layout, geo3dStyle);
  scene.add(handle.group);
  return handle;
}

/** 布局完成后挂载地图下方底座装饰（双环/网格/涟漪） */
export function applyGeo3dPlatformEffectsLayer(
  scene: THREE.Scene,
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "minY">,
  visual: ResolvedGeo3dVisualStyle,
  geo3dStyle: ChartGeo3dStyle = {},
  isDark = true,
): Geo3dPlatformEffectsHandle | null {
  removeGeo3dPlatformEffects(scene);
  if (!resolveGeo3dPlatformEffects(geo3dStyle)) return null;
  const resolved = resolvePlatformEffectsStyle(geo3dStyle, visual.preset, isDark, true);
  if (!Object.values(resolved.layers).some(Boolean)) return null;
  const handle = buildGeo3dPlatformEffects(layout, resolved);
  scene.add(handle.group);
  return handle;
}

export type ApplyGeo3dPointEffectsInput = {
  container: HTMLElement;
  domElement: HTMLElement;
  mapGroup: THREE.Group;
  meshes: THREE.Object3D[];
  heatBlobSamples: HeatBlobSample[];
  features: JoinedMapFeature[];
  project: (coord: [number, number]) => [number, number] | null;
  projBounds: import("@/components/charts/engine/three/geo3dHeatCanvas").ProjBoundsLike;
  minVal: number;
  maxVal: number;
  plateDepth: number;
  terrainCap: boolean;
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ">;
  geo3dStyle?: ChartGeo3dStyle;
  isDark?: boolean;
};

/** 布局完成后挂载热力 blob / 光柱 / 浮动标签 */
export function applyGeo3dPointEffectsLayer(
  input: ApplyGeo3dPointEffectsInput,
): Geo3dPointEffectsHandle | null {
  removeGeo3dPointEffectsFromGroup(input.mapGroup);
  const geo3dStyle = input.geo3dStyle ?? {};
  const preset = resolveGeo3dStylePreset(geo3dStyle);
  const masterEnabled = resolveGeo3dPointEffects(geo3dStyle);
  const resolved = resolvePointEffectsStyle(geo3dStyle, preset, input.isDark ?? true, masterEnabled);
  if (!resolved.enabled || !Object.values(resolved.layers).some(Boolean)) return null;
  return buildGeo3dPointEffects({
    container: input.container,
    domElement: input.domElement,
    mapGroup: input.mapGroup,
    meshes: input.meshes,
    heatBlobSamples: input.heatBlobSamples,
    features: input.features,
    project: input.project,
    projBounds: input.projBounds,
    minVal: input.minVal,
    maxVal: input.maxVal,
    plateDepth: input.plateDepth,
    terrainCap: input.terrainCap,
    layout: input.layout,
    style: resolved,
  });
}

/** @deprecated 使用 {@link applyGeo3dSceneClouds} */
export function applyGeo3dSceneFog(
  scene: THREE.Scene,
  layout: Pick<ThreeGeoOrbitLayout, "defaultDistance" | "halfX" | "halfZ" | "maxY">,
  visual: ResolvedGeo3dVisualStyle,
  _isDark?: boolean,
  geo3dStyle: ChartGeo3dStyle = {},
): Geo3dSceneCloudsHandle | null {
  return applyGeo3dSceneClouds(scene, layout, visual, geo3dStyle);
}

/** 3D 预设下的行政区边界默认色（可被 geo.regionBorderColor 覆盖） */
export function resolvePresetRegionBorderDefaults(
  isDark: boolean,
  preset: Geo3dStylePreset,
): { hex: string; opacity: number } {
  const base = PRESET_BASE[preset];
  const color = isDark ? base.borderColorDark : base.borderColorLight;
  const opacity = isDark ? base.borderOpacityDark : base.borderOpacityLight;
  return { hex: hexFromColorNumber(color), opacity };
}

export { resolveGeoRegionBorderShow as resolveGeo3dShowRegionBorder } from "@/components/charts/engine/geo/geoRegionBorderStyle";

/** 面板/渲染：自定义 shellColor 优先，否则按预设与主题 */
export function resolveGeo3dShellColorHex(
  style: ChartGeo3dStyle,
  isDark: boolean,
): string {
  const custom = style.shellColor?.trim();
  if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) {
    return custom.toLowerCase();
  }
  const preset = resolveGeo3dStylePreset(style);
  const presetColor = isDark
    ? PRESET_BASE[preset].shellColorDark
    : PRESET_BASE[preset].shellColorLight;
  return hexFromColorNumber(presetColor);
}

export function resolveGeo3dShellColorNumber(
  style: ChartGeo3dStyle,
  isDark: boolean,
): number {
  return new THREE.Color(resolveGeo3dShellColorHex(style, isDark)).getHex();
}

export function hasCustomGeo3dShellColor(style: ChartGeo3dStyle): boolean {
  const custom = style.shellColor?.trim();
  return Boolean(custom && /^#[0-9a-fA-F]{6}$/.test(custom));
}

export function resolveGeo3dShellOpacity(style: ChartGeo3dStyle): number {
  const raw = style.shellOpacity;
  if (raw != null && Number.isFinite(raw)) {
    return Math.min(1, Math.max(0, raw));
  }
  const preset = resolveGeo3dStylePreset(style);
  return PRESET_BASE[preset].defaultShellOpacity;
}

export function resolveGeo3dVisualStyle(
  style: ChartGeo3dStyle,
  isDark: boolean,
): ResolvedGeo3dVisualStyle & { isDark: boolean } {
  const preset = resolveGeo3dStylePreset(style);
  const base = PRESET_BASE[preset];
  return {
    preset,
    ...base,
    sceneFog: resolveGeo3dSceneClouds(style),
    isDark,
  };
}

/** 切换预设时写入的默认 geo3d 字段（含完整场景特效） */
export function geo3dPresetDefaults(preset: Geo3dStylePreset): Partial<ChartGeo3dStyle> {
  if (preset === "satellite") {
    return { ...DEFAULT_MAP_3D_CHART_DE_STYLE.geo3d, stylePreset: "satellite" };
  }
  const base = PRESET_BASE[preset];
  return {
    ...GEO3D_SHARED_EFFECTS_DEFAULTS,
    stylePreset: preset,
    terrainTexture: base.preferTerrainTexture,
    shellOpacity: base.defaultShellOpacity,
  };
}
