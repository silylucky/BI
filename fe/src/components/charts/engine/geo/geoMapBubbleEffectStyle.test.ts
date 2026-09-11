import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEO_MAP_BUBBLE_COLOR,
  DEFAULT_GEO_MAP_BUBBLE_RING_COUNT,
  DEFAULT_GEO_MAP_BUBBLE_SPEED,
  resolveGeoMapBubbleEffect,
  resolveGeoMapBubbleEffectPanelColor,
  hasCustomGeoMapBubbleEffectColor,
} from "@/components/charts/engine/geo/geoMapBubbleEffectStyle";

describe("resolveGeoMapBubbleEffect", () => {
  it("defaults to disabled ripple", () => {
    const effect = resolveGeoMapBubbleEffect({});
    expect(effect.enabled).toBe(false);
    expect(effect.type).toBe("ripple");
    expect(effect.speed).toBe(DEFAULT_GEO_MAP_BUBBLE_SPEED);
    expect(effect.ringCount).toBe(DEFAULT_GEO_MAP_BUBBLE_RING_COUNT);
  });

  it("enables ripple with clamped speed and ring count", () => {
    const effect = resolveGeoMapBubbleEffect(
      {
        bubbleEffect: true,
        bubbleEffectSpeed: 5,
        bubbleEffectRingCount: 12,
        bubbleEffectColor: "#112233",
      },
      { accentColor: "#abcdef" },
    );
    expect(effect.enabled).toBe(true);
    expect(effect.speed).toBe(3);
    expect(effect.ringCount).toBe(8);
    expect(effect.color).toBe("#112233");
    expect(effect.durationMs).toBe(Math.round(2200 / 3));
  });

  it("falls back to accent color then default amber", () => {
    expect(resolveGeoMapBubbleEffect({ bubbleEffect: true }, { accentColor: "#aabbcc" }).color).toBe(
      "#aabbcc",
    );
    expect(resolveGeoMapBubbleEffect({ bubbleEffect: true }).color).toBe("#fbbf24");
  });

  it("exposes panel color helpers", () => {
    expect(hasCustomGeoMapBubbleEffectColor({ bubbleEffectColor: "#112233" })).toBe(true);
    expect(resolveGeoMapBubbleEffectPanelColor({}, { accentColor: "#aabbcc" })).toBe("#aabbcc");
    expect(resolveGeoMapBubbleEffectPanelColor({}, {})).toBe(DEFAULT_GEO_MAP_BUBBLE_COLOR);
  });
});
