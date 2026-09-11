import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { CanvasChartHost } from "@/components/charts/engine/CanvasChartHost";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import {
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToConfig,
  smokeCaseToViewModel,
} from "@/components/charts/chartCatalogSmokeFixtures";
import { resolveChartColors } from "@/lib/chartPalette";
import { patchChartDeStyle } from "@/lib/chartDeStyle";
import { resolveDevChartType } from "@/pages/dev/devChartTypeAlias";

type DepthVisualLevel = "off" | "standard" | "enhanced";

const DEPTH_VALUES = new Set<DepthVisualLevel>(["off", "standard", "enhanced"]);

function readDepthVisual(raw: string | null): DepthVisualLevel | undefined {
  if (!raw || !DEPTH_VALUES.has(raw as DepthVisualLevel)) return undefined;
  return raw as DepthVisualLevel;
}

export function DevChartsPage() {
  const [params] = useSearchParams();
  const chartType = resolveDevChartType(params.get("type"));
  const depthVisual = readDepthVisual(params.get("depthVisual"));

  const fixture = useMemo(
    () => CHART_CATALOG_SMOKE_CASES.find((item) => item.type === chartType) ?? null,
    [chartType],
  );

  const config = useMemo(() => {
    if (!fixture) return null;
    const base = smokeCaseToConfig(fixture);
    return depthVisual ? patchChartDeStyle(base, { depthVisual }) : base;
  }, [fixture, depthVisual]);

  const viewModel = useMemo(
    () => (fixture ? smokeCaseToViewModel(fixture) : null),
    [fixture],
  );

  const style = useMemo(() => {
    if (!config) return null;
    return buildStyleContext({
      config,
      scheme: "light",
      chartColors: resolveChartColors("default"),
      dashboardDefaults: depthVisual ? { depthVisual } : undefined,
    });
  }, [config, depthVisual]);

  if (!chartType) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-theme-sm text-gray-600 dark:text-gray-400">
        <h1 className="mb-2 text-theme-lg font-semibold text-gray-900 dark:text-white">图表开发预览</h1>
        <p>
          请通过查询参数指定类型，例如{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">/dev/charts?type=map-3d</code>
        </p>
      </main>
    );
  }

  if (!fixture || !config || !viewModel || !style) {
    return (
      <main className="mx-auto max-w-3xl p-6" role="alert">
        <h1 className="mb-2 text-theme-lg font-semibold text-error-600">未知图表类型</h1>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          未找到 <code className="font-mono">{chartType}</code> 的标准 smoke 夹具。
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 p-4 dark:bg-gray-950">
      <header className="mb-3 shrink-0">
        <h1 className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
          Dev Charts · <span className="font-mono">{chartType}</span>
          {depthVisual ? <span className="text-gray-500"> · depth={depthVisual}</span> : null}
        </h1>
      </header>
      <div
        data-testid="d3-chart-canvas"
        className="min-h-0 flex-1 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      >
        <CanvasChartHost viewModel={viewModel} style={style} chartConfig={config} height={520} />
      </div>
    </main>
  );
}
