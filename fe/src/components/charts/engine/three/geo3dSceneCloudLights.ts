import * as THREE from "three";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";

export const GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME = "geo3d-scene-cloud-lights";

/** 对标 sc-datav Demo1 ambient intensity=2，嵌入图表略保守 */
export const SCENE_CLOUD_AMBIENT_INTENSITY = 1.6;
export const SCENE_CLOUD_AMBIENT_COLOR = 0xffffff;

/** 对标 sc-datav Demo1 directional intensity=12、color=#fff5e8 */
export const SCENE_CLOUD_KEY_INTENSITY = 8;
export const SCENE_CLOUD_KEY_COLOR = 0xfff5e8;

/** sc-datav 主光位置 [0, 200, 20] 相对云团 bounds≈50 的比例 */
const KEY_LIGHT_Y_SCALE = 4;
const KEY_LIGHT_Z_SCALE = 0.4;

export type Geo3dSceneCloudLightsHandle = {
  group: THREE.Group;
  dispose: () => void;
};

export function buildGeo3dSceneCloudLights(
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ">,
): Geo3dSceneCloudLightsHandle {
  const group = new THREE.Group();
  group.name = GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME;

  const span = Math.max(layout.halfX, layout.halfZ, 4);

  const ambient = new THREE.AmbientLight(
    SCENE_CLOUD_AMBIENT_COLOR,
    SCENE_CLOUD_AMBIENT_INTENSITY,
  );
  ambient.name = "geo3d-scene-cloud-ambient";

  const key = new THREE.DirectionalLight(SCENE_CLOUD_KEY_COLOR, SCENE_CLOUD_KEY_INTENSITY);
  key.name = "geo3d-scene-cloud-key";
  key.position.set(0, span * KEY_LIGHT_Y_SCALE, span * KEY_LIGHT_Z_SCALE);

  group.add(ambient, key);

  return {
    group,
    dispose() {
      group.remove(ambient, key);
      ambient.dispose();
      key.dispose();
      group.parent?.remove(group);
    },
  };
}

export function removeGeo3dSceneCloudLights(scene: THREE.Scene): void {
  const existing = scene.getObjectByName(GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME);
  if (!existing) return;
  for (const child of [...existing.children]) {
    if (child instanceof THREE.Light) {
      child.dispose();
    }
  }
  scene.remove(existing);
}
