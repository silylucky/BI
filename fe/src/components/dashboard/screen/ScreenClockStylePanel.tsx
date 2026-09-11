import { ChartPaletteFontSizeSelect } from "@/components/dashboard/chartPaletteShared";
import {
  DeAttrField,
  DeSegmentGroup,
  DE_SELECT,
} from "@/components/dashboard/dashboardInspectorUi";
import {
  DASHBOARD_FONT_OPTIONS,
  dashboardFontSelectValue,
  resolveDashboardFontOptionValue,
} from "@/components/dashboard/dashboardStyleConfig";
import { DeTitleStyleToolbar } from "@/components/dashboard/deTitleStyleToolbar";
import { CHART_FONT_SIZE_OPTIONS } from "@/lib/chartFontSizes";
import type { ScreenClockStyleConfig } from "@/lib/screenVisualStyle";
import {
  DEFAULT_SCREEN_CLOCK_STYLE,
  normalizeScreenClockStyle,
} from "@/lib/screenVisualStyle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartInspectorSection,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import { ScreenColorField } from "./ScreenVisualStylePanels";

const SCREEN_LARGE_FONT_SIZE_OPTIONS = [...CHART_FONT_SIZE_OPTIONS, 56, 64, 72] as const;

const DATE_FORMAT_OPTIONS = [
  { value: "YYYY-MM-DD", label: "2026-08-07" },
  { value: "YYYY/MM/DD", label: "2026/08/07" },
  { value: "YYYY年MM月DD日", label: "2026年08月07日" },
  { value: "MM-DD", label: "08-07" },
] as const;

type ScreenClockStylePanelProps = {
  value: ScreenClockStyleConfig | undefined;
  onChange: (next: ScreenClockStyleConfig) => void;
};

export function ScreenClockStylePanel({ value, onChange }: ScreenClockStylePanelProps) {
  const style = normalizeScreenClockStyle(value);
  const patch = (partial: Partial<ScreenClockStyleConfig>) => onChange({ ...style, ...partial });
  const fontSelectValue = dashboardFontSelectValue(style.fontFamily);
  const resolvedFont = resolveDashboardFontOptionValue(style.fontFamily);

  return (
    <ChartInspectorSection title="时钟" defaultOpen data-testid="screen-clock-style-panel">
      <ChartPaletteFontSizeSelect
        label="时间字号"
        density="narrow"
        value={style.fontSize}
        fallback={DEFAULT_SCREEN_CLOCK_STYLE.fontSize}
        options={SCREEN_LARGE_FONT_SIZE_OPTIONS}
        onChange={(fontSize) => patch({ fontSize })}
      />
      <ScreenColorField
        label="时间颜色"
        kind="text"
        value={style.color}
        onChange={(color) => patch({ color })}
      />
      <InspectorSwitchRow
        label="显示日期"
        checked={style.showDate}
        onCheckedChange={(showDate) => patch({ showDate })}
      />
      {style.showDate ? (
        <DeAttrField label="日期格式" compact className="border-b-0 py-0">
          <DeSegmentGroup
            value={style.dateFormat}
            options={DATE_FORMAT_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            columns={2}
            onChange={(dateFormat) =>
              patch({ dateFormat: dateFormat as ScreenClockStyleConfig["dateFormat"] })
            }
          />
        </DeAttrField>
      ) : null}
      <InspectorSwitchRow
        label="显示秒"
        checked={style.showSeconds}
        onCheckedChange={(showSeconds) => patch({ showSeconds })}
      />
      <InspectorSwitchRow
        label="12 小时制"
        checked={style.use12Hour}
        onCheckedChange={(use12Hour) => patch({ use12Hour })}
      />
      <InspectorSwitchRow
        label="显示星期"
        checked={style.showWeekday}
        onCheckedChange={(showWeekday) => patch({ showWeekday })}
      />
      {style.showWeekday ? (
        <>
          <ChartPaletteFontSizeSelect
            label="星期字号"
            density="narrow"
            value={style.weekdayFontSize}
            fallback={DEFAULT_SCREEN_CLOCK_STYLE.weekdayFontSize}
            options={CHART_FONT_SIZE_OPTIONS}
            onChange={(weekdayFontSize) => patch({ weekdayFontSize })}
          />
          <ScreenColorField
            label="星期颜色"
            kind="text"
            value={style.weekdayColor}
            onChange={(weekdayColor) => patch({ weekdayColor })}
          />
        </>
      ) : null}
      <DeAttrField label="字体" compact>
        <Select
          value={fontSelectValue}
          onValueChange={(next) => {
            if (next === "__default__") patch({ fontFamily: "" });
            else if (next !== "__custom__") patch({ fontFamily: next });
          }}
        >
          <SelectTrigger className={DE_SELECT} aria-label="时钟字体">
            <SelectValue placeholder="默认字体" />
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
            {fontSelectValue === "__custom__" && resolvedFont ? (
              <SelectItem value="__custom__">{resolvedFont}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </DeAttrField>
      <DeAttrField label="排版" compact className="border-b-0 py-0">
        <DeTitleStyleToolbar
          value={style}
          defaultFontSize={DEFAULT_SCREEN_CLOCK_STYLE.fontSize}
          onChange={(partial) => patch(partial)}
        />
      </DeAttrField>
      <DeAttrField label="排列方式" compact className="border-b-0 py-0">
        <DeSegmentGroup
          value={style.layout}
          options={[
            { value: "stacked", label: "上下" },
            { value: "inline", label: "横向" },
          ]}
          columns={2}
          onChange={(layout) => patch({ layout: layout as ScreenClockStyleConfig["layout"] })}
        />
      </DeAttrField>
    </ChartInspectorSection>
  );
}
