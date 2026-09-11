import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHART_PALETTE_CATALOG,
  CHART_PALETTE_INHERIT_LABEL,
  chartPaletteLabel,
  paletteColorsMatchPreset,
  resolveChartColors,
  resolvePaletteId,
} from "@/lib/chartPalette";
import { cn } from "@/lib/utils";
import { DE_SELECT } from "./dashboardInspectorUi";
import { INSPECTOR_SELECT_TRIGGER } from "./inspectorCompact";
import {
  ChartPaletteColorSwatch,
  ChartPaletteSeriesColorRow,
  ChartPaletteSwatchStrip,
} from "./chartPaletteShared";
import {
  ChartPaletteCurrentDisplay,
  ChartPaletteInlineMenu,
} from "./ChartPaletteOptionList";
import type { ChartSeriesColorItem } from "@/lib/chartDeStyle";

type ChartPalettePickerProps = {
  value?: string;
  paletteColors?: readonly string[];
  onChange: (paletteId: string | undefined, colors: readonly string[]) => void;
  seriesColors?: readonly ChartSeriesColorItem[];
  onSeriesColorsChange?: (items: readonly ChartSeriesColorItem[]) => void;
  showInherit?: boolean;
  inheritLabel?: string;
  inheritPreviewColors?: readonly string[];
  dense?: boolean;
  className?: string;
};

const INHERIT_VALUE = "__inherit__";
const paletteSelectContentClass =
  "z-[100001] max-h-[min(20rem,70vh)] min-w-[var(--radix-select-trigger-width)] max-w-[min(18rem,calc(100vw-1.5rem))]";

function resolveSelectValue(value: string | undefined, showInherit: boolean): string {
  if (showInherit && !resolvePaletteId(value)) return INHERIT_VALUE;
  return resolvePaletteId(value) ?? "default";
}

