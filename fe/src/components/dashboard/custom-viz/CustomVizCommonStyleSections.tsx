import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TEXT_COLOR_RECOMMENDED } from "@/components/dashboard/dashboardStyleConfig";
import { ChartBackgroundStyleFields } from "../chartStyleFields";
import { ChartDeAttrField, CHART_DE_INPUT } from "../chartInspectorDeFields";
import { ChartPaletteFontSizeSelect } from "../chartPaletteShared";
import { ChartPaletteDeParityFields } from "../chartPaletteDeParityFields";
import { ChartDeLabelContentFields } from "../chartStyleSections/ChartDeLabelContentFields";
import { ChartDeSliderField } from "../deAttrSlider";
import { DeTitleStyleToolbar } from "../deTitleStyleToolbar";
import {
  ChartInspectorSection,
  INSPECTOR_SECTION_GAP,
  INSPECTOR_SWITCH_SIZE,
  InspectorInlineColorRow,
} from "../inspectorCompact";
import type { DashboardStyleConfig } from "../dashboardStyleConfig";
import type { CustomVizWidgetConfig } from "../layoutUtils";
import {
  patchCustomVizDisplayStyle,
  patchCustomVizDisplayStyleNested,
  readCustomVizDisplayStyle,
  readCustomVizLabelVisible,
  readCustomVizTitleVisible,
  readCustomVizTooltipVisible,
  resolveCustomVizDisplayBackgroundShell,
  resolveCustomVizLabelColor,
  resolveCustomVizTooltipBackground,
  resolveCustomVizTooltipColor,
  readCustomVizDisplayBorder,
  type CustomVizDisplayStyle,
} from "./customVizDisplayStyle";

type SectionProps = {
  config: CustomVizWidgetConfig;
  widgetTitle: string;
  dashboardStyle?: DashboardStyleConfig;
  onChange: (next: CustomVizWidgetConfig) => void;
  onTitleChange?: (title: string) => void;
};

