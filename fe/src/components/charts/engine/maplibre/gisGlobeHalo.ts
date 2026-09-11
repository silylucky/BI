import type { GisAtmospherePreset, GisProjection } from "@/components/charts/engine/maplibre/gisProject";
import { resolveGisEffectsSettings } from "@/components/charts/engine/maplibre/gisProjectEffects";
import type { GisEffectsSettings } from "@/components/charts/engine/maplibre/gisProjectEffects";
import type { GisProjectFog } from "@/components/charts/engine/maplibre/gisProject";
import type { GisProjectHalo } from "@/components/charts/engine/maplibre/gisProjectHalo";
import {
  type GlobeLimbBounds,
  resolveGlobeLimbBoundsForHaloPaint,
} from "@/components/charts/engine/maplibre/gisGlobeLayout";
import { drawGlobeAtmosphereHalo } from "@/components/charts/engine/maplibre/gisGlobeHaloDraw";
import {
  applyOverlayCanvasLayout,
  readMapOverlayPaintSize,
  readOverlayLayoutSize,
  syncOverlayCanvasSize,
} from "@/components/charts/engine/maplibre/gisOverlayCanvas";
import {
  ensureGisMapControlStack,
  GIS_MAP_CANVAS_Z,
} from "@/components/charts/engine/maplibre/gisMapControlStack";

type MapLibreMap = import("maplibre-gl").Map;

export type { GlobeLimbBounds } from "@/components/charts/engine/maplibre/gisGlobeLayout";
export { drawGlobeAtmosphereHalo } from "@/components/charts/engine/maplibre/gisGlobeHaloDraw";

const HALO_CANVAS_CLASS = "pointer-events-none absolute";
/** 置于 map canvas 之下；球面由 WebGL 自然遮挡，光晕只从球外透明区透出，不洗白地表。 */
const HALO_CANVAS_Z = "3";
const LIMB_REPAINT_EPS = 0.5;

function limbNearlyEqual(a: GlobeLimbBounds, b: GlobeLimbBounds): boolean {
  return (
    Math.hypot(a.x - b.x, a.y - b.y) <= LIMB_REPAINT_EPS &&
    Math.abs(a.radius - b.radius) <= LIMB_REPAINT_EPS
  );
}

function bindMapHaloPaintSync(map: MapLibreMap | null, schedule: () => void): () => void {
  if (!map) return () => undefined;
  const onSync = () => schedule();
  const events = ["render", "resize", "idle", "style.load"] as const;
  for (const event of events) {
    map.on(event, onSync);
  }
  return () => {
    for (const event of events) {
      map.off(event, onSync);
    }
  };
}

export type GisGlobeHaloOverlayHandle = {
  dispose: () => void;
  /** Map 异步就绪后须主动触发，否则 render 监听未挂上时光晕/星空不绘制。 */
  requestPaint: () => void;
};

/**
 * 可靠光晕层：canvas-container 内 z=3（地图 z=4），全圆 + screen；地图遮挡中心。
 * 仅在 map render 时合并重绘（rAF 去抖），避免常驻 rAF 与 render 双通道闪烁/卡顿。
 */
