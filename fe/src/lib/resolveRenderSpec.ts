import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { RenderSpec } from "@/components/charts/engine/types";
import { activeFieldRefs } from "@/lib/chartConfigState";
import { getEngineIdForChartType } from "@/components/charts/engine/registry";

function buildRenderSource(config: ChartViewConfig): Record<string, unknown> {
  if (config.bindingId) {
    return { bindingId: config.bindingId };
  }
  const source: Record<string, unknown> = {
    mode: config.mode,
    dataSourceId: config.dataSourceId ?? null,
  };
  if (config.mode === "sql") {
    source.sql = config.sql;
  } else if (config.mode === "table") {
    source.schema = config.schema;
    source.table = config.table;
  }
  return source;
}

/** 前端本地构建 render-spec，与 backend `build_render_spec` 字段对齐 */
export function resolveRenderSpec(config: ChartViewConfig): RenderSpec {
  return {
    engine: getEngineIdForChartType(config.chartType),
    chartType: config.chartType,
    styleVariant: config.styleVariant ?? "default",
    encoding: {
      dimensions: activeFieldRefs(config.dimensions),
      metrics: activeFieldRefs(config.metrics),
    },
    source: buildRenderSource(config),
  };
}
