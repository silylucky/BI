import { describe, expect, it } from "vitest";
import {
  normalizeScreenClockStyle,
  normalizeScreenDateTimeStyle,
  normalizeScreenIconStyle,
  normalizeScreenShapeStyle,
  normalizeScreenVisualStyle,
} from "./screenVisualStyle";

describe("screenVisualStyle", () => {
  it("merges partial clock style", () => {
    expect(normalizeScreenClockStyle({ fontSize: 24, use12Hour: true }).fontSize).toBe(24);
    expect(normalizeScreenClockStyle({ fontSize: 24, use12Hour: true }).use12Hour).toBe(true);
    expect(normalizeScreenClockStyle({ fontSize: 24 }).showDate).toBe(true);
  });

  it("merges partial datetime style", () => {
    expect(normalizeScreenDateTimeStyle({ timeFontSize: 28 }).timeFontSize).toBe(28);
    expect(normalizeScreenDateTimeStyle({ timeFontSize: 28 }).dateFontSize).toBe(14);
  });

  it("normalizes shape and icon style buckets", () => {
    expect(normalizeScreenShapeStyle({ shape: "triangle" }).shape).toBe("triangle");
    expect(normalizeScreenIconStyle({ icon: "home", size: 64 }).size).toBe(64);
  });

  it("normalizes full visual style buckets", () => {
    const style = normalizeScreenVisualStyle({
      clock: { fontSize: 20 },
      border: { glowEnabled: false, variant: "border-2" },
      shape: { strokeWidth: 3 },
      icon: { color: "#ffffff" },
    });
    expect(style.clock.fontSize).toBe(20);
    expect(style.border.glowEnabled).toBe(false);
    expect(style.border.variant).toBe("border-2");
    expect(style.shape.strokeWidth).toBe(3);
    expect(style.icon.color).toBe("#ffffff");
    expect(style.datetime.showSeconds).toBe(true);
  });
});
