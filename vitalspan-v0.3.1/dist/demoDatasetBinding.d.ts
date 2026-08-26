/** 与 backend/app/dashboard/templates/rebind_demo_encodings.py 保持语义一致 */
export declare const DEMO_DATASET_WIDE = "demo-sales-wide";
export declare const DEMO_DATASET_DETAIL = "demo-sales-detail";
export declare const DEMO_DATASET_GEO = "demo-v-sales-geo";
export declare const DEMO_DATASET_GRID = "demo-gov-grid-stats";
type AxisMap = Record<string, string[]>;
export type DemoEncoding = {
    datasetId: string;
    dimensions: string[];
    metrics: string[];
    axes: AxisMap;
};
export declare function encodingFor(chartType: string, title: string): DemoEncoding;
export declare function applyDemoEncodingToChartConfig(chartType: string, chartId: string, title: string, styleVariant?: string): Record<string, unknown>;
export {};
