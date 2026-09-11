import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  SHAPE_DRAG_EDGE_BOTTOM_INSET_SCREEN_PX,
  SHAPE_DRAG_EDGE_RIGHT_TOP_SCREEN_PX,
  SHAPE_DRAG_EDGE_SIDE_SCREEN_PX,
  SHAPE_DRAG_EDGE_TOP_SCREEN_PX,
} from "./geometry";

type PixelShapeDragEdgesProps = {
  widgetId: string;
  scale: number;
  onDragPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onDragKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

/** 对标 DE `.de-drag-area`：透明边带拖移，不占布局、不单独染色 */
export function PixelShapeDragEdges({
  widgetId,
  scale,
  onDragPointerDown,
  onDragKeyDown,
}: PixelShapeDragEdgesProps) {
  const safeScale = scale > 0 ? scale : 1;
  const top = SHAPE_DRAG_EDGE_TOP_SCREEN_PX / safeScale;
  const side = SHAPE_DRAG_EDGE_SIDE_SCREEN_PX / safeScale;
  const bottomInset = SHAPE_DRAG_EDGE_BOTTOM_INSET_SCREEN_PX / safeScale;
  const rightTop = SHAPE_DRAG_EDGE_RIGHT_TOP_SCREEN_PX / safeScale;

  const edgeClass = cn(
    "pixel-shape-drag-edge absolute z-20 touch-none select-none",
    "cursor-grab active:cursor-grabbing",
  );

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onDragPointerDown(event);
  };

  return (
    <>
      <div
        data-testid={`pixel-drag-edge-top-${widgetId}`}
        className={cn(edgeClass, "pixel-shape-drag-edge-top")}
        style={{ left: 1, top: 1, right: 1, height: top }}
        aria-label="拖动组件"
        role="button"
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onDragKeyDown}
      />
      <div
        data-testid={`pixel-drag-edge-left-${widgetId}`}
        className={cn(edgeClass, "pixel-shape-drag-edge-left")}
        style={{ left: 1, top: 1, width: side, bottom: bottomInset }}
        onPointerDown={startDrag}
      />
      <div
        data-testid={`pixel-drag-edge-right-${widgetId}`}
        className={cn(edgeClass, "pixel-shape-drag-edge-right")}
        style={{ right: 1, top: rightTop, width: side, bottom: bottomInset }}
        onPointerDown={startDrag}
      />
      <div
        data-testid={`pixel-drag-edge-bottom-${widgetId}`}
        className={cn(edgeClass, "pixel-shape-drag-edge-bottom")}
        style={{ left: rightTop, right: 1, bottom: 1, height: top }}
        onPointerDown={startDrag}
      />
    </>
  );
}
