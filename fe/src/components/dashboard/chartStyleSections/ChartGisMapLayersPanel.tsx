import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import { InspectorSliderField } from "@/components/dashboard/deAttrSlider";
import {
  ChartInspectorSection,
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SWITCH_SIZE,
  InspectorFieldLabel,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import { ChartGisMapLayerStyleFields } from "@/components/dashboard/chartStyleSections/ChartGisMapLayerStyleFields";
import {
  DEFAULT_GIS_OVERLAY,
  listGisProjectLayers,
  readGisProject,
  resolveGisOverlayStyle,
  writeGisProject,
  type GisProjectOverlay,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  defaultGisProjectLayer,
  patchGisProjectLayer,
  writeGisProjectLayers,
  type GisLayerKind,
  type GisProjectLayer,
} from "@/components/charts/engine/maplibre/gisProjectLayers";
import { applyGisMapViewOverlayPatch, syncGisMapViewLayers } from "@/components/charts/engine/maplibre/gisMapViewBridge";
import { resolveGisChartColors } from "@/lib/resolveGisChartColors";

const LAYERS_HINT =
  "多图层叠加在 PMTiles 底图之上；散点/热力样式亦可在「散点叠加」快捷编辑。图层顺序靠上者优先绘制。";

const KIND_LABELS: Record<GisLayerKind, string> = {
  scatter: "散点",
  heatmap: "热力",
};

function moveLayer(layers: GisProjectLayer[], fromIndex: number, toIndex: number): GisProjectLayer[] {
  if (toIndex < 0 || toIndex >= layers.length || fromIndex === toIndex) return layers;
  const next = [...layers];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function ChartGisMapLayersPanel() {
  const { cfg, widget, mutateChartConfig, dashboardStyle } = useChartInspector();
  const project = readGisProject(cfg);
  const layers = useMemo(() => listGisProjectLayers(project), [project]);
  const [selectedLayerId, setSelectedLayerId] = useState(
    project.activeLayerId ?? layers[0]?.id ?? "",
  );

  useEffect(() => {
    const preferred = project.activeLayerId ?? layers[0]?.id ?? "";
    if (layers.some((layer) => layer.id === preferred)) {
      setSelectedLayerId(preferred);
      return;
    }
    setSelectedLayerId(layers[0]?.id ?? "");
  }, [layers, project.activeLayerId]);

  const selectLayer = useCallback(
    (layerId: string) => {
      setSelectedLayerId(layerId);
      mutateChartConfig((current) => writeGisProject(current, { activeLayerId: layerId }));
    },
    [mutateChartConfig],
  );

  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
  const paletteColors = useMemo(
    () => resolveGisChartColors(cfg, dashboardStyle),
    [cfg, dashboardStyle],
  );
  const resolvedStyle = useMemo(
    () => resolveGisOverlayStyle(selectedLayer?.style, paletteColors),
    [paletteColors, selectedLayer?.style],
  );

  const commitLayers = useCallback(
    (nextLayers: GisProjectLayer[]) => {
      mutateChartConfig((current) =>
        writeGisProject(current, writeGisProjectLayers(readGisProject(current), nextLayers)),
      );
      syncGisMapViewLayers(widget.id);
    },
    [mutateChartConfig, widget.id],
  );

  const patchSelectedLayer = useCallback(
    (patch: Partial<GisProjectLayer>) => {
      if (!selectedLayer) return;
      commitLayers(patchGisProjectLayer(project, selectedLayer.id, patch));
    },
    [commitLayers, project, selectedLayer],
  );

  const patchSelectedStyle = useCallback(
    (stylePatch: GisProjectOverlay) => {
      if (!selectedLayer) return;
      patchSelectedLayer({ style: { ...selectedLayer.style, ...stylePatch } });
      applyGisMapViewOverlayPatch(widget.id, selectedLayer.id, stylePatch);
    },
    [patchSelectedLayer, selectedLayer, widget.id],
  );

  const addLayer = (kind: GisLayerKind) => {
    const next = [...layers, defaultGisProjectLayer(kind)];
    commitLayers(next);
    selectLayer(next[next.length - 1].id);
  };

  const removeSelectedLayer = () => {
    if (layers.length <= 1 || !selectedLayer) return;
    const next = layers.filter((layer) => layer.id !== selectedLayer.id);
    commitLayers(next);
    selectLayer(next[0]?.id ?? "");
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const copy = defaultGisProjectLayer(selectedLayer.kind);
    copy.name = `${selectedLayer.name} 副本`;
    copy.style = selectedLayer.style ? { ...selectedLayer.style } : undefined;
    copy.opacity = selectedLayer.opacity;
    copy.visible = selectedLayer.visible;
    const next = [...layers, copy];
    commitLayers(next);
    selectLayer(copy.id);
  };

  return (
    <ChartInspectorSection title="GIS 图层" hint={LAYERS_HINT} data-testid="chart-gis-map-layers-panel">
      <div className={INSPECTOR_SECTION_GAP}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-gray-200 px-2 py-1 text-theme-xs text-brand-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            onClick={() => addLayer("scatter")}
          >
            + 散点层
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 px-2 py-1 text-theme-xs text-brand-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            onClick={() => addLayer("heatmap")}
          >
            + 热力层
          </button>
        </div>

        <div className="grid gap-1.5">
          {layers.map((layer, index) => {
            const active = layer.id === selectedLayer?.id;
            return (
              <div
                key={layer.id}
                className={`grid gap-1.5 rounded-lg border p-2 ${
                  active
                    ? "border-brand-500/60 bg-brand-500/5"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-theme-xs font-medium text-gray-800 dark:text-gray-100"
                    onClick={() => selectLayer(layer.id)}
                  >
                    {layer.name}
                    <span className="ml-1 text-gray-400">({KIND_LABELS[layer.kind]})</span>
                  </button>
                  <Switch
                    checked={layer.visible !== false}
                    onCheckedChange={(checked) =>
                      commitLayers(patchGisProjectLayer(project, layer.id, { visible: checked }))
                    }
                    aria-label={`显示 ${layer.name}`}
                    size={INSPECTOR_SWITCH_SIZE}
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-gray-500 hover:text-brand-500 disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => commitLayers(moveLayer(layers, index, index - 1))}
                      aria-label="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-gray-500 hover:text-brand-500 disabled:opacity-30"
                      disabled={index === layers.length - 1}
                      onClick={() => commitLayers(moveLayer(layers, index, index + 1))}
                      aria-label="下移"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedLayer ? (
          <>
            <div className="grid gap-1.5">
              <InspectorFieldLabel label="图层名称" />
              <Input
                className={INSPECTOR_CTRL}
                value={selectedLayer.name}
                onChange={(event) => patchSelectedLayer({ name: event.target.value })}
                aria-label="图层名称"
              />
            </div>

            <div className="grid gap-1.5">
              <InspectorFieldLabel label="图层类型" />
              <Select
                value={selectedLayer.kind}
                onValueChange={(kind) => patchSelectedLayer({ kind: kind as GisLayerKind })}
              >
                <SelectTrigger className={INSPECTOR_CTRL} aria-label="图层类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scatter">散点</SelectItem>
                  <SelectItem value="heatmap">热力</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <InspectorSliderField
              label="图层不透明度"
              value={Math.round((selectedLayer.opacity ?? 1) * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(next) => patchSelectedLayer({ opacity: next / 100 })}
            />

            <InspectorSwitchRow
              label="有数据时自动定位"
              checked={resolvedStyle.autoFit}
              onCheckedChange={(autoFit) => patchSelectedStyle({ autoFit })}
            />

            <ChartGisMapLayerStyleFields
              resolved={resolvedStyle}
              kind={selectedLayer.kind}
              onPatch={patchSelectedStyle}
            />

            <div className="flex flex-wrap gap-3">
              {selectedLayer.style && Object.keys(selectedLayer.style).length > 0 ? (
                <button
                  type="button"
                  className="text-theme-xs text-brand-500 hover:underline"
                  onClick={() => patchSelectedLayer({ style: undefined })}
                >
                  恢复默认样式
                </button>
              ) : null}
              {layers.length > 1 ? (
                <button
                  type="button"
                  className="text-theme-xs text-red-500 hover:underline"
                  onClick={removeSelectedLayer}
                >
                  删除图层
                </button>
              ) : null}
              <button
                type="button"
                className="text-theme-xs text-brand-500 hover:underline"
                onClick={duplicateSelectedLayer}
              >
                复制图层
              </button>
            </div>
          </>
        ) : (
          <p className="text-theme-xs text-gray-500">
            默认散点半径 {DEFAULT_GIS_OVERLAY.radiusMin}–{DEFAULT_GIS_OVERLAY.radiusMax}px
          </p>
        )}
      </div>
    </ChartInspectorSection>
  );
}
