import { Fragment, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { ChevronDown, Highlighter, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPickerPanel } from "@/components/ui/color-picker-panel";
import { ColorSwatchChip } from "@/components/ui/color-swatch-chip";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { normalizeHexColor } from "@/components/ui/color-utils";

export { normalizeHexColor } from "@/components/ui/color-utils";

export type ColorSwatch = {
  color: string;
  label: string;
};

type ColorFieldProps = {
  value: string;
  onChange: (value: string | undefined) => void;
  /** 无组件级覆盖时用于预览/取色器初值（不写入 onChange） */
  fallbackValue?: string;
  swatches?: readonly ColorSwatch[] | readonly string[];
  label?: string;
  allowClear?: boolean;
  compact?: boolean;
  /** field：完整输入；swatch：紧凑分栏（色块 + Hex 提示 + 下拉） */
  variant?: "field" | "swatch";
  /** 取色按钮 aria-label（外层已有可见标签时不传 label，用此项） */
  buttonAriaLabel?: string;
  /** swatch：是否在控件上方显示 label；行内配色行由左侧标签承担时应为 false */
  showLabel?: boolean;
  /** swatch 触发器形态：chip 通用色块；text 字色 A+下划线；highlight 荧光笔+色块 */
  swatchTriggerPreset?: "chip" | "text" | "highlight";
  /** 行内配色（左侧已有标签）时关闭悬停 Tooltip，避免与 Popover 抢焦点 */
  showHintTooltip?: boolean;
  className?: string;
  /** 取色器/输入框连续变更时防抖提交，减轻画布等大组件重渲染 */
  liveCommitMs?: number;
  /** 有推荐色板时默认展开 */
  swatchesDefaultOpen?: boolean;
  /** 透传给 PopoverContent（className / style / data-* 等） */
  popoverContentProps?: Omit<ComponentPropsWithoutRef<typeof PopoverContent>, "children">;
};

const DEFAULT_LIVE_COMMIT_MS = 120;

const FIELD_SHELL =
  "flex w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-1.5 shadow-theme-xs transition-[border-color,box-shadow] focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-white/[0.03] dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/15";

const swatchTriggerVariants = cva(
  "flex h-9 overflow-hidden rounded-lg border bg-white text-left shadow-theme-xs transition-[border-color,box-shadow] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:bg-white/[0.03]",
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

function normalizeSwatches(
  swatches: readonly ColorSwatch[] | readonly string[],
): ColorSwatch[] {
  if (swatches.length === 0) return [];
  if (typeof swatches[0] === "string") {
    return (swatches as readonly string[]).map((color) => ({ color, label: color }));
  }
  return swatches as ColorSwatch[];
}

function resolveCommitValue(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return normalizeHexColor(trimmed) ?? undefined;
}

export function ColorField({
  value,
  onChange,
  fallbackValue,
  swatches = [],
  label,
  allowClear = true,
  compact = false,
  variant = "field",
  className,
  buttonAriaLabel,
  showLabel,
  liveCommitMs = DEFAULT_LIVE_COMMIT_MS,
  swatchesDefaultOpen: _swatchesDefaultOpen = false,
  popoverContentProps,
  swatchTriggerPreset = "chip",
  showHintTooltip = true,
}: ColorFieldProps) {
  const {
    className: popoverClassName,
    style: popoverStyle,
    ...restPopoverContentProps
  } = popoverContentProps ?? {};
  const items = normalizeSwatches(swatches);
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** null=清除；string=色值；undefined=无待提交 */
  const pendingRef = useRef<string | null | undefined>(undefined);

  onChangeRef.current = onChange;

  // 取色器打开或防抖未 flush 时，本地 draft 优先，避免父级回写导致拖拽跳色
  useEffect(() => {
    if (open) return;
    if (timerRef.current != null) return;
    setLocalValue(value);
  }, [value, open]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const flushCommit = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current === undefined) return;
    const next = pendingRef.current;
    pendingRef.current = undefined;
    onChangeRef.current(next === null || next === "" ? undefined : next);
  };

  const queueCommit = (next: string | null, immediate: boolean) => {
    pendingRef.current = next;
    if (immediate || liveCommitMs <= 0) {
      flushCommit();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushCommit, liveCommitMs);
  };

  const commitNow = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      queueCommit(null, true);
      return;
    }
    const resolved = resolveCommitValue(raw);
    if (resolved === undefined) return;
    queueCommit(resolved, true);
  };

  const scheduleCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      queueCommit(null, false);
      return;
    }
    const resolved = resolveCommitValue(raw);
    if (resolved === undefined) return;
    queueCommit(resolved, false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && pendingRef.current !== undefined) flushCommit();
  };

  const applyColor = (next: string, immediate = false) => {
    setLocalValue(next);
    const resolved = resolveCommitValue(next);
    if (resolved === undefined) return;
    queueCommit(resolved, immediate);
  };

  const explicitHex = normalizeHexColor(localValue);
  const fallbackHex = fallbackValue ? normalizeHexColor(fallbackValue) : undefined;
  const previewHex = explicitHex ?? fallbackHex;
  const pickerSeed = localValue || fallbackValue || "";
  const pickerLabel = buttonAriaLabel ?? (label ? `${label}取色器` : "取色器");
  const popoverTitle = label ?? buttonAriaLabel?.replace(/取色器$/, "") ?? "颜色";
  const chipSize = compact || variant === "swatch" ? "sm" : "md";
  const popoverAlign = variant === "swatch" ? "start" : compact ? "end" : "start";
  const popoverSide = variant === "swatch" ? "bottom" : compact ? "left" : "bottom";
  const swatchLabelVisible = showLabel ?? Boolean(label);
  const swatchTitle = previewHex
    ? `${popoverTitle} · ${previewHex.toUpperCase()}`
    : popoverTitle;

  const popoverBody = (
    <PopoverContent
      align={popoverAlign}
      side={popoverSide}
      sideOffset={6}
      collisionPadding={12}
      onOpenAutoFocus={(event) => event.preventDefault()}
      className={cn(
        "w-[228px] max-h-[min(70vh,24rem)] overflow-y-auto overscroll-contain p-2.5",
        popoverClassName,
      )}
      style={popoverStyle}
      {...restPopoverContentProps}
    >
      <p className="mb-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">{popoverTitle}</p>
      <ColorPickerPanel value={pickerSeed} onChange={applyColor} />
      {items.length > 0 ? (
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <p className="mb-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">推荐</p>
          <div
            className="grid grid-cols-6 gap-1"
            role="listbox"
            aria-label={label ? `${label}推荐色` : "推荐色"}
          >
            {items.map((item) => {
              const selected = previewHex === normalizeHexColor(item.color);
              const swatchOption = (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={item.label}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                    "dark:hover:bg-white/5",
                    selected &&
                      "bg-brand-50/80 ring-1 ring-inset ring-brand-500/50 dark:bg-brand-500/10",
                  )}
                  onClick={() => applyColor(item.color, true)}
                >
                  <ColorSwatchChip color={item.color} size="sm" selected={selected} />
                </button>
              );
              return showHintTooltip ? (
                <HintTooltip key={item.color} label={item.label}>
                  {swatchOption}
                </HintTooltip>
              ) : (
                <Fragment key={item.color}>{swatchOption}</Fragment>
              );
            })}
          </div>
        </div>
      ) : null}
      {variant === "swatch" && allowClear && explicitHex ? (
        <button
          type="button"
          className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          onClick={() => {
            setLocalValue("");
            queueCommit(null, true);
            setOpen(false);
          }}
        >
          清除颜色
        </button>
      ) : null}
    </PopoverContent>
  );

  if (variant === "swatch") {
    const inkColor = previewHex || "#111827";
    const highlightPreview = previewHex || "#fef08a";

    const swatchButton = (
      <button
        type="button"
        className={cn(
          swatchTriggerVariants({ open }),
          swatchTriggerPreset === "text" && "inline-flex h-7 items-center gap-0.5 px-0",
          swatchTriggerPreset === "highlight" && "h-7",
        )}
        aria-label={pickerLabel}
        aria-expanded={open}
        title={swatchTitle}
        onMouseDown={(event) => event.preventDefault()}
      >
        {swatchTriggerPreset === "text" ? (
          <>
            <span className="flex flex-col items-center justify-center gap-0.5 px-1.5">
              <span className="text-sm font-bold leading-none">A</span>
              <span
                className="h-0.5 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                style={{ backgroundColor: inkColor }}
              />
            </span>
            <ChevronDown
              className={cn(
                "mr-1 size-3.5 shrink-0 opacity-60 transition-transform",
                open && "rotate-180 text-brand-500",
              )}
              aria-hidden
            />
          </>
        ) : swatchTriggerPreset === "highlight" ? (
          <>
            <span className="flex h-full items-center gap-1 border-r border-gray-100 px-1.5 dark:border-gray-800">
              <Highlighter className="size-3.5 shrink-0 opacity-80" aria-hidden />
              <ColorSwatchChip
                color={highlightPreview}
                size={chipSize}
                className={!previewHex ? "opacity-50" : undefined}
              />
            </span>
            <span className="flex shrink-0 items-center gap-1 px-1.5">
              {!previewHex ? (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">无</span>
              ) : null}
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                  open && "rotate-180 text-brand-500 dark:text-brand-400",
                )}
                aria-hidden
              />
            </span>
          </>
        ) : (
          <>
            <span
              className="flex h-full w-10 shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50/90 p-1.5 dark:border-gray-800 dark:bg-white/[0.04]"
              aria-hidden
            >
              <ColorSwatchChip color={previewHex || undefined} size={chipSize} />
            </span>
            <span className="flex shrink-0 items-center gap-1 px-2">
              {!previewHex ? (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">未设置</span>
              ) : null}
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                  open && "rotate-180 text-brand-500 dark:text-brand-400",
                )}
                aria-hidden
              />
            </span>
          </>
        )}
      </button>
    );

    return (
      <div className={cn("min-w-0 shrink-0", className)}>
        {label && swatchLabelVisible ? (
          <Label className="mb-1 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </Label>
        ) : null}
        <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
          {/* 禁止 HintTooltip 套在 Trigger 内：TooltipTrigger+PopoverTrigger 双重 asChild 会抢走点击 */}
          <PopoverTrigger asChild>{swatchButton}</PopoverTrigger>
          {popoverBody}
        </Popover>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-0" : "space-y-2", className)}>
      {label ? (
        <Label className="text-theme-xs text-gray-600 dark:text-gray-400">{label}</Label>
      ) : null}
      <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
        <div className={cn(FIELD_SHELL, compact ? "h-8" : "h-9")}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={pickerLabel}
              aria-expanded={open}
              title="打开取色器"
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-md py-0.5 pl-0.5 pr-1 transition-colors",
                "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30",
                "dark:hover:bg-white/5",
                open && "bg-gray-50 ring-1 ring-inset ring-brand-200 dark:bg-white/5 dark:ring-brand-500/30",
              )}
            >
              <ColorSwatchChip color={previewHex || undefined} size={chipSize} />
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                  open && "rotate-180 text-brand-500 dark:text-brand-400",
                )}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent px-0.5 font-mono text-[11px] uppercase tracking-wide text-gray-700 placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 focus:outline-none dark:text-gray-200 dark:placeholder:text-gray-500"
            value={localValue}
            placeholder="#ffffff"
            spellCheck={false}
            aria-label={label ? `${label} Hex` : "颜色 Hex"}
            onChange={(event) => {
              const next = event.target.value;
              setLocalValue(next);
              const resolved = resolveCommitValue(next);
              if (resolved !== undefined) scheduleCommit(resolved);
            }}
            onBlur={(event) => {
              const normalized = normalizeHexColor(event.target.value);
              if (normalized) {
                setLocalValue(normalized);
                commitNow(normalized);
                return;
              }
              if (!event.target.value.trim()) {
                setLocalValue("");
                commitNow("");
              }
            }}
          />
          {allowClear ? (
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30 dark:hover:bg-white/5 dark:hover:text-gray-200"
              aria-label="清除颜色"
              onClick={() => {
                setLocalValue("");
                commitNow("");
              }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {popoverBody}
      </Popover>
    </div>
  );
}