export function ChartPalettePicker({
  value,
  paletteColors,
  onChange,
  seriesColors,
  onSeriesColorsChange,
  showInherit = false,
  inheritLabel = CHART_PALETTE_INHERIT_LABEL,
  inheritPreviewColors,
  dense = false,
  className,
}: ChartPalettePickerProps) {
  const rows = showInherit
    ? [{ id: INHERIT_VALUE, label: inheritLabel, colors: [] as const }, ...CHART_PALETTE_CATALOG]
    : [...CHART_PALETTE_CATALOG];

  const [customOpen, setCustomOpen] = useState(false);
  const [bootstrapCustom, setBootstrapCustom] = useState(false);
  const [denseMenuOpen, setDenseMenuOpen] = useState(false);
  const denseMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dense || !denseMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (denseMenuRef.current?.contains(target)) return;
      setDenseMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [dense, denseMenuOpen]);

  const committedSelectValue = resolveSelectValue(value, showInherit);
  const resolvedId = committedSelectValue === INHERIT_VALUE ? undefined : committedSelectValue;
  const inheritActive = showInherit && committedSelectValue === INHERIT_VALUE;

  const isSeriesMode = Boolean(seriesColors?.length && onSeriesColorsChange);

  const isCustomized = useMemo(() => {
    if (isSeriesMode) {
      return seriesColors!.some((item, index) => {
        const preset = resolveChartColors(resolvedId);
        const fallback = preset[index % preset.length] ?? preset[0];
        return item.color !== fallback;
      });
    }
    return !inheritActive && !paletteColorsMatchPreset(resolvedId, paletteColors);
  }, [inheritActive, isSeriesMode, paletteColors, resolvedId, seriesColors]);

  useEffect(() => {
    if (isCustomized) setCustomOpen(true);
  }, [isCustomized]);

  useEffect(() => {
    if (!inheritActive) setBootstrapCustom(false);
  }, [inheritActive]);

  const effectiveInheritActive = inheritActive && !bootstrapCustom;
  const effectiveResolvedId =
    bootstrapCustom && inheritActive ? "default" : resolvedId;

  const activeColors = useMemo(() => {
    if (effectiveInheritActive) return [];
    const preset = resolveChartColors(effectiveResolvedId);
    if (!paletteColors?.length) return preset;
    return preset.map((color, index) => paletteColors[index] ?? color);
  }, [effectiveInheritActive, effectiveResolvedId, paletteColors]);

  const customColors = useMemo(() => {
    if (effectiveInheritActive) return [];
    const preset = resolveChartColors(effectiveResolvedId);
    if (!paletteColors?.length) return preset;
    return preset.map((color, index) => paletteColors[index] ?? color);
  }, [effectiveInheritActive, effectiveResolvedId, paletteColors]);

  const activeLabel = effectiveInheritActive
    ? inheritLabel
    : (chartPaletteLabel(effectiveResolvedId) ?? "品牌");

  const handlePresetChange = (next: string) => {
    if (next === INHERIT_VALUE) {
      onChange(undefined, []);
      onSeriesColorsChange?.([]);
      setCustomOpen(false);
      setBootstrapCustom(false);
      return;
    }
    const preset = CHART_PALETTE_CATALOG.find((item) => item.id === next);
    onChange(next, preset ? [...preset.colors] : resolveChartColors(next));
    onSeriesColorsChange?.([]);
  };

  const selectPreset = (next: string) => {
    handlePresetChange(next);
    if (dense) setDenseMenuOpen(false);
  };

  const handleColorChange = (index: number, color: string | undefined) => {
    if (effectiveInheritActive || !color) return;
    const base = [...customColors];
    base[index] = color;
    onChange(effectiveResolvedId ?? "default", base);
  };

  const handleSeriesColorChange = (id: string, color: string) => {
    if (!seriesColors || !onSeriesColorsChange) return;
    onSeriesColorsChange(
      seriesColors.map((item) => (item.id === id ? { ...item, color } : item)),
    );
  };

  const handleReset = () => {
    if (effectiveInheritActive) return;
    if (isSeriesMode) {
      onSeriesColorsChange?.([]);
      return;
    }
    const id = effectiveResolvedId ?? "default";
    onChange(id, resolveChartColors(id));
  };

  const handleCustomToggle = () => {
    if (inheritActive) {
      handlePresetChange("default");
      setBootstrapCustom(true);
      setCustomOpen(true);
      return;
    }
    setCustomOpen((open) => !open);
  };

  const wideSelectTriggerClass = cn(
    DE_SELECT,
    "h-auto min-h-8 px-2.5 py-1 text-left text-[12px]",
    "[&>span]:line-clamp-none [&>span]:flex [&>span]:w-full [&>span]:flex-col [&>span]:items-start [&>span]:justify-start [&>span]:text-left",
  );
  const settingsBtnClass = dense ? "size-8" : "size-7";

  const settingsButton = (
    <button
      type="button"
      aria-label="自定义配色"
      aria-expanded={customOpen}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
        settingsBtnClass,
        customOpen
          ? "border-brand-500 text-brand-600 dark:border-brand-500/60 dark:text-brand-300"
          : "border-gray-300 bg-white text-gray-600 hover:border-brand-500 hover:text-brand-600 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:border-brand-500/60",
      )}
      onClick={handleCustomToggle}
    >
      <SlidersHorizontal className="size-3.5" aria-hidden />
    </button>
  );

  return (
    <div
      className={cn("space-y-0", className)}
      data-chart-palette-picker
      onPointerDown={(event) => event.stopPropagation()}
    >
      {dense ? (
        <div ref={denseMenuRef} className="space-y-1.5">
          <div className="flex min-w-0 items-start gap-1.5">
            <ChartPaletteCurrentDisplay
              activeLabel={activeLabel}
              activeColors={activeColors}
              inheritActive={effectiveInheritActive}
              inheritPreviewColors={inheritPreviewColors}
              triggerClass={INSPECTOR_SELECT_TRIGGER}
              menuOpen={denseMenuOpen}
              onMenuToggle={() => setDenseMenuOpen((open) => !open)}
            />
            {settingsButton}
          </div>
          {denseMenuOpen ? (
            <div
              className="max-h-[min(14rem,40vh)] touch-manipulation overflow-y-auto overscroll-y-contain rounded-lg border border-gray-200 bg-white p-1 shadow-theme-sm dark:border-gray-700 dark:bg-gray-900"
              data-testid="chart-palette-inline-menu-panel"
            >
              <ChartPaletteInlineMenu
                rows={rows}
                selectedId={committedSelectValue}
                inheritValue={INHERIT_VALUE}
                inheritPreviewColors={inheritPreviewColors}
                onSelect={selectPreset}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-1.5">
          <Select value={committedSelectValue} onValueChange={selectPreset}>
            <SelectTrigger
              className={cn(wideSelectTriggerClass, "min-w-0 flex-1 shadow-none")}
              aria-label="配色方案"
            >
              <SelectValue placeholder="配色方案" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className={paletteSelectContentClass}
            >
              {rows.map((row) => (
                <SelectItem
                  key={row.id}
                  value={row.id}
                  textValue={row.label}
                  className="items-start text-left"
                >
                  <span className="flex min-w-0 w-full flex-col items-start gap-1 text-left">
                    <ChartPaletteSwatchStrip
                      colors={row.colors}
                      inherit={row.id === INHERIT_VALUE}
                      inheritPreviewColors={inheritPreviewColors}
                      className="w-full rounded-[2px]"
                    />
                    <span
                      data-testid="chart-palette-option-label"
                      className="w-full text-left text-theme-xs leading-tight"
                    >
                      {row.label}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {settingsButton}
        </div>
      )}

      {customOpen && !effectiveInheritActive ? (
        <div className="mt-2" data-testid="chart-palette-custom">
          <div className="flex items-center justify-between text-[12px] font-normal text-gray-600 dark:text-gray-300">
            <span>自定义</span>
            <button
              type="button"
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              onClick={handleReset}
            >
              重置
            </button>
          </div>
          <div className={cn("mt-2", isSeriesMode ? "flex flex-col gap-1" : "flex flex-wrap gap-1")}>
            {isSeriesMode
              ? seriesColors!.map((item) => (
                  <ChartPaletteSeriesColorRow
                    key={item.id}
                    name={item.name}
                    value={item.color}
                    onChange={(next) => handleSeriesColorChange(item.id, next)}
                  />
                ))
              : customColors.map((color, index) => (
                  <ChartPaletteColorSwatch
                    key={`palette-swatch-${index}`}
                    value={color}
                    aria-label={`系列色 ${index + 1}`}
                    onChange={(next) => handleColorChange(index, next)}
                  />
                ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
