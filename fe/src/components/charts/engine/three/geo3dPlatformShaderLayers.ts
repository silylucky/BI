import * as THREE from "three";

export type PlatformGridUniforms = {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uCells: { value: number };
};

export function createPlatformGridUniforms(
  color: THREE.ColorRepresentation,
  opacity: number,
  cells: number,
): PlatformGridUniforms {
  return {
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    uCells: { value: cells },
  };
}

export type PlatformShaderUniforms = {
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uSpeed: { value: number };
};

export function createPlatformShaderUniforms(
  color: THREE.ColorRepresentation,
  opacity: number,
  speed = 1,
): PlatformShaderUniforms {
  return {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    uSpeed: { value: speed },
  };
}

const RADIAL_GLOW_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = smoothstep(0.55, 0.0, d);
  float halo = smoothstep(1.0, 0.35, d) * 0.45;
  float alpha = (core + halo) * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`;

const PULSE_FRAG = `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float wave = 0.0;
  for (int i = 0; i < 3; i++) {
    float phase = fract(uTime * uSpeed * 0.18 + float(i) * 0.34);
    float ring = smoothstep(0.035, 0.0, abs(d - phase * 0.95));
    wave += ring * (1.0 - phase) * 0.85;
  }
  float fade = smoothstep(1.05, 0.15, d);
  float alpha = wave * fade * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`;

const SWEEP_FRAG = `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p) * 2.0;
  float angle = atan(p.y, p.x);
  float sweep = fract(uTime * uSpeed * 0.22);
  float beam = 1.0 - smoothstep(0.0, 0.22, abs(fract((angle / 6.2831853) + 0.5 - sweep) - 0.5));
  float radial = smoothstep(1.0, 0.12, radius);
  float alpha = beam * radial * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`;

const SQUARE_GRID_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uCells;
varying vec2 vUv;
void main() {
  vec2 coord = vUv * uCells;
  vec2 derivative = fwidth(coord);
  vec2 gridDist = abs(fract(coord - 0.5) - 0.5);
  float lineX = 1.0 - smoothstep(0.0, derivative.x * 0.75, gridDist.x);
  float lineY = 1.0 - smoothstep(0.0, derivative.y * 0.75, gridDist.y);
  float alpha = max(lineX, lineY) * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}`;

const SHADER_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function createShaderPlane(
  size: number,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  cacheKey: string,
  blending: THREE.Blending = THREE.AdditiveBlending,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SHADER_VERT,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending,
  });
  material.customProgramCacheKey = () => cacheKey;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.renderOrder = -10;
  return mesh;
}

export function createPlatformSquareGridMesh(
  size: number,
  uniforms: PlatformGridUniforms,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  return createShaderPlane(size, SQUARE_GRID_FRAG, uniforms, "geo3d-platform-square-grid", THREE.NormalBlending);
}

export function createPlatformGlowMesh(
  size: number,
  uniforms: PlatformShaderUniforms,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  return createShaderPlane(size, RADIAL_GLOW_FRAG, uniforms, "geo3d-platform-glow");
}

export function createPlatformPulseMesh(
  size: number,
  uniforms: PlatformShaderUniforms,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  return createShaderPlane(size, PULSE_FRAG, uniforms, "geo3d-platform-pulse");
}

export function createPlatformSweepMesh(
  size: number,
  uniforms: PlatformShaderUniforms,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  return createShaderPlane(size, SWEEP_FRAG, uniforms, "geo3d-platform-sweep");
}

export function tickPlatformShaderUniforms(
  uniforms: PlatformShaderUniforms,
  deltaSec: number,
): void {
  uniforms.uTime.value += deltaSec;
}
