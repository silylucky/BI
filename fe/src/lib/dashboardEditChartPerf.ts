/** 编辑态未选中组件：绘制分辨率上限（逻辑 px），选中后全分辨率 */
export const EDIT_CHART_PAINT_MAX_EDGE = 720;

export function resolveEditPaintMaxEdge(
  editMode: boolean,
  selected: boolean,
): number | undefined {
  if (!editMode || selected) return undefined;
  return EDIT_CHART_PAINT_MAX_EDGE;
}

export function capChartPaintSize(
  size: { width: number; height: number },
  maxEdge?: number,
): { width: number; height: number } {
  if (!maxEdge || maxEdge <= 0) return size;
  const edge = Math.max(size.width, size.height);
  if (edge <= maxEdge) return size;
  const ratio = maxEdge / edge;
  return {
    width: Math.max(48, Math.round(size.width * ratio)),
    height: Math.max(48, Math.round(size.height * ratio)),
  };
}

/** 未选中组件跳过 live resize 重绘，松手/选中后再 commit */
export function shouldDeferEditLivePaint(editMode: boolean, selected: boolean): boolean {
  return editMode && !selected;
}

type EmbeddedMountGateSnapshot = {
  gisBasemapOnly: boolean;
  isGisMapChart: boolean;
  columnCount: number;
  rowCount: number;
};

/**
 * 嵌入图表 mount gate：仅当无法绘制任何内容时才用骨架屏占位。
 * 交互冻结时 queryEnabled 可暂时为 false，但已有数据的图表应继续展示最后一帧。
 */
export function shouldShowEmbeddedMountGateSkeleton(
  renderEnabled: boolean,
  queryEnabled: boolean,
  snapshot: EmbeddedMountGateSnapshot,
): boolean {
  if (!renderEnabled) return true;
  if (queryEnabled) return false;
  if (snapshot.gisBasemapOnly || snapshot.isGisMapChart) return false;
  return snapshot.columnCount === 0 && snapshot.rowCount === 0;
}
