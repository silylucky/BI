import { memo } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { D3ViewRouter } from "@/components/charts/engine/d3/d3ViewRouter";

/** 画布图表统一渲染入口（D3 单轨） */
function ChartEngineViewInner(props: ChartEngineViewProps) {
  return <D3ViewRouter {...props} />;
}

export const ChartEngineView = memo(ChartEngineViewInner);
