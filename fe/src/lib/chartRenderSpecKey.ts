import type { ChartViewConfig } from "@/lib/chartViewConfig";

/** 仅序列化影响 /charts/render-spec 的字段，稳定 effect 依赖、避免对象引用抖动 */
export function chartRenderSpecKey(config: ChartViewConfig): string {
  return JSON.stringify({
    chartType: config.chartType,
    styleVariant: config.styleVariant,
    dimensions: config.dimensions,
    metrics: config.metrics,
    mode: config.mode,
    dataSourceId: config.dataSourceId,
    bindingId: config.bindingId,
    datasetId: config.datasetId,
    configId: config.configId,
    sql: config.sql,
    schema: config.schema,
    table: config.table,
    nativeBody: config.nativeBody,
    index: config.index,
  });
}
