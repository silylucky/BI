import { useMemo } from "react";
import { CanvasChartHost } from "@/components/charts/engine/CanvasChartHost";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import {
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToConfig,
  smokeCaseToViewModel,
} from "@/components/charts/chartCatalogSmokeFixtures";
import { resolveChartColors } from "@/lib/chartPalette";

export function BarPluginDemo() {
  const fixture = CHART_CATALOG_SMOKE_CASES.find((item) => item.type === "bar");
  const config = useMemo(() => (fixture ? smokeCaseToConfig(fixture) : null), [fixture]);
  const viewModel = useMemo(() => (fixture ? smokeCaseToViewModel(fixture) : null), [fixture]);
  const style = useMemo(() => {
    if (!config) return null;
    return buildStyleContext({
      config,
      scheme: "light",
      chartColors: resolveChartColors("default"),
    });
  }, [config]);

  if (!fixture || !config || !viewModel || !style) return null;

  return (
    <CanvasChartHost viewModel={viewModel} style={style} chartConfig={config} height={190} />
  );
}
