import type { PointerEvent } from "react";
import { cn } from "@/lib/utils";

type WidgetEditRailResizeHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
  ariaLabel?: string;
  testId?: string;
};

/** 图表编辑双列 / 画布与右栏之间的拖拽分隔条 */
export function WidgetEditRailResizeHandle({
  onPointerDown,
  className,
  ariaLabel = "调整配置与数据集列宽",
  testId = "widget-edit-rail-resize-handle",
}: WidgetEditRailResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={cn(
        "group relative z-[2] h-full shrink-0 cursor-col-resize touch-none select-none",
        "bg-transparent hover:bg-brand-100/80 dark:hover:bg-brand-500/15",
        className,
      )}
      data-testid={testId}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 group-hover:bg-brand-400 dark:bg-gray-700 dark:group-hover:bg-brand-400"
        aria-hidden
      />
    </div>
  );
}
