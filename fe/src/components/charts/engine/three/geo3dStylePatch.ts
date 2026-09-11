import * as THREE from "three";
import type { ChartGeo3dStyle, ChartGeoStyle } from "@/lib/chartDeStyle";
import { resolveGeoRegionBorder } from "@/components/charts/engine/geo/geoRegionBorderStyle";
import {
  buildGeo3dLayerStructureSigs,
  buildGeo3dStructureContentSig,
  buildGeo3dVisualContentSig,
} from "@/components/charts/engine/three/geo3dStyleContentSig";
import type { Geo3dPlatformEffectsHandle } from "@/components/charts/engine/three/geo3dPlatformEffects";
import type { Geo3dPointEffectsHandle } from "@/components/charts/engine/three/geo3dPointEffects";
import type { Geo3dSceneCloudsHandle } from "@/components/charts/engine/three/geo3dSceneClouds";
import { resolvePlatformEffectsStyle } from "@/components/charts/engine/three/geo3dPlatformStyle";
import { resolvePointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import { resolveGeo3dSceneCloudSpeed } from "@/components/charts/engine/three/geo3dSceneCloudStyle";
import {
  resolveGeo3dPlatformEffects,
  resolveGeo3dPointEffects,
  resolveGeo3dSceneClouds,
  resolveGeo3dShellOpacity,
  resolveGeo3dStylePreset,
  resolveGeo3dVisualStyle,
} from "@/components/charts/engine/three/geo3dVisualStyle";

export type Geo3dStylePatchTargets = {
  meshes: THREE.Object3D[];
  sceneClouds: Geo3dSceneCloudsHandle | null;
  platformEffects: Geo3dPlatformEffectsHandle | null;
  pointEffects: Geo3dPointEffectsHandle | null;
};

export type Geo3dStylePatchResult = "noop" | "patched" | "layer-rebuilt" | "full-rebuild";

function patchShellOpacity(meshes: THREE.Object3D[], opacity: number): void {
  for (const root of meshes) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.opacity = opacity;
          mat.transparent = opacity < 1;
          mat.needsUpdate = true;
        }
      }
    });
  }
}

function patchRegionBorders(
  meshes: THREE.Object3D[],
  geoStyle: ChartGeoStyle,
  isDark: boolean,
  preset: ReturnType<typeof resolveGeo3dStylePreset>,
): void {
  const regionBorder = resolveGeoRegionBorder(geoStyle, isDark, { preset });
  for (const root of meshes) {
    const group = root as THREE.Object3D & { userData: Record<string, unknown> };
    const borderLines = group.userData.borderLines as THREE.LineSegments | undefined;
    if (!borderLines) continue;
    group.userData.borderColor = regionBorder.colorHex;
    group.userData.borderOpacity = regionBorder.opacity;
    borderLines.visible = regionBorder.show;
    const mat = borderLines.material as THREE.LineBasicMaterial;
    mat.color.setHex(regionBorder.colorHex);
    mat.opacity = regionBorder.opacity;
  }
}

export function applyGeo3dVisualStylePatch(
  targets: Geo3dStylePatchTargets,
  geo3dStyle: ChartGeo3dStyle,
  geoStyle: ChartGeoStyle,
  isDark: boolean,
): void {
  const preset = resolveGeo3dStylePreset(geo3dStyle);
  patchShellOpacity(targets.meshes, resolveGeo3dShellOpacity(geo3dStyle));
  patchRegionBorders(targets.meshes, geoStyle, isDark, preset);

  if (targets.sceneClouds) {
    if (resolveGeo3dSceneClouds(geo3dStyle)) {
      targets.sceneClouds.setSpeed(resolveGeo3dSceneCloudSpeed(geo3dStyle));
    }
  }

  if (targets.platformEffects && resolveGeo3dPlatformEffects(geo3dStyle)) {
    const resolved = resolvePlatformEffectsStyle(geo3dStyle, preset, isDark, true);
    targets.platformEffects.patchVisual(resolved);
  }

  if (targets.pointEffects && resolveGeo3dPointEffects(geo3dStyle)) {
    const resolved = resolvePointEffectsStyle(geo3dStyle, preset, isDark, true);
    targets.pointEffects.patchVisual(resolved);
  }
}

export function compareGeo3dStyleUpdate(
  prevGeo3d: ChartGeo3dStyle,
  prevGeo: ChartGeoStyle,
  nextGeo3d: ChartGeo3dStyle,
  nextGeo: ChartGeoStyle,
): Geo3dStylePatchResult {
  const prevStructure = buildGeo3dStructureContentSig(prevGeo3d, prevGeo);
  const nextStructure = buildGeo3dStructureContentSig(nextGeo3d, nextGeo);
  if (prevStructure === nextStructure) {
    const prevVisual = buildGeo3dVisualContentSig(prevGeo3d, prevGeo);
    const nextVisual = buildGeo3dVisualContentSig(nextGeo3d, nextGeo);
    return prevVisual === nextVisual ? "noop" : "patched";
  }

  const prevLayers = buildGeo3dLayerStructureSigs(prevGeo3d, prevGeo);
  const nextLayers = buildGeo3dLayerStructureSigs(nextGeo3d, nextGeo);
  if (prevLayers.core !== nextLayers.core) return "full-rebuild";

  const decorChanged =
    prevLayers.cloud !== nextLayers.cloud ||
    prevLayers.platform !== nextLayers.platform ||
    prevLayers.point !== nextLayers.point;
  return decorChanged ? "layer-rebuilt" : "full-rebuild";
}

export function resolveGeo3dCapTintMixScale(
  geo3dStyle: ChartGeo3dStyle,
  isDark: boolean,
): number {
  const visualStyle = resolveGeo3dVisualStyle(geo3dStyle, isDark);
  const pointEffectsStyle = resolvePointEffectsStyle(
    geo3dStyle,
    visualStyle.preset,
    isDark,
    resolveGeo3dPointEffects(geo3dStyle),
  );
  const heatBlobActive =
    pointEffectsStyle.enabled && pointEffectsStyle.layers.heatBlob;
  return (
    visualStyle.capTintMixScale *
    (heatBlobActive ? pointEffectsStyle.heatBlobDimChoropleth : 1)
  );
}
