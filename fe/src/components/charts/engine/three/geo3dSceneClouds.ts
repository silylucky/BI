import * as THREE from "three";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";
import {
  resolveGeo3dSceneCloudOptions,
  type ResolvedSceneCloudOptions,
} from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import {
  buildCloudClusterInstances,
  updateCloudClusterMatrices,
  wrapClusterAxis,
  type CloudClusterRuntime,
} from "@/components/charts/engine/three/geo3dSceneCloudClusters";
import {
  removeGeo3dSceneCloudLights,
} from "@/components/charts/engine/three/geo3dSceneCloudLights";
import type { ChartGeo3dStyle } from "@/lib/chartDeStyle";

export const GEO3D_SCENE_CLOUDS_GROUP_NAME = "geo3d-scene-clouds";

/** 盛行风向：自西向东（地图 +X），略带偏北 */
const WIND_DIR = new THREE.Vector2(1, 0.08).normalize();

export type Geo3dSceneCloudsHandle = {
  group: THREE.Group;
  /** @param deltaSec 帧间隔秒数；camera 用于贴片朝向与距离淡出 */
  update: (deltaSec: number, camera?: THREE.Camera) => void;
  setSpeed: (speed: number) => void;
  dispose: () => void;
};

function resolveDriftRate(speed: number, span: number): number {
  return span * 0.012 * speed;
}

export function buildGeo3dSceneClouds(
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "maxY" | "defaultDistance">,
  geo3dStyle: ChartGeo3dStyle = {},
): Geo3dSceneCloudsHandle {
  return buildGeo3dSceneCloudsWithOptions(layout, resolveGeo3dSceneCloudOptions(geo3dStyle));
}

export function buildGeo3dSceneCloudsWithOptions(
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "maxY" | "defaultDistance">,
  options: ResolvedSceneCloudOptions,
): Geo3dSceneCloudsHandle {
  const group = new THREE.Group();
  group.name = GEO3D_SCENE_CLOUDS_GROUP_NAME;
  group.renderOrder = 20;

  const span = Math.max(layout.halfX, layout.halfZ, 4);
  const halfExtent = span * 1.25;
  const driftState = { rate: resolveDriftRate(options.speed, span) };
  const build = buildCloudClusterInstances(span, layout.maxY, options, layout.defaultDistance);
  const clusters: CloudClusterRuntime[] = build.clusters;
  group.add(build.instancedMesh);

  let elapsed = 0;

  return {
    group,
    update(deltaSec: number, camera?: THREE.Camera) {
      if (deltaSec > 0) {
        elapsed += deltaSec;
        const dx = WIND_DIR.x * driftState.rate * deltaSec;
        const dz = WIND_DIR.y * driftState.rate * deltaSec;
        for (const cluster of clusters) {
          const factor = cluster.speedFactor;
          cluster.centerX = wrapClusterAxis(cluster.centerX + dx * factor, halfExtent);
          cluster.centerZ = wrapClusterAxis(cluster.centerZ + dz * factor, halfExtent);
        }
        group.rotation.y = Math.cos(elapsed / 2) * 0.22;
        group.rotation.x = Math.sin(elapsed / 2) * 0.12;
      }
      if (camera) {
        group.updateMatrixWorld(true);
        updateCloudClusterMatrices(
          build.instancedMesh,
          clusters,
          build.puffs,
          build.opacities,
          camera,
        );
      }
    },
    setSpeed(speed: number) {
      driftState.rate = resolveDriftRate(speed, span);
    },
    dispose() {
      group.remove(build.instancedMesh);
      build.sharedGeometry.dispose();
      build.sharedMaterial.dispose();
      clusters.length = 0;
      build.puffs.length = 0;
    },
  };
}

export function removeGeo3dSceneClouds(scene: THREE.Scene): void {
  scene.fog = null;
  removeGeo3dSceneCloudLights(scene);
  const existing = scene.getObjectByName(GEO3D_SCENE_CLOUDS_GROUP_NAME);
  if (existing) scene.remove(existing);
}
