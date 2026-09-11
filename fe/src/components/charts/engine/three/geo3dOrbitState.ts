/** 看板内嵌 3D 地图：跨 React 重渲染保留用户 orbit 视角（避免重建后跳回默认机位） */
export const GEO3D_ORBIT_STATE_VERSION = 8;

export type Geo3dOrbitSnapshot = {
  v: number;
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
};

const orbitByInstance = new Map<string, Geo3dOrbitSnapshot>();

export function readGeo3dOrbitState(instanceKey: string | undefined): Geo3dOrbitSnapshot | null {
  if (!instanceKey) return null;
  const snapshot = orbitByInstance.get(instanceKey);
  if (!snapshot || snapshot.v !== GEO3D_ORBIT_STATE_VERSION) return null;
  return snapshot;
}

export function writeGeo3dOrbitState(
  instanceKey: string | undefined,
  snapshot: Geo3dOrbitSnapshot,
): void {
  if (!instanceKey) return;
  orbitByInstance.set(instanceKey, { ...snapshot, v: GEO3D_ORBIT_STATE_VERSION });
}

export function resetGeo3dOrbitStateForTests(): void {
  orbitByInstance.clear();
}

/** @internal vitest */
export function seedGeo3dOrbitStateForTests(
  instanceKey: string,
  snapshot: Geo3dOrbitSnapshot,
): void {
  orbitByInstance.set(instanceKey, snapshot);
}
