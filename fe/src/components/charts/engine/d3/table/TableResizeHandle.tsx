import { cn } from "@/lib/utils";

type TableResizeHandleProps = {
  orientation: "column" | "row";
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
};

/** AntV S2 风格行列拖拽手柄 */
export function TableResizeHandle({
  orientation,
  onPointerDown,
  onDoubleClick,
  className,
}: TableResizeHandleProps) {
  const isColumn = orientation === "column";
  return (
    <div
      role="separator"
      aria-orientation={isColumn ? "vertical" : "horizontal"}
      aria-label={isColumn ? "调整列宽，双击自动适应内容" : "调整行高"}
      data-pixel-no-drag="true"
      className={cn(
        "vs-table-resize-handle absolute z-30 touch-none select-none",
        isColumn
          ? "top-0 -right-1 h-full w-2.5 cursor-col-resize sm:w-3"
          : "bottom-0 left-0 h-2.5 w-full cursor-row-resize",
        className,
      )}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <span
        className={cn(
          "vs-table-resize-handle-line pointer-events-none absolute transition-colors",
          isColumn
            ? "top-1 bottom-1 right-[5px] w-px bg-[var(--dashboard-table-border,#d0d5dd)] group-hover/th:bg-brand-500/80 hover:bg-brand-500"
            : "left-3 right-3 bottom-[5px] h-px bg-[var(--dashboard-table-border,#d0d5dd)] hover:bg-brand-500",
        )}
      />
    </div>
  );
}
