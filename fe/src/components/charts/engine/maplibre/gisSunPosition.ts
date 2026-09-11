/** 对齐 vendor/geolibre maplibre-sun.ts 太阳位置计算（NOAA 低精度）。 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

export const GIS_SUN_SPEED_MIN = 5;
export const GIS_SUN_SPEED_MAX = 480;
export const GIS_SUN_SHADE_MIN = 0;
export const GIS_SUN_SHADE_MAX = 0.85;
export const DEFAULT_GIS_SUN_DATE_MS = Date.UTC(2024, 5, 21, 12, 0, 0);

export type GisSunSettings = {
  dateMs: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  shadeOpacity: number;
};

export const DEFAULT_GIS_SUN_SETTINGS: GisSunSettings = {
  dateMs: DEFAULT_GIS_SUN_DATE_MS,
  playing: false,
  speed: 60,
  loop: true,
  shadeOpacity: 0.55,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeGisSunSettings(
  value: unknown,
  base: GisSunSettings = DEFAULT_GIS_SUN_SETTINGS,
): GisSunSettings {
  const raw = (value ?? {}) as Partial<GisSunSettings>;
  return {
    dateMs: typeof raw.dateMs === "number" && Number.isFinite(raw.dateMs) ? raw.dateMs : base.dateMs,
    playing: typeof raw.playing === "boolean" ? raw.playing : base.playing,
    speed: clampNumber(raw.speed, GIS_SUN_SPEED_MIN, GIS_SUN_SPEED_MAX, base.speed),
    loop: typeof raw.loop === "boolean" ? raw.loop : base.loop,
    shadeOpacity: clampNumber(
      raw.shadeOpacity,
      GIS_SUN_SHADE_MIN,
      GIS_SUN_SHADE_MAX,
      base.shadeOpacity,
    ),
  };
}

export function localDayStart(dateMs: number): number {
  const d = new Date(dateMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function advanceGisSunClock(settings: GisSunSettings, deltaMs: number): GisSunSettings {
  const dayStart = localDayStart(settings.dateMs);
  let next = settings.dateMs + deltaMs;
  const dayEnd = dayStart + MS_PER_DAY;
  if (next >= dayEnd) {
    if (settings.loop) {
      next = dayStart + ((next - dayStart) % MS_PER_DAY);
      return { ...settings, dateMs: next };
    }
    return { ...settings, dateMs: dayEnd - MS_PER_MINUTE, playing: false };
  }
  return { ...settings, dateMs: next };
}

function julianDay(dateMs: number): number {
  return dateMs / MS_PER_DAY + 2440587.5;
}

function greenwichMeanSiderealTime(jd: number): number {
  const d = jd - 2451545.0;
  return (18.697374558 + 24.06570982441908 * d) % 24;
}

function sunEquatorialPosition(dateMs: number): { alpha: number; delta: number } {
  const jd = julianDay(dateMs);
  const n = jd - 2451545.0;
  const meanLng = (280.46 + 0.9856474 * n) % 360;
  const meanAnomaly = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const eclipticLng = meanLng + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly);
  const obliquity = 23.439 - 0.0000004 * n;
  const lngRad = eclipticLng * D2R;
  const obRad = obliquity * D2R;
  let alpha = Math.atan2(Math.cos(obRad) * Math.sin(lngRad), Math.cos(lngRad)) * R2D;
  alpha = ((alpha % 360) + 360) % 360;
  const delta = Math.asin(Math.sin(obRad) * Math.sin(lngRad)) * R2D;
  return { alpha, delta };
}

export function subsolarPoint(dateMs: number): { lat: number; lng: number } {
  const jd = julianDay(dateMs);
  const gst = greenwichMeanSiderealTime(jd);
  const { alpha, delta } = sunEquatorialPosition(dateMs);
  let lng = alpha - gst * 15;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: delta, lng };
}

export function sunPositionAt(
  dateMs: number,
  lat: number,
  lng: number,
): { altitude: number; azimuth: number } {
  const jd = julianDay(dateMs);
  const gst = greenwichMeanSiderealTime(jd);
  const { alpha, delta } = sunEquatorialPosition(dateMs);
  let ha = gst * 15 + lng - alpha;
  ha = ((((ha + 180) % 360) + 360) % 360) - 180;
  const haR = ha * D2R;
  const latR = lat * D2R;
  const decR = delta * D2R;
  const sinAltitude =
    Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  const altitude = Math.asin(Math.min(1, Math.max(-1, sinAltitude))) * R2D;
  const azimuth =
    (Math.atan2(Math.sin(haR), Math.cos(haR) * Math.sin(latR) - Math.tan(decR) * Math.cos(latR)) *
      R2D +
      180) %
    360;
  return { altitude, azimuth };
}

export function formatGisSunLocalTime(dateMs: number): string {
  const d = new Date(dateMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatGisSunLocalDate(dateMs: number): string {
  const d = new Date(dateMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseGisSunLocalDateTime(date: string, time: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match || !timeMatch) return null;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hours,
    minutes,
    0,
    0,
  ).getTime();
}

export function localMinutesFromDateMs(dateMs: number): number {
  const d = new Date(dateMs);
  return d.getHours() * 60 + d.getMinutes();
}

export function setLocalMinutesOnDateMs(dateMs: number, minutes: number): number {
  const dayStart = localDayStart(dateMs);
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  return dayStart + clamped * MS_PER_MINUTE;
}
