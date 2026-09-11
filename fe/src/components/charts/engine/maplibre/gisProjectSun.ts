import {
  DEFAULT_GIS_SUN_DATE_MS,
  DEFAULT_GIS_SUN_SETTINGS,
  formatGisSunLocalDate,
  formatGisSunLocalTime,
  GIS_SUN_SHADE_MAX,
  GIS_SUN_SPEED_MAX,
  GIS_SUN_SPEED_MIN,
  localDayStart,
  localMinutesFromDateMs,
  MS_PER_MINUTE,
  normalizeGisSunSettings,
  parseGisSunLocalDateTime,
  setLocalMinutesOnDateMs,
  type GisSunSettings,
} from "@/components/charts/engine/maplibre/gisSunPosition";

export type GisProjectSun = {
  /** 启用太阳模拟（昼夜 terminator + 3D 光照） */
  enabled?: boolean;
  /** GeoLibre：模拟时刻 epoch ms */
  dateMs?: number;
  playing?: boolean;
  /** 模拟分钟/秒 */
  speed?: number;
  loop?: boolean;
  /** 夜半球遮罩强度 0–0.85 */
  shadeOpacity?: number;
  /** legacy */
  date?: string;
  timeMinutes?: number;
  animationSpeed?: number;
  nightShadow?: number;
};

export type ResolvedGisProjectSun = GisSunSettings & { enabled: boolean };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function legacyDateMs(sun: GisProjectSun | undefined): number | null {
  const date =
    sun?.date && ISO_DATE.test(sun.date.trim()) ? sun.date.trim() : formatGisSunLocalDate(DEFAULT_GIS_SUN_DATE_MS);
  const minutesRaw = Number(sun?.timeMinutes);
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw >= 0 && minutesRaw <= 1439
      ? Math.round(minutesRaw)
      : localMinutesFromDateMs(DEFAULT_GIS_SUN_DATE_MS);
  return parseGisSunLocalDateTime(date, formatGisSunLocalTime(setLocalMinutesOnDateMs(DEFAULT_GIS_SUN_DATE_MS, minutes)));
}

export function resolveGisProjectSun(sun: GisProjectSun | undefined): ResolvedGisProjectSun {
  const legacyMs = legacyDateMs(sun);
  const speedRaw = sun?.speed ?? sun?.animationSpeed;
  const shadeRaw = sun?.shadeOpacity ?? sun?.nightShadow;
  const settings = normalizeGisSunSettings({
    dateMs: sun?.dateMs ?? legacyMs ?? DEFAULT_GIS_SUN_DATE_MS,
    playing: sun?.playing === true,
    speed: speedRaw,
    loop: sun?.loop !== false,
    shadeOpacity: shadeRaw,
  });
  return {
    ...settings,
    enabled: sun?.enabled !== false,
  };
}

export function normalizeGisProjectSun(input: unknown): GisProjectSun | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as GisProjectSun;
  const next: GisProjectSun = {};
  if (raw.enabled === false) next.enabled = false;
  if (typeof raw.dateMs === "number" && Number.isFinite(raw.dateMs)) next.dateMs = raw.dateMs;
  if (raw.playing === true) next.playing = true;
  const speed = Number(raw.speed ?? raw.animationSpeed);
  if (Number.isFinite(speed) && speed >= GIS_SUN_SPEED_MIN && speed <= GIS_SUN_SPEED_MAX) {
    next.speed = speed;
  }
  if (raw.loop === false) next.loop = false;
  const shade = Number(raw.shadeOpacity ?? raw.nightShadow);
  if (Number.isFinite(shade) && shade >= 0 && shade <= GIS_SUN_SHADE_MAX) {
    next.shadeOpacity = shade;
  }
  if (typeof raw.date === "string" && ISO_DATE.test(raw.date.trim())) next.date = raw.date.trim();
  const timeMinutes = Number(raw.timeMinutes);
  if (Number.isFinite(timeMinutes) && timeMinutes >= 0 && timeMinutes <= 1439) {
    next.timeMinutes = Math.round(timeMinutes);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export {
  DEFAULT_GIS_SUN_DATE_MS,
  DEFAULT_GIS_SUN_SETTINGS,
  formatGisSunLocalDate,
  formatGisSunLocalTime,
  GIS_SUN_SHADE_MAX,
  GIS_SUN_SPEED_MAX,
  GIS_SUN_SPEED_MIN,
  localDayStart,
  localMinutesFromDateMs,
  MS_PER_MINUTE,
  setLocalMinutesOnDateMs,
};
