import type { CanvasSource, LightSpecification, SkySpecification } from "maplibre-gl";
import {
  advanceGisSunClock,
  MS_PER_MINUTE,
  normalizeGisSunSettings,
  subsolarPoint,
  sunPositionAt,
  type GisSunSettings,
} from "@/components/charts/engine/maplibre/gisSunPosition";
import { whenGisMapStyleReady } from "@/components/charts/engine/maplibre/gisMapRuntime";
import {
  GIS_GRATICULE_LAYER_ID,
  GIS_SUN_NIGHT_LAYER_ID,
  stackGisNightBelowGraticule,
} from "@/components/charts/engine/maplibre/gisGraticule";

type MapLibreMap = import("maplibre-gl").Map;

const NIGHT_SOURCE_ID = "vs-gis-sun-night-source";
const NIGHT_LAYER_ID = GIS_SUN_NIGHT_LAYER_ID;
const NIGHT_LAYER_PREFIX = "vs-gis-sun-night-layer-";
const NIGHT_CANVAS_WIDTH = 960;
const NIGHT_CANVAS_HEIGHT = 480;
const NIGHT_CANVAS_NORTH = 85;
const NIGHT_CANVAS_SOUTH = -85;
const NIGHT_TWILIGHT_DEPTH = 24;
const D2R = Math.PI / 180;
const NIGHT_TWILIGHT_SIN_DEPTH = Math.sin(NIGHT_TWILIGHT_DEPTH * D2R);
const NIGHT_RGB = { r: 10, g: 16, b: 32 };
const MASK_LNG_EPSILON = 0.25;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export class GisSunEngine {
  private readonly map: MapLibreMap;
  private settings: GisSunSettings;
  private readonly previousLight: LightSpecification | undefined;
  private readonly previousSky: SkySpecification | undefined;
  private readonly nightCanvas: HTMLCanvasElement;
  private readonly nightContext: CanvasRenderingContext2D | null;
  private nightImageData: ImageData | null = null;
  private maskDrawn = false;
  private lastMaskLng = 0;
  private lastMaskLat = 0;
  private lastMaskShade = -1;
  private rafId: number | null = null;
  private lastFrame: number | null = null;
  private destroyed = false;
  private readonly onTick?: (settings: GisSunSettings) => void;

  constructor(
    map: MapLibreMap,
    settings: GisSunSettings,
    onTick?: (settings: GisSunSettings) => void,
  ) {
    this.map = map;
    this.settings = normalizeGisSunSettings(settings);
    this.onTick = onTick;
    let saved: LightSpecification | undefined;
    try {
      saved = map.getLight();
    } catch {
      saved = undefined;
    }
    this.previousLight = saved;
    let skySaved: SkySpecification | undefined;
    try {
      skySaved = map.getSky();
      if (skySaved && typeof skySaved["atmosphere-blend"] === "number") {
        map.setSky({ ...skySaved, "atmosphere-blend": 0 });
      }
    } catch {
      skySaved = undefined;
    }
    this.previousSky = skySaved;
    this.nightCanvas = document.createElement("canvas");
    this.nightCanvas.width = NIGHT_CANVAS_WIDTH;
    this.nightCanvas.height = NIGHT_CANVAS_HEIGHT;
    this.nightContext = this.nightCanvas.getContext("2d", { willReadFrequently: true });
    this.handleStyleData = this.handleStyleData.bind(this);
    this.tick = this.tick.bind(this);
    map.on("styledata", this.handleStyleData);
    this.ensureLayers();
    this.render();
    if (this.settings.playing) this.play();
  }

  getSettings(): GisSunSettings {
    return { ...this.settings };
  }

  applySettings(settings: Partial<GisSunSettings>): void {
    const wasPlaying = this.settings.playing;
    this.settings = normalizeGisSunSettings({ ...this.settings, ...settings });
    this.render();
    if (this.settings.playing) {
      if (!wasPlaying || this.rafId === null) this.play();
    } else if (wasPlaying) {
      this.pause();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.pause();
    this.map.off("styledata", this.handleStyleData);
    this.removeLayers();
    try {
      if (this.previousLight) this.map.setLight(this.previousLight);
      if (this.previousSky) this.map.setSky(this.previousSky);
    } catch {
      /* style tearing down */
    }
  }

  private handleStyleData(): void {
    if (this.destroyed) return;
    whenGisMapStyleReady(this.map, () => {
      if (this.destroyed) return;
      if (!this.map.getSource(NIGHT_SOURCE_ID) || !this.map.getLayer(NIGHT_LAYER_ID)) {
        this.invalidateNightMask();
        this.ensureLayers();
        this.render();
      }
      try {
        const sky = this.map.getSky();
        if (sky && sky["atmosphere-blend"] !== 0) {
          this.map.setSky({ ...sky, "atmosphere-blend": 0 });
        }
      } catch {
        /* style without sky */
      }
    });
  }

  private invalidateNightMask(): void {
    this.maskDrawn = false;
  }

  private ensureLayers(): void {
    if (!this.map.isStyleLoaded()) return;
    this.removeLegacyBandLayers();
    if (this.map.getSource(NIGHT_SOURCE_ID)) return;
    this.invalidateNightMask();
    this.drawNightMask();
    this.map.addSource(NIGHT_SOURCE_ID, {
      type: "canvas",
      canvas: this.nightCanvas,
      animate: true,
      coordinates: [
        [-180, NIGHT_CANVAS_NORTH],
        [180, NIGHT_CANVAS_NORTH],
        [180, NIGHT_CANVAS_SOUTH],
        [-180, NIGHT_CANVAS_SOUTH],
      ],
    });
    this.map.addLayer({
      id: NIGHT_LAYER_ID,
      type: "raster",
      source: NIGHT_SOURCE_ID,
      paint: {
        "raster-opacity": 1,
        "raster-fade-duration": 0,
        "raster-resampling": "linear",
      },
    });
    this.raiseNightLayer();
  }

  /** 昼夜遮罩在业务散点层之上；若启用经纬网则保持在光晕线之下，避免盖住网格。 */
  private raiseNightLayer(): void {
    if (!this.map.getLayer(NIGHT_LAYER_ID)) return;
    try {
      if (this.map.getLayer(GIS_GRATICULE_LAYER_ID)) {
        stackGisNightBelowGraticule(this.map);
        return;
      }
      this.map.moveLayer(NIGHT_LAYER_ID);
    } catch {
      /* layer mid-move during style swap */
    }
  }

  private removeLayers(): void {
    if (this.map.getLayer(NIGHT_LAYER_ID)) this.map.removeLayer(NIGHT_LAYER_ID);
    this.removeLegacyBandLayers();
    if (this.map.getSource(NIGHT_SOURCE_ID)) this.map.removeSource(NIGHT_SOURCE_ID);
    this.invalidateNightMask();
  }

  private removeLegacyBandLayers(): void {
    for (let index = 0; index < 128; index += 1) {
      const layerId = `${NIGHT_LAYER_PREFIX}${index}`;
      if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
    }
  }

  render(): void {
    if (this.destroyed) return;
    whenGisMapStyleReady(this.map, () => {
      if (this.destroyed) return;
      if (!this.map.getSource(NIGHT_SOURCE_ID) || !this.map.getLayer(NIGHT_LAYER_ID)) {
        this.invalidateNightMask();
        this.ensureLayers();
      }
      const source = this.map.getSource(NIGHT_SOURCE_ID) as CanvasSource | undefined;
      if (!source) return;
      this.drawNightMask();
      this.applyLight();
      this.raiseNightLayer();
      try {
        this.map.triggerRepaint();
      } catch {
        /* map tearing down */
      }
    });
  }

  play(): void {
    if (this.destroyed || this.rafId !== null) return;
    this.lastFrame = null;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  pause(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastFrame = null;
  }

  private tick(now: number): void {
    this.rafId = null;
    if (this.destroyed || !this.settings.playing) return;
    if (this.lastFrame !== null) {
      const elapsedSec = (now - this.lastFrame) / 1000;
      const advancedMs = elapsedSec * this.settings.speed * MS_PER_MINUTE;
      this.settings = advanceGisSunClock(this.settings, advancedMs);
      this.render();
      this.onTick?.(this.getSettings());
    }
    this.lastFrame = now;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  private drawNightMask(): void {
    if (!this.nightContext) return;
    const subsolar = subsolarPoint(this.settings.dateMs);
    const shadeAlpha = Math.round(
      Math.min(1, Math.max(0, this.settings.shadeOpacity)) * 255,
    );
    const lngDelta = Math.abs(((subsolar.lng - this.lastMaskLng + 540) % 360) - 180);
    if (
      this.maskDrawn &&
      lngDelta < MASK_LNG_EPSILON &&
      subsolar.lat === this.lastMaskLat &&
      shadeAlpha === this.lastMaskShade
    ) {
      return;
    }

    const width = this.nightCanvas.width;
    const height = this.nightCanvas.height;
    if (
      !this.nightImageData ||
      this.nightImageData.width !== width ||
      this.nightImageData.height !== height
    ) {
      this.nightImageData = this.nightContext.createImageData(width, height);
    }
    const data = this.nightImageData.data;
    const decR = subsolar.lat * D2R;
    const sinDec = Math.sin(decR);
    const cosDec = Math.cos(decR);
    const cosHourAngles = new Float64Array(width);
    for (let x = 0; x < width; x += 1) {
      const lng = -180 + ((x + 0.5) / width) * 360;
      const hourAngle = ((((lng - subsolar.lng + 180) % 360) + 360) % 360) - 180;
      cosHourAngles[x] = Math.cos(hourAngle * D2R);
    }
    let offset = 0;
    for (let y = 0; y < height; y += 1) {
      const lat =
        NIGHT_CANVAS_NORTH - ((y + 0.5) / height) * (NIGHT_CANVAS_NORTH - NIGHT_CANVAS_SOUTH);
      const latR = lat * D2R;
      const sinLat = Math.sin(latR);
      const cosLat = Math.cos(latR);
      for (let x = 0; x < width; x += 1) {
        const sinAltitude = sinLat * sinDec + cosLat * cosDec * cosHourAngles[x];
        const twilight = smoothstep(-sinAltitude / NIGHT_TWILIGHT_SIN_DEPTH);
        data[offset] = NIGHT_RGB.r;
        data[offset + 1] = NIGHT_RGB.g;
        data[offset + 2] = NIGHT_RGB.b;
        data[offset + 3] = Math.round(shadeAlpha * twilight);
        offset += 4;
      }
    }
    this.nightContext.putImageData(this.nightImageData, 0, 0);
    this.maskDrawn = true;
    this.lastMaskLng = subsolar.lng;
    this.lastMaskLat = subsolar.lat;
    this.lastMaskShade = shadeAlpha;
  }

  private applyLight(): void {
    let center: { lat: number; lng: number };
    try {
      center = this.map.getCenter();
    } catch {
      return;
    }
    const { altitude, azimuth } = sunPositionAt(this.settings.dateMs, center.lat, center.lng);
    const polar = Math.min(90, Math.max(0, 90 - altitude));
    const daylight = Math.max(0, Math.sin(altitude * D2R));
    const intensity = 0.2 + 0.6 * daylight;
    const warmth = 1 - daylight;
    try {
      this.map.setLight({
        anchor: "map",
        position: [1.5, azimuth, polar],
        color: `rgb(255, ${Math.round(255 - 40 * warmth)}, ${Math.round(255 - 90 * warmth)})`,
        intensity,
      });
    } catch {
      /* style without light */
    }
  }
}
