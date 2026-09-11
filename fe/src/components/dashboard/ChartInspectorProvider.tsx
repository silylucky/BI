import { useCallback, useRef, type ReactNode } from "react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  patchChartDeStyle,
  patchChartDeStyleNested,
  type ChartDeStyle,
} from "@/lib/chartDeStyle";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import type { LayoutWidget } from "./layoutUtils";
import { defaultChartConfig } from "./layoutUtils";
import { ChartInspectorReactContext } from "./chartInspectorContext";
import { useChartInspectorState } from "./useChartInspectorState";

type ChartInspectorProviderProps = {
  widget: LayoutWidget;
  onChange: (chartConfig: ChartViewConfig) => void;
  onTitleChange?: (title: string) => void;
  dashboardStyle?: DashboardStyleConfig;
  dashboardId?: string;
  dashboardWidgets?: LayoutWidget[];
  children: ReactNode;
};

export function ChartInspectorProvider({
  widget,
  onChange,
  onTitleChange,
  dashboardStyle,
  dashboardId,
  dashboardWidgets,
  children,
}: ChartInspectorProviderProps) {
  const widgetRef = useRef(widget);
  widgetRef.current = widget;

  const readChartConfig = useCallback((): ChartViewConfig => {
    const current = widgetRef.current;
    if (current.chartConfig) return current.chartConfig;
    return defaultChartConfig("bar");
  }, []);

  /** 同步更新 ref，避免 columns/binding effect 在父级 re-render 前用旧 cfg 覆盖 deStyle */
  const emitChange = useCallback(
    (next: ChartViewConfig) => {
      if (!widgetRef.current.chartConfig) return;
      widgetRef.current = { ...widgetRef.current, chartConfig: next };
      onChange(next);
    },
    [onChange],
  );

  const state = useChartInspectorState(widget, readChartConfig, emitChange);

  const patchDeStyle = useCallback(
    (patch: Partial<ChartDeStyle>) => {
      emitChange(patchChartDeStyle(readChartConfig(), patch));
    },
    [emitChange, readChartConfig],
  );

  const patchDeStyleNested = useCallback(
    <K extends keyof ChartDeStyle>(
      key: K,
      patch: Partial<NonNullable<ChartDeStyle[K]>>,
    ) => {
      emitChange(patchChartDeStyleNested(readChartConfig(), key, patch));
    },
    [emitChange, readChartConfig],
  );

  const mutateChartConfig = useCallback(
    (mutator: (cfg: ChartViewConfig) => ChartViewConfig) => {
      emitChange(mutator(readChartConfig()));
    },
    [emitChange, readChartConfig],
  );

  return (
    <ChartInspectorReactContext.Provider
      value={{
        ...state,
        widget,
        onChange: emitChange,
        onTitleChange,
        dashboardStyle,
        dashboardId,
        dashboardWidgets,
        patchDeStyle,
        patchDeStyleNested,
        mutateChartConfig,
      }}
    >
      {children}
    </ChartInspectorReactContext.Provider>
  );
}
