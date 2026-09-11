import * as THREE from "three";
import type { GeoSurfaceColors } from "@/components/charts/engine/three/geoToThreeShapes";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";

function drawPlotBackdropTexture(surface: GeoSurfaceColors): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.5;
  const grad = ctx.createRadialGradient(cx, cy * 0.92, r * 0.05, cx, cy, r);
  grad.addColorStop(0, surface.palette.plotBgCenter);
  grad.addColorStop(1, surface.palette.plotBgEdge);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 对标 2D map-plot-bg：径向渐变底衬，避免 3D 画布透明发空 */
export function mountThreeGeoPlotBackdrop(
  scene: THREE.Scene,
  layout: ThreeGeoOrbitLayout,
  surface: GeoSurfaceColors,
): () => void {
  const span = Math.max(layout.halfX, layout.halfZ) * 3.2;
  const texture = drawPlotBackdropTexture(surface);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(span, span), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = layout.minY - 0.08;
  plane.renderOrder = -2;
  scene.add(plane);

  return () => {
    texture.dispose();
    plane.geometry.dispose();
    mat.dispose();
    scene.remove(plane);
  };
}
