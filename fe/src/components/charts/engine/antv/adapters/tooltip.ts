import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import { formatChartValue } from "@/lib/chartValueFormat";

export function antvTooltipFormatter(format: NumberFormatConfig | undefined) {
  return (datum: Record<string, unknown>) => {
    const name = datum.name ?? datum.category ?? datum.x ?? "";
    const raw = datum.value ?? datum.y ?? datum.count;
    return { name: String(name), value: formatChartValue(raw, format) };
  };
}
