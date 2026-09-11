import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import type { ChartType } from "@/lib/chartTypes";

const DEFAULT_DATASET_ID = "demo-sales-wide";
const DEFAULT_CONFIG_ID = "d769b018-4fc9-46ea-a055-45c67ec6a318";
const DEFAULT_DATASOURCE_ID = "550e8400-e29b-41d4-a716-446655440000";

/** 测试/ smoke 用：生成 Dataset-only 图表配置，替代存量 mode=sql fixture。 */
export function makeDatasetChartConfig(
  chartType: ChartType = "line",
  overrides: Partial<ChartViewConfig> = {},
): ChartViewConfig {
  return {
    ...defaultChartConfig(chartType),
    mode: "dataset",
    dataSourceId: DEFAULT_DATASOURCE_ID,
    datasetId: DEFAULT_DATASET_ID,
    configId: DEFAULT_CONFIG_ID,
    sql: undefined,
    bindingId: undefined,
    ...overrides,
  };
}
