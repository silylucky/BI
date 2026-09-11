import type { StyleSpecification } from "maplibre-gl";
import { gisFogToMapLibreSky } from "@/components/charts/engine/maplibre/gisAtmosphereSky";
import { ensureGisMapControlStack } from "@/components/charts/engine/maplibre/gisMapControlStack";
import type {
  GisAtmospherePreset,
  GisProjectFog,
  GisProjection,
  ResolvedGisMapControls,
} from "@/components/charts/engine/maplibre/gisProject";

type MapLibreMap = import("maplibre-gl").Map;

export type GisMapCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

export function captureGisMapCamera(map: MapLibreMap): GisMapCamera {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function restoreGisMapCamera(map: MapLibreMap, camera: GisMapCamera) {
  map.jumpTo({
    center: camera.center,
    zoom: camera.zoom,
    bearing: camera.bearing,
    pitch: camera.pitch,
  });
}

export function applyGisMapStylePreservingCamera(
  map: MapLibreMap,
  style: StyleSpecification,
  onReady?: () => void,
  cameraOverride?: GisMapCamera | null,
) {
  const camera = cameraOverride ?? captureGisMapCamera(map);
  map.setStyle(style);
  map.once("style.load", () => {
    const restore = () => restoreGisMapCamera(map, camera);
    restore();
    map.resize();
    restore();
    map.once("idle", () => {
      restore();
      onReady?.();
    });
  });
}

/** 编辑态：拖拽后的实时相机优先于尚未写回的 gisProject.view。 */
export function mountGisLiveCameraTracking(
  map: MapLibreMap,
  onCameraChange: (camera: GisMapCamera) => void,
): () => void {
  const sync = () => onCameraChange(captureGisMapCamera(map));
  map.on("moveend", sync);
  map.on("zoomend", sync);
  map.on("rotateend", sync);
  map.on("pitchend", sync);
  return () => {
    map.off("moveend", sync);
    map.off("zoomend", sync);
    map.off("rotateend", sync);
    map.off("pitchend", sync);
  };
}

/** 球面模式下 areTilesLoaded 可能长期 false；首帧 idle 即可视为可展示。 */
export function markGisMapPaintReady(
  map: MapLibreMap,
  onReady: () => void,
  cancelled: () => boolean,
  projection: GisProjection | undefined,
): void {
  const finish = () => {
    if (cancelled()) return;
    map.triggerRepaint();
    map.once("render", () => {
      if (cancelled()) return;
      onReady();
    });
  };

  const waitForPresentableFrame = () => {
    if (projection === "globe") {
      let settled = false;
      const finishOnce = () => {
        if (settled || cancelled()) return;
        settled = true;
        finish();
      };
      map.once("idle", finishOnce);
      window.setTimeout(finishOnce, 2_000);
      return;
    }
    if (map.areTilesLoaded()) {
      finish();
      return;
    }
    map.once("idle", () => {
      if (cancelled()) return;
      if (map.areTilesLoaded()) finish();
      else map.once("idle", finish);
    });
  };

  if (map.isStyleLoaded()) {
    waitForPresentableFrame();
    return;
  }
  map.once("load", waitForPresentableFrame);
}

export function reloadGisProtomapsSource(map: MapLibreMap): void {
  if (!map.isStyleLoaded()) return;
  const source = map.getSource("protomaps") as { reload?: () => void } | undefined;
  source?.reload?.();
}

export type GlobeAtmosphereState = {
  projection?: GisProjection;
  fog?: GisProjectFog;
  atmospherePreset?: GisAtmospherePreset;
};

/** setStyle 后只触发 style.load；初始 mount 触发 load — 两者都监听 */
export function whenGisMapStyleReady(map: MapLibreMap, run: () => void) {
  if (map.isStyleLoaded()) {
    run();
    return;
  }
  const onReady = () => {
    if (!map.isStyleLoaded()) {
      map.once("idle", onReady);
      return;
    }
    map.off("load", onReady);
    map.off("style.load", onReady);
    map.off("idle", onReady);
    run();
  };
  // setStyle 后 load 不再触发；仅 style.load 会到。已 loaded 时勿挂 once("load") 以免永不回调。
  if (!map.loaded()) {
    map.once("load", onReady);
  }
  map.once("style.load", onReady);
}

export function applyGlobeAtmosphere(
  map: MapLibreMap,
  state: GlobeAtmosphereState,
  options?: { preserveCamera?: boolean },
) {
  const camera = options?.preserveCamera ? captureGisMapCamera(map) : null;
  whenGisMapStyleReady(map, () => {
    if (state.projection === "globe") {
      map.setProjection({ type: "globe" });
      map.setSky(gisFogToMapLibreSky(state.fog, state.atmospherePreset));
    } else {
      map.setProjection({ type: "mercator" });
      map.setSky(undefined);
    }
    if (camera) restoreGisMapCamera(map, camera);
  });
}

export function syncGisMapView(
  map: MapLibreMap,
  view: { center: [number, number]; zoom: number; bearing?: number; pitch?: number },
) {
  if (!map.isStyleLoaded()) return false;
  map.jumpTo({
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing ?? 0,
    pitch: view.pitch ?? 0,
  });
  return true;
}

export function buildGisConfiguredViewKey(view: {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}): string {
  return JSON.stringify({
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing ?? 0,
    pitch: view.pitch ?? 0,
  });
}

/** 地球真实自转角速度（°/秒）：360° / 86400s。 */
export const REAL_EARTH_ROTATION_DEG_PER_SEC = 360 / 86400;

/** 大屏待机可见慢速（约 8 分钟一圈），仍沿地轴自西向东。 */
export const GLOBE_IDLE_ROTATION_DEG_PER_SEC = 360 / (8 * 60);

export function normalizeGlobeLongitude(lng: number): number {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped;
}

export function advanceGlobeLongitude(lng: number, speedDegPerSec: number, deltaSec: number): number {
  // 地球自西向东转：观测经度向西退，表面相对向东。
  return normalizeGlobeLongitude(lng - speedDegPerSec * deltaSec);
}

export async function mountGisMapControls(
  map: MapLibreMap,
  controls: ResolvedGisMapControls,
): Promise<() => void> {
  const maplibregl = await import("maplibre-gl");
  const mounted: import("maplibre-gl").IControl[] = [];

  if (controls.navigation) {
    const nav = new maplibregl.NavigationControl({ visualizePitch: true });
    map.addControl(nav, "top-right");
    mounted.push(nav);
  }
  if (controls.scale) {
    const scale = new maplibregl.ScaleControl({ maxWidth: 96, unit: "metric" });
    map.addControl(scale, "bottom-left");
    mounted.push(scale);
  }
  if (controls.attribution) {
    const attribution = new maplibregl.AttributionControl({ compact: true });
    map.addControl(attribution, "bottom-right");
    mounted.push(attribution);
  }

  map.resize();
  ensureGisMapControlStack(map);
  return () => {
    for (const control of mounted) {
      try {
        map.removeControl(control);
      } catch {
        /* map 已销毁 */
      }
    }
    map.resize();
  };
}

export function startGisGlobeAutoRotate(
  map: MapLibreMap,
  speedDegPerSec: number = GLOBE_IDLE_ROTATION_DEG_PER_SEC,
): () => void {
  let frameId = 0;
  let last = performance.now();
  let pausedByInteraction = false;

  const pauseForInteraction = () => {
    pausedByInteraction = true;
  };
  const resumeAfterInteraction = () => {
    pausedByInteraction = false;
    last = performance.now();
  };

  map.on("dragstart", pauseForInteraction);
  map.on("dragend", resumeAfterInteraction);
  map.on("zoomstart", pauseForInteraction);
  map.on("zoomend", resumeAfterInteraction);
  map.on("rotatestart", pauseForInteraction);
  map.on("rotateend", resumeAfterInteraction);
  map.on("pitchstart", pauseForInteraction);
  map.on("pitchend", resumeAfterInteraction);

  const tick = (now: number) => {
    const deltaSec = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!pausedByInteraction && map.isStyleLoaded()) {
      const center = map.getCenter();
      const lng = advanceGlobeLongitude(center.lng, speedDegPerSec, deltaSec);
      if (lng !== center.lng) {
        map.setCenter([lng, center.lat]);
      }
    }
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frameId);
    map.off("dragstart", pauseForInteraction);
    map.off("dragend", resumeAfterInteraction);
    map.off("zoomstart", pauseForInteraction);
    map.off("zoomend", resumeAfterInteraction);
    map.off("rotatestart", pauseForInteraction);
    map.off("rotateend", resumeAfterInteraction);
    map.off("pitchstart", pauseForInteraction);
    map.off("pitchend", resumeAfterInteraction);
  };
}