export function mountGisGlobeHaloOverlay(
  wrapper: HTMLElement,
  getMap: () => MapLibreMap | null,
  getContext: () => {
    preset: GisAtmospherePreset | undefined;
    projection: GisProjection | undefined;
    effects?: GisEffectsSettings;
    halo?: GisProjectHalo;
    fog?: GisProjectFog;
  },
): GisGlobeHaloOverlayHandle {
  const enabled = () => getContext().projection === "globe";

  const canvas = document.createElement("canvas");
  canvas.dataset.testid = "gis-globe-halo";
  canvas.className = HALO_CANVAS_CLASS;
  canvas.style.zIndex = HALO_CANVAS_Z;
  wrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let running = true;
  let unbindRender: (() => void) | undefined;
  let boundMap: MapLibreMap | null = null;
  let paintFrameId = 0;
  let paintDomReady = false;
  const canvasSize = { width: 0, height: 0 };
  let lastResolvedLimb: GlobeLimbBounds | null = null;
  let lastPaintedLimb: GlobeLimbBounds | null = null;
  let lastEffectsKey = "";

  const syncCanvasSize = (width: number, height: number) => {
    syncOverlayCanvasSize(canvas, ctx, width, height, canvasSize);
    applyOverlayCanvasLayout(canvas, width, height);
  };

  const ensurePaintDom = (map: MapLibreMap) => {
    if (paintDomReady) return;
    const paintRoot = map.getCanvasContainer();
    const mapCanvas = map.getCanvas();
    if (canvas.parentElement !== paintRoot) {
      paintRoot.insertBefore(canvas, mapCanvas);
    }
    paintRoot.style.position = paintRoot.style.position || "relative";
    mapCanvas.style.zIndex = GIS_MAP_CANVAS_Z;
    canvas.style.zIndex = HALO_CANVAS_Z;
    ensureGisMapControlStack(map);
    paintDomReady = true;
  };

  let mapResizeObserver: ResizeObserver | null = null;

  const observeMapContainer = (map: MapLibreMap | null) => {
    mapResizeObserver?.disconnect();
    mapResizeObserver = null;
    if (!map || typeof ResizeObserver === "undefined") return;
    const target = map.getCanvasContainer();
    mapResizeObserver = new ResizeObserver(() => {
      schedulePaint();
    });
    mapResizeObserver.observe(target);
  };

  const bindMapIfNeeded = () => {
    const map = getMap();
    if (map && map === boundMap) return;
    unbindRender?.();
    boundMap = map;
    paintDomReady = false;
    lastResolvedLimb = null;
    lastPaintedLimb = null;
    lastEffectsKey = "";
    if (map) {
      observeMapContainer(map);
      const container = map.getCanvasContainer();
      container.style.background = "transparent";
      map.getCanvas().style.background = "transparent";
      ensurePaintDom(map);
    }
    unbindRender = bindMapHaloPaintSync(map, schedulePaint);
  };

  const paint = () => {
    if (!running || !ctx || !enabled()) {
      canvas.style.display = "none";
      return;
    }
    bindMapIfNeeded();

    const map = getMap();
    if (!map) return;
    ensurePaintDom(map);

    const overlay = map.getCanvasContainer();
    const { width, height } = readMapOverlayPaintSize(map, overlay);
    if (width <= 0 || height <= 0) return;

    const sizeChanged = width !== canvasSize.width || height !== canvasSize.height;
    if (sizeChanged) {
      syncCanvasSize(width, height);
      lastPaintedLimb = null;
    }

    const atmosphereContext = getContext();
    const effects = resolveGisEffectsSettings({
      effects: atmosphereContext.effects,
      halo: atmosphereContext.halo,
      fog: atmosphereContext.fog,
    });
    const effectsKey = `${effects.haloColor}:${effects.haloExtent}:${effects.haloOpacity}:${effects.enabled}`;
    if (!effects.enabled) {
      canvas.style.display = "none";
      ctx.clearRect(0, 0, width, height);
      lastPaintedLimb = null;
      lastEffectsKey = "";
      return;
    }

    if (!map.isStyleLoaded()) {
      canvas.style.display = "none";
      return;
    }

    const resolved = resolveGlobeLimbBoundsForHaloPaint(map, overlay, width, height);
    if (resolved) {
      lastResolvedLimb = resolved;
    }
    const limb = resolved ?? lastResolvedLimb;
    if (!limb) {
      canvas.style.display = "none";
      return;
    }

    canvas.style.display = "block";
    if (
      !sizeChanged &&
      effectsKey === lastEffectsKey &&
      lastPaintedLimb &&
      limbNearlyEqual(limb, lastPaintedLimb)
    ) {
      return;
    }

    drawGlobeAtmosphereHalo(ctx, width, height, limb, effects);
    lastPaintedLimb = { ...limb };
    lastEffectsKey = effectsKey;
  };

  const schedulePaint = () => {
    if (!running || paintFrameId !== 0) return;
    paintFrameId = requestAnimationFrame(() => {
      paintFrameId = 0;
      paint();
    });
  };

  const initial = readOverlayLayoutSize(wrapper);
  syncCanvasSize(initial.width, initial.height);
  schedulePaint();

  const wrapperObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          schedulePaint();
        })
      : null;
  wrapperObserver?.observe(wrapper);

  return {
    dispose: () => {
      running = false;
      cancelAnimationFrame(paintFrameId);
      unbindRender?.();
      wrapperObserver?.disconnect();
      mapResizeObserver?.disconnect();
      canvas.remove();
    },
    requestPaint: schedulePaint,
  };
}
