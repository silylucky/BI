import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardCanvasEmptyProps = {
  dragActive?: boolean;
  className?: string;
};

export function DashboardCanvasEmpty({ dragActive = false, className }: DashboardCanvasEmptyProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl border border-dashed transition-colors",
          dragActive
            ? "border-brand-400 bg-brand-50/80 text-brand-600 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-400"
            : "border-gray-300 bg-white/80 text-gray-400 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-500",
        )}
      >
        <LayoutGrid className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {dragActive ? "松开以放置组件" : "画布是空的"}
        </p>
        <p className="mt-1 max-w-xs text-theme-xs text-gray-500 dark:text-gray-400">
          {dragActive
            ? "组件将落在你松手的位置"
            : "从左侧拖拽或点击图表类型；落点由你决定，保存后才会写入看板"}
        </p>
      </div>
    </div>
  );
}
