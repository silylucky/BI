import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { InspectorFieldLabel } from "./inspectorCompact";

function sliderPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 432px 看板配置栏滑块宽度 */
export const DE_SLIDER_WIDTH_WIDE = "w-[10.5rem]";
/** 252px 图表配置列滑块宽度 */
export const DE_SLIDER_WIDTH_NARROW = "w-[8.25rem]";
/** 252px 行内字段（标签+滑块+数值）定宽滑块 */
export const DE_SLIDER_WIDTH_CHART_INLINE = "w-[6rem]";
/** 字段标签列宽：容纳「装饰边框不透明度」等长标签，同行滑块左对齐 */
export const DE_SLIDER_FIELD_LABEL_COL = "7rem";

/** 圆形滑块半径（size-3），轨道两端内缩避免贴边/裁切 */
const SLIDER_THUMB_RADIUS = "0.375rem";

const SLIDER_SHELL = "relative flex h-7 items-center";
const SLIDER_TRACK =
  "pointer-events-none absolute top-1/2 left-1.5 right-1.5 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10";
const SLIDER_THUMB =
  "pointer-events-none absolute top-1/2 z-[1] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500 bg-white shadow-theme-xs will-change-[left] dark:border-brand-400 dark:bg-gray-900";

function sliderThumbLeft(percent: number): string {
  return `calc(${SLIDER_THUMB_RADIUS} + (100% - 2 * ${SLIDER_THUMB_RADIUS}) * ${percent / 100})`;
}

const DE_ATTR_FIELD_SHELL =
  "border-b border-gray-100 dark:border-white/[0.06]";

export type DeProgressSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  ariaValuetext?: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** 拖动过程中每帧提交 onChange（图表样式栏即时预览） */
  liveUpdate?: boolean;
  /** 拖拽过程中每帧预览（用于标签即时刷新，不触发重渲染链） */
  onPreview?: (value: number | null) => void;
};

/**
 * DataEase el-slider--small 对标：细轨道 + 品牌色进度 + 圆形滑块
 * 默认松手提交；图表样式栏传 liveUpdate 实现拖动即时生效。
 */
export function DeProgressSlider({
  value,
  min,
  max,
  step = 1,
  ariaLabel,
  ariaValuetext,
  className,
  disabled = false,
  liveUpdate = false,
  onChange,
  onPreview,
}: DeProgressSliderProps) {
  const clamped = clampValue(value, min, max);
  const [draft, setDraft] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startValueRef = useRef(clamped);
  const lastCommittedRef = useRef(clamped);
  const draftRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const onPreviewRef = useRef(onPreview);
  const unbindDocumentEndRef = useRef<(() => void) | null>(null);

  onChangeRef.current = onChange;
  onPreviewRef.current = onPreview;

  const shown = draft ?? clamped;
  const percent = sliderPercent(shown, min, max);
  const valueText = ariaValuetext ?? String(shown);

  useEffect(() => {
    if (!draggingRef.current) {
      setDraft(null);
      draftRef.current = null;
      lastCommittedRef.current = clamped;
    }
  }, [clamped]);

  const unbindDocumentEnd = useCallback(() => {
    unbindDocumentEndRef.current?.();
    unbindDocumentEndRef.current = null;
  }, []);

  const commitValue = useCallback((next: number) => {
    if (next === lastCommittedRef.current) return;
    lastCommittedRef.current = next;
    onChangeRef.current(next);
  }, []);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    activePointerIdRef.current = null;
    unbindDocumentEnd();
    const final = draftRef.current ?? startValueRef.current;
    draftRef.current = null;
    setDraft(null);
    onPreviewRef.current?.(null);
    if (!liveUpdate || final !== lastCommittedRef.current) {
      commitValue(final);
    }
  }, [commitValue, liveUpdate, unbindDocumentEnd]);

  const beginDrag = useCallback(
    (pointerId: number) => {
      draggingRef.current = true;
      activePointerIdRef.current = pointerId;
      startValueRef.current = draftRef.current ?? clamped;
      const onDocEnd = (event: PointerEvent) => {
        if (event.pointerId !== activePointerIdRef.current) return;
        endDrag();
      };
      document.addEventListener("pointerup", onDocEnd);
      document.addEventListener("pointercancel", onDocEnd);
      unbindDocumentEndRef.current = () => {
        document.removeEventListener("pointerup", onDocEnd);
        document.removeEventListener("pointercancel", onDocEnd);
      };
    },
    [clamped, endDrag],
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    draftRef.current = next;
    setDraft(next);
    onPreviewRef.current?.(next);
    if (liveUpdate || !draggingRef.current) {
      commitValue(next);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginDrag(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag();
  };

  return (
    <div
      className={cn(SLIDER_SHELL, "max-w-full", disabled && "opacity-50", className)}
      data-testid="de-progress-slider"
    >
      <div className={SLIDER_TRACK} aria-hidden>
        <div
          className="h-full w-full origin-left rounded-full bg-brand-500 will-change-transform dark:bg-brand-400"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <div className={SLIDER_THUMB} style={{ left: sliderThumbLeft(percent) }} aria-hidden />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={valueText}
        className="absolute inset-0 z-20 m-0 h-full w-full cursor-pointer touch-none opacity-0 disabled:cursor-not-allowed"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onBlur={() => {
          if (draggingRef.current) endDrag();
        }}
        onChange={handleInput}
      />
    </div>
  );
}

type DeSliderInlineRowProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel?: string;
  density?: "wide" | "narrow";
  /** field：DeAttr 表单标签；muted：grid 内次级标签；compact：2 列栅格短标签 */
  labelTone?: "field" | "muted" | "compact";
  disabled?: boolean;
  className?: string;
  liveUpdate?: boolean;
  onChange: (value: number) => void;
  onPreview?: (value: number | null) => void;
};

