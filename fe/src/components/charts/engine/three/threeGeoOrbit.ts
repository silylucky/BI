import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GEO_MAP_SCALE_LIMIT } from "@/components/charts/engine/geo/geoConstants";
import type { Geo3dOrbitSnapshot } from "@/components/charts/engine/three/geo3dOrbitState";
import { GEO3D_ORBIT_STATE_VERSION } from "@/components/charts/engine/three/geo3dOrbitState";

export type ThreeGeoOrbitLayout = {
  size: THREE.Vector3;
  defaultDistance: number;
  minDistance: number;
  maxDistance: number;
  halfX: number;
  halfZ: number;
  maxY: number;
  minY: number;
  target: THREE.Vector3;
};

const GEO_MAP_TARGET_SPAN = 18;
/** 正北朝上：相机置于地图北侧（+Z），朝南俯视 */
export const GEO_DEFAULT_AZIMUTH = 0;
/** 相对水平面抬升 60°（OrbitControls 极角 = 90° - 60°） */
export const GEO_DEFAULT_TILT_DEG = 60;
export const GEO_DEFAULT_POLAR = Math.PI / 2 - (GEO_DEFAULT_TILT_DEG * Math.PI) / 180;

export function computeGeoOrbitDefaultDistance(
  camera: THREE.PerspectiveCamera,
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "defaultDistance">,
): number {
  const vFovRad = (camera.fov * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
  const distForHeight = layout.halfZ / Math.tan(vFovRad / 2);
  const distForWidth = layout.halfX / Math.tan(hFovRad / 2);
  return Math.max(distForHeight, distForWidth, layout.defaultDistance * 0.85) * 1.12;
}

/** 仅用挤出本体几何算包围盒，忽略边线子节点 */
function boundsFromMapMeshes(mapGroup: THREE.Group): THREE.Box3 {
  const box = new THREE.Box3();
  let hasMesh = false;
  mapGroup.traverse((obj) => {
    if (obj.type !== "Mesh") return;
    const mesh = obj as THREE.Mesh;
    const geom = mesh.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingBox) return;
    const meshBox = geom.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if (!hasMesh) {
      box.copy(meshBox);
      hasMesh = true;
    } else {
      box.union(meshBox);
    }
  });
  if (!hasMesh) box.setFromObject(mapGroup);
  return box;
}

export type ThreeGeoOrbitLayoutOptions = {
  /** 投影阶段已按 D3 layoutCenter 对齐原点时，跳过二次 bbox 居中 */
  preCentered?: boolean;
};

