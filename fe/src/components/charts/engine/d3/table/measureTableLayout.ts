import {
  TABLE_AUTO_FIT_SAMPLE_ROWS,
  TABLE_CELL_HORIZONTAL_PADDING_PX,
  TABLE_DEFAULT_COL_PX,
  TABLE_DEFAULT_ROW_PX,
  TABLE_DEFAULT_SERIES_PX,
  TABLE_MAX_COL_PX,
  TABLE_MIN_COL_PX,
  TABLE_MIN_ROW_PX,
} from "@/components/charts/engine/d3/table/tableLayoutConstants";

const SERIES_FIELD = "__vs_series__";

let measureNode: HTMLSpanElement | null = null;

function getMeasureNode(): HTMLSpanElement {
  if (!measureNode) {
    measureNode = document.createElement("span");
    measureNode.style.cssText =
      "position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-size:var(--dashboard-table-body-font-size,14px);font-family:inherit;";
    document.body.appendChild(measureNode);
  }
  return measureNode;
}

export function measureTextWidthPx(text: string): number {
  const node = getMeasureNode();
  node.textContent = text || " ";
  return node.getBoundingClientRect().width;
}

export function clampColumnWidthPx(width: number): number {
  return Math.max(TABLE_MIN_COL_PX, Math.min(TABLE_MAX_COL_PX, Math.round(width)));
}

type MeasureLayoutFromDomOptions = {
  table: HTMLTableElement;
  columns: string[];
  showSeriesNumber: boolean;
};

/** 从当前渲染的表格读取列宽/行高（首次拖拽前保持 auto 布局，按下时再采样） */
export function measureTableLayoutFromDom({
  table,
  columns,
  showSeriesNumber,
}: MeasureLayoutFromDomOptions) {
  const headerRow = table.querySelector("thead tr");
  const headerCells = headerRow ? Array.from(headerRow.querySelectorAll("th")) : [];
  const columnWidthsPx: Record<string, number> = {};
  let cellIndex = 0;

  let seriesColumnWidthPx = showSeriesNumber ? TABLE_DEFAULT_SERIES_PX : 0;
  if (showSeriesNumber && headerCells[cellIndex]) {
    seriesColumnWidthPx = clampColumnWidthPx(headerCells[cellIndex].getBoundingClientRect().width);
    cellIndex += 1;
  }

  for (const col of columns) {
    const th = headerCells[cellIndex];
    columnWidthsPx[col] = clampColumnWidthPx(th?.getBoundingClientRect().width ?? TABLE_DEFAULT_COL_PX);
    cellIndex += 1;
  }

  const bodyRow = table.querySelector("tbody tr");
  const rowHeightPx = Math.max(
    TABLE_MIN_ROW_PX,
    Math.round(bodyRow?.getBoundingClientRect().height ?? TABLE_DEFAULT_ROW_PX),
  );

  return { columnWidthsPx, seriesColumnWidthPx, rowHeightPx };
}

type AutoFitColumnOptions = {
  field: string;
  columns: string[];
  displayCols: string[];
  rows: unknown[][];
  headerLabel: string;
  showSeriesNumber: boolean;
  formatCell: (value: unknown) => string;
};

/** Excel/S2 扩展：按表头 + 采样行内容计算列宽 */
export function measureColumnAutoFitWidth({
  field,
  columns,
  displayCols,
  rows,
  headerLabel,
  showSeriesNumber,
  formatCell,
}: AutoFitColumnOptions): number {
  if (field === SERIES_FIELD) {
    return TABLE_DEFAULT_SERIES_PX;
  }

  const colIndex = columns.indexOf(field);
  if (colIndex < 0 || !displayCols.includes(field)) {
    return TABLE_DEFAULT_COL_PX;
  }

  let max = measureTextWidthPx(headerLabel);
  const sampleCount = Math.min(rows.length, TABLE_AUTO_FIT_SAMPLE_ROWS);
  for (let i = 0; i < sampleCount; i += 1) {
    const raw = rows[i]?.[colIndex];
    max = Math.max(max, measureTextWidthPx(formatCell(raw)));
  }

  const withPadding = max + TABLE_CELL_HORIZONTAL_PADDING_PX + (showSeriesNumber ? 0 : 0);
  return clampColumnWidthPx(withPadding);
}