/** 单行：标签 · 滑块 · 数值（TailAdmin / DE 紧凑密度） */
function DeSliderInlineRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  density = "wide",
  labelTone = "muted",
  disabled = false,
  className,
  liveUpdate = false,
  onChange,
  onPreview,
}: DeSliderInlineRowProps) {
  const clamped = clampValue(value, min, max);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? clamped;
  const display = unit ? `${shown}${unit}` : String(shown);
  const sliderWidth =
    density === "narrow" && labelTone === "field"
      ? "w-full min-w-0 max-w-full"
      : density === "narrow"
        ? DE_SLIDER_WIDTH_NARROW
        : DE_SLIDER_WIDTH_WIDE;
  const gridCols =
    density === "narrow" && labelTone === "field"
      ? "grid-cols-[7rem_minmax(0,1fr)_2rem]"
      : labelTone === "field"
        ? "grid-cols-[7rem_minmax(0,10.5rem)_2.5rem]"
        : labelTone === "compact"
          ? "grid-cols-[1.75rem_minmax(0,1fr)_2.5rem]"
          : "grid-cols-[minmax(0,1fr)_minmax(0,10.5rem)_2.5rem]";

  return (
    <div className={cn("grid min-w-0 items-center gap-x-2.5", gridCols, className)}>
      {hint ? (
        <InspectorFieldLabel
          label={label}
          hint={hint}
          labelClassName={
            labelTone === "compact" ? "text-center truncate" : labelTone === "field" ? "whitespace-nowrap" : undefined
          }
        />
      ) : (
        <span
          className={cn(
            "text-theme-xs",
            labelTone === "field"
              ? "shrink-0 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300"
              : labelTone === "compact"
                ? "min-w-0 truncate text-center text-gray-500 dark:text-gray-400"
                : "min-w-0 truncate text-gray-500 dark:text-gray-400",
          )}
        >
          {label}
        </span>
      )}
      <DeProgressSlider
        className={cn(sliderWidth, "min-w-0 max-w-full justify-self-start")}
        value={clamped}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        liveUpdate={liveUpdate}
        ariaLabel={ariaLabel ?? label}
        ariaValuetext={display}
        onPreview={(value) => {
          setPreview(value);
          onPreview?.(value);
        }}
        onChange={onChange}
      />
      <span className="min-w-0 truncate text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {display}
      </span>
    </div>
  );
}

type DeSliderStackedRowProps = Omit<DeSliderInlineRowProps, "labelTone" | "density" | "className"> & {
  className?: string;
};

/** 窄列双行：顶行标签+数值，底行滑块（2 列 grid 单元格防重叠） */
function DeSliderStackedRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  className,
  liveUpdate = false,
  onChange,
  onPreview,
}: DeSliderStackedRowProps) {
  const clamped = clampValue(value, min, max);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? clamped;
  const display = unit ? `${shown}${unit}` : String(shown);

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        {hint ? (
          <InspectorFieldLabel label={label} hint={hint} />
        ) : (
          <span className="min-w-0 truncate text-theme-xs text-gray-500 dark:text-gray-400">{label}</span>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{display}</span>
      </div>
      <DeProgressSlider
        className="w-full min-w-0"
        value={clamped}
        min={min}
        max={max}
        step={step}
        liveUpdate={liveUpdate}
        ariaLabel={ariaLabel ?? label}
        ariaValuetext={display}
        onPreview={(value) => {
          setPreview(value);
          onPreview?.(value);
        }}
        onChange={onChange}
      />
    </div>
  );
}

export type DeAttrSliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel: string;
  className?: string;
  onChange: (value: number) => void;
};

