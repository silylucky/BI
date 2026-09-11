import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  POINT_EFFECT_TO_MAP_RATIO,
  resolveNormalizedMapVisualSpan,
  resolvePointEffectSizing,
} from "@/components/charts/engine/three/geo3dPointEffectScale";
import { resolvePillarHeight } from "@/components/charts/engine/three/geo3dPointPillar";
import { resolvePointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

const LAYOUT = { halfX: 9, halfZ: 8 };

function makeScaledMapGroup(scale: number): THREE.Group {
  const mapGroup = new THREE.Group();
  mapGroup.scale.setScalar(scale);
  return mapGroup;
}

describe("geo3dPointEffectScale", () => {
  it("uses normalized map span from orbit layout", () => {
    expect(resolveNormalizedMapVisualSpan(LAYOUT)).toBe(18);
  });

  it("keeps identical visual pillar size across drill normalize scales", () => {
    const national = resolvePointEffectSizing(makeScaledMapGroup(0.04), LAYOUT);
    const drill = resolvePointEffectSizing(makeScaledMapGroup(0.14), LAYOUT);

    expect(national.visualMapSpan).toBe(drill.visualMapSpan);
    expect(national.effectUnit * national.mapScale).toBeCloseTo(
      drill.effectUnit * drill.mapScale,
      4,
    );
    expect(national.effectUnit * national.mapScale).toBeCloseTo(
      18 * POINT_EFFECT_TO_MAP_RATIO,
      4,
    );
  });

  it("uses larger local unit when mapGroup scale is smaller", () => {
    const sizing = resolvePointEffectSizing(makeScaledMapGroup(0.04), LAYOUT);
    expect(sizing.effectUnit).toBeGreaterThan(sizing.visualMapSpan);
  });
});

describe("geo3dPointPillar sizing", () => {
  it("produces pillar height proportional to effect unit", () => {
    const style = resolvePointEffectsStyle({}, "tech", true, true);
    const effectUnit = 2.5;
    const height = resolvePillarHeight(1, effectUnit, style);
    expect(height).toBeGreaterThan(effectUnit * 0.9);
    expect(height).toBeLessThan(effectUnit * 2);
  });
});
