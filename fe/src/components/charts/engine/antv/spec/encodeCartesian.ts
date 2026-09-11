import type { RenderSpec } from "@/components/charts/engine/types";
import {
  applyLineStyleVariant,
  buildCartesianCategorySeries,
} from "@/components/charts/engine/buildDatasetEncoding";

export type AntvCartesianRow = Record<string, string | number>;

/** 笛卡尔图（line/bar）→ G2Plot 长表数据 */
export function encodeCartesianRows(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
  seriesType: "line" | "bar",
): { data: AntvCartesianRow[]; xField: string; yField: string; seriesField?: string; isHorizontal: boolean } {
  const { xData, series, isHorizontal } = buildCartesianCategorySeries(
    spec,
    rows,
    columns,
    seriesType,
    seriesType === "line" ? applyLineStyleVariant : undefined,
  );
  const xField = "__category__";
  const yField = "__value__";
  const seriesField = series.length > 1 ? "__series__" : undefined;
  const data: AntvCartesianRow[] = [];

  for (const s of series) {
    const name = String(s.name ?? "");
    const values = (s.data ?? []) as number[];
    xData.forEach((cat, i) => {
      const row: AntvCartesianRow = {
        [xField]: cat,
        [yField]: Number(values[i] ?? 0),
      };
      if (seriesField) row[seriesField] = name;
      data.push(row);
    });
  }

  return { data, xField, yField, seriesField, isHorizontal };
}
