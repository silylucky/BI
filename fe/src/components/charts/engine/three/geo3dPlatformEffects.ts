import * as THREE from "three";
import type { ThreeGeoOrbitLayout } from "@/components/charts/engine/three/threeGeoOrbit";
import {
  applyPlatformRippleShader,
  createPlatformRippleUniforms,
  type PlatformRippleUniforms,
} from "@/components/charts/engine/three/geo3dPlatformRippleMaterial";
import {
  createPlatformSquareRippleMesh,
  createPlatformSquareRippleUniforms,
  type PlatformSquareRippleUniforms,
} from "@/components/charts/engine/three/geo3dPlatformSquareRippleMaterial";
import {
  createPlatformGlowMesh,
  createPlatformGridUniforms,
  createPlatformPulseMesh,
  createPlatformShaderUniforms,
  createPlatformSquareGridMesh,
  createPlatformSweepMesh,
  tickPlatformShaderUniforms,
  type PlatformShaderUniforms,
} from "@/components/charts/engine/three/geo3dPlatformShaderLayers";
import { getPlatformTextures } from "@/components/charts/engine/three/geo3dPlatformTexture";
import {
  DEFAULT_PLATFORM_SQUARE_GRID_CELLS,
  type ResolvedPlatformEffectsStyle,
} from "@/components/charts/engine/three/geo3dPlatformStyle";

export const GEO3D_PLATFORM_GROUP_NAME = "geo3d-platform-effects";

export type Geo3dPlatformEffectsHandle = {
  group: THREE.Group;
  update: (deltaSec: number) => void;
  patchVisual: (resolved: ResolvedPlatformEffectsStyle) => void;
  dispose: () => void;
};

type RingMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
type DisposableMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;

