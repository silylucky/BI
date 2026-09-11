import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorField, type ColorSwatch } from "@/components/ui/color-field";
import { Switch } from "@/components/ui/switch";
import { INSPECTOR_SWITCH_SIZE } from "./inspectorCompact";
import { resolveChartColors } from "@/lib/chartPalette";
import { CHART_FONT_SIZE_OPTIONS, resolveChartFontSizeOptions } from "@/lib/chartFontSizes";
import { HintTooltip, TruncateHint } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { DE_SELECT } from "./dashboardInspectorUi";
import {
  INSPECTOR_COLLAPSE_TRIGGER,
  INSPECTOR_LABEL,
  INSPECTOR_SELECT,
  InspectorCollapseChevron,
  useInspectorSectionOpen,
} from "./inspectorCompact";

export const PALETTE_STRIP_SWATCH_COUNT = 8;
/** 下拉项 / 触发器色带统一宽度，避免首项「跟随看板」与预设行错位 */
export const PALETTE_SWATCH_STRIP_WIDTH = "5.5rem";

/** 配色方案色带预览（对标 DataEase 下拉条） */
export function ChartPaletteSwatchStrip({
  colors,
  inherit,
  inheritPreviewColors,
  className,
  count = PALETTE_STRIP_SWATCH_COUNT,
}: {
  colors: readonly string[];
  inherit?: boolean;
  /** 继承仪表板时展示的色带（与看板配置一致） */
  inheritPreviewColors?: readonly string[];
  className?: string;
  count?: number;
}) {
  const palette = inherit
    ? (inheritPreviewColors?.length
        ? inheritPreviewColors
        : resolveChartColors("default")
      ).slice(0, count)
    : colors;
  return (
    <div
      className={cn(
        "flex h-4 w-full min-w-0 items-stretch overflow-hidden rounded-sm",
        "ring-1 ring-inset ring-black/[0.06] dark:ring-white/10",
        inherit && !inheritPreviewColors?.length && "opacity-60",
        className,
      )}
      aria-hidden
    >
      {palette.slice(0, count).map((color, index) => (
        <span
          key={`${inherit ? "inherit" : color}-${index}`}
          className="min-w-0 flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

/** 自定义配色栅格：pill 取色器（棋盘格色块 + 下拉箭头） */
export function ChartPaletteColorSwatch({
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  className?: string;
}) {
  return (
    <ColorField
      variant="swatch"
      showLabel={false}
      showHintTooltip={false}
      allowClear={false}
      value={value}
      buttonAriaLabel={ariaLabel}
      className={className}
      onChange={(next) => {
        if (next) onChange(next);
      }}
    />
  );
}

/** 系列色行：色块 + 名称（对标 DE color-list-item） */
export function ChartPaletteSeriesColorRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ChartPaletteColorSwatch value={value} aria-label={`${name} 系列色`} onChange={onChange} />
      <TruncateHint title={name} className="min-w-0 flex-1 text-[12px] text-gray-600 dark:text-gray-300">
        {name}
      </TruncateHint>
    </div>
  );
}

/** @deprecated 使用 CHART_FONT_SIZE_OPTIONS（`@/lib/chartFontSizes`） */
export const CHART_PALETTE_FONT_SIZES = CHART_FONT_SIZE_OPTIONS;

type ChartPaletteNestedSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
  compact?: boolean;
  /** @deprecated 开关与折叠独立，不再联动展开 */
  enabled?: boolean;
};

/** DataEase attr-style 内嵌折叠组（图表标签 / 提示 / 表格配色） */
export function ChartPaletteNestedSection({
  title,
  children,
  defaultOpen = false,
  action,
  compact = false,
}: ChartPaletteNestedSectionProps) {
  const [open, setOpen] = useInspectorSectionOpen(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-b border-gray-100 dark:border-white/[0.06]"
    >
      <div className="flex items-center gap-1 py-1.5">
        <CollapsibleTrigger
          className={cn(
            INSPECTOR_COLLAPSE_TRIGGER,
            "flex min-w-0 flex-1 items-center gap-0.5 rounded-md text-left",
            compact
              ? "py-1 pl-0 pr-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-300"
              : "py-1 pl-0 pr-1 text-theme-xs font-medium text-gray-700 dark:text-gray-300",
            "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:hover:bg-white/[0.04]",
          )}
        >
          <InspectorCollapseChevron />
          <span className="min-w-0 truncate">{title}</span>
        </CollapsibleTrigger>
        {action ? (
          <div
            className="flex shrink-0 items-center pr-0.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        ) : null}
      </div>
      <CollapsibleContent className="space-y-0 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function ChartPaletteSectionSwitch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      size={INSPECTOR_SWITCH_SIZE}
    />
  );
}

type ChartPaletteFontSizeSelectProps = {
  value?: number;
  fallback?: number;
  options?: readonly number[];
  onChange: (fontSize: number) => void;
  density?: "narrow" | "wide";
  className?: string;
  showLabel?: boolean;
  /** 左侧标签文案，默认「字体大小」 */
  label?: string;
};

export function ChartPaletteFontSizeSelect({
  value,
  fallback = 12,
  options = CHART_FONT_SIZE_OPTIONS,
  onChange,
  density = "wide",
  className,
  showLabel = true,
  label = "字体大小",
}: ChartPaletteFontSizeSelectProps) {
  const resolved = value ?? fallback;
  const optionList = resolveChartFontSizeOptions(value, fallback, options);

  return (
    <div
      className={cn(
        showLabel &&
          "flex items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        !showLabel && "py-0",
        className,
      )}
    >
      {showLabel ? (
        <span className={cn(INSPECTOR_LABEL, "shrink-0 whitespace-nowrap")}>{label}</span>
      ) : null}
      <Select value={String(resolved)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger
          className={cn(density === "narrow" ? INSPECTOR_SELECT : DE_SELECT, "h-8 w-[5rem] shrink-0")}
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optionList.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type ChartTableColorGridCellProps = {
  label: string;
  value: string;
  swatches?: readonly ColorSwatch[] | readonly string[];
  onChange: (value: string | undefined) => void;
};

/** DE 表格配色：pill 取色器 + 底部标签，两列栅格单元 */
export function ChartTableColorGridCell({
  label,
  value,
  swatches,
  onChange,
}: ChartTableColorGridCellProps) {
  return (
    <div className="min-w-0">
      <ColorField
        variant="swatch"
        showLabel={false}
        showHintTooltip={false}
        allowClear
        value={value}
        swatches={swatches}
        buttonAriaLabel={`${label}取色器`}
        onChange={onChange}
      />
      <p className="mt-0.5 truncate text-[10px] leading-tight text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
