import { memo } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { ChartEngineView } from "@/components/charts/engine/ChartEngineView";

export type CanvasChartHostProps = ChartEngineViewProps;

function CanvasChartHostInner(props: CanvasChartHostProps) {
  return <ChartEngineView {...props} />;
}

export const CanvasChartHost = memo(CanvasChartHostInner);