/** 将挤出地图躺平（XZ 平面）、居中并缩放到可 orbit 的合理尺度 */
export function layoutThreeGeoMapGroup(
  mapGroup: THREE.Group,
  options: ThreeGeoOrbitLayoutOptions = {},
): ThreeGeoOrbitLayout {
  mapGroup.rotation.x = -Math.PI / 2;
  mapGroup.updateMatrixWorld(true);

  const box = boundsFromMapMeshes(mapGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  if (!options.preCentered) {
    mapGroup.position.sub(center);
    mapGroup.updateMatrixWorld(true);
  }

  let halfX = Math.max(size.x * 0.5, 0.5);
  let halfZ = Math.max(size.z * 0.5, 0.5);
  const span = Math.max(halfX, halfZ);
  const normalize = span > 0 ? (GEO_MAP_TARGET_SPAN / span) * 0.5 : 0.5;
  mapGroup.scale.multiplyScalar(normalize);
  mapGroup.updateMatrixWorld(true);

  const scaledBox = boundsFromMapMeshes(mapGroup);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  if (scaledCenter.lengthSq() > 1e-8) {
    mapGroup.position.sub(scaledCenter);
    mapGroup.updateMatrixWorld(true);
  }

  const fittedBox = boundsFromMapMeshes(mapGroup);
  const fittedSize = fittedBox.getSize(new THREE.Vector3());
  halfX = Math.max(fittedSize.x * 0.5, 0.5);
  halfZ = Math.max(fittedSize.z * 0.5, 0.5);
  const halfY = Math.max(fittedSize.y * 0.5, 0.08);
  const radius = Math.max(halfX, halfZ);
  const defaultDistance = Math.max(radius * 2.35, 14);

  return {
    size: fittedSize,
    defaultDistance,
    minDistance: defaultDistance / GEO_MAP_SCALE_LIMIT.max,
    maxDistance: defaultDistance / GEO_MAP_SCALE_LIMIT.min,
    halfX,
    halfZ,
    maxY: halfY,
    minY: -halfY,
    target: new THREE.Vector3(0, 0, 0),
  };
}

/** sc-datav Demo1/Demo2：缩放到 ~16 单位，雾效与相机可复用 */
export function layoutDatavMapGroup(mapGroup: THREE.Group): ThreeGeoOrbitLayout {
  mapGroup.rotation.x = -Math.PI / 2;
  mapGroup.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(mapGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  mapGroup.position.sub(center);
  mapGroup.updateMatrixWorld(true);

  let halfX = Math.max(size.x * 0.5, 0.5);
  let halfZ = Math.max(size.z * 0.5, 0.5);
  let maxY = Math.max(size.y, 0.2);

  const targetSpan = 16;
  const span = Math.max(halfX, halfZ);
  const normalize = span > 0 ? (targetSpan / span) * 0.5 : 0.5;
  mapGroup.scale.multiplyScalar(normalize);
  mapGroup.position.y = 0.2;
  mapGroup.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(mapGroup);
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  halfX = Math.max(scaledSize.x * 0.5, 0.5);
  halfZ = Math.max(scaledSize.z * 0.5, 0.5);
  const halfY = Math.max(scaledSize.y * 0.5, 0.1);

  return {
    size: scaledSize,
    defaultDistance: 18,
    minDistance: 8,
    maxDistance: 24,
    halfX,
    halfZ,
    maxY: halfY,
    minY: -halfY,
    target: new THREE.Vector3(0, 0, 0),
  };
}

export type ThreeGeoOrbitControlOptions = {
  /** roam 时开启阻尼；须配合持续 RAF 的 controls.update() */
  enableDamping?: boolean;
};

export function configureThreeGeoOrbitControls(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  layout: ThreeGeoOrbitLayout,
  roam: boolean,
  options: ThreeGeoOrbitControlOptions = {},
): () => void {
  const enableDamping = options.enableDamping ?? true;
  controls.target.copy(layout.target);
  controls.screenSpacePanning = false;
  controls.enableDamping = enableDamping;
  controls.dampingFactor = enableDamping ? 0.08 : 0;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.minDistance = layout.minDistance;
  controls.maxDistance = layout.maxDistance;
  controls.enablePan = roam;
  controls.enableZoom = roam;
  controls.enableRotate = roam;

  const azimuth = GEO_DEFAULT_AZIMUTH;
  const polar = GEO_DEFAULT_POLAR;
  const d = computeGeoOrbitDefaultDistance(camera, layout);
  const { target } = layout;
  camera.position.set(
    target.x + d * Math.sin(polar) * Math.sin(azimuth),
    target.y + d * Math.cos(polar),
    target.z + d * Math.sin(polar) * Math.cos(azimuth),
  );
  camera.lookAt(target);

  controls.update();

  return () => undefined;
}

export function resetThreeGeoOrbitView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  layout: ThreeGeoOrbitLayout,
): void {
  controls.target.copy(layout.target);
  const azimuth = GEO_DEFAULT_AZIMUTH;
  const polar = GEO_DEFAULT_POLAR;
  const d = computeGeoOrbitDefaultDistance(camera, layout);
  const { target } = layout;
  camera.position.set(
    target.x + d * Math.sin(polar) * Math.sin(azimuth),
    target.y + d * Math.cos(polar),
    target.z + d * Math.sin(polar) * Math.cos(azimuth),
  );
  camera.lookAt(target);
  controls.update();
}

export function applyGeo3dOrbitSnapshot(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  snapshot: Geo3dOrbitSnapshot,
): void {
  controls.target.set(snapshot.target.x, snapshot.target.y, snapshot.target.z);
  camera.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  camera.lookAt(controls.target);
  controls.update();
}

export function captureGeo3dOrbitSnapshot(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): Geo3dOrbitSnapshot {
  return {
    v: GEO3D_ORBIT_STATE_VERSION,
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
  };
}
