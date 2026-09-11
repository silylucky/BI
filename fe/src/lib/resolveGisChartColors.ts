import { readChartDeStyle } from "@/lib/chartDeStyle";
import { resolveChartColors, resolveInheritPreviewColors } from "@/lib/chartPalette";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

/** 与 GisMapView buildStyleContext.chartColors 对齐的 palette 解析 */
export function resolveGisChartColors(
  cfg: ChartViewConfig,
  dashboardStyle?: Pick<DashboardStyleConfig, "paletteId" | "paletteColors"> | null,
): string[] {
  const deStyle = readChartDeStyle(cfg);
  if (deStyle.paletteColors?.length) return [...deStyle.paletteColors];
  const inherited = resolveInheritPreviewColors(dashboardStyle?.paletteId, dashboardStyle?.paletteColors);
  if (inherited.length) return inherited;
  return resolveChartColors(deStyle.paletteId ?? "default");
}
