import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GEO3D_SCENE_CLOUDS_GROUP_NAME } from "./geo3dSceneClouds";
import {
  applyGeo3dSceneClouds,
  applyGeo3dPlatformEffectsLayer,
  geo3dPresetDefaults,
  hasCustomGeo3dShellColor,
  resolveGeo3dPlatformEffects,
  resolveGeo3dSceneClouds,
  resolveGeo3dShellColorHex,
  resolveGeo3dShellOpacity,
  resolveGeo3dStylePreset,
  resolveGeo3dVisualStyle,
  resolvePresetRegionBorderDefaults,
} from "./geo3dVisualStyle";
import {
  buildGeo3dStructureContentSig,
  buildGeo3dStyleContentSig,
  buildGeo3dVisualContentSig,
} from "./geo3dStyleContentSig";

describe("geo3dVisualStyle", () => {
  it("defaults to satellite preset", () => {
    expect(resolveGeo3dStylePreset({})).toBe("satellite");
  });

  it("satellite preset defaults match product tuned map-3d style", () => {
    const defaults = geo3dPresetDefaults("satellite");
    expect(defaults.sceneFog).toBe(true);
    expect(defaults.platformGlow).toBe(false);
    expect(defaults.heatBlobRadius).toBe(15);
  });

  it("tech preset enables scene clouds and disables terrain texture", () => {
    const defaults = geo3dPresetDefaults("tech");
    expect(defaults.terrainTexture).toBe(false);
    expect(defaults.sceneFog).toBe(true);
    expect(defaults.platformEffects).toBe(true);
    expect(defaults.platformGlow).toBe(false);
    expect(defaults.pointEffects).toBe(true);
    expect(defaults.heatBlob).toBe(true);
    expect(defaults.pointPillar).toBe(true);
    expect(defaults.floatingLabels).toBe(true);

    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    expect(visual.preset).toBe("tech");
    expect(visual.sceneFog).toBe(true);
    expect(visual.techSatelliteOverlay).toBe(true);
  });

  it("classic preset enables full scene effects", () => {
    const defaults = geo3dPresetDefaults("classic");
    expect(defaults.terrainTexture).toBe(false);
    expect(defaults.sceneFog).toBe(true);
    expect(defaults.platformEffects).toBe(true);
    expect(defaults.pointEffects).toBe(true);
    const visual = resolveGeo3dVisualStyle({ stylePreset: "classic" }, false);
    expect(visual.preferTerrainTexture).toBe(false);
    expect(resolveGeo3dSceneClouds({ stylePreset: "classic" })).toBe(true);
    expect(resolveGeo3dPlatformEffects({ stylePreset: "classic" })).toBe(true);
  });

  it("glass preset defaults to translucent shell", () => {
    const defaults = geo3dPresetDefaults("glass");
    expect(defaults.shellOpacity).toBe(0.48);
    expect(defaults.sceneFog).toBe(true);
    expect(defaults.pointEffects).toBe(true);
    expect(resolveGeo3dShellOpacity({ stylePreset: "glass" })).toBe(0.48);
  });

  it("scene clouds resolve from preset when unset", () => {
    expect(resolveGeo3dSceneClouds({ stylePreset: "tech" })).toBe(true);
    expect(resolveGeo3dSceneClouds({ stylePreset: "satellite" })).toBe(true);
    expect(resolveGeo3dSceneClouds({ stylePreset: "tech", sceneFog: false })).toBe(false);
  });

  it("platform effects resolve from preset when unset", () => {
    expect(resolveGeo3dPlatformEffects({ stylePreset: "tech" })).toBe(true);
    expect(resolveGeo3dPlatformEffects({ stylePreset: "satellite" })).toBe(true);
    expect(resolveGeo3dPlatformEffects({ stylePreset: "tech", platformEffects: false })).toBe(
      false,
    );
  });

  it("applyGeo3dPlatformEffectsLayer mounts platform group", () => {
    const scene = new THREE.Scene();
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    const handle = applyGeo3dPlatformEffectsLayer(
      scene,
      { halfX: 9, halfZ: 6, minY: -0.5 },
      visual,
      { stylePreset: "tech" },
      true,
    );
    expect(handle).not.toBeNull();
    expect(scene.children.some((child) => child.name === "geo3d-platform-effects")).toBe(true);
    handle?.dispose();
  });

  it("applyGeo3dSceneClouds mounts cloud group instead of linear fog", () => {
    const scene = new THREE.Scene();
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    const handle = applyGeo3dSceneClouds(scene, { halfX: 9, halfZ: 6, maxY: 1, defaultDistance: 20 }, visual);
    expect(handle).not.toBeNull();
    expect(scene.fog).toBeNull();
    expect(scene.children.some((child) => child.name === GEO3D_SCENE_CLOUDS_GROUP_NAME)).toBe(
      true,
    );
    handle?.dispose();
  });

  it("preset region border defaults differ by preset", () => {
    const tech = resolvePresetRegionBorderDefaults(true, "tech");
    const minimal = resolvePresetRegionBorderDefaults(true, "minimal");
    expect(tech.hex).not.toBe(minimal.hex);
  });

  it("content sig includes shell and border fields", () => {
    const a = buildGeo3dStyleContentSig({ stylePreset: "satellite" }, { showRegionBorder: true });
    const b = buildGeo3dStyleContentSig(
      { stylePreset: "satellite", shellColor: "#112233" },
      { showRegionBorder: true, regionBorderColor: "#aabbcc" },
    );
    expect(a).not.toBe(b);
  });

  it("resolves custom shell color hex", () => {
    expect(resolveGeo3dShellColorHex({ shellColor: "#AABBCC" }, true)).toBe("#aabbcc");
    expect(hasCustomGeo3dShellColor({ shellColor: "#112233" })).toBe(true);
    expect(hasCustomGeo3dShellColor({})).toBe(false);
  });

  it("resolves shell opacity with clamp", () => {
    expect(resolveGeo3dShellOpacity({})).toBe(1);
    expect(resolveGeo3dShellOpacity({ shellOpacity: 0.6 })).toBe(0.6);
    expect(resolveGeo3dShellOpacity({ shellOpacity: 1.5 })).toBe(1);
    expect(resolveGeo3dShellOpacity({ shellOpacity: -0.2 })).toBe(0);
  });

  it("content sig changes when shell opacity changes", () => {
    const a = buildGeo3dStyleContentSig({ stylePreset: "satellite", shellOpacity: 1 });
    const b = buildGeo3dStyleContentSig({ stylePreset: "satellite", shellOpacity: 0.5 });
    expect(a).not.toBe(b);
    const structureA = buildGeo3dStructureContentSig({ stylePreset: "satellite", shellOpacity: 1 });
    const structureB = buildGeo3dStructureContentSig({ stylePreset: "satellite", shellOpacity: 0.5 });
    expect(structureA).toBe(structureB);
    const visualA = buildGeo3dVisualContentSig({ stylePreset: "satellite", shellOpacity: 1 });
    const visualB = buildGeo3dVisualContentSig({ stylePreset: "satellite", shellOpacity: 0.5 });
    expect(visualA).not.toBe(visualB);
  });

  it("structure sig changes when cloud density changes", () => {
    const a = buildGeo3dStructureContentSig({ stylePreset: "tech", sceneCloudDensity: 0.4 });
    const b = buildGeo3dStructureContentSig({ stylePreset: "tech", sceneCloudDensity: 0.9 });
    expect(a).not.toBe(b);
  });

  it("content sig changes when platform effects toggle", () => {
    const a = buildGeo3dStyleContentSig({ stylePreset: "tech", platformEffects: true });
    const b = buildGeo3dStyleContentSig({ stylePreset: "tech", platformEffects: false });
    expect(a).not.toBe(b);
  });

  it("content sig changes when platform layer toggles", () => {
    const a = buildGeo3dStyleContentSig({
      stylePreset: "tech",
      platformEffects: true,
    });
    const b = buildGeo3dStyleContentSig({
      stylePreset: "tech",
      platformEffects: true,
      platformRipple: false,
    });
    expect(a).not.toBe(b);
  });

  it("content sig changes when visual map legend toggles", () => {
    const on = buildGeo3dStyleContentSig({ stylePreset: "satellite" }, { visualMap: true });
    const off = buildGeo3dStyleContentSig({ stylePreset: "satellite" }, { visualMap: false });
    expect(on).not.toBe(off);
  });

  it("visual sig changes when platform color changes without structure change", () => {
    const base = {
      stylePreset: "tech" as const,
      platformEffects: true,
    };
    const visualA = buildGeo3dVisualContentSig(base);
    const visualB = buildGeo3dVisualContentSig({
      ...base,
      platformRippleColor: "#ff6600",
    });
    expect(visualA).not.toBe(visualB);
    expect(buildGeo3dStructureContentSig(base)).toBe(
      buildGeo3dStructureContentSig({ ...base, platformRippleColor: "#ff6600" }),
    );
  });
});
