import { Input } from "@/components/ui/input";
import { ColorField } from "@/components/ui/color-field";
import { Switch } from "@/components/ui/switch";
import type { ChartBorderStyle } from "@/lib/chartDeStyle";
import { ChartBackgroundStyleFields } from "./chartStyleFields";
import {
  DeAttrField,
  DeAttrForm,
  DeAttrToggleRow,
  DE_INPUT,
  DeSegmentGroup,
} from "./dashboardInspectorUi";
import { DashboardConfigSlider } from "./deAttrSlider";
import {
  ChartInspectorSection,
  INSPECTOR_SWITCH_SIZE,
  InspectorInlineColorRow,
} from "./inspectorCompact";
import { ChartPaletteFontSizeSelect } from "./chartPaletteShared";
import type { WidgetStyleConfig } from "./dashboardStyleConfig";
import { SURFACE_COLOR_RECOMMENDED } from "./dashboardStyleConfig";
import { resolveCustomVizWidgetShellStyle } from "./custom-viz/customVizDisplayStyle";
import type {
  LayoutWidget,
  MediaAlign,
  MediaFit,
  MediaWidgetConfig,
  TabsHeadStyleConfig,
  TabsWidgetConfig,
  DashboardStyleConfig,
} from "./layoutUtils";
import { mergeWidgetShellStyle } from "./dashboardStyleConfig";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import { resolveLegacyTitleBarWidgetStyle } from "@/lib/screenTitleBarAssets";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { ShapePresentationLayers } from "@/lib/chartDeStyle";
import {
  WidgetShellBackgroundLayers,
  WidgetShellFrameLayers,
} from "./WidgetShellPresentationLayers";

export function toWidgetShellLayers(
  shell: ReturnType<typeof mergeWidgetShellStyle>,
): ShapePresentationLayers {
  return {
    style: {},
    backgroundLayers: [shell.backgroundLayer],
    frameLayers: [shell.frameLayer ?? null],
  };
}

/** 栅格看板组件外壳：底色 + 底图/装饰图层 + 装饰边框 */
export function GridWidgetShellFrame({
  shell,
  widgetId,
  className,
  children,
}: {
  shell: ReturnType<typeof mergeWidgetShellStyle>;
  widgetId: string;
  className?: string;
  children: ReactNode;
}) {
  const layers = toWidgetShellLayers(shell);
  return (
    <div className={cn("relative flex h-full min-h-0 flex-col", className)} style={shell.style}>
      <WidgetShellBackgroundLayers layers={layers} prefix={`grid-${widgetId}`} />
      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <WidgetShellFrameLayers layers={layers} prefix={`grid-${widgetId}`} zClassName="z-[2]" />
    </div>
  );
}

export function readWidgetStyleBorder(ws: WidgetStyleConfig = {}): ChartBorderStyle {
  return {
    show: ws.borderEnabled,
    color: ws.borderColor,
    width: ws.borderWidth,
    style: ws.borderStyle,
  };
}

export function patchWidgetStyleBorder(
  ws: WidgetStyleConfig,
  patch: Partial<ChartBorderStyle>,
): WidgetStyleConfig {
  return {
    ...ws,
    borderEnabled: patch.show ?? ws.borderEnabled,
    borderColor: patch.color ?? ws.borderColor,
    borderWidth: patch.width ?? ws.borderWidth,
    borderStyle: patch.style ?? ws.borderStyle,
  };
}

export function mergeWidgetOverrideStyle(
  dashboardWidgetStyle: WidgetStyleConfig | undefined,
  widget: LayoutWidget,
): WidgetStyleConfig | undefined {
  let override: WidgetStyleConfig | undefined;
  if (widget.type === "tabs") override = widget.tabsConfig?.widgetStyle;
  else if (widget.type === "media") override = widget.mediaConfig?.widgetStyle;
  else if (widget.type === "text") {
    override =
      resolveLegacyTitleBarWidgetStyle(widget) ?? widget.textConfig?.widgetStyle;
  } else if (widget.type === "customViz") {
    override = widget.customVizConfig?.widgetStyle;
  }

  if (!dashboardWidgetStyle && !override) return undefined;
  return { ...(dashboardWidgetStyle ?? {}), ...(override ?? {}) };
}

