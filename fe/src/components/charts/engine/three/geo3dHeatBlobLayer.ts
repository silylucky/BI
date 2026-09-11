import * as THREE from "three";
import {
  bakeHeatCanvas,
  mapSamplesToCanvasPoints,
  resolveHeatBlobZScale,
  type ProjBoundsLike,
} from "@/components/charts/engine/three/geo3dHeatCanvas";
import {
  resolveHeatBlobValueRange,
  type HeatBlobSample,
} from "@/components/charts/engine/three/geo3dHeatSamples";
import type { ResolvedPointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";

/** 对标 sc-datav Demo1 heatmap.tsx */
const DEMO1_HEAT_CANVAS_SIZE = 500;
const DEMO1_HEAT_SEGMENTS = 300;

const HEAT_VERT = `
uniform float uZScale;
uniform sampler2D uGreyMap;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 grey = texture2D(uGreyMap, uv);
  float height = uZScale * grey.a;
  vec3 transformed = vec3(position.x, position.y, height);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}`;

const HEAT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uHeatMap;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity) * texture2D(uHeatMap, vUv);
}`;

export type Geo3dHeatBlobHandle = {
  mesh: THREE.Mesh;
  patchVisual: (style: ResolvedPointEffectsStyle) => void;
  dispose: () => void;
};

export function buildGeo3dHeatBlobLayer(
  samples: HeatBlobSample[],
  projBounds: ProjBoundsLike,
  capTopZ: number,
  minVal: number,
  maxVal: number,
  visualMapSpan: number,
  mapScale: number,
  style: ResolvedPointEffectsStyle,
): Geo3dHeatBlobHandle | null {
  if (!style.layers.heatBlob || samples.length === 0) return null;

  const { min: heatMin, max: heatMax } = resolveHeatBlobValueRange(samples, minVal, maxVal);

  const canvasPoints = mapSamplesToCanvasPoints(
    samples,
    projBounds,
    DEMO1_HEAT_CANVAS_SIZE,
    DEMO1_HEAT_CANVAS_SIZE,
    0,
  );

  const baked = bakeHeatCanvas({
    width: DEMO1_HEAT_CANVAS_SIZE,
    height: DEMO1_HEAT_CANVAS_SIZE,
    points: canvasPoints,
    minValue: heatMin,
    maxValue: heatMax,
    radius: style.heatBlobRadius,
    blur: style.heatBlobBlur,
  });

  const heatTexture = new THREE.CanvasTexture(baked.colorCanvas);
  heatTexture.needsUpdate = true;
  const greyTexture = new THREE.CanvasTexture(baked.greyCanvas);
  greyTexture.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uHeatMap: { value: heatTexture },
      uGreyMap: { value: greyTexture },
      uZScale: {
        value: resolveHeatBlobZScale(visualMapSpan, style.heatBlobLift, mapScale),
      },
      uColor: { value: new THREE.Color(style.heatBlobColor) },
      uOpacity: { value: style.heatBlobOpacity },
    },
    vertexShader: HEAT_VERT,
    fragmentShader: HEAT_FRAG,
  });

  const spanX = Math.max(projBounds.maxX - projBounds.minX, 0.5);
  const spanY = Math.max(projBounds.maxY - projBounds.minY, 0.5);
  const centerX = (projBounds.minX + projBounds.maxX) * 0.5;
  const centerY = (projBounds.minY + projBounds.maxY) * 0.5;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX, spanY, DEMO1_HEAT_SEGMENTS, DEMO1_HEAT_SEGMENTS),
    material,
  );
  mesh.position.set(centerX, centerY, capTopZ + 0.02);
  mesh.renderOrder = 20;
  mesh.name = "geo3d-heat-blob";

  return {
    mesh,
    patchVisual(nextStyle: ResolvedPointEffectsStyle) {
      material.uniforms.uColor.value.set(nextStyle.heatBlobColor);
      material.uniforms.uOpacity.value = nextStyle.heatBlobOpacity;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      heatTexture.dispose();
      greyTexture.dispose();
    },
  };
}
