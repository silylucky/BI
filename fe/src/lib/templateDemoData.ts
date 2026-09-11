import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { DashboardLayout, LayoutWidget } from "@/components/dashboard/layoutUtils";
import { resolveSampleDbDatasource, type SampleDatasourceItem } from "@/lib/mapChartSalesGeo";
import { isValidComponentUuid } from "@/lib/vizComponents";

/** 与 backend `demo_datasource.TEMPLATE_DEMO_DATASOURCE_REF` 对齐 */
export const TEMPLATE_DEMO_DATASOURCE_REF = "__demo:sample_db__";

/** 导出/跨环境复用时：环境 UUID 或空 → 演示占位符（保留 SQL/维度量） */
export function normalizeChartConfigForPortableDemo(
  chartConfig: ChartViewConfig,
): ChartViewConfig {
  if (chartConfig.bindingId) return chartConfig;
  const mode =
    chartConfig.mode ??
    (chartConfig.sql?.trim() ? "sql" : chartConfig.table ? "table" : undefined);
  const current = chartConfig.dataSourceId;
  if (current === TEMPLATE_DEMO_DATASOURCE_REF) return chartConfig;
  const shouldNormalize =
    !current ||
    current === "" ||
    (typeof current === "string" && isValidComponentUuid(current));
  if (
    shouldNormalize &&
    (mode === "sql" || mode === "table" || mode === "dataset" || mode === undefined)
  ) {
    return { ...chartConfig, dataSourceId: TEMPLATE_DEMO_DATASOURCE_REF };
  }
  return chartConfig;
}

function normalizeWidgetForTemplateExport(widget: LayoutWidget): LayoutWidget {
  if (widget.type !== "chart" || !widget.chartConfig) return widget;
  return {
    ...widget,
    chartConfig: normalizeChartConfigForPortableDemo(widget.chartConfig),
  };
}

/** 模板/大屏 JSON 导出前：统一 chart dataSourceId 为演示占位符 */
export function normalizeLayoutForTemplateExport<T extends DashboardLayout>(layout: T): T {
  return {
    ...layout,
    widgets: layout.widgets.map((w) =>
      normalizeWidgetForTemplateExport(w as LayoutWidget),
    ) as T["widgets"],
  };
}

function shouldBindChartDataSource(dataSourceId: string | undefined): boolean {
  return !dataSourceId || dataSourceId === TEMPLATE_DEMO_DATASOURCE_REF;
}

function bindWidgetDemoDatasource(widget: LayoutWidget, dataSourceId: string): LayoutWidget {
  if (widget.type !== "chart" || !widget.chartConfig) return widget;
  if (!shouldBindChartDataSource(widget.chartConfig.dataSourceId)) return widget;
  return {
    ...widget,
    chartConfig: {
      ...widget.chartConfig,
      dataSourceId,
    },
  };
}

/** Hub 预览 / 使用模板前：将演示 SQL 绑定到 sample_db 数据源 */
export function bindTemplateDemoDatasource(
  layout: DashboardLayout,
  dataSourceId: string | null | undefined,
): DashboardLayout {
  if (!dataSourceId) return layout;
  if (layout.version === 1) {
    return {
      ...layout,
      widgets: layout.widgets.map((w) => bindWidgetDemoDatasource(w, dataSourceId)),
    };
  }
  return {
    ...layout,
    widgets: layout.widgets.map((w) => bindWidgetDemoDatasource(w, dataSourceId)),
  };
}

export function resolveTemplateDemoDatasourceId(items: SampleDatasourceItem[]): string | null {
  return resolveSampleDbDatasource(items)?.id ?? null;
}

/** 执行查数前：将演示占位符绑定到当前环境的 sample_db 数据源 */
export function bindChartConfigDemoDatasource(
  chartConfig: ChartViewConfig,
  demoDatasourceId: string | null | undefined,
): ChartViewConfig {
  if (!demoDatasourceId) return chartConfig;
  if (chartConfig.dataSourceId !== TEMPLATE_DEMO_DATASOURCE_REF) return chartConfig;
  return { ...chartConfig, dataSourceId: demoDatasourceId };
}

/** 模板是否含需演示库查数的图表（无 bindingId 的 SQL/表模式） */
export function layoutRequiresDemoCharts(layout: DashboardLayout): boolean {
  return layout.widgets.some((widget) => {
    if (widget.type !== "chart") return false;
    const cfg = widget.chartConfig;
    if (!cfg || cfg.bindingId) return false;
    return Boolean(cfg.sql?.trim() || cfg.mode === "table" || cfg.mode === "sql");
  });
}
