/** GeoLibre maplibre-effects.ts 星场：平铺 parallax，无 twinkle。 */
const STAR_AREA_PER_STAR = 900;
const STARFIELD_LNG_PERIOD_DEGREES = 360;
const STARFIELD_LAT_PERIOD_DEGREES = 180;

type Star = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  glow: boolean;
};

function makeStar(fieldWidth: number, fieldHeight: number): Star {
  const size = Math.random() * 1.3 + 0.2;
  const alpha = Math.random() * 0.6 + 0.15;
  return { x: Math.random() * fieldWidth, y: Math.random() * fieldHeight, size, alpha, glow: size > 1.1 };
}

function drawStar(ctx: CanvasRenderingContext2D, star: Star): void {
  let color = `rgba(255, 255, 255, ${star.alpha})`;
  if (Math.random() > 0.8) {
    color =
      Math.random() > 0.5
        ? `hsla(220, 30%, 85%, ${star.alpha})`
        : `hsla(40, 30%, 85%, ${star.alpha})`;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
  ctx.fill();
  if (star.glow) {
    ctx.fillStyle = `rgba(200, 220, 255, ${0.12 * star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function buildGeolibreStarfieldTile(
  width: number,
  height: number,
  dpr: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round((width * height) / STAR_AREA_PER_STAR);
  for (let i = 0; i < count; i += 1) {
    drawStar(ctx, makeStar(width, height));
  }
  return canvas;
}

export function resolveGeolibreStarfieldParallaxOffset(
  centerLng: number,
  centerLat: number,
  originLng: number,
  originLat: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const offsetX = ((centerLng - originLng) / STARFIELD_LNG_PERIOD_DEGREES) * width;
  const offsetY = ((centerLat - originLat) / STARFIELD_LAT_PERIOD_DEGREES) * height;
  return {
    x: ((offsetX % width) + width) % width,
    y: ((offsetY % height) + height) % height,
  };
}

export function drawGeolibreStarfieldParallax(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  field: HTMLCanvasElement,
  centerLng: number,
  centerLat: number,
  originLng: number,
  originLat: number,
  options?: { skipClear?: boolean },
): void {
  const { x: wrappedX, y: wrappedY } = resolveGeolibreStarfieldParallaxOffset(
    centerLng,
    centerLat,
    originLng,
    originLat,
    width,
    height,
  );
  if (!options?.skipClear) {
    ctx.clearRect(0, 0, width, height);
  }
  ctx.drawImage(field, wrappedX, wrappedY, width, height);
  ctx.drawImage(field, wrappedX - width, wrappedY, width, height);
  ctx.drawImage(field, wrappedX, wrappedY - height, width, height);
  ctx.drawImage(field, wrappedX - width, wrappedY - height, width, height);
}
