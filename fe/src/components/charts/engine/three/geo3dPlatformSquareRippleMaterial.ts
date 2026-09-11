import * as THREE from "three";
import { RIPPLE_SAMPLE_GLSL } from "@/components/charts/engine/three/geo3dPlatformRippleGlsl";

export type PlatformSquareRippleUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uFrequency: { value: number };
  uWidth: { value: number };
  uCells: { value: number };
  uGridColor: { value: THREE.Color };
  uRippleColor: { value: THREE.Color };
  uRippleOpacity: { value: number };
};

export function createPlatformSquareRippleUniforms(
  gridColor: THREE.ColorRepresentation,
  rippleColor: THREE.ColorRepresentation,
  rippleOpacity: number,
  cells: number,
  speed: number,
  frequency: number,
): PlatformSquareRippleUniforms {
  return {
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uFrequency: { value: frequency },
    uWidth: { value: 0.14 },
    uCells: { value: cells },
    uGridColor: { value: new THREE.Color(gridColor) },
    uRippleColor: { value: new THREE.Color(rippleColor) },
    uRippleOpacity: { value: rippleOpacity },
  };
}

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform float uTime;
uniform float uSpeed;
uniform float uFrequency;
uniform float uWidth;
uniform float uCells;
uniform vec3 uGridColor;
uniform vec3 uRippleColor;
uniform float uRippleOpacity;
varying vec2 vUv;
${RIPPLE_SAMPLE_GLSL}

float squareGridMask(vec2 uv, float cells) {
  vec2 coord = uv * cells;
  vec2 derivative = fwidth(coord);
  vec2 gridDist = abs(fract(coord - 0.5) - 0.5);
  float lineX = 1.0 - smoothstep(0.0, derivative.x * 0.75, gridDist.x);
  float lineY = 1.0 - smoothstep(0.0, derivative.y * 0.75, gridDist.y);
  return max(lineX, lineY);
}

void main() {
  float mask = squareGridMask(vUv, uCells);
  if (mask < 0.001) discard;

  float rDistance = length(vUv - 0.5) * 2.0;
  bool hit = false;
  vec3 outLight = uGridColor;
  float outAlpha = 0.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= uFrequency) break;
    float phase = fract(uTime * uSpeed * 0.05 + float(i) / max(uFrequency, 1.0));
    vec3 waveLight = outLight;
    float waveAlpha = 0.0;
    if (sampleRippleRing(rDistance, phase, uWidth, uGridColor, uRippleOpacity, uRippleColor, waveLight, waveAlpha)) {
      hit = true;
      outLight = waveLight;
      outAlpha = max(outAlpha, waveAlpha);
    }
  }
  if (!hit) discard;
  gl_FragColor = vec4(outLight, outAlpha * mask);
}`;

export function createPlatformSquareRippleMesh(
  size: number,
  uniforms: PlatformSquareRippleUniforms,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  material.customProgramCacheKey = () => "geo3d-platform-square-ripple-mask";
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.renderOrder = -9;
  return mesh;
}
