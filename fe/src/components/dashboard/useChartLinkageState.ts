import { useCallback, useMemo, useState } from "react";
import type { ChartLinkageRuntime } from "./dashboardFilterUtils";
import type { LayoutWidget } from "./layoutUtils";
import { collectChartLinkageRules } from "@/lib/chartLinkageRules";

/** 看板级地图联动运行时：单击区域 → 写入 SQL 参数 → 目标图 refresh */
export function useChartLinkageState(
  widgets: LayoutWidget[],
  initialParams?: Record<string, string>,
) {
  const [params, setParams] = useState<Record<string, string>>(() => ({ ...initialParams }));

  const chartLinkageRuntime = useMemo((): ChartLinkageRuntime => ({
    params,
    rules: collectChartLinkageRules(widgets),
  }), [params, widgets]);

  const handleChartLinkageClick = useCallback(
    (_widgetId: string, payload: { parameterKey: string; value: string }) => {
      const key = payload.parameterKey.trim();
      if (!key) return;
      setParams((prev) => ({ ...prev, [key]: payload.value }));
    },
    [],
  );

  const resetChartLinkageParams = useCallback(() => {
    setParams({});
  }, []);

  return {
    chartLinkageRuntime,
    handleChartLinkageClick,
    resetChartLinkageParams,
  };
}
