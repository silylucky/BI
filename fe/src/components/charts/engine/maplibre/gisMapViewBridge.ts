import type { GisProjectFog, GisProjectView, GisProjection, GisAtmospherePreset, ResolvedGisMapControls, GisProjectOverlay } from "@/components/charts/engine/maplibre/gisProject";
import type { GisBasemapLayerVisibility } from "@/components/charts/engine/maplibre/gisProject";
import type { GisProjectHalo } from "@/components/charts/engine/maplibre/gisProjectHalo";
import type { GisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";
import type { GisEffectsSettings } from "@/components/charts/engine/maplibre/gisProjectEffects";
import type { GisSunSettings } from "@/components/charts/engine/maplibre/gisSunPosition";

export type GisMapAtmosphereContext = {
  projection?: GisProjection;
  atmospherePreset?: GisAtmospherePreset;
  fog?: GisProjectFog;
  halo?: GisProjectHalo;
  effects?: GisEffectsSettings;
};

export type GisMapBasemapPatch = {
  basemapLayers?: GisBasemapLayerVisibility;
  buildings3d?: boolean;
  earthOpacity?: number;
};

export type GisMapViewLiveControl = {
  capture: () => GisProjectView | null;
  applyView: (view: GisProjectView) => boolean;
  applyAtmosphere?: (ctx: GisMapAtmosphereContext) => boolean;
  applyBasemapPatch?: (patch: GisMapBasemapPatch) => boolean;
  applyMapControls?: (controls: ResolvedGisMapControls) => boolean;
  syncLayers?: () => boolean;
  applyOverlayPatch?: (layerId: string, patch: GisProjectOverlay) => boolean;
  applySun?: (sun: GisProjectSun | undefined, patch?: Partial<GisProjectSun>) => boolean;
  getSunSettings?: () => GisSunSettings | null;
};

const liveControlByWidgetId = new Map<string, GisMapViewLiveControl>();

/** 编辑态：GIS 地图实例注册相机读写（样式栏即时预览 / 读取当前视角） */
export function registerGisMapViewLiveControl(
  widgetId: string,
  control: GisMapViewLiveControl,
): () => void {
  liveControlByWidgetId.set(widgetId, control);
  return () => {
    if (liveControlByWidgetId.get(widgetId) === control) {
      liveControlByWidgetId.delete(widgetId);
    }
  };
}

export function captureGisMapViewCamera(widgetId: string): GisProjectView | null {
  return liveControlByWidgetId.get(widgetId)?.capture() ?? null;
}

/** 绕过 React 重渲染链，直接把相机应用到画布上的 MapLibre 实例 */
export function applyGisMapViewCamera(widgetId: string, view: GisProjectView): boolean {
  return liveControlByWidgetId.get(widgetId)?.applyView(view) ?? false;
}

export function applyGisMapViewAtmosphere(
  widgetId: string,
  ctx: GisMapAtmosphereContext,
): boolean {
  return liveControlByWidgetId.get(widgetId)?.applyAtmosphere?.(ctx) ?? false;
}

export function applyGisMapBasemapPatch(widgetId: string, patch: GisMapBasemapPatch): boolean {
  return liveControlByWidgetId.get(widgetId)?.applyBasemapPatch?.(patch) ?? false;
}

export function applyGisMapControls(widgetId: string, controls: ResolvedGisMapControls): boolean {
  return liveControlByWidgetId.get(widgetId)?.applyMapControls?.(controls) ?? false;
}

export function syncGisMapViewLayers(widgetId: string): boolean {
  return liveControlByWidgetId.get(widgetId)?.syncLayers?.() ?? false;
}

/** 样式栏即时预览：合并 overlay patch 并 runtime setPaintProperty，不等待 React 重渲染。 */
export function applyGisMapViewOverlayPatch(
  widgetId: string,
  layerId: string,
  patch: GisProjectOverlay,
): boolean {
  return liveControlByWidgetId.get(widgetId)?.applyOverlayPatch?.(layerId, patch) ?? false;
}

export function applyGisMapSun(
  widgetId: string,
  sun: GisProjectSun | undefined,
  patch?: Partial<GisProjectSun>,
): boolean {
  return liveControlByWidgetId.get(widgetId)?.applySun?.(sun, patch) ?? false;
}

export function getGisMapSunSettings(widgetId: string): GisSunSettings | null {
  return liveControlByWidgetId.get(widgetId)?.getSunSettings?.() ?? null;
}
