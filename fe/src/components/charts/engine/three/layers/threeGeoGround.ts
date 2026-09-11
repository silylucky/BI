import * as THREE from "three";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";

function drawInfiniteGroundTexture(isDark: boolean): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.5;

  const base = ctx.createRadialGradient(cx, cy, maxR * 0.04, cx, cy, maxR);
  if (isDark) {
    base.addColorStop(0, "#1a3a5c");
    base.addColorStop(0.22, "#0a1628");
    base.addColorStop(0.55, "#050d18");
    base.addColorStop(1, "#010409");
  } else {
    base.addColorStop(0, "#dbeafe");
    base.addColorStop(0.25, "#94a3b8");
    base.addColorStop(0.6, "#64748b");
    base.addColorStop(1, "#334155");
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const ringCount = 14;
  for (let i = 1; i <= ringCount; i += 1) {
    const t = i / ringCount;
    const r = maxR * 0.12 + t * maxR * 0.86;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDark
      ? `rgba(56, 189, 248, ${0.14 * (1 - t * 0.65)})`
      : `rgba(37, 99, 235, ${0.1 * (1 - t * 0.6)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const spokes = 24;
  for (let i = 0; i < spokes; i += 1) {
    const angle = (i / spokes) * Math.PI * 2;
    const inner = maxR * 0.1;
    const outer = maxR * 0.98;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = isDark ? "rgba(56, 189, 248, 0.06)" : "rgba(37, 99, 235, 0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** 大尺度地面 + 径向渐变与同心网格，营造纵深感（无场景雾） */
export function mountThreeGeoGround(
  scene: THREE.Scene,
  layout: ThreeGeoOrbitLayout,
  isDark: boolean,
): () => void {
  const span = Math.max(layout.halfX, layout.halfZ) * 14;
  const texture = drawInfiniteGroundTexture(isDark);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: isDark ? 0x88c4f0 : 0xffffff,
      metalness: 0.72,
      roughness: 0.22,
      emissive: isDark ? 0x0a1628 : 0x1e293b,
      emissiveIntensity: isDark ? 0.35 : 0.12,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = layout.minY - Math.max(layout.maxY * 0.08, 0.5);
  floor.receiveShadow = true;
  scene.add(floor);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 0.35, span * 0.35),
    new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x60a5fa,
      transparent: true,
      opacity: isDark ? 0.09 : 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = layout.minY - Math.max(layout.maxY * 0.06, 0.35);
  scene.add(glow);

  return () => {
    texture.dispose();
    floor.geometry.dispose();
    (floor.material as THREE.Material).dispose();
    glow.geometry.dispose();
    (glow.material as THREE.Material).dispose();
    scene.remove(floor, glow);
  };
}
