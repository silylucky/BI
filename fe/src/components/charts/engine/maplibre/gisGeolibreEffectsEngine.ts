import type { SkySpecification } from "maplibre-gl";
import type { ResolvedGisEffectsSettings } from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import {
  GIS_SPACE_EDGE_DARKEN,
  nextGisEffectsFrameTime,
  parseEffectsHex,
  rgbaEffects,
  shadeEffectsRgb,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import {
  drawGeolibreComets,
  type GeolibreComet,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsComets";
import {
  buildGeolibreStarfieldTile,
  drawGeolibreStarfieldParallax,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsStarfield";
import {
  bindMapRenderSync,
  resolveGlobeScreenBounds,
  shouldRenderGisGlobeFarEffects,
} from "@/components/charts/engine/maplibre/gisGlobeLayout";
import {
  ensureGisMapControlStack,
  GIS_MAP_COMETS_Z,
  GIS_MAP_STARS_Z,
} from "@/components/charts/engine/maplibre/gisMapControlStack";

type MapLibreMap = import("maplibre-gl").Map;

const EFFECTS_MAP_CLASS = "vs-gis-geolibre-effects-map";

function isGlobeProjection(map: MapLibreMap): boolean {
  try {
    return map.getProjection()?.type === "globe";
  } catch {
    return false;
  }
}

function createLayerCanvas(
  zIndex: number,
  testId: "gis-effects-space" | "gis-effects-stars" | "gis-effects-comets",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.dataset.testid = testId;
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = String(zIndex);
  return canvas;
}

/** 深空/星场/流星；球缘光晕由 mountGisGlobeHaloOverlay 独立承担（更可靠）。 */
export class GisGeolibreEffectsEngine {
  private readonly map: MapLibreMap;
  private settings: ResolvedGisEffectsSettings;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly mapRoot: HTMLElement | null;
  private readonly previousMapZ: string;
  private readonly previousSky: SkySpecification | undefined;
  private readonly spaceCtx: CanvasRenderingContext2D;
  private readonly starsCtx: CanvasRenderingContext2D;
  private readonly cometCtx: CanvasRenderingContext2D;
  private starfield: HTMLCanvasElement | null = null;
  private starfieldOriginLng = 0;
  private starfieldOriginLat = 0;
  private comets: GeolibreComet[] = [];
  private spaceGradient: CanvasGradient | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private starsDirty = true;
  private rafId: number | null = null;
  private lastFrameTime = -Infinity;
  private destroyed = false;
  private unbindMapRender: (() => void) | undefined;

  constructor(map: MapLibreMap, settings: ResolvedGisEffectsSettings) {
    this.map = map;
    this.settings = settings;
    this.mapCanvas = map.getCanvas();
    this.mapRoot = this.mapCanvas.closest(".maplibregl-map");
    this.previousMapZ = this.mapCanvas.style.zIndex;
    this.previousSky = this.readSky();
    this.suppressMapLibreAtmosphere();

    const space = createLayerCanvas(0, "gis-effects-space");
    const stars = createLayerCanvas(Number(GIS_MAP_STARS_Z), "gis-effects-stars");
    const comets = createLayerCanvas(Number(GIS_MAP_COMETS_Z), "gis-effects-comets");
    const container = map.getCanvasContainer();
    container.append(space, stars, comets);
    this.spaceCtx = space.getContext("2d")!;
    this.starsCtx = stars.getContext("2d")!;
    this.cometCtx = comets.getContext("2d")!;

    this.mapRoot?.classList.add(EFFECTS_MAP_CLASS);
    ensureGisMapControlStack(map);
    container.style.background = "transparent";
    this.mapCanvas.style.background = "transparent";

    this.handleResize = this.handleResize.bind(this);
    this.handleMapChange = this.handleMapChange.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
    this.handleStyleData = this.handleStyleData.bind(this);
    this.tick = this.tick.bind(this);
    this.unbindMapRender = bindMapRenderSync(map, () => {
      if (!document.hidden) this.start();
    });
    map.on("resize", this.handleResize);
    map.on("move", this.handleMapChange);
    map.on("styledata", this.handleStyleData);
    map.once("load", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.handleResize();
    this.start();
  }

  applySettings(settings: ResolvedGisEffectsSettings): void {
    this.settings = settings;
    this.spaceGradient = null;
    if (!document.hidden) this.start();
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.map.off("resize", this.handleResize);
    this.map.off("move", this.handleMapChange);
    this.map.off("styledata", this.handleStyleData);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.unbindMapRender?.();
    this.unbindMapRender = undefined;
    this.mapCanvas.style.zIndex = this.previousMapZ;
    try {
      if (this.previousSky) this.map.setSky(this.previousSky);
    } catch {
      /* style tearing down */
    }
    this.mapRoot?.classList.remove(EFFECTS_MAP_CLASS);
    for (const ctx of [this.spaceCtx, this.starsCtx, this.cometCtx]) {
      ctx.canvas.remove();
    }
  }

  private readSky(): SkySpecification | undefined {
    try {
      return this.map.getSky();
    } catch {
      return undefined;
    }
  }

  private suppressMapLibreAtmosphere(): void {
    try {
      const sky = this.map.getSky();
      if (sky && sky["atmosphere-blend"] !== 0) {
        this.map.setSky({ ...sky, "atmosphere-blend": 0 });
      }
    } catch {
      /* style without sky */
    }
  }

  private handleVisibility(): void {
    if (document.hidden) this.stop();
    else this.start();
  }

  private handleMapChange(): void {
    this.starsDirty = true;
    if (!document.hidden) this.start();
  }

  private handleStyleData(): void {
    if (this.destroyed) return;
    this.suppressMapLibreAtmosphere();
  }

  private handleResize(): void {
    const mapCanvas = this.map.getCanvas();
    this.width = mapCanvas.clientWidth;
    this.height = mapCanvas.clientHeight;
    this.dpr = window.devicePixelRatio || 1;
    for (const ctx of [this.spaceCtx, this.starsCtx, this.cometCtx]) {
      const canvas = ctx.canvas;
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
      canvas.width = Math.round(this.width * this.dpr);
      canvas.height = Math.round(this.height * this.dpr);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    this.starfield = null;
    this.spaceGradient = null;
    this.starsDirty = true;
  }

  private start(): void {
    if (this.destroyed || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private drawSpaceBackground(): void {
    const ctx = this.spaceCtx;
    if (!this.spaceGradient) {
      const gradient = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        0,
        this.width / 2,
        this.height / 2,
        Math.max(this.width, this.height) * 0.75,
      );
      const space = parseEffectsHex(this.settings.spaceColor, { r: 12, g: 27, b: 51 });
      gradient.addColorStop(0, rgbaEffects(space, 1));
      gradient.addColorStop(1, rgbaEffects(shadeEffectsRgb(space, -GIS_SPACE_EDGE_DARKEN), 1));
      this.spaceGradient = gradient;
    }
    ctx.fillStyle = this.spaceGradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private ensureStarfield(): void {
    if (this.starfield) return;
    const center = this.map.getCenter();
    this.starfieldOriginLng = center.lng;
    this.starfieldOriginLat = center.lat;
    this.starfield = buildGeolibreStarfieldTile(this.width, this.height, this.dpr);
  }

  private drawStarfield(): void {
    if (this.width <= 0 || this.height <= 0 || !this.starfield) return;
    const center = this.map.getCenter();
    const globe = resolveGlobeScreenBounds(this.map);
    const ctx = this.starsCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (globe) {
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.arc(globe.x, globe.y, globe.radius * 0.99, 0, Math.PI * 2);
      ctx.clip("evenodd");
    }
    drawGeolibreStarfieldParallax(
      ctx,
      this.width,
      this.height,
      this.starfield,
      center.lng,
      center.lat,
      this.starfieldOriginLng,
      this.starfieldOriginLat,
      { skipClear: true },
    );
    ctx.restore();
  }

  private isFarGlobeView(): boolean {
    if (this.width <= 0 || this.height <= 0) return false;
    return shouldRenderGisGlobeFarEffects(
      this.map,
      resolveGlobeScreenBounds(this.map),
      this.width,
      this.height,
    );
  }

  private tick(timestamp: number): void {
    this.rafId = null;
    if (this.destroyed) return;

    const nextFrameTime = nextGisEffectsFrameTime(timestamp, this.lastFrameTime);
    if (nextFrameTime === null) {
      this.start();
      return;
    }
    const elapsed = Number.isFinite(this.lastFrameTime)
      ? Math.min(nextFrameTime - this.lastFrameTime, (1000 / 60) * 2)
      : 1000 / 60;
    this.lastFrameTime = nextFrameTime;

    if (!isGlobeProjection(this.map) || !this.settings.enabled) {
      this.spaceCtx.clearRect(0, 0, this.width, this.height);
      this.starsCtx.clearRect(0, 0, this.width, this.height);
      this.cometCtx.clearRect(0, 0, this.width, this.height);
      this.start();
      return;
    }

    this.spaceCtx.clearRect(0, 0, this.width, this.height);
    this.drawSpaceBackground();

    if (!this.isFarGlobeView()) {
      this.starsCtx.clearRect(0, 0, this.width, this.height);
      this.cometCtx.clearRect(0, 0, this.width, this.height);
      this.comets = [];
      this.starsDirty = true;
      this.start();
      return;
    }

    this.ensureStarfield();
    this.drawStarfield();
    this.starsDirty = false;

    this.cometCtx.clearRect(0, 0, this.width, this.height);
    this.comets = drawGeolibreComets(
      this.cometCtx,
      this.width,
      this.height,
      this.comets,
      elapsed / (1000 / 60),
    );
    this.start();
  }
}
