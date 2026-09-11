import { chartStyleSectionsForType } from "@/lib/chartStyleSectionRegistry";
import { filterStyleSectionsForChart } from "@/lib/chartStylePanelGates";
import { useChartInspector } from "./ChartInspectorContext";
import { ChartStyleSection } from "./chartStyleSections/ChartStyleSection";

/** DataEase chart-edit「样式」Tab：按图表类型分发独立配置块 */
export function ChartStylePanel() {
  const { cfg } = useChartInspector();
  const sections = filterStyleSectionsForChart(
    cfg.chartType,
    chartStyleSectionsForType(cfg.chartType),
  );

  return (
    <div className="flex flex-col gap-0" data-testid="chart-style-panel">
      {sections.map((sectionId) => (
        <ChartStyleSection key={sectionId} sectionId={sectionId} />
      ))}
    </div>
  );
}
