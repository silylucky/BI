import type { GisAtmospherePreset, GisProjection } from "@/components/charts/engine/maplibre/gisProject";
import { createMeteorSpawner, drawMeteors, type Meteor } from "@/components/charts/engine/maplibre/gisMeteors";
import {
  resolveGlobeScreenBounds,
  resolveGlobeScreenBoundsFallback,
  shouldRenderGisStarfield,
} from "@/components/charts/engine/maplibre/gisGlobeLayout";
import { readOverlayLayoutSize, syncOverlayCanvasSize } from "@/components/charts/engine/maplibre/gisOverlayCanvas";

type MapLibreMap = import("maplibre-gl").Map;

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkle: number;
  phase: number;
  hue: number;
};

export function resolveGisStarIntensity(preset: GisAtmospherePreset | undefined): number {
  if (preset === "night") return 1;
  return 0;
}

export function resolveGisMeteorIntensity(preset: GisAtmospherePreset | undefined): number {
  if (preset === "night") return 1;
  return 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildProceduralStars(width: number, height: number, seed = 42): Star[] {
  const rand = mulberry32(seed);
  const count = Math.max(120, Math.floor((width * height) / 900));
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = rand() * 1.3 + 0.2;
    const hue = rand() > 0.8 ? (rand() > 0.5 ? 220 : 40) : 0;
    stars.push({
      x: rand() * width,
      y: rand() * height,
      radius: size,
      alpha: rand() * 0.6 + 0.15,
      twinkle: rand() * 0.4,
      phase: rand() * Math.PI * 2,
      hue,
    });
  }
  return stars;
}

export function resolveStarfieldParallaxOffset(
  centerLng: number,
  centerLat: number,
  refLng: number,
  refLat: number,
  width: number,
  height: number,
): { dx: number; dy: number } {
  return {
    dx: ((centerLng - refLng) / 360) * width,
    dy: ((centerLat - refLat) / 180) * height,
  };
}

function starColor(hue: number, alpha: number): string {
  if (hue === 220) return `rgba(200, 220, 255, ${alpha})`;
  if (hue === 40) return `rgba(255, 240, 210, ${alpha})`;
  return `rgba(235, 245, 255, ${alpha})`;
}

function drawStarfieldFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stars: Star[],
  meteors: Meteor[],
  starIntensity: number,
  meteorIntensity: number,
  timeSec: number,
  parallax: { dx: number; dy: number },
) {
  ctx.clearRect(0, 0, width, height);

  for (const star of stars) {
    let x = star.x - parallax.dx;
    let y = star.y - parallax.dy;
    x = ((x % width) + width) % width;
    y = ((y % height) + height) % height;

    const twinkle = star.twinkle * Math.sin(timeSec * 1.6 + star.phase);
    const alpha = Math.min(1, star.alpha * starIntensity * (0.7 + twinkle));
    ctx.fillStyle = starColor(star.hue, alpha);
    ctx.beginPath();
    ctx.arc(x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();

    if (star.radius > 1.1) {
      ctx.fillStyle = starColor(star.hue, alpha * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, star.radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMeteors(ctx, meteors, meteorIntensity);
}

export function mountGisStarfieldOverlay(
  wrapper: HTMLElement,
  getMap: () => MapLibreMap | null,
  preset: GisAtmospherePreset | undefined,
  projection: GisProjection | undefined,
): () => void {
  const starIntensity = resolveGisStarIntensity(preset);
  const meteorIntensity = resolveGisMeteorIntensity(preset);
  const enabled = projection === "globe" && starIntensity > 0;

  const canvas = document.createElement("canvas");
  canvas.dataset.testid = "gis-starfield";
  canvas.className = "pointer-events-none absolute inset-0 z-[1] h-full w-full";
  wrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let stars: Star[] = [];
  let refLng = 100;
  let refLat = 28;
  let refSet = false;
  const canvasSize = { width: 0, height: 0 };
  const tickMeteors = createMeteorSpawner(meteorIntensity);
  let meteors: Meteor[] = [];
  let running = true;
  let start = performance.now();
  let lastFrame = start;
  let frameId = 0;

  const syncCanvasSize = (width: number, height: number) => {
    const changed = syncOverlayCanvasSize(canvas, ctx, width, height, canvasSize);
    if (changed) {
      stars = buildProceduralStars(width, height);
    }
  };

  const resize = () => {
    const { width, height } = readOverlayLayoutSize(wrapper);
    syncCanvasSize(width, height);
  };

  const paint = () => {
    if (!running || !ctx || !enabled) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";

    const { width, height } = readOverlayLayoutSize(wrapper);
    if (width <= 0 || height <= 0) return;

    syncCanvasSize(width, height);

    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    const map = getMap();
    if (map && !refSet) {
      const center = map.getCenter();
      refLng = center.lng;
      refLat = center.lat;
      refSet = true;
    }
    const globe = map
      ? resolveGlobeScreenBounds(map) ?? resolveGlobeScreenBoundsFallback(width, height)
      : resolveGlobeScreenBoundsFallback(width, height);

    if (!shouldRenderGisStarfield(globe, width, height, map)) {
      canvas.style.display = "none";
      ctx.clearRect(0, 0, width, height);
      meteors = [];
      return;
    }

    const center = map?.getCenter() ?? { lng: refLng, lat: refLat };
    const parallax = resolveStarfieldParallaxOffset(
      center.lng,
      center.lat,
      refLng,
      refLat,
      width,
      height,
    );

    if (meteorIntensity > 0) {
      meteors = tickMeteors({ width, height, globe, intensity: meteorIntensity }, dt, meteors);
    } else {
      meteors = [];
    }

    drawStarfieldFrame(
      ctx,
      width,
      height,
      stars,
      meteors,
      starIntensity,
      meteorIntensity,
      (now - start) / 1000,
      parallax,
    );
  };

  const loop = () => {
    paint();
    frameId = requestAnimationFrame(loop);
  };

  resize();
  if (enabled) loop();

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(wrapper);

  return () => {
    running = false;
    cancelAnimationFrame(frameId);
    ro?.disconnect();
    canvas.remove();
  };
}
