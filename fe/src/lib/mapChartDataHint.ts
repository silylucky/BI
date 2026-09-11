import { SALES_GEO_DRILL_SQL, SALES_GEO_PROVINCE_SQL } from "@/lib/mapChartSalesGeo";

export { SALES_GEO_DRILL_SQL, SALES_GEO_PROVINCE_SQL };

export type MapChartFieldHint = {
  message: string;
  /** 右栏展示的示例 SQL；null 表示仅文案、不展示代码块 */
  sampleSql: string | null;
};

export function mapChartFieldHint(columns: string[]): MapChartFieldHint | null {
  const normalized = columns.map((c) => c.trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  const hasProvince = normalized.some((c) => /province|省份|^region$/i.test(c));
  const hasCity = normalized.some((c) => /^(city|城市)$/i.test(c) || /city$/i.test(c));
  const hasDistrict = normalized.some((c) => /district|区县/i.test(c));

  if (hasProvince && hasCity) {
    return {
      message: hasDistrict
        ? "已具备省/市/区县字段：拖入对应槽位，预览态双击地图下钻。"
        : "已具备省/市字段：预览态双击省可下钻到市级地图。",
      sampleSql: null,
    };
  }

  const hasGeoName = normalized.some(
    (c) =>
      /(?:^|_)(region|province|city|area|name)(?:$|_)/i.test(c) &&
      !/(?:^|_)(region_id|product_id|customer_id)(?:$|_)/i.test(c),
  );
  if (hasGeoName) return null;

  if (normalized.includes("region_id")) {
    return {
      message:
        "region_id 为演示库行政区划 ID（含省/市/区县），全国视图会自动上卷到省级。生产环境请 JOIN regions 取 province/city，或改用 v_sales_geo。",
      sampleSql: SALES_GEO_DRILL_SQL,
    };
  }

  return {
    message:
      "省级：34 省离线底图。市：33 省可下钻；区县：仅部分城市已打包边界。请用 sample_db 视图 v_sales_geo 配置 province / city / district。",
    sampleSql: SALES_GEO_DRILL_SQL,
  };
}
