import {
  DeAttrField,
} from "@/components/dashboard/dashboardInspectorUi";
import { DeAttrSliderField } from "@/components/dashboard/deAttrSlider";
import { ChartPaletteFontSizeSelect } from "@/components/dashboard/chartPaletteShared";
import {
  TEXT_COLOR_RECOMMENDED,
  WIDGET_BORDER_RECOMMENDED,
} from "@/components/dashboard/dashboardStyleConfig";
import { CHART_FONT_SIZE_OPTIONS } from "@/lib/chartFontSizes";
import {
  ChartInspectorSection,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import type {
  ScreenBorderStyleConfig,
  ScreenDateTimeStyleConfig,
  ScreenVisualStyleConfig,
} from "@/lib/screenVisualStyle";
import {
  DEFAULT_SCREEN_DATETIME_STYLE,
  normalizeScreenBorderStyle,
  normalizeScreenDateTimeStyle,
} from "@/lib/screenVisualStyle";
import { ScreenBorderSparkleStylePanel } from "./ScreenBorderSparkleStylePanel";
import { ScreenBorderVariantPicker } from "./ScreenBorderVariantPicker";
import { ScreenClockStylePanel } from "./ScreenClockStylePanel";

/** 时间行：在图表标准档位上扩展大屏标题级字号 */
const SCREEN_LARGE_FONT_SIZE_OPTIONS = [...CHART_FONT_SIZE_OPTIONS, 56, 64, 72] as const;

type ScreenStylePanelProps<T> = {
  value: T;
  onChange: (next: T) => void;
};

export function ScreenColorField({
  label,
  value,
  onChange,
  kind = "accent",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  kind?: "accent" | "text";
}) {
  return (
    <InspectorInlineColorRow
      label={label}
      value={value}
      allowClear={false}
      swatches={kind === "text" ? TEXT_COLOR_RECOMMENDED : WIDGET_BORDER_RECOMMENDED}
      onChange={(next) => onChange(next ?? value)}
    />
  );
}

export { ScreenClockStylePanel } from "./ScreenClockStylePanel";

export function ScreenDateTimeStylePanel({
  value,
  onChange,
}: ScreenStylePanelProps<ScreenDateTimeStyleConfig>) {
  const style = normalizeScreenDateTimeStyle(value);
  const patch = (partial: Partial<ScreenDateTimeStyleConfig>) => onChange({ ...style, ...partial });

  return (
    <ChartInspectorSection title="日期时间" defaultOpen data-testid="screen-datetime-style-panel">
      <ChartPaletteFontSizeSelect
        label="日期字号"
        density="narrow"
        value={style.dateFontSize}
        fallback={DEFAULT_SCREEN_DATETIME_STYLE.dateFontSize}
        options={CHART_FONT_SIZE_OPTIONS}
        onChange={(dateFontSize) => patch({ dateFontSize })}
      />
      <ChartPaletteFontSizeSelect
        label="时间字号"
        density="narrow"
        value={style.timeFontSize}
        fallback={DEFAULT_SCREEN_DATETIME_STYLE.timeFontSize}
        options={SCREEN_LARGE_FONT_SIZE_OPTIONS}
        onChange={(timeFontSize) => patch({ timeFontSize })}
      />
      <ScreenColorField label="文字颜色" kind="text" value={style.color} onChange={(color) => patch({ color })} />
      <InspectorSwitchRow
        label="显示星期"
        checked={style.showWeekday}
        onCheckedChange={(showWeekday) => patch({ showWeekday })}
      />
      <InspectorSwitchRow
        label="显示秒"
        checked={style.showSeconds}
        onCheckedChange={(showSeconds) => patch({ showSeconds })}
      />
    </ChartInspectorSection>
  );
}

export function ScreenBorderStylePanel({
  value,
  onChange,
}: ScreenStylePanelProps<ScreenBorderStyleConfig>) {
  const style = normalizeScreenBorderStyle(value);
  const patch = (partial: Partial<ScreenBorderStyleConfig>) =>
    onChange({ ...(value ?? {}), ...partial });

  return (
    <ChartInspectorSection title="边框" defaultOpen data-testid="screen-border-style-panel">
      <DeAttrField label="边框样式" compact className="border-b-0 py-0">
        <ScreenBorderVariantPicker style={style} onChange={(variant) => patch({ variant })} />
      </DeAttrField>
      <ScreenColorField label="强调色" value={style.accentColor} onChange={(accentColor) => patch({ accentColor })} />
      <InspectorSwitchRow
        label="外发光"
        checked={style.glowEnabled}
        onCheckedChange={(glowEnabled) => patch({ glowEnabled })}
      />
      <DeAttrSliderField
        label="内框透明度"
        compact
        value={style.innerBorderOpacity}
        min={0}
        max={1}
        step={0.05}
        ariaLabel="内框透明度"
        onChange={(innerBorderOpacity) => patch({ innerBorderOpacity })}
      />
      <ScreenBorderSparkleStylePanel
        value={value?.sparkle}
        accentFallback={style.accentColor}
        onChange={(sparkle) => patch({ sparkle })}
      />
    </ChartInspectorSection>
  );
}

export function patchScreenVisualStyle(
  current: ScreenVisualStyleConfig | undefined,
  key: keyof ScreenVisualStyleConfig,
  partial: ScreenVisualStyleConfig[typeof key],
): ScreenVisualStyleConfig {
  return {
    ...current,
    [key]: {
      ...(current?.[key] ?? {}),
      ...(partial ?? {}),
    },
  };
}
