import { memo } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { D3CanvasView } from "@/components/charts/engine/d3/views/D3CanvasView";
import { D3GeoMapView } from "@/components/charts/engine/d3/views/D3GeoMapView";
import { GisMapView } from "@/components/charts/engine/maplibre/GisMapView";
import { D3TableView, isD3TableChartType } from "@/components/charts/engine/d3/table/D3TableView";

/** D3 画布图表统一入口 */
function D3ViewRouterInner(props: ChartEngineViewProps) {
  if (props.viewModel.chartType === "gis-map") {
    return <GisMapView {...props} />;
  }
  if (props.viewModel.chartType === "map" || props.viewModel.chartType === "map-3d") {
    return <D3GeoMapView {...props} />;
  }
  if (isD3TableChartType(props.viewModel.chartType)) {
    return <D3TableView {...props} />;
  }
  return <D3CanvasView {...props} />;
}

export const D3ViewRouter = memo(D3ViewRouterInner);

/** @deprecated 使用 D3ViewRouter / D3CartesianView */
export const D3LineView = D3ViewRouter;
