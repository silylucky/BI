import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseDeResultLimit } from "@/lib/chartDeDisplay";
import { ChartResultLimitField } from "./ChartResultLimitField";
import {
  DASHBOARD_FONT_OPTIONS,
  DASHBOARD_REFRESH_PRESETS,
  buildDashboardGapPatch,
  dashboardFontSelectValue,
  resolveDashboardFontOptionValue,
  resolveDashboardGapUiState,
  resolveDashboardRefreshPreset,
  type DashboardStyleConfig,
  type GapPreset,
  type DashboardChromeConfig,
  DEFAULT_QUERY_LIMIT,
} from "./dashboardStyleConfig";
import {
  resolveDashboardAlignmentSnap,
  resolveDashboardChrome,
} from "./dashboardChromeConfig";
import { AlignmentSnapControls } from "./dashboardAlignmentSnapControls";
import {
  DE_SELECT,
  DeAttrField,
  DeAttrForm,
  DeAttrSubField,
  DeAttrToggleRow,
  DeAttrToggleSection,
  DeSegmentGroup,
} from "./dashboardInspectorUi";
import { DeAttrSliderField, DeAttrSubSliderRow } from "./deAttrSlider";
import { WidgetStyleLineBorderControls } from "./chartStyleFields";

import type { DashboardStylePatch } from "./DashboardContextInspector";

type PatchFn = (patch: DashboardStylePatch) => void;

type Props = {
  styleConfig: DashboardStyleConfig;
  patchStyle: PatchFn;
  isPixelLayout: boolean;
};

function GapControls({
  hasGap,
  preset,
  customPx,
  customMax,
  onHasGapChange,
  onPresetChange,
  onCustomPx,
}: {
  hasGap: boolean;
  preset: GapPreset;
  customPx: number;
  customMax: number;
  onHasGapChange: (hasGap: boolean) => void;
  onPresetChange: (preset: Exclude<GapPreset, "custom"> | "custom") => void;
  onCustomPx: (px: number) => void;
}) {
  return (
    <DeAttrField label="组件间隙">
      <DeSegmentGroup
        value={hasGap}
        columns={2}
        sizing="fit"
        options={[
          { value: true, label: "有间隙" },
          { value: false, label: "无间隙" },
        ]}
        onChange={(v) => onHasGapChange(v === true)}
      />
      {hasGap ? (
        <DeAttrSubField label="间隙大小">
          <DeSegmentGroup
            value={preset}
            columns={4}
            sizing="fit"
            options={[
              { value: "sm", label: "小" },
              { value: "md", label: "中" },
              { value: "lg", label: "大" },
              { value: "custom", label: "自定义" },
            ]}
            onChange={(v) => onPresetChange(v as Exclude<GapPreset, "custom"> | "custom")}
          />
          {preset === "custom" ? (
            <div className="mt-2" data-testid="dashboard-gap-custom-controls">
              <DeAttrSubSliderRow
                label="自定义"
                min={0}
                max={customMax}
                step={1}
                unit="px"
                value={Math.max(0, customPx)}
                ariaLabel="自定义间隙滑块"
                description={`对标 DataEase：每侧 padding 为设定值，相邻间距约为 2 倍；像素自定义 0–${customMax}px，栅格 0–48px。`}
                onPreview={(next) => {
                  if (next != null) onCustomPx(next);
                }}
                onChange={onCustomPx}
              />
            </div>
          ) : null}
        </DeAttrSubField>
      ) : null}
    </DeAttrField>
  );
}

function FontSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (fontFamily: string | undefined) => void;
}) {
  const selectValue = dashboardFontSelectValue(value);
  const resolved = resolveDashboardFontOptionValue(value);

  return (
    <DeAttrField label="仪表板字体">
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === "__default__") onChange(undefined);
          else if (next !== "__custom__") onChange(next);
        }}
      >
        <SelectTrigger className={DE_SELECT} aria-label="仪表板字体">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_FONT_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.label}
              value={opt.value ? opt.value : "__default__"}
              style={opt.value ? { fontFamily: opt.value } : undefined}
            >
              {opt.label}
            </SelectItem>
          ))}
          {selectValue === "__custom__" && resolved ? (
            <SelectItem value="__custom__">{resolved}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </DeAttrField>
  );
}

