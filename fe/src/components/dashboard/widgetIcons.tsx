import { getChartTypeDisplayName } from "@/lib/chartRegistry";
import {
  chartTypeIcon,
  CHART_TYPE_ICONS,
  FALLBACK_CATALOG_ITEMS,
} from "@/lib/chartTypeCatalogDisplay";

export { chartTypeIcon as widgetChartIcon, CHART_TYPE_ICONS as WIDGET_CHART_ICONS, FALLBACK_CATALOG_ITEMS };
export { getChartTypeDisplayName };

/** @deprecated 使用 getChartTypeDisplayName */
export const WIDGET_CHART_LABELS: Record<string, string> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return getChartTypeDisplayName(prop);
    },
  },
);
