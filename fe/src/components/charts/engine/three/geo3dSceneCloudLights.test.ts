import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildGeo3dSceneCloudLights,
  GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME,
  removeGeo3dSceneCloudLights,
  SCENE_CLOUD_AMBIENT_INTENSITY,
  SCENE_CLOUD_KEY_COLOR,
  SCENE_CLOUD_KEY_INTENSITY,
} from "./geo3dSceneCloudLights";

describe("geo3dSceneCloudLights", () => {
  it("builds ambient and warm directional lights scaled to map span", () => {
    const handle = buildGeo3dSceneCloudLights({ halfX: 9, halfZ: 6 });
    expect(handle.group.name).toBe(GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME);
    expect(handle.group.children).toHaveLength(2);

    const ambient = handle.group.children.find(
      (child) => child instanceof THREE.AmbientLight,
    ) as THREE.AmbientLight;
    const key = handle.group.children.find(
      (child) => child instanceof THREE.DirectionalLight,
    ) as THREE.DirectionalLight;

    expect(ambient.intensity).toBe(SCENE_CLOUD_AMBIENT_INTENSITY);
    expect(key.intensity).toBe(SCENE_CLOUD_KEY_INTENSITY);
    expect(key.color.getHex()).toBe(SCENE_CLOUD_KEY_COLOR);
    expect(key.position.y).toBe(36);
    expect(key.position.z).toBeCloseTo(3.6);

    handle.dispose();
  });

  it("removeGeo3dSceneCloudLights clears lights from scene", () => {
    const scene = new THREE.Scene();
    const handle = buildGeo3dSceneCloudLights({ halfX: 10, halfZ: 10 });
    scene.add(handle.group);
    expect(scene.getObjectByName(GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME)).toBeTruthy();

    removeGeo3dSceneCloudLights(scene);
    expect(scene.getObjectByName(GEO3D_SCENE_CLOUD_LIGHTS_GROUP_NAME)).toBeUndefined();
    expect(scene.children).toHaveLength(0);
  });
});
