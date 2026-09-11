import * as THREE from "three";
import {
  resolveCloudVisualProfile,
  type ResolvedSceneCloudOptions,
} from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import { createCloudPuffMaterial } from "@/components/charts/engine/three/geo3dSceneCloudPuffMaterial";
import {
  getSceneCloudTexture,
  resolveSceneCloudPlaneSize,
} from "@/components/charts/engine/three/geo3dSceneCloudTexture";

export type CloudClusterRuntime = {
  index: number;
  centerX: number;
  centerZ: number;
  baseY: number;
  speedFactor: number;
  puffIndices: number[];
};

export type CloudPuffRuntime = {
  index: number;
  clusterIndex: number;
  localOffset: THREE.Vector3;
  volume: number;
  baseOpacity: number;
  fade: number;
  rotation: number;
  rotationFactor: number;
};

export type CloudClusterBuildResult = {
  instancedMesh: THREE.InstancedMesh;
  clusters: CloudClusterRuntime[];
  puffs: CloudPuffRuntime[];
  opacities: Float32Array;
  sharedGeometry: THREE.PlaneGeometry;
  sharedMaterial: THREE.MeshBasicMaterial;
  fadeDistance: number;
};

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 0.17) * 43758.5453;
  return x - Math.floor(x);
}

function distributePuffInCluster(
  seed: number,
  bounds: THREE.Vector3,
  volume: number,
  smallestVolume: number,
): { offset: THREE.Vector3; puffVolume: number } {
  let s = seed;
  const rand = () => {
    s += 1;
    return seededUnit(s);
  };
  const offset = new THREE.Vector3(
    (rand() * 2 - 1) * bounds.x,
    (rand() * 2 - 1) * bounds.y,
    (rand() * 2 - 1) * bounds.z,
  );
  const xDiff = Math.abs(offset.x);
  const yDiff = Math.abs(offset.y);
  const zDiff = Math.abs(offset.z);
  const maxDiff = Math.max(xDiff, yDiff, zDiff);
  let length = 1;
  if (xDiff === maxDiff) length -= xDiff / bounds.x;
  if (yDiff === maxDiff) length -= yDiff / bounds.y;
  if (zDiff === maxDiff) length -= zDiff / bounds.z;
  const volFactor = Math.max(smallestVolume, length);
  return { offset, puffVolume: volFactor * volume };
}

export function buildCloudClusterInstances(
  span: number,
  maxY: number,
  options: ResolvedSceneCloudOptions,
  defaultDistance: number,
): CloudClusterBuildResult {
  const profile = resolveCloudVisualProfile(options.density);
  const clusterCount = profile.clusterCount;
  const puffPerCluster = profile.puffPerCluster;
  const puffTotal = clusterCount * puffPerCluster;
  const texture = getSceneCloudTexture();
  const plane = resolveSceneCloudPlaneSize(texture);
  const sharedGeometry = new THREE.PlaneGeometry(plane.width, plane.height);
  sharedGeometry.setAttribute(
    "cloudOpacity",
    new THREE.InstancedBufferAttribute(new Float32Array(puffTotal), 1),
  );

  const baseOpacity = profile.puffOpacity;
  const sharedMaterial = createCloudPuffMaterial({ opacity: baseOpacity });
  const instancedMesh = new THREE.InstancedMesh(sharedGeometry, sharedMaterial, puffTotal);
  instancedMesh.name = "geo3d-cloud-puffs";
  instancedMesh.renderOrder = 20;
  instancedMesh.frustumCulled = false;
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const opacities = new Float32Array(puffTotal);
  const opacityAttr = sharedGeometry.getAttribute("cloudOpacity") as THREE.InstancedBufferAttribute;
  const clusters: CloudClusterRuntime[] = [];
  const puffs: CloudPuffRuntime[] = [];
  const spread = span * profile.spreadScale;
  const fadeDistance = Math.max(span * 2.5, defaultDistance * 0.65);
  let puffIndex = 0;

  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    const seed = clusterIndex + 1;
    const centerX = (seededUnit(seed * 1.7) - 0.5) * spread;
    const centerZ = (seededUnit(seed * 2.3) - 0.5) * spread;
    const heightT = seededUnit(seed * 3.1);
    const baseY = maxY + span * (0.12 + heightT * 0.18) * options.height;
    const bounds = new THREE.Vector3(
      span * 0.42 * profile.boundsScale,
      span * 0.09 * profile.boundsScale,
      span * 0.22 * profile.boundsScale,
    );
    const volume = span * profile.volumeScale;
    const puffIndices: number[] = [];

    for (let puff = 0; puff < puffPerCluster; puff += 1) {
      const puffSeed = seed * 17 + puff * 5.3;
      const { offset, puffVolume } = distributePuffInCluster(
        puffSeed,
        bounds,
        volume,
        profile.smallestVolume,
      );
      puffIndices.push(puffIndex);
      puffs.push({
        index: puffIndex,
        clusterIndex,
        localOffset: offset,
        volume: puffVolume,
        baseOpacity,
        fade: fadeDistance,
        rotation: puff * (Math.PI / puffPerCluster),
        rotationFactor: 0,
      });
      opacities[puffIndex] = baseOpacity;
      puffIndex += 1;
    }

    clusters.push({
      index: clusterIndex,
      centerX,
      centerZ,
      baseY,
      speedFactor: 0.55 + heightT * 0.65,
      puffIndices,
    });
  }

  opacityAttr.array = opacities;
  opacityAttr.needsUpdate = true;
  instancedMesh.count = puffTotal;

  return {
    instancedMesh,
    clusters,
    puffs,
    opacities,
    sharedGeometry,
    sharedMaterial,
    fadeDistance,
  };
}

