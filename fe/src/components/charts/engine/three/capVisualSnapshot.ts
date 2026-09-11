import * as THREE from "three";

export type CapVisualSnapshot = {
  color: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

export function snapshotCapVisual(
  cap: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
): CapVisualSnapshot {
  const snap: CapVisualSnapshot = { color: cap.color.clone() };
  if (cap instanceof THREE.MeshStandardMaterial) {
    snap.emissive = cap.emissive.clone();
    snap.emissiveIntensity = cap.emissiveIntensity;
  }
  return snap;
}

export function applyCapVisual(
  cap: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
  snap: CapVisualSnapshot,
): void {
  cap.color.copy(snap.color);
  if (cap instanceof THREE.MeshStandardMaterial) {
    if (snap.emissive) cap.emissive.copy(snap.emissive);
    if (snap.emissiveIntensity != null) cap.emissiveIntensity = snap.emissiveIntensity;
  }
}

export function applyCapHoverVisual(
  cap: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
  resting: CapVisualSnapshot,
  hoverTint: THREE.Color,
  isDark: boolean,
): void {
  cap.color.copy(hoverTint);
  if (cap instanceof THREE.MeshStandardMaterial) {
    cap.emissive.copy(resting.emissive ?? hoverTint);
    const base = resting.emissiveIntensity ?? 0;
    cap.emissiveIntensity = Math.min(1, base + (isDark ? 0.18 : 0.12));
  }
}
