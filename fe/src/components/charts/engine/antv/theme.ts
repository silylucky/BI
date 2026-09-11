import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";

export type AntvThemeTokens = {
  axisLabel: string;
  axisLine: string;
  gridLine: string;
  legendText: string;
  tooltipBg: string;
  tooltipText: string;
  background: string;
};

export function getAntvThemeTokens(scheme: ColorScheme): AntvThemeTokens {
  if (scheme === "dark") {
    return {
      axisLabel: "rgba(255,255,255,0.72)",
      axisLine: "rgba(255,255,255,0.2)",
      gridLine: "rgba(255,255,255,0.08)",
      legendText: "rgba(255,255,255,0.85)",
      tooltipBg: "rgba(17,24,39,0.92)",
      tooltipText: "#f9fafb",
      background: "transparent",
    };
  }
  return {
    axisLabel: "#667085",
    axisLine: "#e4e7ec",
    gridLine: "#f2f4f7",
    legendText: "#344054",
    tooltipBg: "rgba(255,255,255,0.96)",
    tooltipText: "#344054",
    background: "transparent",
  };
}
