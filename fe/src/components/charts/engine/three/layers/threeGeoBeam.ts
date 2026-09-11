import * as THREE from "three";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";

export function mountThreeGeoBeam(
  scene: THREE.Scene,
  layout: ThreeGeoOrbitLayout,
  isDark: boolean,
): { update: () => void; dispose: () => void } {
  const beam = new THREE.SpotLight(
    isDark ? 0x38bdf8 : 0x60a5fa,
    2.2,
    layout.defaultDistance * 3.5,
    Math.PI / 5.5,
    0.35,
    1,
  );
  beam.position.set(0, layout.maxY * 3.5, 0);
  scene.add(beam);

  let angle = 0;
  const radius = Math.max(layout.halfX, layout.halfZ) * 0.75;

  return {
    update: () => {
      angle += 0.01;
      beam.position.x = Math.cos(angle) * radius;
      beam.position.z = Math.sin(angle) * radius;
    },
    dispose: () => {
      scene.remove(beam);
    },
  };
}
