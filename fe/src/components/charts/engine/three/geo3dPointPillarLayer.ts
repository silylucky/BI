import * as THREE from "three";
import type { RegionPointSample } from "@/components/charts/engine/three/geo3dRegionCentroid";
import {
  buildGeo3dPointPillar,
  patchGeo3dPointPillarVisual,
  resolvePillarHeight,
  resolveVerticalBillboardYaw,
  type Geo3dPointPillar,
} from "@/components/charts/engine/three/geo3dPointPillar";
import { resolveRegionCapAnchorLocal } from "@/components/charts/engine/three/geo3dRegionCentroid";
import type { ResolvedPointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

export type Geo3dPointPillarLayerHandle = {
  group: THREE.Group;
  pillars: Array<{ name: string; pillar: Geo3dPointPillar; baseZ: number }>;
  update: (deltaSec: number, reducedMotion: boolean, camera?: THREE.Camera) => void;
  patchVisual: (style: ResolvedPointEffectsStyle) => void;
  dispose: () => void;
};

export function buildGeo3dPointPillarLayer(
  samples: RegionPointSample[],
  meshes: THREE.Object3D[],
  capTopZ: number,
  effectUnit: number,
  style: ResolvedPointEffectsStyle,
): Geo3dPointPillarLayerHandle | null {
  if (!style.layers.pointPillar || samples.length === 0) return null;
  const group = new THREE.Group();
  group.name = "geo3d-point-pillars";
  const pillars: Geo3dPointPillarLayerHandle["pillars"] = [];
  const worldPos = new THREE.Vector3();
  const runtimeStyle = { ...style };

  for (const sample of samples) {
    const barHeight = resolvePillarHeight(sample.valueT, effectUnit, runtimeStyle);
    const pillar = buildGeo3dPointPillar(barHeight, runtimeStyle, effectUnit);
    const anchor = resolveRegionCapAnchorLocal(meshes, sample.name, capTopZ, sample.adcode);
    if (!anchor) continue;
    pillar.group.position.set(anchor.x, anchor.y, capTopZ);
    pillar.group.renderOrder = 15;
    group.add(pillar.group);
    pillars.push({ name: sample.name, pillar, baseZ: capTopZ });
  }

  return {
    group,
    pillars,
    update(deltaSec, reducedMotion, camera) {
      for (const entry of pillars) {
        if (camera) {
          entry.pillar.group.getWorldPosition(worldPos);
          entry.pillar.beamMesh.rotation.z = resolveVerticalBillboardYaw(worldPos, camera);
        }
        if (deltaSec > 0 && !reducedMotion) {
          entry.pillar.ringMesh.rotation.z += (deltaSec + 0.02) * runtimeStyle.pointPillarRingSpeed;
        }
      }
    },
    patchVisual(nextStyle: ResolvedPointEffectsStyle) {
      runtimeStyle.pointPillarRingSpeed = nextStyle.pointPillarRingSpeed;
      for (const entry of pillars) {
        patchGeo3dPointPillarVisual(entry.pillar, nextStyle);
      }
    },
    dispose() {
      for (const entry of pillars) entry.pillar.dispose();
      group.clear();
    },
  };
}
