import { describe, expect, it } from "vitest";
import {
  buildPlatformEffectsContentSig,
  resolvePlatformAccentColors,
  resolvePlatformEffectsStyle,
  resolvePlatformLayerFlags,
} from "./geo3dPlatformStyle";

describe("geo3dPlatformStyle", () => {
  it("defaults core layers on and shader layers off when effects enabled", () => {
    expect(resolvePlatformLayerFlags({}, true)).toMatchObject({
      highlight: true,
      rings: true,
      grid: true,
      ripple: true,
      glow: false,
      pulse: false,
      sweep: false,
    });
  });

  it("follows map preset colors when unset", () => {
    const tech = resolvePlatformAccentColors({ stylePreset: "tech" }, "tech", true);
    const classic = resolvePlatformAccentColors({ stylePreset: "classic" }, "classic", true);
    expect(tech.ripple).toBe("#0ea5e9");
    expect(classic.ripple).toBe("#ea580c");
  });

  it("applies custom colors and opacity", () => {
    const resolved = resolvePlatformEffectsStyle(
      {
        platformGridColor: "#112233",
        platformGridOpacity: 0.25,
        platformSizeScale: 1.2,
      },
      "tech",
      true,
      true,
    );
    expect(resolved.colors.grid).toBe("#112233");
    expect(resolved.gridOpacity).toBe(0.25);
    expect(resolved.sizeScale).toBe(1.2);
  });

  it("allows disabling shader layers explicitly", () => {
    expect(resolvePlatformLayerFlags({ platformGlow: false }, true)).toMatchObject({
      glow: false,
      pulse: false,
      sweep: false,
    });
    expect(resolvePlatformLayerFlags({ platformGlow: true, platformPulse: true }, true)).toMatchObject({
      glow: true,
      pulse: true,
      sweep: false,
    });
  });

  it("provides distinct default accent colors per layer", () => {
    const tech = resolvePlatformAccentColors({ stylePreset: "tech" }, "tech", true);
    expect(tech.glow).not.toBe(tech.sweep);
  });

  it("applies custom glow color", () => {
    const resolved = resolvePlatformEffectsStyle(
      { platformGlowColor: "#ff00aa", platformGlow: true },
      "tech",
      true,
      true,
    );
    expect(resolved.colors.glow).toBe("#ff00aa");
  });

  it("content sig changes when layer toggles", () => {
    const a = buildPlatformEffectsContentSig({}, true);
    const b = buildPlatformEffectsContentSig({ platformRipple: false }, true);
    expect(a).not.toBe(b);
  });
});
