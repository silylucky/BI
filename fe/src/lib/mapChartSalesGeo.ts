import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { ensureChartSlotCapacity } from "@/components/dashboard/chartFieldSlots";

/** sample_db 三级地图：省→市→区县下钻（需 v_sales_geo 视图） */
export const SALES_GEO_DRILL_SQL = `SELECT province, city, district, SUM(amount) AS total
FROM v_sales_geo
GROUP BY province, city, district`;

/** sample_db 省级聚合（单维度 region 槽位） */
export const SALES_GEO_PROVINCE_SQL = `SELECT province AS region, SUM(amount) AS total
FROM v_sales_geo
GROUP BY province`;

export type SampleDatasourceItem = { id: string; name: string; code: string; database?: string };

/** 从已登记数据源中匹配 docker sample-mysql / sample_db */
export function resolveSampleDbDatasource(
  items: SampleDatasourceItem[],
): SampleDatasourceItem | null {
  const score = (ds: SampleDatasourceItem): number => {
    const dbName = (ds.database ?? "").toLowerCase();
    const code = ds.code.toLowerCase();
    const name = ds.name.toLowerCase();
    let s = 0;
    if (dbName === "sample_db") s += 10;
    else if (dbName.includes("sample_db")) s += 6;
    if (code === "demo") s += 20;
    else if (code === "sample-mysql") s += 4;
    else if (/sample-mysql|demo-mysql|official-demo/.test(`${code} ${name}`)) s += 3;
    else if (/\bsample\b/.test(`${code} ${name}`)) s += 1;
    return s;
  };
  const ranked = items
    .map((ds) => ({ ds, s: score(ds) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.ds ?? null;
}

/** 官方示例 Dataset：区域销售地理（v_sales_geo 视图） */
export const DEMO_SALES_GEO_DATASET_ID = "demo-v-sales-geo";

/** 一键配置 Dataset + 槽位，可选绑定 sample 数据源 */
export function applySalesGeoDrillMapConfig(
  cfg: ChartViewConfig,
  dataSourceId?: string,
  configId?: string,
): ChartViewConfig {
  return ensureChartSlotCapacity({
    ...cfg,
    mode: "dataset",
    sql: undefined,
    datasetId: DEMO_SALES_GEO_DATASET_ID,
    configId: configId ?? cfg.configId,
    dataSourceId: dataSourceId ?? cfg.dataSourceId,
    bindingId: undefined,
    axes: {
      xAxis: [{ field: "province" }],
      yAxis: [{ field: "amount" }],
      drill: [{ field: "city" }, { field: "district" }],
    },
  });
}

export function isSalesGeoMapConfig(cfg: ChartViewConfig): boolean {
  const dims = cfg.dimensions?.map((d) => d.field?.trim()) ?? [];
  return (
    cfg.datasetId === DEMO_SALES_GEO_DATASET_ID ||
    (dims[0] === "province" &&
      dims[1] === "city" &&
      dims[2] === "district" &&
      Boolean(cfg.configId))
  );
}
