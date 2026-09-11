import { cn } from "@/lib/utils";
import {
  PreviewBars,
  PreviewCirclePacking,
  PreviewFunnel,
  PreviewGauge,
  PreviewGraph,
  PreviewKpi,
  PreviewLineTrend,
  PreviewLiquid,
  PreviewMap,
  PreviewMap3d,
  PreviewMix,
  PreviewPie,
  PreviewRadar,
  PreviewSankey,
  PreviewScatter,
  PreviewTableGrid,
  PreviewTreemap,
  PreviewWordCloud,
} from "./previewParts";

type ChartTypePreviewIconProps = {
  type: string;
  className?: string;
};

/** DataEase 风格迷你图表预览图标（Picker 专用） */
export function ChartTypePreviewIcon({ type, className }: ChartTypePreviewIconProps) {
  const box = cn("size-10 shrink-0 text-brand-500", className);

  switch (type) {
    case "gauge":
      return <PreviewGauge className={box} />;
    case "liquid":
      return <PreviewLiquid className={box} />;
    case "kpi":
      return <PreviewKpi className={box} />;

    case "table-info":
      return <PreviewTableGrid className={box} variant="info" />;
    case "table-normal":
      return <PreviewTableGrid className={box} variant="normal" />;
    case "table-pivot":
      return <PreviewTableGrid className={box} variant="pivot" />;
    case "t-heatmap":
      return <PreviewTableGrid className={box} variant="heatmap" />;

    case "line":
      return <PreviewLineTrend className={box} />;
    case "area":
      return <PreviewLineTrend className={box} area />;
    case "area-stack":
      return <PreviewLineTrend className={box} area stacked />;

    case "bar":
      return <PreviewBars className={box} />;
    case "bar-stack":
      return <PreviewBars className={box} stacked />;
    case "percentage-bar-stack":
      return <PreviewBars className={box} stacked percent />;
    case "bar-group":
      return <PreviewBars className={box} grouped />;
    case "bar-group-stack":
      return <PreviewBars className={box} grouped stacked />;
    case "waterfall":
      return <PreviewBars className={box} waterfall />;
    case "bar-horizontal":
      return <PreviewBars className={box} horizontal />;
    case "bar-stack-horizontal":
      return <PreviewBars className={box} horizontal stacked />;
    case "percentage-bar-stack-horizontal":
      return <PreviewBars className={box} horizontal percent />;
    case "bar-range":
      return <PreviewBars className={box} range />;
    case "bidirectional-bar":
      return <PreviewBars className={box} bidirectional />;
    case "progress-bar":
      return <PreviewBars className={box} progress />;
    case "stock-line":
      return <PreviewBars className={box} stock />;
    case "bullet-graph":
      return <PreviewBars className={box} bullet />;

    case "pie":
      return <PreviewPie className={box} />;
    case "pie-donut":
      return <PreviewPie className={box} donut />;
    case "pie-rose":
      return <PreviewPie className={box} rose />;
    case "pie-donut-rose":
      return <PreviewPie className={box} donut rose />;
    case "radar":
      return <PreviewRadar className={box} />;
    case "treemap":
      return <PreviewTreemap className={box} />;
    case "word-cloud":
    case "wordCloud":
      return <PreviewWordCloud className={box} />;

    case "map":
      return <PreviewMap className={box} />;
    case "map-3d":
      return <PreviewMap3d className={box} />;

    case "scatter":
      return <PreviewScatter className={box} />;
    case "quadrant":
      return <PreviewScatter className={box} quadrant />;
    case "multi-scatter":
      return <PreviewScatter className={box} multi />;
    case "funnel":
      return <PreviewFunnel className={box} />;
    case "sankey":
      return <PreviewSankey className={box} />;
    case "circle-packing":
      return <PreviewCirclePacking className={box} />;
    case "graph":
      return <PreviewGraph className={box} />;

    case "chart-mix":
    case "combo":
      return <PreviewMix className={box} />;
    case "chart-mix-group":
      return <PreviewMix className={box} grouped />;
    case "chart-mix-stack":
      return <PreviewMix className={box} stacked />;
    case "chart-mix-dual-line":
      return <PreviewMix className={box} dualLine />;

    default:
      return <PreviewLineTrend className={box} />;
  }
}
