import { exportChartPng } from "@/components/charts/engine/registry";

/** @deprecated 请使用 registry.exportChartPng */
export function exportChartPngFromContainer(
  container: HTMLElement,
  title: string,
  chartType = "line",
): void {
  void exportChartPng(container, chartType, title);
}
