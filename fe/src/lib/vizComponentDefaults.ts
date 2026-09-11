import {
  defaultChartConfig,
  defaultFilterConfig,
  defaultMediaConfig,
  defaultTextConfig,
} from "@/components/dashboard/layoutUtils";
import { getChartTypeDisplayName } from "@/lib/chartRegistry";
import type { ChartType } from "@/lib/chartViewConfig";
import { randomId } from "@/lib/randomId";
import { defaultChartResultLimitValue } from "@/lib/chartDeDisplay";
import type { VizComponentPayload, VizWidgetType } from "./vizComponents";

export type VizComponentDefaultsOptions = {
  chartType?: ChartType;
  customViz?: { artifactId: string; displayName?: string };
};

export function defaultVizComponentPayload(
  widgetType: VizWidgetType,
  options?: VizComponentDefaultsOptions,
): VizComponentPayload {
  const seedId = randomId();
  switch (widgetType) {
    case "chart":
      return {
        chartConfig: {
          ...defaultChartConfig(options?.chartType ?? "bar"),
          chartId: seedId,
        },
      };
    case "filter":
      return { filterConfig: defaultFilterConfig(seedId) };
    case "text":
      return { textConfig: defaultTextConfig() };
    case "media":
      return { mediaConfig: defaultMediaConfig() };
    case "customViz":
      return {
        customVizConfig: {
          artifactId: options?.customViz?.artifactId ?? "",
          dataBinding: { status: "manual", resultLimit: defaultChartResultLimitValue() },
          displayStyle: {
            title: { show: true },
            label: { show: true },
          },
        },
      };
    default:
      return { chartConfig: { ...defaultChartConfig("bar"), chartId: seedId } };
  }
}

export function defaultVizComponentName(
  widgetType: VizWidgetType,
  options?: VizComponentDefaultsOptions,
): string {
  switch (widgetType) {
    case "chart":
      if (options?.chartType) {
        return `未命名${getChartTypeDisplayName(options.chartType)}`;
      }
      return "未命名图表";
    case "filter":
      return "未命名筛选器";
    case "text":
      return "未命名富文本";
    case "media":
      return "未命名媒体";
    case "customViz":
      return options?.customViz?.displayName?.trim() || "未命名自定义组件";
    default:
      return "未命名组件";
  }
}
