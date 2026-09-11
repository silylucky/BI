import { Switch } from "@/components/ui/switch";
import { ColorField } from "@/components/ui/color-field";
import type { WidgetStyleConfig } from "./dashboardStyleConfig";
import { SURFACE_COLOR_RECOMMENDED, WIDGET_BORDER_RECOMMENDED } from "./dashboardStyleConfig";
import {
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SWITCH_SIZE,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "./inspectorCompact";
import { DashboardConfigSlider, InspectorSliderField } from "./deAttrSlider";
import { DeSegmentGroup } from "./dashboardInspectorUi";
import { ChartDeSegmentField } from "./chartInspectorDeFields";
import { ChartFramePresetPicker } from "./ChartFramePresetPicker";
import type { ChartBorderStyle } from "@/lib/chartDeStyle";
import { InspectorNestedSection } from "./inspectorNestedSection";
import {
  WidgetSurfaceAppearanceFields,
  WidgetSurfaceSpacingFields,
  type WidgetSurfaceStyleDensity,
} from "./widgetSurfaceStyleFields";
import type { SurfaceKind } from "@/lib/surfacePreset";
import { WidgetBackgroundImagePicker } from "./WidgetBackgroundImagePicker";

type BackgroundPatch = Partial<WidgetStyleConfig>;

function WidgetBackgroundImageSection({
  value,
  onChange,
  highlightUrls,
}: {
  value: WidgetStyleConfig;
  onChange: (patch: BackgroundPatch) => void;
  highlightUrls?: string[];
}) {
  return (
    <WidgetBackgroundImagePicker
      value={value}
      onChange={onChange}
      highlightUrls={highlightUrls}
    />
  );
}

const LINE_BORDER_STYLES = [
  { value: "solid", label: "实线" },
  { value: "dashed", label: "虚线" },
  { value: "dotted", label: "点线" },
] as const;

const BG_MODE_OPTIONS = [
  { value: "image", label: "图片" },
  { value: "frame", label: "装饰边框" },
] as const;

const BG_MODE_LINE_BORDER_OPTIONS = [
  { value: "image", label: "图片" },
  { value: "border", label: "线框" },
] as const;

type ChartBackgroundDeModeFieldsProps = {
  value: WidgetStyleConfig;
  onChange: (patch: BackgroundPatch) => void;
  disabled?: boolean;
  /** chart：装饰边框 SVG；dashboard 全局：仅底图 + 独立线区块 */
  borderTab?: "decorative" | "line" | "imageOnly";
  density?: WidgetSurfaceStyleDensity;
  highlightUrls?: string[];
};

function DeAttrToggleRowCompact({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <InspectorSwitchRow
      label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}

type LineBorderStyleFields = {
  color?: string;
  width?: number;
  style?: ChartBorderStyle["style"];
  radius?: number;
};

function LineBorderStyleFields({
  value,
  onChange,
  density,
  showRadius = false,
}: {
  value: LineBorderStyleFields;
  onChange: (patch: Partial<LineBorderStyleFields>) => void;
  density: WidgetSurfaceStyleDensity;
  showRadius?: boolean;
}) {
  const Slider = density === "narrow" ? InspectorSliderField : DashboardConfigSlider;

  return (
    <div className="space-y-0">
      <InspectorInlineColorRow
        label="线框色"
        allowClear
        swatches={WIDGET_BORDER_RECOMMENDED}
        value={value.color ?? ""}
        onChange={(color) => onChange({ color: color || undefined })}
      />
      <Slider
        label="线宽"
        value={value.width}
        fallback={1}
        min={0}
        max={8}
        step={1}
        unit="px"
        onChange={(width) => onChange({ width })}
      />
      {showRadius ? (
        <Slider
          label="圆角"
          value={value.radius}
          fallback={0}
          min={0}
          max={32}
          step={1}
          unit="px"
          onChange={(radius) => onChange({ radius })}
        />
      ) : null}
      <ChartDeSegmentField
        label="线型"
        value={value.style ?? "solid"}
        columns={3}
        options={LINE_BORDER_STYLES.map((s) => ({ value: s.value, label: s.label }))}
        onChange={(style) => onChange({ style: style as LineBorderStyleFields["style"] })}
      />
    </div>
  );
}

/** 看板整体 widgetStyle · 组件外框线框（pixel-shape-inner） */
export function WidgetStyleLineBorderControls({
  value,
  onChange,
  showToggle = true,
  density = "wide",
}: {
  value: WidgetStyleConfig;
  onChange: (patch: BackgroundPatch) => void;
  showToggle?: boolean;
  density?: WidgetSurfaceStyleDensity;
}) {
  const lineOn = value.borderEnabled !== false;

  return (
    <div className="space-y-2">
      {showToggle ? (
        <DeAttrToggleRowCompact
          label="显示线框"
          checked={lineOn}
          onCheckedChange={(show) => onChange({ borderEnabled: show, backgroundShow: true })}
        />
      ) : null}
      {lineOn ? (
        <LineBorderStyleFields
          density={density}
          value={{
            color: value.borderColor,
            width: value.borderWidth,
            style: value.borderStyle,
          }}
          onChange={(patch) =>
            onChange({
              ...(patch.color !== undefined ? { borderColor: patch.color } : {}),
              ...(patch.width !== undefined ? { borderWidth: patch.width } : {}),
              ...(patch.style !== undefined ? { borderStyle: patch.style } : {}),
            })
          }
        />
      ) : null}
    </div>
  );
}

/** 单图 deStyle.border · 内容区线框（pixel-shape-content，可覆盖看板默认） */
export function ChartLineBorderControls({
  value,
  onChange,
  density = "narrow",
}: {
  value?: ChartBorderStyle;
  onChange: (patch: Partial<ChartBorderStyle>) => void;
  density?: WidgetSurfaceStyleDensity;
}) {
  const lineOn = value?.show === true;

  return (
    <div className="space-y-2">
      <DeAttrToggleRowCompact
        label="显示线框"
        checked={lineOn}
        onCheckedChange={(show) => onChange({ show })}
      />
      {lineOn ? (
        <LineBorderStyleFields
          density={density}
          showRadius
          value={{
            color: value?.color,
            width: value?.width,
            style: value?.style,
            radius: value?.radius,
          }}
          onChange={(patch) =>
            onChange({
              ...(patch.color !== undefined ? { color: patch.color } : {}),
              ...(patch.width !== undefined ? { width: patch.width } : {}),
              ...(patch.style !== undefined ? { style: patch.style } : {}),
              ...(patch.radius !== undefined ? { radius: patch.radius } : {}),
            })
          }
        />
      ) : null}
    </div>
  );
}

/** DataEase 背景区核心：图片 / 边框（装饰 SVG 或 CSS 线框） */
export function ChartBackgroundDeModeFields({
  value,
  onChange,
  disabled = false,
  borderTab = "decorative",
  density = "narrow",
  highlightUrls,
}: ChartBackgroundDeModeFieldsProps) {
  const useLineBorder = borderTab === "line";
  const imageOnly = borderTab === "imageOnly";
  const rawMode = value.backgroundMode ?? (value.framePresetId ? "frame" : "image");
  const mode = useLineBorder
    ? rawMode === "border" || rawMode === "frame"
      ? "border"
      : "image"
    : rawMode === "border"
      ? "image"
      : rawMode;

  if (disabled) {
    return (
      <p className="py-1 text-[11px] text-gray-400 dark:text-gray-500">
        {imageOnly
          ? "开启背景后可设置底图"
          : useLineBorder
            ? "开启背景后可设置图片或线框"
            : "开启背景后可设置图片或装饰边框"}
      </p>
    );
  }

  if (imageOnly) {
    return (
      <WidgetBackgroundImageSection
        value={value}
        onChange={onChange}
        highlightUrls={highlightUrls}
      />
    );
  }

  const segmentOptions = useLineBorder ? BG_MODE_LINE_BORDER_OPTIONS : BG_MODE_OPTIONS;
  const lineOn = value.borderEnabled !== false;
  const FrameOpacitySlider =
    density === "narrow" ? InspectorSliderField : DashboardConfigSlider;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DeSegmentGroup
          sizing="fit"
          className="min-w-0"
          value={mode}
          columns={2}
          options={segmentOptions}
          onChange={(next) => {
            if (useLineBorder) {
              onChange({
                backgroundMode: next as "image" | "border",
                backgroundShow: true,
                ...(next === "border"
                  ? {
                      borderEnabled: true,
                      framePresetId: undefined,
                      frameColor: undefined,
                    }
                  : {}),
              });
              return;
            }
            onChange({
              backgroundMode: next as "image" | "frame",
              backgroundShow: true,
              ...(next === "frame" && !value.framePresetId ? { framePresetId: "frame-1" } : {}),
            });
          }}
        />
        {useLineBorder && mode === "border" ? (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="whitespace-nowrap text-[10px] text-gray-500 dark:text-gray-400">
              显示线框
            </span>
            <Switch
              checked={lineOn}
              onCheckedChange={(show) =>
                onChange({ borderEnabled: show, backgroundShow: true, backgroundMode: "border" })
              }
              aria-label="显示线框"
              size={INSPECTOR_SWITCH_SIZE}
            />
          </div>
        ) : null}
      </div>
      {mode === "image" ? (
        <WidgetBackgroundImageSection
          value={value}
          onChange={onChange}
          highlightUrls={highlightUrls}
        />
      ) : useLineBorder ? (
        <WidgetStyleLineBorderControls value={value} onChange={onChange} showToggle={false} density="narrow" />
      ) : (
        <div className="space-y-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <ColorField
              variant="swatch"
              label="装饰色"
              showLabel
              allowClear
              showHintTooltip={false}
              swatches={WIDGET_BORDER_RECOMMENDED}
              value={value.frameColor ?? ""}
              onChange={(color) =>
                onChange({
                  frameColor: color || undefined,
                  backgroundShow: true,
                  backgroundMode: "frame",
                })
              }
            />
            <ChartFramePresetPicker
              className="min-w-0 flex-1"
              label="装饰边框"
              value={value.framePresetId}
              color={value.frameColor}
              onChange={(presetId) =>
                onChange({
                  framePresetId: presetId,
                  backgroundShow: true,
                  backgroundMode: "frame",
                })
              }
            />
          </div>
          <FrameOpacitySlider
            label="装饰边框不透明度"
            ariaLabel="装饰边框不透明度"
            value={
              value.frameOpacity != null ? Math.round(value.frameOpacity * 100) : undefined
            }
            fallback={100}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(opacity) =>
              onChange({
                frameOpacity: opacity / 100,
                backgroundShow: true,
                backgroundMode: "frame",
                ...(value.framePresetId ? {} : { framePresetId: "frame-1" }),
              })
            }
          />
        </div>
      )}
    </div>
  );
}

