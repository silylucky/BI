import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGeo3dSceneClouds, buildGeo3dSceneCloudsWithOptions, GEO3D_SCENE_CLOUDS_GROUP_NAME } from "./geo3dSceneClouds";
import { DEFAULT_SCENE_CLOUD_DENSITY, resolveCloudVisualProfile } from "./geo3dSceneCloudStyle";
import { applyGeo3dSceneClouds, resolveGeo3dSceneClouds, resolveGeo3dVisualStyle } from "./geo3dVisualStyle";

describe("geo3dSceneClouds", () => {
  it("builds volumetric cloud clusters above the map", () => {
    const handle = buildGeo3dSceneClouds({
      halfX: 9,
      halfZ: 6,
      maxY: 1.2,
      defaultDistance: 20,
    });
    expect(handle.group.children.length).toBe(1);
    const instanced = handle.group.children[0] as THREE.InstancedMesh;
    expect(instanced).toBeInstanceOf(THREE.InstancedMesh);
    const material = instanced.material as THREE.MeshBasicMaterial;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.map).toBeTruthy();
    expect(material.opacity).toBeGreaterThan(0.1);
    const profile = resolveCloudVisualProfile(DEFAULT_SCENE_CLOUD_DENSITY);
    expect(instanced.count).toBe(profile.clusterCount * profile.puffPerCluster);
    handle.dispose();
  });

  it("applyGeo3dSceneClouds mounts clouds and clears linear fog", () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1, 10);
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech" }, true);
    const handle = applyGeo3dSceneClouds(
      scene,
      { halfX: 9, halfZ: 6, maxY: 1.2, defaultDistance: 20 },
      visual,
    );
    expect(handle).not.toBeNull();
    expect(scene.fog).toBeNull();
    expect(scene.children.some((child) => child.name === GEO3D_SCENE_CLOUDS_GROUP_NAME)).toBe(true);
    handle?.dispose();
  });

  it("drifts cluster centers along prevailing wind", () => {
    const handle = buildGeo3dSceneCloudsWithOptions(
      { halfX: 9, halfZ: 6, maxY: 1.2, defaultDistance: 20 },
      { density: 0.5, speed: 1, height: 1 },
    );
    const instanced = handle.group.children[0] as THREE.InstancedMesh;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const avgX = (mesh: THREE.InstancedMesh) => {
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      let sum = 0;
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        sum += pos.setFromMatrixPosition(matrix).x;
      }
      return sum / mesh.count;
    };
    handle.update(0, camera);
    const avgBefore = avgX(instanced);
    handle.update(3, camera);
    const avgAfter = avgX(instanced);
    expect(avgAfter).toBeGreaterThan(avgBefore);
    handle.dispose();
  });

  it("applyGeo3dSceneClouds removes clouds when disabled", () => {
    const scene = new THREE.Scene();
    const visual = resolveGeo3dVisualStyle({ stylePreset: "tech", sceneFog: false }, true);
    expect(resolveGeo3dSceneClouds({ stylePreset: "tech", sceneFog: false })).toBe(false);
    const handle = applyGeo3dSceneClouds(
      scene,
      { halfX: 9, halfZ: 6, maxY: 1.2, defaultDistance: 20 },
      visual,
    );
    expect(handle).toBeNull();
    expect(scene.children).toHaveLength(0);
  });
});
