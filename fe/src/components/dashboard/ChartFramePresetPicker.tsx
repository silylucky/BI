import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CHART_FRAME_BORDER_PRESETS,
  chartFramePresetThumbStyle,
  type ChartFramePresetId,
} from "@/lib/chartFrameBorderPresets";

const triggerShellVariants = cva(
  "flex h-9 min-w-0 w-full overflow-hidden rounded-lg border bg-white text-left shadow-theme-xs transition-[border-color,box-shadow] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:bg-white/[0.03]",
  {
    variants: {
      open: {
        true: "border-brand-300 ring-2 ring-brand-500/20 dark:border-brand-500/50",
        false:
          "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
      },
    },
    defaultVariants: {
      open: false,
    },
  },
);

type ChartFramePresetPickerProps = {
  value?: string;
  color?: string;
  onChange: (presetId: ChartFramePresetId) => void;
  /** 与 ColorField 并排时传可见标签；不传则仅按钮内文案 */
  label?: string;
  className?: string;
  /** 窄右栏内优先向左展开，避免被视口底部裁切 */
  popoverSide?: "left" | "bottom";
};

function presetIndex(presetId: string): string {
  const match = presetId.match(/(\d+)$/);
  return match?.[1] ?? "1";
}

export function ChartFramePresetPicker({
  value,
  color,
  onChange,
  label,
  className,
  popoverSide = "left",
}: ChartFramePresetPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ?? "frame-1";
  const selectedPreset =
    CHART_FRAME_BORDER_PRESETS.find((item) => item.id === selected) ??
    CHART_FRAME_BORDER_PRESETS[0];
  const indexLabel = presetIndex(selectedPreset.id);
  const pickerLabel = label ?? "装饰样式";

  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <span className="mb-1 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
      ) : null}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={triggerShellVariants({ open })}
            aria-label="选择装饰边框"
            aria-expanded={open}
            onMouseDown={(event) => event.preventDefault()}
          >
            <span
              className="flex h-full w-11 shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50/90 p-1 dark:border-gray-800 dark:bg-white/[0.04]"
              aria-hidden
            >
              <span
                className="h-full w-full rounded-[5px]"
                style={chartFramePresetThumbStyle(selected, color)}
              />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 px-2.5">
              <span className="min-w-0 flex-1 truncate text-theme-xs text-gray-700 dark:text-gray-200">
                {label ? `样式 ${indexLabel}` : pickerLabel}
              </span>
              {!label ? (
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[10px] font-semibold tabular-nums text-gray-700 dark:bg-white/10 dark:text-gray-200">
                  {indexLabel}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                  open && "rotate-180 text-brand-500 dark:text-brand-400",
                )}
                aria-hidden
              />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side={popoverSide}
          collisionPadding={12}
          className="w-[min(15.5rem,calc(100vw-2rem))] max-h-[min(70vh,20rem)] overflow-y-auto overscroll-contain p-2.5"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="mb-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            装饰边框样式
          </p>
          <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="装饰边框">
            {CHART_FRAME_BORDER_PRESETS.map((preset) => {
              const active = preset.id === selected;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-label={preset.label}
                  title={preset.label}
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-lg border transition-colors",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                    active
                      ? "border-brand-500 ring-1 ring-brand-500/30 dark:border-brand-500/70"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
                  )}
                  onClick={() => {
                    onChange(preset.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="absolute inset-1 rounded-md"
                    style={chartFramePresetThumbStyle(preset.id, color)}
                    aria-hidden
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-white/90 px-1 py-px text-[9px] font-medium tabular-nums text-gray-600 shadow-theme-xs dark:bg-gray-900/90 dark:text-gray-300">
                    {presetIndex(preset.id)}
                  </span>
                  {active ? (
                    <span className="absolute left-1 top-1 flex size-4 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-xs">
                      <Check className="size-2.5" aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
