import * as THREE from "three";
import type { JoinedMapFeature, RegionPointSample } from "@/components/charts/engine/three/geo3dRegionCentroid";
import {
  buildRegionPointSamples,
  resolveRegionCapAnchorWorld,
  resolvePillarTopWorld,
} from "@/components/charts/engine/three/geo3dRegionCentroid";
import type { HeatBlobSample } from "@/components/charts/engine/three/geo3dHeatSamples";
import type { ProjBoundsLike } from "@/components/charts/engine/three/geo3dHeatCanvas";
import {
  buildGeo3dHeatBlobLayer,
  type Geo3dHeatBlobHandle,
} from "@/components/charts/engine/three/geo3dHeatBlobLayer";
import {
  buildGeo3dPointPillarLayer,
  type Geo3dPointPillarLayerHandle,
} from "@/components/charts/engine/three/geo3dPointPillarLayer";
import {
  buildGeo3dFloatingLabels,
  type Geo3dFloatingLabelsHandle,
} from "@/components/charts/engine/three/geo3dFloatingLabels";
import type { ResolvedPointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import { resolveGeoCapTopZ } from "@/components/charts/engine/three/buildGeoFlatPlateMesh";
import { resolvePointEffectSizing, type OrbitLayoutSpan } from "@/components/charts/engine/three/geo3dPointEffectScale";

export const GEO3D_POINT_EFFECTS_GROUP_NAME = "geo3d-point-effects";

export type Geo3dPointEffectsHandle = {
  group: THREE.Group;
  samples: RegionPointSample[];
  pillarLayer: Geo3dPointPillarLayerHandle | null;
  heatBlob: Geo3dHeatBlobHandle | null;
  floatingLabels: Geo3dFloatingLabelsHandle | null;
  pillarHeights: Map<string, number>;
  update: (deltaSec: number, reducedMotion: boolean, camera?: THREE.Camera) => void;
  patchVisual: (style: ResolvedPointEffectsStyle) => void;
  syncLabels: (
    camera: THREE.Camera,
    domElement: HTMLElement,
    container: HTMLElement,
  ) => void;
  dispose: () => void;
};

type BuildGeo3dPointEffectsInput = {
  container: HTMLElement;
  domElement: HTMLElement;
  mapGroup: THREE.Group;
  meshes: THREE.Object3D[];
  heatBlobSamples: HeatBlobSample[];
  features: JoinedMapFeature[];
  project: (coord: [number, number]) => [number, number] | null;
  projBounds: ProjBoundsLike;
  minVal: number;
  maxVal: number;
  plateDepth: number;
  terrainCap: boolean;
  layout: OrbitLayoutSpan;
  style: ResolvedPointEffectsStyle;
};

export function buildGeo3dPointEffects(input: BuildGeo3dPointEffectsInput): Geo3dPointEffectsHandle | null {
  const {
    container,
    domElement,
    mapGroup,
    meshes,
    heatBlobSamples,
    features,
    project,
    projBounds,
    minVal,
    maxVal,
    plateDepth,
    terrainCap,
    layout,
    style,
  } = input;
  if (!style.enabled || !Object.values(style.layers).some(Boolean)) return null;

  const samples = buildRegionPointSamples(features, project, minVal, maxVal);
  if (samples.length === 0) return null;

  const capTopZ = resolveGeoCapTopZ(plateDepth, terrainCap);
  const sizing = resolvePointEffectSizing(mapGroup, layout);

  const group = new THREE.Group();
  group.name = GEO3D_POINT_EFFECTS_GROUP_NAME;

  const heatBlob = style.layers.heatBlob
    ? buildGeo3dHeatBlobLayer(
        heatBlobSamples,
        projBounds,
        capTopZ,
        minVal,
        maxVal,
        sizing.visualMapSpan,
        sizing.mapScale,
        style,
      )
    : null;
  if (heatBlob) group.add(heatBlob.mesh);

  const pillarLayer = buildGeo3dPointPillarLayer(samples, meshes, capTopZ, sizing.effectUnit, style);
  if (pillarLayer) group.add(pillarLayer.group);

  const pillarHeights = new Map<string, number>();
  if (pillarLayer) {
    for (const entry of pillarLayer.pillars) {
      pillarHeights.set(entry.name, entry.pillar.barHeight);
    }
  }

  const sampleByName = new Map(samples.map((sample) => [sample.name, sample]));
  const pillarByName = new Map(
    pillarLayer?.pillars.map((entry) => [entry.name, entry.pillar]) ?? [],
  );
  const anchorWorld = new THREE.Vector3();

  const floatingLabels = buildGeo3dFloatingLabels(container, samples, style);
  mapGroup.add(group);

  const resolveAnchorWorld = (name: string): THREE.Vector3 | null => {
    const pillar = pillarByName.get(name);
    if (pillar) {
      return resolvePillarTopWorld(
        pillar.group,
        pillar.barHeight,
        style.floatingLabelOffset,
        anchorWorld,
      );
    }
    return resolveRegionCapAnchorWorld(
      meshes,
      name,
      mapGroup,
      capTopZ,
      style.floatingLabelOffset,
      anchorWorld,
      sampleByName.get(name)?.adcode,
    );
  };

  return {
    group,
    samples,
    pillarLayer,
    heatBlob,
    floatingLabels,
    pillarHeights,
    update(deltaSec, reducedMotion, camera) {
      pillarLayer?.update(deltaSec, reducedMotion, camera);
    },
    patchVisual(nextStyle: ResolvedPointEffectsStyle) {
      heatBlob?.patchVisual(nextStyle);
      pillarLayer?.patchVisual(nextStyle);
      floatingLabels?.applyStyle(nextStyle);
    },
    syncLabels(camera, canvas, chartContainer) {
      floatingLabels?.sync(camera, canvas, chartContainer, resolveAnchorWorld);
    },
    dispose() {
      heatBlob?.dispose();
      pillarLayer?.dispose();
      floatingLabels?.dispose();
      mapGroup.remove(group);
    },
  };
}

export function removeGeo3dPointEffectsFromGroup(mapGroup: THREE.Group): void {
  const existing = mapGroup.getObjectByName(GEO3D_POINT_EFFECTS_GROUP_NAME);
  if (existing) mapGroup.remove(existing);
}
