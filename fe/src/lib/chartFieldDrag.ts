/** HTML5 拖放：字段库 → 图表槽位 */
export const FIELD_DRAG_MIME = "application/x-vitalspan-field";

export function writeFieldDragData(dataTransfer: DataTransfer, field: string): void {
  dataTransfer.setData(FIELD_DRAG_MIME, field);
  // 部分浏览器仅 text/plain 可在 drop 时读回
  dataTransfer.setData("text/plain", field);
  dataTransfer.effectAllowed = "copy";
}

export function readFieldDragData(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(FIELD_DRAG_MIME).trim() ||
    dataTransfer.getData("text/plain").trim()
  );
}

/** 字段槽禁用：仅当列已加载完且确实为空时禁用（加载中保留可拖入） */
export function isChartFieldDropDisabled(
  columnsLoading: boolean,
  columns: string[],
): boolean {
  if (columns.length > 0) return false;
  return !columnsLoading;
}
