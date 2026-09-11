import type { GisProject, GisProjectFog } from "@/components/charts/engine/maplibre/gisProject";
import type { GisProjectHalo } from "@/components/charts/engine/maplibre/gisProjectHalo";
import {
  normalizeGisEffectsSettings,
  type GisEffectsSettings,
  type ResolvedGisEffectsSettings,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";

export type { GisEffectsSettings, ResolvedGisEffectsSettings };

export function legacyEffectsFromProject(project: {
  halo?: GisProjectHalo;
  fog?: GisProjectFog;
}): GisEffectsSettings | undefined {
  const next: GisEffectsSettings = {};
  if (typeof project.halo?.color === "string") next.haloColor = project.halo.color;
  if (project.halo?.outerScale != null) next.haloExtent = project.halo.outerScale;
  if (project.halo?.opacity != null) next.haloOpacity = project.halo.opacity;
  if (typeof project.fog?.["space-color"] === "string") {
    next.spaceColor = project.fog["space-color"];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function resolveGisEffectsSettings(
  project: Pick<GisProject, "effects" | "halo" | "fog">,
): ResolvedGisEffectsSettings {
  const merged: GisEffectsSettings = {
    ...legacyEffectsFromProject(project),
    ...project.effects,
  };
  return normalizeGisEffectsSettings(Object.keys(merged).length > 0 ? merged : undefined);
}

export function normalizeGisProjectEffects(input: unknown): GisEffectsSettings | undefined {
  if (!input || typeof input !== "object") return undefined;
  const normalized = normalizeGisEffectsSettings(input as GisEffectsSettings);
  const raw = input as GisEffectsSettings;
  const next: GisEffectsSettings = {};
  if (raw.haloColor && normalized.haloColor !== undefined) next.haloColor = normalized.haloColor;
  if (raw.haloExtent != null) next.haloExtent = normalized.haloExtent;
  if (raw.haloOpacity != null) next.haloOpacity = normalized.haloOpacity;
  if (raw.spaceColor) next.spaceColor = normalized.spaceColor;
  if (raw.enabled === true) next.enabled = true;
  if (raw.enabled === false) next.enabled = false;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function writeGisEffectsPatch(patch: Partial<GisEffectsSettings>): {
  effects: GisEffectsSettings;
  halo: undefined;
  fog?: GisProjectFog;
} {
  return {
    effects: patch as GisEffectsSettings,
    halo: undefined,
  };
}