function RefreshField({
  refreshIntervalSec,
  onChange,
}: {
  refreshIntervalSec?: number;
  onChange: (sec: number | undefined) => void;
}) {
  const preset = resolveDashboardRefreshPreset(refreshIntervalSec);
  const customMin =
    preset === "custom" && refreshIntervalSec
      ? Math.max(1, Math.round(refreshIntervalSec / 60))
      : 5;

  return (
    <DeAttrField label="刷新频率" hint="分享页整体刷新">
      <Select
        value={preset}
        onValueChange={(next) => {
          if (next === "off") onChange(undefined);
          else if (next !== "custom") onChange(Number(next));
          else onChange(refreshIntervalSec && refreshIntervalSec > 0 ? refreshIntervalSec : 300);
        }}
      >
        <SelectTrigger className={DE_SELECT} aria-label="刷新频率">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_REFRESH_PRESETS.map((opt) => (
            <SelectItem key={opt.label} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === "custom" ? (
        <div className="mt-2" data-testid="dashboard-refresh-custom-slider">
          <DeAttrSubSliderRow
            label="自定义间隔"
            min={1}
            max={120}
            step={1}
            unit="分钟"
            value={customMin}
            ariaLabel="自定义刷新间隔"
            onChange={(min) => onChange(min > 0 ? min * 60 : undefined)}
          />
        </div>
      ) : null}
    </DeAttrField>
  );
}

function QueryLimitField({
  defaultQueryLimit,
  onChange,
}: {
  defaultQueryLimit?: number;
  onChange: (limit: number) => void;
}) {
  return (
    <ChartResultLimitField
      stored={String(defaultQueryLimit ?? DEFAULT_QUERY_LIMIT)}
      onChange={(value) => onChange(parseDeResultLimit(value) ?? DEFAULT_QUERY_LIMIT)}
      hint="看板默认，取最新 N 条"
    />
  );
}

export function DashboardOverallConfigPanel({
  styleConfig,
  patchStyle,
  isPixelLayout,
}: Props) {
  const gapUi = resolveDashboardGapUiState(styleConfig, { pixel: isPixelLayout });
  const scaleMode = styleConfig.scaleMode ?? "canvas";
  const ws = styleConfig.widgetStyle ?? {};
  const chrome = resolveDashboardChrome(styleConfig);
  const alignmentSnap = resolveDashboardAlignmentSnap(styleConfig);
  const patchChrome = (patch: Partial<DashboardChromeConfig>) =>
    patchStyle({ chrome: { ...styleConfig.chrome, ...patch } });

  return (
    <DeAttrForm data-testid="dashboard-overall-config-body">
      <FontSelect
        value={styleConfig.fontFamily}
        onChange={(fontFamily) => patchStyle({ fontFamily })}
      />

      <DeAttrSliderField
        label="组件圆角"
        value={ws.borderRadius}
        fallback={8}
        min={0}
        max={48}
        step={1}
        unit="px"
        onChange={(borderRadius) =>
          patchStyle((prev) => ({
            widgetStyle: {
              ...prev.widgetStyle,
              borderRadius,
            },
          }))
        }
      />

      <DeAttrField label="组件线框" compact hint="组件外框，作用于全部组件">
        <WidgetStyleLineBorderControls
          value={ws}
          onChange={(patch) =>
            patchStyle((prev) => ({
              widgetStyle: {
                ...prev.widgetStyle,
                ...patch,
              },
            }))
          }
          density="wide"
        />
      </DeAttrField>

      <GapControls
        hasGap={gapUi.hasGap}
        preset={gapUi.preset}
        customPx={gapUi.customPx}
        customMax={gapUi.customMax}
        onHasGapChange={(hasGap) =>
          patchStyle(buildDashboardGapPatch(styleConfig, { type: "toggle", hasGap }, { pixel: isPixelLayout }))
        }
        onPresetChange={(preset) =>
          patchStyle(buildDashboardGapPatch(styleConfig, { type: "preset", preset }, { pixel: isPixelLayout }))
        }
        onCustomPx={(px) =>
          patchStyle(buildDashboardGapPatch(styleConfig, { type: "customPx", px }, { pixel: isPixelLayout }))
        }
      />

      <DeAttrField label="缩放模式">
        <DeSegmentGroup
          value={scaleMode}
          columns={2}
          sizing="fit"
          options={[
            { value: "canvas", label: "画布比例" },
            { value: "component", label: "组件比例" },
          ]}
          onChange={(v) => patchStyle({ scaleMode: v as "canvas" | "component" })}
        />
      </DeAttrField>

      <RefreshField
        refreshIntervalSec={styleConfig.refreshIntervalSec}
        onChange={(refreshIntervalSec) => patchStyle({ refreshIntervalSec })}
      />

      <QueryLimitField
        defaultQueryLimit={styleConfig.defaultQueryLimit}
        onChange={(defaultQueryLimit) => patchStyle({ defaultQueryLimit })}
      />

      <DeAttrToggleSection title="显示与交互">
        <DeAttrToggleRow
          label="图表加载提示"
          checked={chrome.showChartLoadingHint}
          onCheckedChange={(checked) => patchChrome({ showChartLoadingHint: checked })}
        />
        <DeAttrToggleRow
          label="组件右键菜单"
          checked={chrome.showFloatingActions}
          onCheckedChange={(checked) => patchChrome({ showFloatingActions: checked })}
        />
        <DeAttrToggleRow
          label="图表操作按钮"
          checked={chrome.showChartActionButtons}
          onCheckedChange={(checked) => patchChrome({ showChartActionButtons: checked })}
        />
        <AlignmentSnapControls
          chrome={chrome}
          alignment={alignmentSnap}
          alignmentSnapRaw={styleConfig.chrome?.alignmentSnap}
          isPixelLayout={isPixelLayout}
          patchChrome={patchChrome}
        />
      </DeAttrToggleSection>
    </DeAttrForm>
  );
}
