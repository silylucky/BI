export declare const TEMPLATE_DEMO_DATASOURCE_REF = "__demo:sample_db__";
export declare function demoChartTitle(chartType: string): string | undefined;
/** 内置图演示绑定：Dataset 模式 + 官方示例字段编码（禁止 SQL，与 FE isChartExecuteReady 对齐） */
export declare function buildDemoChartConfig(chartType: string, chartId: string, styleVariant?: string, title?: string): Record<string, unknown>;
