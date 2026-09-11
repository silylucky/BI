import type { LayoutWidget } from "./layoutUtils";
import { randomId } from "@/lib/randomId";

/** 深拷贝 widget 并生成新 ID，用于跨看板复用 */
export function cloneLayoutWidget(source: LayoutWidget, widgets: LayoutWidget[]): LayoutWidget {
  const newId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  const base: LayoutWidget = {
    ...structuredClone(source),
    id: newId,
    order: maxOrder + 1,
    parentTabsId: undefined,
    tabPaneId: undefined,
    gridX: undefined,
    gridY: undefined,
  };

  if (source.type === "filter" && source.filterConfig) {
    return {
      ...base,
      type: "filter",
      filterConfig: { ...source.filterConfig, filterId: newId },
    };
  }
  if (source.type === "chart" && source.chartConfig) {
    return {
      ...base,
      type: "chart",
      chartConfig: { ...source.chartConfig, chartId: newId },
    };
  }
  if (source.type === "text" && source.textConfig) {
    return { ...base, type: "text", textConfig: { ...source.textConfig } };
  }
  if (source.type === "media" && source.mediaConfig) {
    return { ...base, type: "media", mediaConfig: { ...source.mediaConfig } };
  }
  if (source.type === "tabs" && source.tabsConfig) {
    const panes = source.tabsConfig.panes.map((pane) => ({
      ...pane,
      id: randomId(),
      childWidgetIds: [],
    }));
    return {
      ...base,
      type: "tabs",
      tabsConfig: {
        tabsId: newId,
        panes,
        activePaneId: panes[0]?.id ?? newId,
      },
    };
  }
  return base;
}
