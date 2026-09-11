import { useCallback, useMemo } from "react";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import { InspectorSliderField } from "@/components/dashboard/deAttrSlider";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import { readGisProject, writeGisProject } from "@/components/charts/engine/maplibre/gisProject";
import {
  DEFAULT_GIS_EFFECTS_SETTINGS,
  GIS_HALO_EXTENT_MAX,
  GIS_HALO_EXTENT_MIN,
  GIS_HALO_OPACITY_MAX,
  GIS_HALO_OPACITY_MIN,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import {
  resolveGisEffectsSettings,
  type GisEffectsSettings,
} from "@/components/charts/engine/maplibre/gisProjectEffects";
import { applyGisMapViewAtmosphere } from "@/components/charts/engine/maplibre/gisMapViewBridge";

const ATMOSPHERE_HINT =
  "对标 GeoLibre「大气效果」：球缘光晕（颜色/范围/强度）与深空背景色；仅球面地球生效。";

export function ChartGisMapAtmospherePanel() {
  const { cfg, widget, mutateChartConfig } = useChartInspector();
  const project = readGisProject(cfg);
  const resolved = useMemo(
    () => resolveGisEffectsSettings(project),
    [project.effects, project.fog, project.halo],
  );

  const patchProject = useCallback(
    (patch: Parameters<typeof writeGisProject>[1]) => {
      mutateChartConfig((current) => writeGisProject(current, patch));
    },
    [mutateChartConfig],
  );

  const previewAtmosphere = useCallback(
    (effects: GisEffectsSettings) => {
      applyGisMapViewAtmosphere(widget.id, {
        atmospherePreset: project.atmospherePreset,
        projection: project.projection,
        effects,
        fog: project.fog,
        halo: project.halo,
      });
    },
    [project.atmospherePreset, project.fog, project.halo, project.projection, widget.id],
  );

  const patchEffects = useCallback(
    (patch: Partial<GisEffectsSettings>) => {
      const nextEffects = { ...project.effects, ...patch };
      previewAtmosphere(nextEffects);
      patchProject({ effects: nextEffects, halo: undefined });
    },
    [patchProject, previewAtmosphere, project.effects],
  );

  const resetDefaults = () => {
    previewAtmosphere({});
    patchProject({ effects: undefined, halo: undefined });
  };

  if (project.projection !== "globe") {
    return (
      <ChartInspectorSection title="大气效果" hint={ATMOSPHERE_HINT} data-testid="chart-gis-map-atmosphere-panel">
        <p className="text-theme-xs text-gray-500">请先将投影设为「球面地球」。</p>
      </ChartInspectorSection>
    );
  }

  const controlsDisabled = !resolved.enabled;

  return (
    <ChartInspectorSection title="大气效果" hint={ATMOSPHERE_HINT} data-testid="chart-gis-map-atmosphere-panel">
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorSwitchRow
          label="已启用"
          checked={resolved.enabled}
          onCheckedChange={(enabled) => patchEffects({ enabled })}
        />
        <InspectorInlineColorRow
          label="光晕颜色"
          value={resolved.haloColor}
          allowClear={false}
          onChange={(haloColor) => {
            if (haloColor) patchEffects({ haloColor });
          }}
          className={controlsDisabled ? "pointer-events-none opacity-60" : undefined}
        />
        <InspectorSliderField
          label="光晕范围"
          value={Math.round(resolved.haloExtent * 100) / 100}
          min={GIS_HALO_EXTENT_MIN}
          max={GIS_HALO_EXTENT_MAX}
          step={0.05}
          unit="x"
          disabled={controlsDisabled}
          onChange={(haloExtent) => patchEffects({ haloExtent })}
        />
        <InspectorSliderField
          label="光晕强度"
          value={Math.round(resolved.haloOpacity * 100)}
          min={Math.round(GIS_HALO_OPACITY_MIN * 100)}
          max={Math.round(GIS_HALO_OPACITY_MAX * 100)}
          step={1}
          unit="%"
          disabled={controlsDisabled}
          onChange={(opacity) => patchEffects({ haloOpacity: opacity / 100 })}
        />
        <InspectorInlineColorRow
          label="太空颜色"
          hint="大气效果插件内的深空 radial 中心色（与光晕同一套设置）"
          value={resolved.spaceColor}
          allowClear={false}
          onChange={(spaceColor) => {
            if (spaceColor) patchEffects({ spaceColor });
          }}
          className={controlsDisabled ? "pointer-events-none opacity-60" : undefined}
        />
        <button
          type="button"
          className="text-theme-xs text-brand-500 hover:underline"
          onClick={resetDefaults}
        >
          恢复默认设置
        </button>
        <p className="text-[10px] text-gray-400">
          默认光晕 {DEFAULT_GIS_EFFECTS_SETTINGS.haloColor} · 范围{" "}
          {DEFAULT_GIS_EFFECTS_SETTINGS.haloExtent}x · 深空 {DEFAULT_GIS_EFFECTS_SETTINGS.spaceColor}
        </p>
      </div>
    </ChartInspectorSection>
  );
}
