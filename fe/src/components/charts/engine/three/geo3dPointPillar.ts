import * as THREE from "three";
import { getPointEffectTextures } from "@/components/charts/engine/three/geo3dPointTexture";
import type { ResolvedPointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

function buildPillarCoreMaterial(
  colorTop: THREE.Color,
  colorBottom: THREE.Color,
  barHeight: number,
  opacity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      uColor1: { value: colorTop },
      uColor2: { value: colorBottom },
      uSize: { value: barHeight },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uSize;
      uniform float uOpacity;
      void main() {
        float t = clamp(vPosition.z / max(uSize, 0.001), 0.0, 1.0);
        vec3 color = mix(uColor2, uColor1, t);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
  });
}

/** huiguang 贴图竖直光幕；每帧由 layer 绕 Z 轴朝向相机 */
function buildPillarHuiguangBeam(
  beamWidth: number,
  barHeight: number,
  color: THREE.Color,
  opacity: number,
): { mesh: THREE.Mesh; geometry: THREE.PlaneGeometry; material: THREE.MeshBasicMaterial } {
  const geometry = new THREE.PlaneGeometry(beamWidth, barHeight);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, barHeight * 0.5);
  const textures = getPointEffectTextures();
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    color,
    map: textures.glowSheet,
    alphaMap: textures.glowSheet,
    opacity,
    depthTest: false,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    alphaTest: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 14;
  return { mesh, geometry, material };
}

/** 水平 Billboard：保持竖直，绕 Z 轴朝向相机 */
export function resolveVerticalBillboardYaw(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
): number {
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  const dx = camPos.x - worldPos.x;
  const dy = camPos.y - worldPos.y;
  if (dx * dx + dy * dy < 1e-8) return 0;
  return Math.atan2(dy, dx) - Math.PI / 2;
}

export type Geo3dPointPillar = {
  group: THREE.Group;
  barHeight: number;
  beamMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  dispose: () => void;
};

export function buildGeo3dPointPillar(
  barHeight: number,
  style: ResolvedPointEffectsStyle,
  unit: number,
): Geo3dPointPillar {
  const textures = getPointEffectTextures();
  const colorTop = new THREE.Color(style.pointPillarColorTop);
  const colorBottom = new THREE.Color(style.pointPillarColorBottom);
  const factor = style.pointPillarHeightScale / 5;
  const coreWidth = Math.max(unit * 0.08, 0.02) * factor;
  const beamWidth = Math.max(unit * 2.8, 0.12) * factor;
  const group = new THREE.Group();

  const beam = buildPillarHuiguangBeam(
    beamWidth,
    barHeight,
    colorBottom,
    0.4 * style.pointPillarOpacity,
  );
  group.add(beam.mesh);

  const coreGeom = new THREE.BoxGeometry(coreWidth, coreWidth, barHeight);
  coreGeom.translate(0, 0, barHeight * 0.5);
  const coreMat = buildPillarCoreMaterial(
    colorTop,
    colorBottom,
    barHeight,
    style.pointPillarOpacity,
  );
  const core = new THREE.Mesh(coreGeom, coreMat);
  core.renderOrder = 15;
  group.add(core);

  const ringSize = Math.max(unit * style.pointPillarBaseRingScale, 0.05);
  const ringMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ringSize, ringSize),
    new THREE.MeshBasicMaterial({
      transparent: true,
      color: 0xffffff,
      map: textures.baseRing,
      alphaMap: textures.baseRing,
      opacity: style.pointPillarBaseRingOpacity,
      depthTest: false,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.05,
    }),
  );
  ringMesh.renderOrder = 13;
  group.add(ringMesh);

  return {
    group,
    barHeight,
    beamMesh: beam.mesh,
    ringMesh,
    dispose() {
      beam.geometry.dispose();
      beam.material.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      ringMesh.geometry.dispose();
      (ringMesh.material as THREE.Material).dispose();
    },
  };
}

export function patchGeo3dPointPillarVisual(
  pillar: Geo3dPointPillar,
  style: ResolvedPointEffectsStyle,
): void {
  const colorTop = new THREE.Color(style.pointPillarColorTop);
  const colorBottom = new THREE.Color(style.pointPillarColorBottom);
  const coreMat = pillar.group.children.find(
    (child) => child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial,
  );
  if (coreMat instanceof THREE.Mesh && coreMat.material instanceof THREE.ShaderMaterial) {
    coreMat.material.uniforms.uColor1.value.copy(colorTop);
    coreMat.material.uniforms.uColor2.value.copy(colorBottom);
    coreMat.material.uniforms.uOpacity.value = style.pointPillarOpacity;
  }
  const beamMat = pillar.beamMesh.material as THREE.MeshBasicMaterial;
  beamMat.color.copy(colorBottom);
  beamMat.opacity = 0.4 * style.pointPillarOpacity;
  const ringMat = pillar.ringMesh.material as THREE.MeshBasicMaterial;
  ringMat.opacity = style.pointPillarBaseRingOpacity;
}

export function resolvePillarHeight(
  valueT: number,
  unit: number,
  style: ResolvedPointEffectsStyle,
): number {
  const factor = style.pointPillarHeightScale / 5;
  const base = unit * (0.55 + valueT * 0.85);
  return base * factor;
}
