import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import { formatGeoTooltipValue } from "@/components/charts/engine/geo/OfflineGeoPort";
import type { GeoSurfaceColors } from "@/components/charts/engine/three/geoToThreeShapes";

type VisualMapOpts = {
  min: number;
  max: number;
  surface: GeoSurfaceColors;
  valueFormat?: NumberFormatConfig;
  isDark: boolean;
};

export function mountThreeGeoVisualMap(container: HTMLElement, opts: VisualMapOpts): () => void {
  const layer = document.createElement("div");
  layer.className = "pointer-events-none absolute bottom-2 right-3 z-[3] flex flex-col items-end gap-1";
  const bar = document.createElement("div");
  bar.className = "h-2 w-[100px] rounded-sm";
  bar.style.background = `linear-gradient(to right, ${opts.surface.rangeLowCss}, ${opts.surface.rangeMidCss}, ${opts.surface.rangeHighCss}, ${opts.surface.rangePeakCss})`;
  bar.style.boxShadow = opts.isDark ? "0 0 10px rgba(34, 211, 238, 0.35)" : "0 0 8px rgba(59, 130, 246, 0.25)";
  const labels = document.createElement("div");
  labels.className = "flex w-[100px] justify-between text-[10px] leading-none";
  labels.style.color = opts.isDark ? "#94a3b8" : "#64748b";
  const minLabel = document.createElement("span");
  minLabel.textContent = formatGeoTooltipValue(opts.min, opts.valueFormat);
  const maxLabel = document.createElement("span");
  maxLabel.textContent = formatGeoTooltipValue(opts.max, opts.valueFormat);
  labels.append(minLabel, maxLabel);
  layer.append(bar, labels);
  container.appendChild(layer);
  return () => layer.remove();
}