/** DataEase 风格数值滑块（仅轨道 + 数值，无标签） */
export function DeAttrSlider({
  value,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  className,
  onChange,
}: DeAttrSliderProps) {
  const clamped = clampValue(value, min, max);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? clamped;
  const display = unit ? `${shown}${unit}` : String(shown);

  return (
    <div className={cn("flex items-center justify-end gap-2.5", className)}>
      <DeProgressSlider
        className={DE_SLIDER_WIDTH_WIDE}
        value={clamped}
        min={min}
        max={max}
        step={step}
        ariaLabel={ariaLabel}
        ariaValuetext={display}
        onPreview={setPreview}
        onChange={onChange}
      />
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {display}
      </span>
    </div>
  );
}

export type ChartDeSliderFieldProps = {
  label: string;
  hint?: string;
  value: number | undefined;
  /** 未配置时的展示/滑块默认位置 */
  fallback?: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  /** stacked：标签+全宽滑块；inline：标签·定宽滑块·数值单行 */
  layout?: "stacked" | "inline";
  onPreviewChange?: (value: number | null) => void;
  onChange: (value: number) => void;
};

/** chart-edit 216px 栏：标签/数值一行 + 全宽或行内定宽滑块 */
export function ChartDeSliderField({
  label,
  hint,
  value,
  fallback = 0,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  className,
  disabled = false,
  layout = "stacked",
  onPreviewChange,
  onChange,
}: ChartDeSliderFieldProps) {
  const resolved = value ?? fallback;
  const clamped = clampValue(resolved, min, max);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? clamped;
  const display = unit ? `${shown}${unit}` : String(shown);
  const liveUpdate = true;

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
          disabled && "opacity-60",
          className,
        )}
      >
        <DeSliderInlineRow
          label={label}
          hint={hint}
          value={clamped}
          min={min}
          max={max}
          step={step}
          unit={unit}
          ariaLabel={ariaLabel}
          density="narrow"
          labelTone="field"
          disabled={disabled}
          liveUpdate={liveUpdate}
          onChange={onChange}
          onPreview={onPreviewChange}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        {hint ? (
          <InspectorFieldLabel label={label} hint={hint} />
        ) : (
          <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{label}</p>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
          {display}
        </span>
      </div>
      <DeProgressSlider
        className="w-full min-w-0"
        value={clamped}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        liveUpdate={liveUpdate}
        ariaLabel={ariaLabel ?? label}
        ariaValuetext={display}
        onPreview={(value) => {
          setPreview(value);
          onPreviewChange?.(value);
        }}
        onChange={onChange}
      />
    </div>
  );
}

export type ChartDeStepperFieldProps = {
  label: string;
  value: number | undefined;
  fallback?: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

/** 图表样式栏：标签 + −/+ 步进按钮（对标 DE 数值步进） */
export function ChartDeStepperField({
  label,
  value,
  fallback = 0,
  min,
  max,
  step = 1,
  ariaLabel,
  className,
  disabled = false,
  onChange,
}: ChartDeStepperFieldProps) {
  const resolved = clampValue(value ?? fallback, min, max);

  const bump = (delta: number) => {
    onChange(clampValue(resolved + delta, min, max));
  };

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-2.5 border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        disabled && "opacity-60",
        className,
      )}
    >
      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
      <div className="flex items-center justify-end gap-1">
        <IconButton
          type="button"
          variant="outline"
          size="sm"
          className="size-7"
          disabled={disabled || resolved <= min}
          aria-label={`减少${ariaLabel ?? label}`}
          onClick={() => bump(-step)}
        >
          <Minus className="size-3.5" aria-hidden />
        </IconButton>
        <span
          className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-gray-700 dark:text-gray-300"
          aria-live="polite"
        >
          {resolved}
        </span>
        <IconButton
          type="button"
          variant="outline"
          size="sm"
          className="size-7"
          disabled={disabled || resolved >= max}
          aria-label={`增加${ariaLabel ?? label}`}
          onClick={() => bump(step)}
        >
          <Plus className="size-3.5" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

export type InspectorSliderFieldProps = Omit<ChartDeSliderFieldProps, "className"> & {
  hint?: string;
  className?: string;
};

/** 216px 图表右栏：标签+数值顶行，滑块独占下一行全宽 */
export function InspectorSliderField({ className, ...slider }: InspectorSliderFieldProps) {
  return <ChartDeSliderField className={className} {...slider} />;
}

export type DeAttrSliderFieldProps = {
  label: string;
  /** 字段下方静态说明（数值已在行尾展示） */
  hint?: string;
  value: number | undefined;
  fallback?: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  compact?: boolean;
  density?: "wide" | "narrow";
  labelTone?: DeSliderInlineRowProps["labelTone"];
  ariaLabel?: string;
  className?: string;
  /** 图表样式栏：拖动即时提交 */
  liveUpdate?: boolean;
  onChange: (value: number) => void;
  onPreviewChange?: (value: number | null) => void;
};

