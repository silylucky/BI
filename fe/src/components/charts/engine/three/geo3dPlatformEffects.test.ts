import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  GEO3D_PLATFORM_GROUP_NAME,
  buildGeo3dPlatformEffects,
} from "./geo3dPlatformEffects";
import {
  resolvePlatformEffectsStyle,
  resolvePlatformLayerFlags,
} from "./geo3dPlatformStyle";
import {
  applyGeo3dPlatformEffectsLayer,
  resolveGeo3dPlatformEffects,
  resolveGeo3dVisualStyle,
} from "./geo3dVisualStyle";

describe("geo3dPlatformEffects", () => {
  const layout = { halfX: 9, halfZ: 6, minY: -0.5 };

  it("builds default platform decoration layers for tech preset", () => {
    const resolved = resolvePlatformEffectsStyle({ stylePreset: "tech" }, "tech", true, true);
    const handle = buildGeo3dPlatformEffects(layout, resolved);
    expect(handle.group.name).toBe(GEO3D_PLATFORM_GROUP_NAME);
    expect(handle.group.children.length).toBeGreaterThanOrEqual(5);
    handle.dispose();
  });

  it("builds square grid and ripple as separate masked layers", () => {
    const resolved = resolvePlatformEffectsStyle(
      {
        platformGridStyle: "square",
        platformHighlight: false,
        platformRings: false,
        platformGlow: false,
        platformPulse: false,
        platformSweep: false,
      },
      "tech",
      true,
      true,
    );
    const handle = buildGeo3dPlatformEffects(layout, resolved);
    expect(handle.group.children).toHaveLength(2);
    handle.dispose();
  });

  it("builds square grid layer", () => {
    const resolved = resolvePlatformEffectsStyle(
      {
        platformGridStyle: "square",
        platformHighlight: false,
        platformRings: false,
        platformRipple: false,
        platformGlow: false,
        platformPulse: false,
        platformSweep: false,
      },
      "tech",
      true,
      true,
    );
    expect(resolved.gridStyle).toBe("square");
    const handle = buildGeo3dPlatformEffects(layout, resolved);
    expect(handle.group.children).toHaveLength(1);
    const mesh = handle.group.children[0] as THREE.Mesh;
    expect(mesh.material.type).toBe("ShaderMaterial");
    handle.dispose();
  });

  it("applies pulse speed to shader uniforms", () => {
    const resolved = resolvePlatformEffectsStyle(
      { platformPulse: true, platformPulseSpeed: 2, platformHighlight: false, platformRings: false, platformGrid: false, platformRipple: false },
      "tech",
      true,
      true,
    );
    expect(resolved.pulseSpeed).toBe(2);
    expect(resolved.ringSpeed).toBe(2.5);
  });
  it("builds shader layers when enabled", () => {
    const resolved = resolvePlatformEffectsStyle(
      {
        platformGlow: true,
        platformPulse: true,
        platformSweep: false,
        platformHighlight: false,
        platformRings: false,
        platformGrid: false,
        platformRipple: false,
      },
      "tech",
      true,
      true,
    );
    const handle = buildGeo3dPlatformEffects(layout, resolved);
    expect(handle.group.children).toHaveLength(2);
    handle.dispose();
  });

  it("rotates rings on update", () => {
    const resolved = resolvePlatformEffectsStyle(
      {
        platformHighlight: false,
        platformGrid: false,
        platformRipple: false,
        platformGlow: false,
        platformPulse: false,
        platformSweep: false,
      },
      "tech",
      true,
      true,
    );
    const handle = buildGeo3dPlatformEffects(layout, resolved);
    const ring1 = handle.group.children[0] as THREE.Mesh;
    const ring2 = handle.group.children[1] as THREE.Mesh;
    const z1Before = ring1.rotation.z;
    const z2Before = ring2.rotation.z;
    handle.update(1);
    expect(ring1.rotation.z).not.toBe(z1Before);
    expect(ring2.rotation.z).not.toBe(z2Before);
    handle.dispose();
  });

  it("tech preset enables platform effects by default", () => {
    expect(resolveGeo3dPlatformEffects({ stylePreset: "tech" })).toBe(true);
    expect(resolveGeo3dPlatformEffects({ stylePreset: "satellite" })).toBe(true);
  });

  it("layer flags default shader layers off unless explicitly enabled", () => {
    expect(resolvePlatformLayerFlags({}, true)).toMatchObject({
      glow: false,
      pulse: false,
      sweep: false,
    });
    expect(resolvePlatformLayerFlags({ platformGlow: true }, true).glow).toBe(true);
  });

  it("applyGeo3dPlatformEffectsLayer mounts group to scene", () => {
    const scene = new THREE.Scene();
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    const handle = applyGeo3dPlatformEffectsLayer(scene, layout, visual, { stylePreset: "tech" }, true);
    expect(handle).not.toBeNull();
    expect(scene.children.some((child) => child.name === GEO3D_PLATFORM_GROUP_NAME)).toBe(true);
    handle?.dispose();
  });

  it("applyGeo3dPlatformEffectsLayer returns null when all layers off", () => {
    const scene = new THREE.Scene();
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    const handle = applyGeo3dPlatformEffectsLayer(
      scene,
      layout,
      visual,
      {
        stylePreset: "tech",
        platformHighlight: false,
        platformRings: false,
        platformGrid: false,
        platformRipple: false,
        platformGlow: false,
        platformPulse: false,
        platformSweep: false,
      },
      true,
    );
    expect(handle).toBeNull();
  });
});
