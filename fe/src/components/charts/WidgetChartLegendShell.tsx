import type { ReactNode } from "react";
import { EmbeddedChartLegendShell } from "@/components/charts/EmbeddedChartLegend";
import { useWidgetShellLegend } from "@/components/dashboard/pixelCanvas/widgetShellLegendContext";

/** 栅格/像素画布共用：消费 ChartRenderer 发布的 shell 图例状态 */
export function WidgetChartLegendShell({
  children,
  clipChart = true,
}: {
  children: ReactNode;
  clipChart?: boolean;
}) {
  const legendCtx = useWidgetShellLegend();
  const legend = legendCtx?.state;
  const legendItems = legend?.visible && legend.items.length > 0 ? legend.items : [];

  return (
    <EmbeddedChartLegendShell
      position={legend?.position ?? "bottom"}
      orient={legend?.orient ?? "horizontal"}
      hAlign={legend?.hAlign ?? "center"}
      vAlign={legend?.vAlign ?? "bottom"}
      fontSize={legend?.fontSize ?? 12}
      icon={legend?.icon ?? "triangle"}
      iconSize={legend?.iconSize ?? 6}
      textColor={legend?.textColor}
      items={legendItems}
      clipChart={clipChart}
    >
      {children}
    </EmbeddedChartLegendShell>
  );
}