export function buildGeo3dPlatformEffects(
  layout: Pick<ThreeGeoOrbitLayout, "halfX" | "halfZ" | "minY">,
  resolved: ResolvedPlatformEffectsStyle,
): Geo3dPlatformEffectsHandle {
  const span = Math.max(layout.halfX, layout.halfZ, 4);
  const {
    colors,
    layers,
    ringOpacity,
    gridOpacity,
    rippleOpacity,
    glowOpacity,
    pulseOpacity,
    sweepOpacity,
    sizeScale,
    highlightOpacity,
    gridStyle,
    gridDensity,
    rippleSpeed,
    rippleFrequency,
    ringSpeed,
    pulseSpeed,
    sweepSpeed,
  } = resolved;
  const textures = getPlatformTextures();
  const group = new THREE.Group();
  group.name = GEO3D_PLATFORM_GROUP_NAME;
  group.rotation.x = -Math.PI / 2;
  group.position.y = layout.minY - span * 0.02;
  group.renderOrder = -10;

  const highlightSize = span * 3 * sizeScale;
  const ring1Size = span * 2.4 * sizeScale;
  const ring2Size = span * 2.25 * sizeScale;
  const gridSize = span * 28;
  const glowSize = span * 3.8 * sizeScale;
  const pulseSize = span * 3.2 * sizeScale;
  const sweepSize = span * 3.5 * sizeScale;
  const layerZ = span * 0.01;
  const ringZ = span * 0.02;
  const squareCells = DEFAULT_PLATFORM_SQUARE_GRID_CELLS * gridDensity;
  const isSquare = gridStyle === "square";

  const meshes: DisposableMesh[] = [];
  const shaderLayers: Array<{ kind: "glow" | "pulse" | "sweep"; uniforms: PlatformShaderUniforms }> = [];
  let ring1: RingMesh | null = null;
  let ring2: RingMesh | null = null;
  let highlightMesh: RingMesh | null = null;
  let gridMesh: RingMesh | null = null;
  let rippleMesh: RingMesh | null = null;
  let textureRippleUniforms: PlatformRippleUniforms | null = null;
  let squareRippleUniforms: PlatformSquareRippleUniforms | null = null;

  if (layers.grid && isSquare) {
    const squareGrid = createPlatformSquareGridMesh(
      gridSize,
      createPlatformGridUniforms(colors.grid, gridOpacity, squareCells),
    );
    squareGrid.position.z = layerZ;
    gridMesh = squareGrid;
    meshes.push(squareGrid);
  } else if (layers.grid) {
    const gridBase = new THREE.Mesh(
      new THREE.PlaneGeometry(gridSize, gridSize),
      new THREE.MeshBasicMaterial({
        map: textures.grid,
        alphaMap: textures.gridBlack,
        color: colors.grid,
        transparent: true,
        opacity: gridOpacity,
        depthWrite: false,
      }),
    );
    gridBase.position.z = layerZ;
    gridMesh = gridBase;
    meshes.push(gridBase);
  }

  if (layers.ripple && isSquare) {
    squareRippleUniforms = createPlatformSquareRippleUniforms(
      colors.grid,
      colors.ripple,
      rippleOpacity,
      squareCells,
      rippleSpeed,
      rippleFrequency,
    );
    const squareRipple = createPlatformSquareRippleMesh(gridSize, squareRippleUniforms);
    squareRipple.position.z = layerZ + span * 0.002;
    rippleMesh = squareRipple;
    meshes.push(squareRipple);
  } else if (layers.ripple) {
    textureRippleUniforms = createPlatformRippleUniforms(colors.ripple, rippleSpeed, rippleFrequency);
    const rippleGrid = new THREE.Mesh(
      new THREE.PlaneGeometry(gridSize, gridSize),
      new THREE.MeshBasicMaterial({
        map: textures.grid,
        alphaMap: textures.gridBlack,
        color: colors.ripple,
        transparent: true,
        opacity: rippleOpacity,
        depthWrite: false,
      }),
    );
    rippleGrid.position.z = layerZ + span * 0.002;
    applyPlatformRippleShader(rippleGrid.material, textureRippleUniforms);
    rippleMesh = rippleGrid;
    meshes.push(rippleGrid);
  }

  if (layers.glow) {
    const glowUniforms = createPlatformShaderUniforms(colors.glow, glowOpacity);
    const glow = createPlatformGlowMesh(glowSize, glowUniforms);
    glow.position.z = ringZ;
    shaderLayers.push({ kind: "glow", uniforms: glowUniforms });
    meshes.push(glow);
  }

  if (layers.pulse) {
    const pulseUniforms = createPlatformShaderUniforms(colors.pulse, pulseOpacity, pulseSpeed);
    const pulse = createPlatformPulseMesh(pulseSize, pulseUniforms);
    pulse.position.z = ringZ;
    shaderLayers.push({ kind: "pulse", uniforms: pulseUniforms });
    meshes.push(pulse);
  }

  if (layers.sweep) {
    const sweepUniforms = createPlatformShaderUniforms(colors.sweep, sweepOpacity, sweepSpeed);
    const sweep = createPlatformSweepMesh(sweepSize, sweepUniforms);
    sweep.position.z = ringZ + span * 0.005;
    shaderLayers.push({ kind: "sweep", uniforms: sweepUniforms });
    meshes.push(sweep);
  }

  if (layers.highlight) {
    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(highlightSize, highlightSize),
      new THREE.MeshBasicMaterial({
        map: textures.highlight,
        color: colors.highlight,
        transparent: true,
        opacity: highlightOpacity,
        depthWrite: false,
      }),
    );
    highlightMesh = highlight;
    meshes.push(highlight);
  }

  if (layers.rings) {
    ring1 = new THREE.Mesh(
      new THREE.PlaneGeometry(ring1Size, ring1Size),
      new THREE.MeshBasicMaterial({
        map: textures.rotationBorder1,
        color: colors.highlight,
        transparent: true,
        opacity: ringOpacity[0],
        depthWrite: false,
      }),
    );
    ring1.position.z = ringZ;
    ring2 = new THREE.Mesh(
      new THREE.PlaneGeometry(ring2Size, ring2Size),
      new THREE.MeshBasicMaterial({
        map: textures.rotationBorder2,
        color: colors.highlight,
        transparent: true,
        opacity: ringOpacity[1],
        depthWrite: false,
      }),
    );
    ring2.position.z = ringZ;
    meshes.push(ring1, ring2);
  }

  group.add(...meshes);

  const runtime = {
    ringSpeed,
    rippleSpeed,
    pulseSpeed,
    sweepSpeed,
    rippleFrequency,
  };

  return {
    group,
    update(deltaSec: number) {
      if (deltaSec <= 0) return;
      if (ring1) ring1.rotation.z += 0.001 * runtime.ringSpeed;
      if (ring2) ring2.rotation.z -= 0.004 * runtime.ringSpeed;
      if (textureRippleUniforms) {
        textureRippleUniforms.uTime.value += deltaSec * 5 * runtime.rippleSpeed;
      }
      if (squareRippleUniforms) {
        squareRippleUniforms.uTime.value += deltaSec * 5 * runtime.rippleSpeed;
      }
      for (const layer of shaderLayers) {
        tickPlatformShaderUniforms(layer.uniforms, deltaSec);
      }
    },
    patchVisual(next: ResolvedPlatformEffectsStyle) {
      runtime.ringSpeed = next.ringSpeed;
      runtime.rippleSpeed = next.rippleSpeed;
      runtime.pulseSpeed = next.pulseSpeed;
      runtime.sweepSpeed = next.sweepSpeed;
      runtime.rippleFrequency = next.rippleFrequency;
      if (ring1) {
        ring1.material.color.set(next.colors.highlight);
        ring1.material.opacity = next.ringOpacity[0];
      }
      if (ring2) {
        ring2.material.color.set(next.colors.highlight);
        ring2.material.opacity = next.ringOpacity[1];
      }
      if (highlightMesh) {
        highlightMesh.material.color.set(next.colors.highlight);
        highlightMesh.material.opacity = next.highlightOpacity;
      }
      if (gridMesh) {
        gridMesh.material.color.set(next.colors.grid);
        gridMesh.material.opacity = next.gridOpacity;
      }
      if (rippleMesh) {
        rippleMesh.material.color.set(next.colors.ripple);
        rippleMesh.material.opacity = next.rippleOpacity;
      }
      for (const layer of shaderLayers) {
        const { uniforms } = layer;
        if (layer.kind === "glow") {
          uniforms.uColor.value.set(next.colors.glow);
          uniforms.uOpacity.value = next.glowOpacity;
          uniforms.uSpeed.value = next.pulseSpeed;
        } else if (layer.kind === "pulse") {
          uniforms.uColor.value.set(next.colors.pulse);
          uniforms.uOpacity.value = next.pulseOpacity;
          uniforms.uSpeed.value = next.pulseSpeed;
        } else if (layer.kind === "sweep") {
          uniforms.uColor.value.set(next.colors.sweep);
          uniforms.uOpacity.value = next.sweepOpacity;
          uniforms.uSpeed.value = next.sweepSpeed;
        }
      }
    },
    dispose() {
      group.remove(...meshes);
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    },
  };
}

export function removeGeo3dPlatformEffects(scene: THREE.Scene): void {
  const existing = scene.getObjectByName(GEO3D_PLATFORM_GROUP_NAME);
  if (existing) scene.remove(existing);
}
