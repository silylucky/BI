import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, Download, FileJson, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardLayoutV2 } from "@/components/dashboard/layoutUtils";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  DeAttrField,
  DeAttrForm,
  DE_INPUT,
  DeSegmentGroup,
} from "@/components/dashboard/dashboardInspectorUi";
import { ChartInspectorSection, INSPECTOR_HINT } from "@/components/dashboard/inspectorCompact";
import { exportDataScreenTemplate } from "@/lib/dataScreenTemplates";
import { registerDebouncedDraftFlusher } from "@/lib/debouncedDraftFlush";
import { PublishTemplateDialog } from "@/components/dashboard/templates/PublishTemplateDialog";
import { downloadJsonFile, downloadLayoutJson } from "@/lib/exportLayoutJson";
import { DATA_SCREEN_CANVAS_BOUNDS, DATA_SCREEN_CANVAS_PRESETS } from "@/lib/surfacePreset";
import { cn } from "@/lib/utils";
import type { PresentationMode } from "./presentationScale";
import {
  DATA_SCREEN_EDIT_PRESENTATION_MODES,
  DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
} from "./presentationScale";

const PRESENTATION_MODE_LABELS: Record<
  (typeof DATA_SCREEN_EDIT_PRESENTATION_MODES)[number],
  string
> = {
  fit: "等比",
  fitWidth: "宽度",
  fitHeight: "高度",
};

const PRESENTATION_MODE_ARIA: Record<
  (typeof DATA_SCREEN_EDIT_PRESENTATION_MODES)[number],
  string
> = {
  fit: "等比适应",
  fitWidth: "宽度优先",
  fitHeight: "高度优先",
};

const PRESENTATION_MODE_HINTS: Record<
  (typeof DATA_SCREEN_EDIT_PRESENTATION_MODES)[number],
  string
> = {
  fitWidth: "编辑区宽度贴满；改 W 会改变纵向比例，改 H 改变可见高度",
  fitHeight: "编辑区高度贴满；改 H 会改变横向比例，改 W 改变可见宽度",
  fit: "整画布缩放进视口；改 W/H 同时影响设计分辨率与缩放",
};

function resolvePresentationHint(mode: PresentationMode): string {
  if ((DATA_SCREEN_EDIT_PRESENTATION_MODES as readonly PresentationMode[]).includes(mode)) {
    return PRESENTATION_MODE_HINTS[mode as (typeof DATA_SCREEN_EDIT_PRESENTATION_MODES)[number]];
  }
  return PRESENTATION_MODE_HINTS[DATA_SCREEN_EDIT_PRESENTATION_DEFAULT];
}

type CanvasSizePatch = { width?: number; height?: number };

type DataScreenConfigExtrasProps = {
  layout: DashboardLayoutV2;
  styleConfig: DashboardStyleConfig;
  widgets: DashboardLayoutV2["widgets"];
  name: string;
  canSave: boolean;
  dashboardId?: string;
  presentationMode: PresentationMode;
  onPresentationModeChange: (mode: PresentationMode) => void;
  onCanvasSizeChange: (patch: CanvasSizePatch) => void;
};

function buildExportLayout(
  layout: DashboardLayoutV2,
  widgets: DashboardLayoutV2["widgets"],
  styleConfig: DashboardStyleConfig,
): DashboardLayoutV2 {
  return {
    ...layout,
    widgets,
    styleConfig: { ...styleConfig, surfaceKind: "data-screen" },
    globalFilters: layout.globalFilters ?? [],
  };
}

