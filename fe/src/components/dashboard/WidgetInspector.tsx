import { MousePointerClick } from "lucide-react";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { cn } from "@/lib/utils";
import type { LayoutWidget } from "./layoutUtils";
import { ChartEditRailWithProvider } from "./ChartEditRail";

type WidgetInspectorProps = {
  widget: LayoutWidget | null;
  onChange: (chartConfig: ChartViewConfig) => void;
  onDelete?: () => void;
  className?: string;
  embedded?: boolean;
};

function InspectorEmpty({ embedded }: { embedded?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-10 text-center",
        !embedded &&
          "rounded-2xl border border-dashed border-gray-300 bg-white shadow-theme-xs dark:border-gray-700 dark:bg-white/[0.02]",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500">
        <MousePointerClick className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-theme-sm font-medium text-gray-800 dark:text-white/90">未选中组件</p>
      <p className="mt-1 max-w-[220px] text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
        在画布中点击图表，左侧配置槽位、右侧拖入字段。
      </p>
    </div>
  );
}

export function WidgetInspector({
  widget,
  onChange,
  onDelete,
  className,
  embedded = false,
}: WidgetInspectorProps) {
  if (!widget) {
    return (
      <div className={cn("w-full", className)}>
        <InspectorEmpty embedded={embedded} />
      </div>
    );
  }

  return (
    <div className={cn("h-full min-h-0 w-full", className)}>
      <ChartEditRailWithProvider widget={widget} onChange={onChange} onDelete={onDelete} />
    </div>
  );
}