/** 432px 看板配置栏：单行滑块字段（对标 DE attr-style） */
export function DeAttrSliderField({
  label,
  hint,
  value,
  fallback = 0,
  min,
  max,
  step = 1,
  unit = "",
  compact,
  density = "wide",
  labelTone = "field",
  ariaLabel,
  className,
  liveUpdate = false,
  onChange,
  onPreviewChange,
}: DeAttrSliderFieldProps) {
  const resolved = value ?? fallback;
  const resolvedDensity = compact ? "narrow" : density;

  return (
    <div
      className={cn(
        DE_ATTR_FIELD_SHELL,
        compact ? "py-2" : "py-2.5",
        className,
      )}
    >
      {resolvedDensity === "narrow" ? (
        <DeSliderStackedRow
          label={label}
          hint={hint}
          value={resolved}
          min={min}
          max={max}
          step={step}
          unit={unit}
          ariaLabel={ariaLabel}
          liveUpdate={liveUpdate}
          onChange={onChange}
          onPreview={onPreviewChange}
        />
      ) : (
        <DeSliderInlineRow
          label={label}
          hint={hint}
          value={resolved}
          min={min}
          max={max}
          step={step}
          unit={unit}
          ariaLabel={ariaLabel}
          density={resolvedDensity}
          labelTone={labelTone}
          liveUpdate={liveUpdate}
          onChange={onChange}
          onPreview={onPreviewChange}
        />
      )}
    </div>
  );
}

/** 图表样式栏 DeAttr 布局滑块：拖动即时生效 */
export function ChartDeAttrSliderField(
  props: Omit<DeAttrSliderFieldProps, "liveUpdate">,
) {
  return <DeAttrSliderField {...props} liveUpdate />;
}

export type DashboardConfigSliderProps = Omit<DeAttrSliderFieldProps, "hint" | "compact"> & {
  /** 窄容器（如 Popover）内使用更短滑块 */
  compact?: boolean;
};

/** 看板配置栏滑块：单行标签 + 固定宽度轨道（对标 DE attr-style，禁止通栏大长线） */
export function DashboardConfigSlider({
  label,
  value,
  fallback = 0,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  className,
  compact,
  onChange,
  onPreviewChange,
}: DashboardConfigSliderProps) {
  return (
    <DeAttrSliderField
      label={label}
      value={value}
      fallback={fallback}
      min={min}
      max={max}
      step={step}
      unit={unit}
      ariaLabel={ariaLabel}
      density={compact ? "narrow" : "wide"}
      className={cn("border-b-0", compact ? "py-0" : undefined, className)}
      compact={compact}
      onChange={onChange}
      onPreviewChange={onPreviewChange}
    />
  );
}

/** 2 列 grid 单元：双行布局，避免窄列内标签/滑块/数值挤叠 */
export function DashboardConfigGridSlider({
  label,
  value,
  fallback = 0,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  className,
  liveUpdate = false,
  onChange,
  onPreviewChange,
}: Omit<DashboardConfigSliderProps, "compact"> & {
  liveUpdate?: boolean;
}) {
  return (
    <div className={cn("min-w-0 py-1", className)}>
      <DeSliderStackedRow
        label={label}
        value={value ?? fallback}
        min={min}
        max={max}
        step={step}
        unit={unit}
        ariaLabel={ariaLabel}
        liveUpdate={liveUpdate}
        onChange={onChange}
        onPreview={onPreviewChange}
      />
    </div>
  );
}

/** 嵌套区块内带说明的滑块行（间隙/刷新自定义等） */
export function DeAttrSubSliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  ariaLabel,
  description,
  hint,
  disabled = false,
  onChange,
  onPreview,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel: string;
  description?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onPreview?: (value: number | null) => void;
}) {
  const clamped = clampValue(value, min, max);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? clamped;
  const display = unit ? `${shown}${unit}` : String(shown);

  const handlePreview = (next: number | null) => {
    setPreview(next);
    onPreview?.(next);
  };

  return (
    <div className="space-y-1.5">
      <div className="grid min-w-0 grid-cols-[7rem_minmax(0,10.5rem)_2.5rem] items-center gap-x-2.5">
        <InspectorFieldLabel
          label={label}
          hint={hint ?? description}
          labelClassName="text-[11px] font-normal text-gray-500 dark:text-gray-400"
        />
        <DeProgressSlider
          className={cn(DE_SLIDER_WIDTH_WIDE, "min-w-0 max-w-full justify-self-start")}
          value={clamped}
          min={min}
          max={max}
          step={step}
          liveUpdate
          disabled={disabled}
          ariaLabel={ariaLabel}
          ariaValuetext={display}
          onPreview={handlePreview}
          onChange={onChange}
        />
        <span className="min-w-0 truncate text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
          {display}
        </span>
      </div>
    </div>
  );
}
