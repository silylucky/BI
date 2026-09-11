import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, LayoutDashboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardList } from "@/hooks/useDashboardList";
import {
  buildDashboardNameCounts,
  dashboardPickerMeta,
  dashboardPickerPrimaryLabel,
  matchesDashboardPickerQuery,
  shortDashboardId,
} from "@/lib/dashboardPickerDisplay";
import { cn } from "@/lib/utils";
import { INSPECTOR_SELECT, InspectorSubtleEmpty } from "./inspectorCompact";

type DashboardPickerFieldProps = {
  value?: string;
  onChange: (dashboardId: string) => void;
  currentDashboardId?: string;
  disabled?: boolean;
  dense?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** 可搜索看板选择（组件复用等） */
export function DashboardPickerField({
  value,
  onChange,
  currentDashboardId,
  disabled = false,
  dense = true,
  className,
  "aria-label": ariaLabel = "选择目标看板",
}: DashboardPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, refetch, isFetching } = useDashboardList();
  const items = data?.items ?? [];
  const nameCounts = useMemo(() => buildDashboardNameCounts(items), [items]);
  const selected = items.find((item) => item.id === value);
  const filtered = useMemo(
    () => items.filter((item) => matchesDashboardPickerQuery(item, query)),
    [items, query],
  );
  const fieldClass = cn(dense ? INSPECTOR_SELECT : "h-11 w-full rounded-lg", className);
  const pickerDisabled = disabled || isLoading || isFetching;

  if (isError) {
    return (
      <div className="space-y-1.5">
        <InspectorSubtleEmpty message="看板列表加载失败" />
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 w-full text-theme-xs"
          onClick={() => void refetch()}
        >
          重试
        </Button>
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return <InspectorSubtleEmpty message="暂无可用看板，请先在「看板管理」中创建" />;
  }

  const triggerPrimary = selected
    ? dashboardPickerPrimaryLabel(selected, nameCounts)
    : value?.trim()
      ? `${shortDashboardId(value)}（已删除或无权访问）`
      : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={pickerDisabled}
          className={cn(
            fieldClass,
            "justify-between gap-1 px-2 font-normal shadow-theme-xs",
            !triggerPrimary && "text-gray-400 dark:text-white/30",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <LayoutDashboard
              className="size-3.5 shrink-0 text-gray-400 dark:text-gray-500"
              aria-hidden
            />
            <span className="min-w-0 truncate">
              {isLoading ? "加载看板列表…" : triggerPrimary ?? "选择目标看板"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-gray-400" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-1.5rem),18rem)] p-0"
        align="start"
        sideOffset={6}
      >
        <div className="border-b border-gray-100 p-2 dark:border-white/[0.06]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索看板名称 / ID"
              className="h-8 rounded-md border-gray-200 bg-gray-50/80 pl-7 text-theme-xs dark:border-gray-800 dark:bg-white/[0.03]"
              aria-label="搜索目标看板"
            />
          </div>
        </div>
        <ScrollArea className="max-h-52">
          <div className="p-1">
            {value && !selected ? (
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  "bg-brand-50 dark:bg-brand-500/10",
                )}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                }}
              >
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px] text-gray-800 dark:text-white/90">
                    {value}
                  </span>
                  <span className="block text-[10px] text-gray-400">已删除或无权访问</span>
                </span>
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-[10px] text-gray-400">无匹配看板</p>
            ) : (
              filtered.map((item) => {
                const isSelected = item.id === value;
                const isCurrent = item.id === currentDashboardId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                      "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                      "dark:hover:bg-white/[0.04]",
                      isSelected && "bg-brand-50 dark:bg-brand-500/10",
                    )}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0 text-brand-500",
                        !isSelected && "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-[11px] font-medium text-gray-800 dark:text-white/90">
                        <span className="truncate">
                          {dashboardPickerPrimaryLabel(item, nameCounts)}
                        </span>
                        {isCurrent ? (
                          <span className="shrink-0 rounded bg-gray-100 px-1 py-px text-[9px] font-normal text-gray-500 dark:bg-white/10 dark:text-gray-400">
                            当前
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                        {dashboardPickerMeta(item)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
