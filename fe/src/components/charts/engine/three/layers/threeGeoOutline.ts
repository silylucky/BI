import * as THREE from "three";

export function attachGeoOutline(mesh: THREE.Mesh, isDark: boolean): () => void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 18);
  const material = new THREE.LineBasicMaterial({
    color: isDark ? 0x67e8f9 : 0x2563eb,
    transparent: true,
    opacity: 0.62,
  });
  const lines = new THREE.LineSegments(edges, material);
  mesh.add(lines);

  return () => {
    mesh.remove(lines);
    edges.dispose();
    material.dispose();
  };
}
