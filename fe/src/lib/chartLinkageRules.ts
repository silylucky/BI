import type { ChartLinkageRule } from "@/components/dashboard/dashboardFilterUtils";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { chartLinkageIsConfigured, readChartLinkageConfig } from "@/lib/chartDeFeatures";

/** 从看板布局收集已启用的图表联动规则 */
export function collectChartLinkageRules(widgets: LayoutWidget[]): ChartLinkageRule[] {
  const chartIds = widgets.filter((w) => w.type === "chart").map((w) => w.id);
  const rules: ChartLinkageRule[] = [];

  for (const widget of widgets) {
    if (widget.type !== "chart" || !widget.chartConfig) continue;
    const linkage = readChartLinkageConfig(widget.chartConfig);
    if (!chartLinkageIsConfigured(linkage)) continue;
    const parameterKey = linkage.parameterKey!.trim();
    const targets =
      linkage.targetWidgetIds && linkage.targetWidgetIds.length > 0
        ? linkage.targetWidgetIds.filter((id) => id !== widget.id && chartIds.includes(id))
        : chartIds.filter((id) => id !== widget.id);
    if (targets.length === 0) continue;
    rules.push({
      sourceWidgetId: widget.id,
      targetWidgetIds: targets,
      parameterKey,
    });
  }

  return rules;
}
