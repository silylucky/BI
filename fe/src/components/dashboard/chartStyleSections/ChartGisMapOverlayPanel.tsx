import { useCallback, useMemo } from "react";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
} from "@/components/dashboard/inspectorCompact";
import { ChartGisMapLayerStyleFields } from "@/components/dashboard/chartStyleSections/ChartGisMapLayerStyleFields";
import {
  DEFAULT_GIS_OVERLAY,
  readGisProject,
  resolveActiveGisProjectLayer,
  resolveGisOverlayStyle,
  writeGisProject,
  type GisProjectOverlay,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  patchGisProjectLayer,
  writeGisProjectLayers,
} from "@/components/charts/engine/maplibre/gisProjectLayers";
import { applyGisMapViewOverlayPatch, syncGisMapViewLayers } from "@/components/charts/engine/maplibre/gisMapViewBridge";
import { resolveGisChartColors } from "@/lib/resolveGisChartColors";

const OVERLAY_HINT =
  "作用于当前编辑图层（与「GIS 图层」同步）；绑定经/纬度后显示散点。";

export function ChartGisMapOverlayPanel() {
  const { cfg, widget, mutateChartConfig, dashboardStyle } = useChartInspector();
  const project = readGisProject(cfg);
  const activeLayer = resolveActiveGisProjectLayer(project);
  const paletteColors = useMemo(
    () => resolveGisChartColors(cfg, dashboardStyle),
    [cfg, dashboardStyle],
  );
  const resolved = useMemo(
    () => resolveGisOverlayStyle(activeLayer.style, paletteColors),
    [activeLayer.style, paletteColors],
  );

  const patchOverlay = useCallback(
    (patch: GisProjectOverlay) => {
      mutateChartConfig((current) => {
        const currentProject = readGisProject(current);
        const layer = resolveActiveGisProjectLayer(currentProject);
        const nextLayers = patchGisProjectLayer(currentProject, layer.id, {
          style: { ...layer.style, ...patch },
        });
        return writeGisProject(current, writeGisProjectLayers(currentProject, nextLayers));
      });
      applyGisMapViewOverlayPatch(widget.id, activeLayer.id, patch);
    },
    [activeLayer.id, mutateChartConfig, widget.id],
  );

  const resetOverlay = () => {
    mutateChartConfig((current) => {
      const currentProject = readGisProject(current);
      const layer = resolveActiveGisProjectLayer(currentProject);
      const nextLayers = patchGisProjectLayer(currentProject, layer.id, { style: undefined });
      return writeGisProject(current, writeGisProjectLayers(currentProject, nextLayers));
    });
    syncGisMapViewLayers(widget.id);
  };

  const hasCustomOverlay = Boolean(activeLayer.style && Object.keys(activeLayer.style).length > 0);

  return (
    <ChartInspectorSection
      title={activeLayer.kind === "heatmap" ? "热力叠加" : "散点叠加"}
      hint={OVERLAY_HINT}
      data-testid="chart-gis-map-overlay-panel"
    >
      <div className={INSPECTOR_SECTION_GAP}>
        <p className="text-theme-xs text-gray-500">
          当前图层：{activeLayer.name}（{activeLayer.kind === "heatmap" ? "热力" : "散点"}）
        </p>
        <ChartGisMapLayerStyleFields
          resolved={resolved}
          kind={activeLayer.kind === "heatmap" ? "heatmap" : "scatter"}
          onPatch={patchOverlay}
        />

        {hasCustomOverlay ? (
          <button
            type="button"
            className="text-theme-xs text-brand-500 hover:underline"
            onClick={resetOverlay}
          >
            恢复默认（半径 {DEFAULT_GIS_OVERLAY.radiusMin}–{DEFAULT_GIS_OVERLAY.radiusMax}px）
          </button>
        ) : null}
      </div>
    </ChartInspectorSection>
  );
}