/** @deprecated 使用 WidgetSurfaceAppearanceFields + InspectorNestedSection */
export function WidgetStyleBackgroundExtrasFields({
  value,
  onChange,
  disabled = false,
}: {
  value: WidgetStyleConfig;
  onChange: (patch: BackgroundPatch) => void;
  disabled?: boolean;
}) {
  if (disabled) return null;

  return (
    <InspectorNestedSection title="外观">
      <WidgetSurfaceAppearanceFields value={value} onChange={onChange} density="wide" />
    </InspectorNestedSection>
  );
}

type ChartBackgroundStyleFieldsProps = {
  value: WidgetStyleConfig;
  border?: ChartBorderStyle;
  onChange: (patch: BackgroundPatch) => void;
  onBorderChange?: (patch: Partial<ChartBorderStyle>) => void;
  /** 背景开关在折叠标题栏时设为 false */
  showHeaderToggle?: boolean;
  /** dashboard：看板默认 widgetStyle；chart：单图 deStyle */
  scope?: "chart" | "dashboard";
  density?: WidgetSurfaceStyleDensity;
  surfaceKind?: SurfaceKind;
  highlightUrls?: string[];
};

/** DataEase 样式 Tab · 背景区块（看板 widgetStyle 或单图 deStyle.background + 线框） */
export function ChartBackgroundStyleFields({
  value,
  border,
  onChange,
  onBorderChange,
  showHeaderToggle = true,
  scope = "chart",
  density = "narrow",
  surfaceKind,
  highlightUrls,
}: ChartBackgroundStyleFieldsProps) {
  const ws = value;
  const showBackground = ws.backgroundShow !== false;
  const isDashboard = scope === "dashboard";

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      {showHeaderToggle ? (
        <InspectorSwitchRow
          label="启用背景"
          checked={showBackground}
          onCheckedChange={(show) => onChange({ backgroundShow: show })}
        />
      ) : null}

      <ChartBackgroundDeModeFields
        value={ws}
        onChange={onChange}
        disabled={!showBackground}
        density={density}
        highlightUrls={highlightUrls}
      />

      {showBackground ? (
        <>
          <InspectorNestedSection title="外观">
            <WidgetSurfaceAppearanceFields
              value={ws}
              onChange={onChange}
              onPreviewChange={onChange}
              density={density}
              surfaceKind={surfaceKind}
            />
          </InspectorNestedSection>

          {isDashboard ? (
            <InspectorNestedSection title="线框">
              <p className="pb-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
                作用于全部组件外框；单图可在样式 Tab 单独覆盖
              </p>
              <WidgetStyleLineBorderControls
                value={ws}
                onChange={onChange}
                density={density}
              />
            </InspectorNestedSection>
          ) : onBorderChange ? (
            <InspectorNestedSection title="线框">
              <p className="pb-1 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
                仅当前组件；覆盖看板默认，作用于整个组件外框
              </p>
              <ChartLineBorderControls
                value={border}
                onChange={onBorderChange}
                density={density}
              />
            </InspectorNestedSection>
          ) : null}

          <InspectorNestedSection title="边距与圆角">
            <WidgetSurfaceSpacingFields value={ws} onChange={onChange} density={density} />
          </InspectorNestedSection>
        </>
      ) : null}
    </div>
  );
}
