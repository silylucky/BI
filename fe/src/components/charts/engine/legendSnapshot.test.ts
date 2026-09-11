import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildLegendSnapshot } from "@/components/charts/engine/legendSnapshot";
import { resolveSeriesLegendNames } from "@/components/charts/engine/buildDatasetEncoding";
import { chartViewModelToRenderSpec } from "@/components/charts/engine/buildChartViewModel";
import {
  CHART_CATALOG_SMOKE_CASES,
  smokeCaseToViewModel,
} from "@/components/charts/chartCatalogSmokeFixtures";
import type { ChartStyleContext } from "@/components/charts/engine/types";

const styleCtx = (colors = ["#465fff", "#12b76a"]): ChartStyleContext => ({
  scheme: "light",
  deStyle: {},
  deFeatures: {},
  chartColors: colors,
  dataScreenSurface: false,
  showLabel: false,
  showTooltip: true,
  seriesGradient: false,
  dataZoom: false,
  labelContent: { showIndicator: true },
  labelPresentation: { fontSize: 12 },
  tooltipPresentation: { fontSize: 12 },
  shellLegend: true,
  embedEdit: true,
});

function smokeVm(type: string) {
  const item = CHART_CATALOG_SMOKE_CASES.find((c) => c.type === type);
  if (!item) throw new Error(`missing smoke ${type}`);
  return smokeCaseToViewModel(item);
}

describe("resolveSeriesLegendNames", () => {
  it("returns series names for area-stack (trend cartesian)", () => {
    const vm = smokeVm("area-stack");
    const spec = chartViewModelToRenderSpec(vm);
    const names = resolveSeriesLegendNames(spec, vm.dataset.rows, vm.dataset.columns);
    expect(names.length).toBeGreaterThan(0);
  });

  it("returns column and line metrics for chart-mix", () => {
    const vm = smokeVm("chart-mix");
    const spec = chartViewModelToRenderSpec(vm);
    const names = resolveSeriesLegendNames(spec, vm.dataset.rows, vm.dataset.columns);
    expect(names).toEqual(expect.arrayContaining(["amount", "amount2"]));
  });

  it("returns sub-series and line metric for chart-mix-group", () => {
    const vm = smokeVm("chart-mix-group");
    const spec = chartViewModelToRenderSpec(vm);
    const names = resolveSeriesLegendNames(spec, vm.dataset.rows, vm.dataset.columns);
    expect(names.length).toBeGreaterThan(2);
    expect(names).toContain("amount2");
  });
});

describe("buildLegendSnapshot", () => {
  it("produces shell legend items for compare cartesian types", () => {
    const vm = smokeVm("bar-stack");
    const snapshot = buildLegendSnapshot(vm, styleCtx());
    expect(snapshot.items.length).toBeGreaterThan(0);
    expect(snapshot.items[0]?.name).toBeTruthy();
  });

  it("produces shell legend items for dual axes mix", () => {
    const vm = smokeVm("chart-mix");
    const snapshot = buildLegendSnapshot(vm, styleCtx());
    expect(snapshot.items.length).toBeGreaterThanOrEqual(2);
  });

  it("produces shell legend items for pie and funnel", () => {
    const pie = buildLegendSnapshot(smokeVm("pie"), styleCtx());
    expect(pie.items.length).toBeGreaterThan(0);

    const funnel = buildLegendSnapshot(smokeVm("funnel"), styleCtx());
    expect(funnel.items.length).toBeGreaterThan(0);
  });

  it("produces fixed legend items for waterfall", () => {
    const snapshot = buildLegendSnapshot(smokeVm("waterfall"), styleCtx());
    expect(snapshot.items.map((item) => item.name)).toEqual(["增加", "减少"]);
  });
});