export function CustomVizBackgroundStyleSection({
  config,
  dashboardStyle,
  onChange,
}: SectionProps) {
  const effective = resolveCustomVizDisplayBackgroundShell({ customVizConfig: config }, dashboardStyle);
  const backgroundEnabled = effective.backgroundShow !== false;
  const surfaceKind = dashboardStyle?.surfaceKind ?? "dashboard";

  return (
    <ChartInspectorSection
      title="背景"
      enabled={backgroundEnabled}
      action={
        <Switch
          checked={backgroundEnabled}
          onCheckedChange={(show) =>
            onChange(patchCustomVizDisplayStyleNested(config, "background", { backgroundShow: show }))
          }
          aria-label="启用背景"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <ChartBackgroundStyleFields
        value={effective}
        border={readCustomVizDisplayBorder(config, dashboardStyle)}
        onChange={(patch) => onChange(patchCustomVizDisplayStyleNested(config, "background", patch))}
        onBorderChange={(patch) => onChange(patchCustomVizDisplayStyleNested(config, "border", patch))}
        showHeaderToggle={false}
        surfaceKind={surfaceKind}
      />
    </ChartInspectorSection>
  );
}

export function CustomVizPaletteStyleSection({ config, dashboardStyle, onChange }: SectionProps) {
  const ds = readCustomVizDisplayStyle(config);

  const patchRoot = (patch: Partial<CustomVizDisplayStyle>) =>
    onChange(patchCustomVizDisplayStyle(config, patch));

  return (
    <ChartInspectorSection title="图表配色">
      <ChartPaletteDeParityFields
        dense
        showInherit
        dashboardPaletteId={dashboardStyle?.paletteId}
        dashboardPaletteColors={dashboardStyle?.paletteColors}
        paletteId={ds.paletteId}
        paletteColors={ds.paletteColors}
        paletteOpacity={ds.paletteOpacity}
        seriesGradient={ds.seriesGradient ?? dashboardStyle?.seriesGradient ?? false}
        depthVisual={dashboardStyle?.depthVisual ?? "off"}
        showLabelToggle={false}
        showTooltipToggle={false}
        showOpacity
        showGradientToggle
        showDepthToggle={false}
        onPaletteChange={(paletteId, colors) =>
          patchRoot({
            paletteId: paletteId ?? undefined,
            paletteColors: colors.length > 0 ? [...colors] : undefined,
          })
        }
        onOpacityChange={(opacityPercent) => patchRoot({ paletteOpacity: opacityPercent / 100 })}
        onOpacityPreview={(opacityPercent) => patchRoot({ paletteOpacity: opacityPercent / 100 })}
        onSeriesGradientChange={(enabled) => patchRoot({ seriesGradient: enabled })}
        onDepthVisualChange={() => undefined}
      />
    </ChartInspectorSection>
  );
}

export function CustomVizTitleStyleSection({
  config,
  widgetTitle,
  dashboardStyle,
  onChange,
  onTitleChange,
}: SectionProps) {
  const ds = readCustomVizDisplayStyle(config);
  const titleVisible = readCustomVizTitleVisible(config, dashboardStyle);
  const patchTitle = (patch: Partial<NonNullable<CustomVizDisplayStyle["title"]>>) =>
    onChange(patchCustomVizDisplayStyleNested(config, "title", patch));

  return (
    <ChartInspectorSection
      title="标题"
      enabled={titleVisible}
      action={
        <Switch
          checked={titleVisible}
          onCheckedChange={(show) => patchTitle({ show })}
          aria-label="显示标题"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <ChartDeAttrField label="文本">
        <div className="space-y-2">
          <Input
            className={CHART_DE_INPUT}
            value={widgetTitle}
            onChange={(e) => onTitleChange?.(e.target.value)}
            aria-label="标题文本"
          />
          <DeTitleStyleToolbar value={ds.title ?? {}} onChange={patchTitle} defaultFontSize={18} />
        </div>
      </ChartDeAttrField>
      <InspectorInlineColorRow
        label="字体色"
        swatches={TEXT_COLOR_RECOMMENDED}
        value={ds.title?.color ?? ""}
        onChange={(color) => patchTitle({ color: color || undefined })}
      />
    </ChartInspectorSection>
  );
}

export function CustomVizRemarkStyleSection({ config, onChange }: SectionProps) {
  const ds = readCustomVizDisplayStyle(config);
  const patchRemark = (patch: Partial<NonNullable<CustomVizDisplayStyle["remark"]>>) =>
    onChange(patchCustomVizDisplayStyleNested(config, "remark", patch));

  return (
    <ChartInspectorSection
      title="备注"
      enabled={ds.remark?.show === true}
      action={
        <Switch
          checked={ds.remark?.show ?? false}
          onCheckedChange={(show) => patchRemark({ show })}
          aria-label="显示备注"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <ChartDeAttrField label="备注内容">
        <Input
          className={CHART_DE_INPUT}
          value={ds.remark?.text ?? ""}
          placeholder="图表说明…"
          onChange={(e) => patchRemark({ text: e.target.value })}
        />
      </ChartDeAttrField>
    </ChartInspectorSection>
  );
}

export function CustomVizLabelStyleSection({ config, dashboardStyle, onChange }: SectionProps) {
  const ds = readCustomVizDisplayStyle(config);
  const showLabel = readCustomVizLabelVisible(config, dashboardStyle);
  const patchLabel = (patch: Partial<NonNullable<CustomVizDisplayStyle["label"]>>) =>
    onChange(patchCustomVizDisplayStyleNested(config, "label", patch));

  return (
    <ChartInspectorSection
      title="标签"
      enabled={showLabel}
      action={
        <Switch
          checked={showLabel}
          onCheckedChange={(show) => patchLabel({ show })}
          aria-label="显示数据标签"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <InspectorInlineColorRow
        label="字体颜色"
        allowClear
        swatches={TEXT_COLOR_RECOMMENDED}
        value={ds.label?.color ?? ""}
        fallbackValue={resolveCustomVizLabelColor(config, dashboardStyle)}
        onChange={(color) => patchLabel({ color: color || undefined })}
      />
      <ChartPaletteFontSizeSelect
        density="narrow"
        value={ds.label?.fontSize}
        fallback={dashboardStyle?.chartLabelStyle?.fontSize ?? 12}
        onChange={(fontSize) => patchLabel({ fontSize })}
      />
      <ChartDeLabelContentFields label={ds.label} patchLabel={patchLabel} />
    </ChartInspectorSection>
  );
}

export function CustomVizTooltipStyleSection({ config, dashboardStyle, onChange }: SectionProps) {
  const ds = readCustomVizDisplayStyle(config);
  const tooltip = ds.tooltip ?? {};
  const tooltipShow = readCustomVizTooltipVisible(config, dashboardStyle);

  return (
    <ChartInspectorSection
      title="提示"
      data-testid="custom-viz-tooltip-style"
      enabled={tooltipShow}
      action={
        <Switch
          checked={tooltipShow}
          onCheckedChange={(show) =>
            onChange(patchCustomVizDisplayStyleNested(config, "tooltip", { show }))
          }
          aria-label="显示提示"
          size={INSPECTOR_SWITCH_SIZE}
        />
      }
    >
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorInlineColorRow
          label="字体颜色"
          allowClear
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tooltip.color ?? ""}
          fallbackValue={resolveCustomVizTooltipColor(config, dashboardStyle)}
          onChange={(color) =>
            onChange(patchCustomVizDisplayStyleNested(config, "tooltip", { color: color || undefined }))
          }
        />
        <InspectorInlineColorRow
          label="背景颜色"
          allowClear
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tooltip.background ?? ""}
          fallbackValue={resolveCustomVizTooltipBackground(config, dashboardStyle)}
          onChange={(background) =>
            onChange(
              patchCustomVizDisplayStyleNested(config, "tooltip", {
                background: background || undefined,
              }),
            )
          }
        />
        <ChartDeSliderField
          label="字号"
          value={tooltip.fontSize}
          fallback={dashboardStyle?.chartTooltipStyle?.fontSize ?? 12}
          min={6}
          max={20}
          step={1}
          onChange={(fontSize) =>
            onChange(patchCustomVizDisplayStyleNested(config, "tooltip", { fontSize }))
          }
        />
      </div>
    </ChartInspectorSection>
  );
}