function CanvasSizeInput({
  id,
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const lastAppliedRef = useRef(value);

  useEffect(() => {
    setDraft(String(value));
    lastAppliedRef.current = value;
  }, [value]);

  const commitSized = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next)));
    if (!Number.isFinite(clamped) || clamped === lastAppliedRef.current) return;
    lastAppliedRef.current = clamped;
    setDraft(String(clamped));
    onCommit(clamped);
  };

  const flushDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    commitSized(parsed);
  };

  useEffect(() => registerDebouncedDraftFlusher(flushDraft), [value, min, max, draft]);

  const bump = (delta: number) => {
    const parsed = Number.parseInt(draft, 10);
    const base = Number.isFinite(parsed) ? parsed : value;
    commitSized(base + delta);
  };

  const handleChange = (raw: string) => {
    const nextDraft = raw.replace(/[^\d]/g, "");
    setDraft(nextDraft);
    const parsed = Number.parseInt(nextDraft, 10);
    if (!Number.isFinite(parsed)) return;
    if (parsed >= min && parsed <= max) {
      commitSized(parsed);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      flushDraft();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(String(value));
      event.currentTarget.blur();
    }
  };

  const parsedDraft = Number.parseInt(draft, 10);
  const shownValue = Number.isFinite(parsedDraft) ? parsedDraft : value;

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <label
        className="text-[11px] font-medium text-gray-500 dark:text-gray-400"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative min-w-0">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          className={cn(DE_INPUT, "h-8 tabular-nums pr-7")}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={flushDraft}
          onKeyDown={handleKeyDown}
        />
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex w-6 flex-col overflow-hidden rounded-r-lg border-l",
            "border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-white/[0.04]",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-hidden={disabled ? true : undefined}
        >
          <button
            type="button"
            disabled={disabled || shownValue >= max}
            className="flex h-1/2 items-center justify-center text-gray-500 transition-colors hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={`增加${label}`}
            onClick={() => bump(1)}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            disabled={disabled || shownValue <= min}
            className="flex h-1/2 items-center justify-center border-t border-gray-200 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={`减少${label}`}
            onClick={() => bump(-1)}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasPresetCards({
  width,
  height,
  disabled,
  onSelect,
}: {
  width: number;
  height: number;
  disabled: boolean;
  onSelect: (patch: CanvasSizePatch) => void;
}) {
  const presetIds = Object.keys(DATA_SCREEN_CANVAS_PRESETS) as Array<
    keyof typeof DATA_SCREEN_CANVAS_PRESETS
  >;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {presetIds.map((presetId) => {
        const preset = DATA_SCREEN_CANVAS_PRESETS[presetId];
        const active = width === preset.width && height === preset.height;
        const ratioLabel = presetId === "16:9" ? "16 : 9" : "21 : 9";

        return (
          <button
            key={presetId}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={preset.label}
            className={cn(
              "flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-all",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1",
              active
                ? "border-brand-200 bg-brand-50/90 shadow-theme-xs dark:border-brand-500/35 dark:bg-brand-500/10"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-gray-600",
              disabled && "cursor-not-allowed opacity-50",
            )}
            onClick={() => onSelect({ width: preset.width, height: preset.height })}
          >
            <span
              className={cn(
                "text-theme-xs font-semibold",
                active
                  ? "text-brand-600 dark:text-brand-300"
                  : "text-gray-800 dark:text-white/90",
              )}
            >
              {ratioLabel}
            </span>
            <span className="mt-0.5 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
              {preset.width}×{preset.height}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DataScreenConfigExtras({
  layout,
  styleConfig,
  widgets,
  name,
  canSave,
  dashboardId,
  presentationMode,
  onPresentationModeChange,
  onCanvasSizeChange,
}: DataScreenConfigExtrasProps) {
  const [publishOpen, setPublishOpen] = useState(false);
  if (layout.version !== 2) return null;

  const exportLayout = buildExportLayout(layout, widgets, styleConfig);
  const presentationValue = (
    DATA_SCREEN_EDIT_PRESENTATION_MODES as readonly PresentationMode[]
  ).includes(presentationMode)
    ? presentationMode
    : DATA_SCREEN_EDIT_PRESENTATION_DEFAULT;

  return (
    <div data-testid="data-screen-config-extras" className="shrink-0">
      <ChartInspectorSection title="画布" defaultOpen>
      <DeAttrForm>
        <DeAttrField label="设计尺寸" compact>
          <div className="flex items-end gap-2">
            <CanvasSizeInput
              id="screen-canvas-w"
              label="宽度"
              value={layout.canvas.width}
              min={DATA_SCREEN_CANVAS_BOUNDS.minWidth}
              max={DATA_SCREEN_CANVAS_BOUNDS.maxWidth}
              disabled={!canSave}
              onCommit={(width) => onCanvasSizeChange({ width })}
            />
            <span
              className="mb-2 shrink-0 select-none text-theme-xs text-gray-400 dark:text-gray-500"
              aria-hidden
            >
              ×
            </span>
            <CanvasSizeInput
              id="screen-canvas-h"
              label="高度"
              value={layout.canvas.height}
              min={DATA_SCREEN_CANVAS_BOUNDS.minHeight}
              max={DATA_SCREEN_CANVAS_BOUNDS.maxHeight}
              disabled={!canSave}
              onCommit={(height) => onCanvasSizeChange({ height })}
            />
          </div>
          <p className={cn(INSPECTOR_HINT, "mt-1.5 tabular-nums")}>
            支持 {DATA_SCREEN_CANVAS_BOUNDS.minWidth}–{DATA_SCREEN_CANVAS_BOUNDS.maxWidth} ×{" "}
            {DATA_SCREEN_CANVAS_BOUNDS.minHeight}–{DATA_SCREEN_CANVAS_BOUNDS.maxHeight}
          </p>
        </DeAttrField>

        <DeAttrField label="常用比例" compact>
          <CanvasPresetCards
            width={layout.canvas.width}
            height={layout.canvas.height}
            disabled={!canSave}
            onSelect={onCanvasSizeChange}
          />
        </DeAttrField>

        <DeAttrField label="编辑区缩放" compact className="border-b-0">
          <DeSegmentGroup
            value={presentationValue}
            options={DATA_SCREEN_EDIT_PRESENTATION_MODES.map((mode) => ({
              value: mode,
              label: PRESENTATION_MODE_LABELS[mode],
              ariaLabel: PRESENTATION_MODE_ARIA[mode],
            }))}
            columns={3}
            onChange={(value) => onPresentationModeChange(value as PresentationMode)}
          />
          <p className={cn(INSPECTOR_HINT, "mt-1.5 leading-relaxed")}>
            {resolvePresentationHint(presentationValue)}
          </p>
        </DeAttrField>

        <div
          className="border-t border-gray-100 pt-3 dark:border-white/[0.06]"
          data-testid="data-screen-export-actions"
        >
          <p className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">导出</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[11px] font-medium"
              disabled={!canSave}
              onClick={() => {
                downloadLayoutJson(exportLayout, name);
                toast.success("布局 JSON 已下载");
              }}
            >
              <FileJson className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">布局 JSON</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[11px] font-medium"
              disabled={!canSave}
              onClick={() => {
                const payload = exportDataScreenTemplate(exportLayout, name);
                downloadJsonFile(payload, `${name.trim() || "screen"}-template.json`);
                toast.success("模板 JSON 已下载");
              }}
            >
              <Download className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">导出模板</span>
            </Button>
            {dashboardId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 h-8 gap-1.5 px-2 text-[11px] font-medium"
                disabled={!canSave}
                onClick={() => setPublishOpen(true)}
              >
                <LayoutTemplate className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">发布为模板</span>
              </Button>
            ) : null}
          </div>
        </div>
      </DeAttrForm>
    </ChartInspectorSection>
    {dashboardId ? (
      <PublishTemplateDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        dashboardId={dashboardId}
        defaultName={name}
        surfaceKind="data-screen"
      />
    ) : null}
    </div>
  );
}
