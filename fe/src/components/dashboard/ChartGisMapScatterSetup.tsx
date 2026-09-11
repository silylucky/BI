import { Button } from "@/components/ui/button";
import { useChartInspector } from "./chartInspectorContext";
import {
  applyGisMapScatterConfig,
  isGisMapScatterConfig,
  resolveSampleDbDatasource,
} from "@/lib/gisMapScatter";

const GIS_SCATTER_SETUP_LABEL = "接入 sample_db · de_map_heat（lng/lat 散点）";

/** GIS 地图数据：一键接入官方 demo-map-scatter Dataset */
export function ChartGisMapScatterSetup() {
  const { cfg, onChange, datasourceItems } = useChartInspector();
  const sampleDs = resolveSampleDbDatasource(datasourceItems);
  const active = isGisMapScatterConfig(cfg);

  return (
    <div className="space-y-1">
      <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">官方示例</span>
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        className="h-7 w-full min-w-0 justify-start overflow-hidden px-2 text-[10px]"
        title={GIS_SCATTER_SETUP_LABEL}
        onClick={() => onChange(applyGisMapScatterConfig(cfg, sampleDs?.id))}
      >
        <span className="min-w-0 truncate">{GIS_SCATTER_SETUP_LABEL}</span>
      </Button>
    </div>
  );
}
