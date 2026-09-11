import { describe, expect, it } from "vitest";
import {
  formatGisSunLocalTime,
  parseGisSunLocalDateTime,
  subsolarPoint,
  sunPositionAt,
} from "@/components/charts/engine/maplibre/gisSunPosition";
import { resolveGisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";

describe("gisSunPosition", () => {
  it("formats and parses local date/time", () => {
    const dateMs = Date.UTC(2024, 5, 21, 9, 36, 0);
    expect(formatGisSunLocalTime(dateMs)).toMatch(/^\d{2}:\d{2}$/);
    const parsed = parseGisSunLocalDateTime("2024-06-21", "09:36");
    expect(parsed).not.toBeNull();
  });

  it("raises solar altitude near subsolar point", () => {
    const dateMs = Date.UTC(2024, 5, 21, 12, 0, 0);
    const subsolar = subsolarPoint(dateMs);
    const atSubsolar = sunPositionAt(dateMs, subsolar.lat, subsolar.lng);
    const away = sunPositionAt(dateMs, 0, subsolar.lng + 90);
    expect(atSubsolar.altitude).toBeGreaterThan(away.altitude);
  });

  it("migrates legacy date + timeMinutes", () => {
    const resolved = resolveGisProjectSun({ date: "2024-06-21", timeMinutes: 17 * 60 + 36 });
    expect(resolved.enabled).toBe(true);
    expect(resolved.shadeOpacity).toBeGreaterThan(0);
  });
});
