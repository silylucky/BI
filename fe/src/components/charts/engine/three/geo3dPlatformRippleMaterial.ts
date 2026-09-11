import * as THREE from "three";

const OPAQUE_FRAGMENT =
  parseInt(THREE.REVISION.replace(/\D+/g, ""), 10) >= 154 ? "opaque_fragment" : "output_fragment";

export type PlatformRippleUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uFrequency: { value: number };
  uWidth: { value: number };
  uColor: { value: THREE.Color };
};

export function createPlatformRippleUniforms(
  color: THREE.ColorRepresentation,
  speed = 1,
  frequency = 1,
): PlatformRippleUniforms {
  return {
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uFrequency: { value: frequency },
    uWidth: { value: 0.14 },
    uColor: { value: new THREE.Color(color) },
  };
}

import { RIPPLE_SAMPLE_GLSL } from "@/components/charts/engine/three/geo3dPlatformRippleGlsl";

/** 扩散涟漪：UV 归一化半径；支持频率（多道波） */
export function applyPlatformRippleShader(
  material: THREE.MeshBasicMaterial,
  uniforms: PlatformRippleUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ...uniforms };
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `varying vec2 vRippleUv;
void main() {
  vRippleUv = uv;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform float uTime;
uniform float uSpeed;
uniform float uFrequency;
uniform float uWidth;
uniform vec3 uColor;
varying vec2 vRippleUv;
${RIPPLE_SAMPLE_GLSL}
void main() {`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <${OPAQUE_FRAGMENT}>`,
      `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
float rDistance = length(vRippleUv - 0.5) * 2.0;
bool hit = false;
vec3 outLight = outgoingLight;
float outAlpha = 0.0;
for (int i = 0; i < 5; i++) {
  if (float(i) >= uFrequency) break;
  float phase = fract(uTime * uSpeed * 0.05 + float(i) / max(uFrequency, 1.0));
  vec3 waveLight = outLight;
  float waveAlpha = 0.0;
  if (sampleRippleRing(rDistance, phase, uWidth, outgoingLight, diffuseColor.a, uColor, waveLight, waveAlpha)) {
    hit = true;
    outLight = waveLight;
    outAlpha = max(outAlpha, waveAlpha);
  }
}
if (!hit) {
  gl_FragColor = vec4(outgoingLight, 0.0);
} else {
  gl_FragColor = vec4(outLight, outAlpha);
}`,
    );
  };
  material.customProgramCacheKey = () => "geo3d-platform-ripple-uv-freq";
}
