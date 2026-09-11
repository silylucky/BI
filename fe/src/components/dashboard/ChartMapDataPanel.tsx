import { ChartMapFieldSlots } from "./ChartMapFieldSlots";
import { ChartMapRegionPicker } from "./ChartMapRegionPicker";
import { ChartMapSalesGeoSetup } from "./ChartMapSalesGeoSetup";
import { MapChartFieldHintBanner } from "./MapChartFieldHint";
import { useChartInspector } from "./chartInspectorContext";
import { mapChartFieldHint } from "@/lib/mapChartDataHint";
import { INSPECTOR_NESTED_CARD } from "./inspectorCompact";

/** 对标 DataEase 区域地图 · 数据页签（GEO-IRON-01：离线中国 + 手动地区下钻，无「世界」层） */
export function ChartMapDataPanel() {
  const { columns } = useChartInspector();
  const mapHint = mapChartFieldHint(columns);

  return (
    <div className="space-y-3">
      <div className={INSPECTOR_NESTED_CARD} data-testid="chart-map-region-section">
        <ChartMapRegionPicker />
      </div>
      <ChartMapSalesGeoSetup />
      {mapHint ? <MapChartFieldHintBanner hint={mapHint} /> : null}
      <ChartMapFieldSlots />
    </div>
  );
}
