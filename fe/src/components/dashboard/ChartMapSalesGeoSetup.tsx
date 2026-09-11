import { Button } from "@/components/ui/button";
import { useChartInspector } from "./chartInspectorContext";
import {
  applySalesGeoDrillMapConfig,
  isSalesGeoMapConfig,
  resolveSampleDbDatasource,
} from "@/lib/mapChartSalesGeo";

const SALES_GEO_SETUP_LABEL = "接入 sample_db · v_sales_geo（省→市→区县）";

/** 地图数据：接入 sample_db · v_sales_geo（替代静态演示预设） */
export function ChartMapSalesGeoSetup() {
  const { cfg, onChange, datasourceItems } = useChartInspector();
  const sampleDs = resolveSampleDbDatasource(datasourceItems);
  const active = isSalesGeoMapConfig(cfg);

  return (
    <div className="space-y-1">
      <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        数据源
      </span>
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        className="h-7 w-full min-w-0 justify-start overflow-hidden px-2 text-[10px]"
        title={SALES_GEO_SETUP_LABEL}
        onClick={() => onChange(applySalesGeoDrillMapConfig(cfg, sampleDs?.id))}
      >
        <span className="min-w-0 truncate">{SALES_GEO_SETUP_LABEL}</span>
      </Button>
    </div>
  );
}
