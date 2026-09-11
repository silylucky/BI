/**
 * Dashboard 画布栅格引擎：react-grid-layout v2
 *
 * - `useContainerWidth` 替代 WidthProvider，避免 flex/overflow 嵌套测宽失败
 * - 编辑/预览共用 ReactGridLayout legacy API（与 PRD DASH-002 一致）
 */
import type { CSSProperties, DragEvent, ReactNode } from "react";
import {
  ReactGridLayout,
  type Layout,
  type LayoutItem,
} from "react-grid-layout/legacy";
import { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { GRID_ROW_HEIGHT } from "./gridLayoutAdapter";
import { GRID_COLS } from "./gridSnapUtils";

export const DASHBOARD_GRID_MARGIN: [number, number] = [0, 0];
export const DASHBOARD_GRID_ROW_HEIGHT = GRID_ROW_HEIGHT;
export const DASHBOARD_GRID_COLS = GRID_COLS;

/** RGL 外部拖入占位 id（palette → canvas） */
export const PALETTE_DROP_ITEM_ID = "__palette_drop__";

/** 八向缩放手柄（对标 DataEase shape-point） */
export const DASHBOARD_GRID_RESIZE_HANDLES = ["s", "w", "e", "n", "sw", "nw", "se", "ne"] as const;

export type DashboardRglCanvasProps = {
  layout: Layout;
  editable: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  margin?: [number, number];
  droppingItem?: LayoutItem;
  isDroppable?: boolean;
  onLayoutChange?: (layout: Layout) => void;
  onDragStart?: (widgetId: string) => void;
  onDrag?: (layout: Layout) => void;
  onDragStop?: (layout: Layout) => void;
  onResizeStart?: (widgetId: string) => void;
  onResize?: (layout: Layout) => void;
  onResizeStop?: (layout: Layout) => void;
  onDrop?: (layout: Layout, item: LayoutItem | undefined, e: Event) => void;
  onDropDragOver?: (e: DragEvent) => { w?: number; h?: number } | false | void;
};

/** 统一 RGL 配置：编辑/预览共用，避免 edit/view 布局漂移 */
export function DashboardRglCanvas({
  layout,
  editable,
  className,
  style,
  margin = DASHBOARD_GRID_MARGIN,
  children,
  droppingItem,
  isDroppable = false,
  onLayoutChange,
  onDragStart,
  onDrag,
  onDragStop,
  onResizeStart,
  onResize,
  onResizeStop,
  onDrop,
  onDropDragOver,
}: DashboardRglCanvasProps) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 });
  const gridWidth = width > 0 ? width : 1200;

  return (
    <div ref={containerRef} className="dashboard-rgl-width-host min-h-0 w-full">
      <ReactGridLayout
        className={className}
        style={style}
        width={gridWidth}
        layout={layout}
        cols={DASHBOARD_GRID_COLS}
        rowHeight={DASHBOARD_GRID_ROW_HEIGHT}
        margin={margin}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        autoSize
        isDraggable={editable}
        isResizable={editable}
        isDroppable={isDroppable}
        droppingItem={droppingItem}
        resizeHandles={editable ? [...DASHBOARD_GRID_RESIZE_HANDLES] : undefined}
        draggableHandle={editable ? ".dashboard-drag-handle" : undefined}
        draggableCancel={editable ? ".dashboard-no-drag" : undefined}
        useCSSTransforms
        onLayoutChange={onLayoutChange}
        onDragStart={
          editable
            ? (_layout, _oldItem, newItem) => onDragStart?.(newItem.i)
            : undefined
        }
        onDrag={editable ? (nextLayout) => onDrag?.(nextLayout) : undefined}
        onDragStop={editable ? (nextLayout) => onDragStop?.(nextLayout) : undefined}
        onResizeStart={
          editable
            ? (_layout, _oldItem, newItem) => onResizeStart?.(newItem.i)
            : undefined
        }
        onResize={editable ? (nextLayout) => onResize?.(nextLayout) : undefined}
        onResizeStop={editable ? (nextLayout) => onResizeStop?.(nextLayout) : undefined}
        onDrop={onDrop}
        onDropDragOver={onDropDragOver}
      >
        {children}
      </ReactGridLayout>
    </div>
  );
}