const GIS_COLOCATED_ASSETS_HINT =
  "地图标注字体不可用。请把 basemaps-assets 放到与 PMTiles 同一瓦片服务目录，未接全球底图时不会请求该服务";

/** 将 MapLibre error 事件分类为人话提示；返回 null 表示可忽略（非阻断）。 */
export function classifyGisMapErrorHint(message: string): string | null {
  const text = message.trim();
  if (!text) return "地图渲染失败";

  const isFetchFailure = /failed to fetch|cors|networkerror|access-control/i.test(text);
  if (isFetchFailure) {
    if (/pmtiles|\.pmtiles|\/dev-pmtiles\//i.test(text) && !/basemaps-assets|fonts\/|sprite/i.test(text)) {
      return "全球 PMTiles 瓦片跨域请求被阻断，请确认外部服务 CORS 与前端访问地址（localhost / 127.0.0.1）一致";
    }
    if (/glyph|fonts\/|sprite|basemaps-assets|jsdelivr|protomaps\.github\.io|Unable to load glyph/i.test(text)) {
      return GIS_COLOCATED_ASSETS_HINT;
    }
    return null;
  }
  if (/sprite|townspot|capital|image .* could not be loaded/i.test(text)) {
    return null;
  }
  if (/glyph|fonts\/|Unable to load glyph/i.test(text)) {
    return GIS_COLOCATED_ASSETS_HINT;
  }
  return text;
}