/** 栅格看板：合并看板级 + 单组件 widgetStyle 外壳（对标 PixelShape） */
export function resolveGridWidgetShell(widget: LayoutWidget, dashboardStyle?: DashboardStyleConfig) {
  const scheme = resolveWidgetEffectiveScheme(dashboardStyle);
  const merged =
    widget.type === "customViz"
      ? resolveCustomVizWidgetShellStyle(widget, dashboardStyle)
      : mergeWidgetOverrideStyle(dashboardStyle?.widgetStyle, widget);
  return mergeWidgetShellStyle(merged, scheme);
}

export function gridWidgetShellClassName(
  showGridChrome: boolean,
  selected: boolean,
  extra?: string,
) {
  return cn(
    "flex h-full min-h-0 flex-col",
    showGridChrome && "overflow-hidden rounded-xl border shadow-theme-xs",
    showGridChrome &&
      selected &&
      "dashboard-widget-selected border-gray-400 shadow-theme-sm ring-1 ring-gray-300/70 dark:border-gray-600 dark:ring-gray-600/40",
    showGridChrome && !selected && "border-gray-200 dark:border-gray-800",
    extra,
  );
}

export function WidgetShellBackgroundSection({
  value,
  onChange,
  highlightUrls,
}: {
  value: WidgetStyleConfig;
  onChange: (patch: Partial<WidgetStyleConfig>) => void;
  highlightUrls?: string[];
}) {
  const ws = value ?? {};
  const backgroundEnabled = ws.backgroundShow !== false;
  return (
    <ChartInspectorSection
      title="背景"
      defaultOpen
      enabled={backgroundEnabled}
      action={
        <Switch
          checked={backgroundEnabled}
          onCheckedChange={(show) => onChange({ backgroundShow: show })}
          aria-label="启用背景"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <ChartBackgroundStyleFields
        scope="chart"
        density="wide"
        showHeaderToggle={false}
        value={ws}
        onChange={onChange}
        highlightUrls={highlightUrls}
        border={readWidgetStyleBorder(ws)}
        onBorderChange={(patch) => onChange(patchWidgetStyleBorder(ws, patch))}
      />
    </ChartInspectorSection>
  );
}

export function WidgetComponentNameSection({
  widgetId,
  title,
  onTitleChange,
}: {
  widgetId: string;
  title: string;
  onTitleChange?: (title: string) => void;
}) {
  if (!onTitleChange) return null;
  return (
    <ChartInspectorSection title="组件" defaultOpen>
      <DeAttrField label="名称" compact className="border-b-0 py-0">
        <Input
          id={`widget-name-${widgetId}`}
          className={DE_INPUT}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="组件名称"
        />
      </DeAttrField>
    </ChartInspectorSection>
  );
}

const MEDIA_FIT_OPTIONS = [
  { value: "contain", label: "包含" },
  { value: "cover", label: "覆盖" },
  { value: "fill", label: "拉伸" },
] as const;

const MEDIA_ALIGN_OPTIONS = [
  { value: "center", label: "居中" },
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
] as const;

export function MediaWidgetStylePanel({
  widget,
  cfg,
  onChange,
  onTitleChange,
}: {
  widget: LayoutWidget & { mediaConfig: MediaWidgetConfig };
  cfg: MediaWidgetConfig;
  onChange: (mediaConfig: MediaWidgetConfig) => void;
  onTitleChange?: (title: string) => void;
}) {
  const patch = (partial: Partial<MediaWidgetConfig>) => onChange({ ...cfg, ...partial });
  const widgetStyle = cfg.widgetStyle ?? {};

  const patchWidgetStyle = (stylePatch: Partial<WidgetStyleConfig>) =>
    patch({ widgetStyle: { ...widgetStyle, ...stylePatch } });

  return (
    <div className="flex flex-col gap-0" data-testid="media-widget-style-panel">
      <WidgetComponentNameSection
        widgetId={widget.id}
        title={widget.title}
        onTitleChange={onTitleChange}
      />
      <ChartInspectorSection title="图片显示" defaultOpen>
        <DeAttrForm>
          <DeAttrField label="缩放方式" compact>
            <DeSegmentGroup
              value={cfg.fit}
              options={[...MEDIA_FIT_OPTIONS]}
              columns={3}
              onChange={(v) => patch({ fit: v as MediaFit })}
            />
          </DeAttrField>
          <DeAttrField label="对齐" hint="留白时的锚点" compact>
            <DeSegmentGroup
              value={cfg.align ?? "center"}
              options={[...MEDIA_ALIGN_OPTIONS]}
              columns={3}
              sizing="fit"
              onChange={(v) => patch({ align: v as MediaAlign })}
            />
          </DeAttrField>
          <DashboardConfigSlider
            label="图片不透明度"
            ariaLabel="图片不透明度"
            value={cfg.opacity != null ? Math.round(cfg.opacity * 100) : undefined}
            fallback={100}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(opacity) => patch({ opacity: opacity / 100 })}
          />
          <DashboardConfigSlider
            label="圆角"
            value={cfg.borderRadius}
            fallback={0}
            min={0}
            max={32}
            step={1}
            unit="px"
            onChange={(borderRadius) => patch({ borderRadius })}
          />
          <DeAttrField label="留白底色" compact className="border-b-0">
            <ColorField
              variant="swatch"
              showLabel={false}
              showHintTooltip={false}
              compact
              allowClear
              swatches={SURFACE_COLOR_RECOMMENDED}
              value={cfg.background ?? ""}
              onChange={(background) => patch({ background: background || "" })}
            />
          </DeAttrField>
        </DeAttrForm>
      </ChartInspectorSection>
      <WidgetShellBackgroundSection value={widgetStyle} onChange={patchWidgetStyle} />
    </div>
  );
}

