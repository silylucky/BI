import { createContext, useContext } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { ChartDeStyle } from "@/lib/chartDeStyle";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import type { LayoutWidget } from "./layoutUtils";
import type { ChartInspectorState } from "./useChartInspectorState";

export type ChartInspectorContextValue = ChartInspectorState & {
  widget: LayoutWidget;
  onChange: (chartConfig: ChartViewConfig) => void;
  onTitleChange?: (title: string) => void;
  /** 当前编辑中的看板 ID */
  dashboardId?: string;
  /** 看板画布组件列表（地图联动目标选择） */
  dashboardWidgets?: LayoutWidget[];
  /** 看板全局样式（组件级标题 show 继承 titleStyle.show） */
  dashboardStyle?: DashboardStyleConfig;
  /** 基于最新 chartConfig 合并 deStyle，避免滑块/连点 patch 覆盖未落盘的字段 */
  patchDeStyle: (patch: Partial<ChartDeStyle>) => void;
  patchDeStyleNested: <K extends keyof ChartDeStyle>(
    key: K,
    patch: Partial<NonNullable<ChartDeStyle[K]>>,
  ) => void;
  mutateChartConfig: (mutator: (cfg: ChartViewConfig) => ChartViewConfig) => void;
};

/** 单例 Context；Provider 与 consumer 必须从此模块引用，避免循环依赖产生双份 Context。 */
export const ChartInspectorReactContext = createContext<ChartInspectorContextValue | null>(null);

export function useChartInspector(): ChartInspectorContextValue {
  const ctx = useContext(ChartInspectorReactContext);
  if (!ctx) {
    throw new Error("useChartInspector must be used within ChartInspectorProvider");
  }
  return ctx;
}
