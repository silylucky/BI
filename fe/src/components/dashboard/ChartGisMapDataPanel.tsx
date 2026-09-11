import { ChartDataSlots } from "./ChartDataSlots";
import { ChartGisMapScatterSetup } from "./ChartGisMapScatterSetup";
import { ChartGisMapTileServiceSetup } from "./ChartGisMapTileServiceSetup";
import { GisMapDataHintBanner } from "./GisMapDataHintBanner";
import { useChartInspector } from "./chartInspectorContext";
import { readGisProject, resolveActiveGisProjectLayer } from "@/components/charts/engine/maplibre/gisProject";
import { resolveGisMapDataHint } from "@/lib/gisMapDataHint";

/** GIS 地图 · 数据页签：底图可空载 + 可选经纬度散点 */
export function ChartGisMapDataPanel() {
  const { cfg, columns } = useChartInspector();
  const hint = resolveGisMapDataHint(cfg, columns);
  const project = readGisProject(cfg);
  const activeLayer = resolveActiveGisProjectLayer(project);

  return (
    <div className="space-y-2" data-testid="chart-gis-map-data-panel">
      <ChartGisMapTileServiceSetup />
      <GisMapDataHintBanner hint={hint} />
      <p className="text-theme-xs text-gray-500 dark:text-gray-400" data-testid="chart-gis-map-active-layer">
        当前数据字段作用于图层「{activeLayer.name}」；多图层可在样式 Tab「GIS 图层」切换当前编辑图层。
      </p>
      <ChartGisMapScatterSetup />
      <ChartDataSlots hideMapHint />
    </div>
  );
}