export function TextWidgetStylePanel({
  widget,
  characters,
  widgetStyle,
  onTitleChange,
  onWidgetStyleChange,
  highlightUrls,
}: {
  widget: LayoutWidget;
  characters: number;
  widgetStyle: WidgetStyleConfig;
  onTitleChange?: (title: string) => void;
  onWidgetStyleChange: (patch: Partial<WidgetStyleConfig>) => void;
  highlightUrls?: string[];
}) {
  return (
    <div className="flex flex-col gap-0" data-testid="text-widget-style-panel">
      <WidgetComponentNameSection
        widgetId={widget.id}
        title={widget.title}
        onTitleChange={onTitleChange}
      />
      <ChartInspectorSection
        title="正文"
        hint="双击画布进入编辑，使用浮动工具栏调整字体、字号、颜色与对齐。"
        defaultOpen
      >
        <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">当前内容：{characters} 个字符</p>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          保存：点击外部或 Ctrl+Enter · 取消：Esc
        </p>
      </ChartInspectorSection>
      <WidgetShellBackgroundSection
        value={widgetStyle}
        onChange={onWidgetStyleChange}
        highlightUrls={highlightUrls}
      />
    </div>
  );
}

export function TabsWidgetStylePanel({
  widget,
  onChange,
  onTitleChange,
}: {
  widget: LayoutWidget & { tabsConfig: TabsWidgetConfig };
  onChange: (tabsConfig: TabsWidgetConfig) => void;
  onTitleChange?: (title: string) => void;
}) {
  const cfg = widget.tabsConfig;
  const widgetStyle = cfg.widgetStyle ?? {};
  const headStyle = cfg.headStyle ?? {};

  const patchWidgetStyle = (patch: Partial<WidgetStyleConfig>) =>
    onChange({ ...cfg, widgetStyle: { ...widgetStyle, ...patch } });

  const patchHeadStyle = (patch: Partial<TabsHeadStyleConfig>) =>
    onChange({ ...cfg, headStyle: { ...headStyle, ...patch } });

  return (
    <div className="flex flex-col gap-0" data-testid="tabs-widget-style-panel">
      <WidgetComponentNameSection
        widgetId={widget.id}
        title={widget.title}
        onTitleChange={onTitleChange}
      />
      <WidgetShellBackgroundSection value={widgetStyle} onChange={patchWidgetStyle} />
      <ChartInspectorSection title="页签栏" defaultOpen>
        <ChartPaletteFontSizeSelect
          density="narrow"
          value={headStyle.fontSize}
          fallback={14}
          onChange={(fontSize) => patchHeadStyle({ fontSize })}
        />
        <InspectorInlineColorRow
          label="激活色"
          value={headStyle.activeColor ?? ""}
          onChange={(activeColor) => patchHeadStyle({ activeColor: activeColor || undefined })}
        />
        <InspectorInlineColorRow
          label="未激活色"
          value={headStyle.inactiveColor ?? ""}
          onChange={(inactiveColor) => patchHeadStyle({ inactiveColor: inactiveColor || undefined })}
        />
        <InspectorInlineColorRow
          label="栏背景"
          value={headStyle.barBackground ?? ""}
          onChange={(barBackground) => patchHeadStyle({ barBackground: barBackground || undefined })}
        />
      </ChartInspectorSection>
    </div>
  );
}
