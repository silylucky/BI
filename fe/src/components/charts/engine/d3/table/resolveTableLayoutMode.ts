import {
  DEFAULT_TABLE_COLUMN_WIDTH_MODE,
  type TableColumnWidthMode,
} from "@/lib/chartDeTableStyle";
import {
  TABLE_DEFAULT_COL_PX,
  TABLE_DEFAULT_SERIES_PX,
} from "@/components/charts/engine/d3/table/tableLayoutConstants";

export const TABLE_SERIES_FIELD = "__vs_series__";

export type TableColumnWidthPlan = {
  mode: TableColumnWidthMode;
  /** 固定列宽：表格总宽可超出容器，横向滚动 */
  contentScroll: boolean;
  seriesWidth?: string;
  columnWidths: Record<string, string>;
};

export function resolveEffectiveColumnWidthMode(
  mode: TableColumnWidthMode | undefined,
  _columnCount?: number,
): TableColumnWidthMode {
  return mode ?? DEFAULT_TABLE_COLUMN_WIDTH_MODE;
}

type BuildColumnWidthPlanInput = {
  mode: TableColumnWidthMode;
  displayCols: string[];
  showSeriesNumber: boolean;
  columnWidthsPct?: Record<string, number>;
  columnWidthsPx?: Record<string, number>;
  measuredWidthsPx?: Record<string, number> | null;
};

/** 对标 DataEase：自适应=等分铺满；固定列宽=按内容像素宽+横滚；自定义=按比例分配 */
export function buildTableColumnWidthPlan({
  mode,
  displayCols,
  showSeriesNumber,
  columnWidthsPct,
  columnWidthsPx,
  measuredWidthsPx,
}: BuildColumnWidthPlanInput): TableColumnWidthPlan {
  const columnCount = displayCols.length + (showSeriesNumber ? 1 : 0);
  const equalPct = columnCount > 0 ? 100 / columnCount : 100;
  const columnWidths: Record<string, string> = {};

  if (mode === "fixed") {
    for (const col of displayCols) {
      const px = measuredWidthsPx?.[col] ?? TABLE_DEFAULT_COL_PX;
      columnWidths[col] = `${px}px`;
    }
    return {
      mode,
      contentScroll: true,
      seriesWidth: showSeriesNumber
        ? `${measuredWidthsPx?.[TABLE_SERIES_FIELD] ?? TABLE_DEFAULT_SERIES_PX}px`
        : undefined,
      columnWidths,
    };
  }

  if (mode === "custom") {
    for (const col of displayCols) {
      const pct = columnWidthsPct?.[col];
      columnWidths[col] = pct != null && pct > 0 ? `${pct}%` : `${equalPct}%`;
    }
    return {
      mode,
      contentScroll: false,
      seriesWidth: showSeriesNumber ? `${Math.min(equalPct, 8)}%` : undefined,
      columnWidths,
    };
  }

  for (const col of displayCols) {
    columnWidths[col] = `${equalPct}%`;
  }
  return {
    mode: "auto",
    contentScroll: false,
    seriesWidth: showSeriesNumber ? `${Math.min(equalPct, 8)}%` : undefined,
    columnWidths,
  };
}
