import { describe, expect, it, vi } from "vitest";
import { normalizeScreenBorderStyle } from "@/lib/screenVisualStyle";
import {
  createScreenBorderSparkle,
  normalizeScreenBorderSparkleStyle,
} from "@/lib/screenBorderSparkle";

describe("screenBorderSparkle", () => {
  it("does not create default sparkle when enabled is false", () => {
    const style = normalizeScreenBorderSparkleStyle(undefined);
    expect(style.enabled).toBe(false);
    expect(style.sparkles).toEqual([]);
  });

  it("creates default sparkle when enabled without explicit sparkles", () => {
    const style = normalizeScreenBorderSparkleStyle({ enabled: true });
    expect(style.enabled).toBe(true);
    expect(style.sparkles).toHaveLength(1);
    expect(style.sparkles[0]?.id).toBeTruthy();
  });

  it("normalizeScreenBorderStyle does not throw without crypto.randomUUID", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    try {
      expect(() => normalizeScreenBorderStyle({ variant: "border-7" })).not.toThrow();
      const style = normalizeScreenBorderStyle({ variant: "border-7" });
      expect(style.variant).toBe("border-7");
      expect(style.sparkle.sparkles).toEqual([]);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: original,
      });
    }
  });

  it("createScreenBorderSparkle uses randomId fallback when randomUUID throws", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      throw new TypeError("crypto.randomUUID is not a function");
    });
    const sparkle = createScreenBorderSparkle();
    expect(sparkle.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    vi.restoreAllMocks();
  });
});