const parentMatrix = new THREE.Matrix4();
const translation = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const cpos = new THREE.Vector3();
const cquat = new THREE.Quaternion();
const cscale = new THREE.Vector3();
const puffScale = new THREE.Vector3();
const matrix = new THREE.Matrix4();

export function updateCloudClusterMatrices(
  instancedMesh: THREE.InstancedMesh,
  clusters: CloudClusterRuntime[],
  puffs: CloudPuffRuntime[],
  opacities: Float32Array,
  camera: THREE.Camera,
): void {
  parentMatrix.copy(instancedMesh.matrixWorld).invert();
  camera.matrixWorld.decompose(cpos, cquat, cscale);

  const sorted = [...puffs].sort((a, b) => {
    const clusterA = clusters[a.clusterIndex]!;
    const clusterB = clusters[b.clusterIndex]!;
    const distA = Math.hypot(
      clusterA.centerX + a.localOffset.x - cpos.x,
      clusterA.baseY + a.localOffset.y - cpos.y,
      clusterA.centerZ + a.localOffset.z - cpos.z,
    );
    const distB = Math.hypot(
      clusterB.centerX + b.localOffset.x - cpos.x,
      clusterB.baseY + b.localOffset.y - cpos.y,
      clusterB.centerZ + b.localOffset.z - cpos.z,
    );
    return distB - distA;
  });

  const opacityAttr = instancedMesh.geometry.getAttribute(
    "cloudOpacity",
  ) as THREE.InstancedBufferAttribute;

  for (let drawIndex = 0; drawIndex < sorted.length; drawIndex += 1) {
    const puff = sorted[drawIndex]!;
    const cluster = clusters[puff.clusterIndex]!;
    translation.set(
      cluster.centerX + puff.localOffset.x,
      cluster.baseY + puff.localOffset.y,
      cluster.centerZ + puff.localOffset.z,
    );
    rotation.copy(cquat);
    puffScale.setScalar(puff.volume);
    matrix.compose(translation, rotation, puffScale).premultiply(parentMatrix);
    instancedMesh.setMatrixAt(drawIndex, matrix);

    const dist = translation.distanceTo(cpos);
    const fade = puff.fade;
    opacities[drawIndex] =
      puff.baseOpacity * (dist < fade - 1 ? dist / fade : 1);
  }

  opacityAttr.array = opacities;
  opacityAttr.needsUpdate = true;
  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.count = sorted.length;
}

export function wrapClusterAxis(value: number, halfExtent: number): number {
  const span = halfExtent * 2;
  if (value > halfExtent) return value - span;
  if (value < -halfExtent) return value + span;
  return value;
}
