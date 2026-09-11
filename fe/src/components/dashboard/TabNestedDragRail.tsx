import { GripVertical } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { useTabChildExtract } from "./pixelCanvas/tabChildExtractContext";

/** Tab 内嵌 shape 组件左侧拖出把手（对标 DE：拖回画布顶层） */
export function TabNestedDragRail({
  widgetId,
  className,
}: {
  widgetId: string;
  className?: string;
}) {
  const { beginExtract, extractingWidgetId } = useTabChildExtract();
  const extracting = extractingWidgetId === widgetId;

  return (
    <HintTooltip label="拖出页签到画布">
      <button
        type="button"
        className={cn(
          "tab-nested-drag-rail pixel-shape-drag-rail absolute left-0 top-0 z-[2] flex cursor-grab items-center justify-center border-r border-gray-200/80 bg-gray-50/90 text-gray-400 active:cursor-grabbing dark:border-gray-700 dark:bg-white/[0.06] dark:text-gray-500",
          extracting && "text-brand-500 dark:text-brand-400",
          className,
        )}
        aria-label="拖出页签到画布"
        onPointerDown={(event) => beginExtract(widgetId, event)}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
    </HintTooltip>
  );
}
