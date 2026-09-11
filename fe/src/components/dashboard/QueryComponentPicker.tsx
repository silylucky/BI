import { Calendar, ChevronsUpDown, ListChecks, Type } from "lucide-react";
import type { FilterControlType } from "./layoutUtils";
import { FILTER_CONTROL_META, FILTER_CONTROL_TYPES } from "./layoutUtils";
import type { FilterInsertPayload } from "./createLayoutWidget";
import { cn } from "@/lib/utils";

type QueryComponentPickerProps = {
  onInsert: (payload: FilterInsertPayload) => void;
  onInserted?: () => void;
};

const CONTROL_ICONS: Record<FilterControlType, typeof Type> = {
  text: Type,
  select: ChevronsUpDown,
  date: Calendar,
  multiselect: ListChecks,
};

function ControlTypeTile({
  controlType,
  onInsert,
  onInserted,
}: {
  controlType: FilterControlType;
  onInsert: (payload: FilterInsertPayload) => void;
  onInserted?: () => void;
}) {
  const Icon = CONTROL_ICONS[controlType];
  const label = FILTER_CONTROL_META[controlType].label;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onInsert({ type: "filter", controlType });
        onInserted?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert({ type: "filter", controlType });
          onInserted?.();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-transparent p-3 text-center transition-colors",
        "hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  );
}

/** 对标 DataEase 查询组件入口：选择控件类型后插入 filter widget */
export function QueryComponentPicker({ onInsert, onInserted }: QueryComponentPickerProps) {
  return (
    <div className="space-y-3" data-testid="query-component-picker">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">选择查询控件类型</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTER_CONTROL_TYPES.map((controlType) => (
          <ControlTypeTile
            key={controlType}
            controlType={controlType}
            onInsert={onInsert}
            onInserted={onInserted}
          />
        ))}
      </div>
    </div>
  );
}
