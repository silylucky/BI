import { TEXT_COLOR_RECOMMENDED, WIDGET_BORDER_RECOMMENDED } from "./dashboardStyleConfig";
import { InspectorInlineColorRow } from "./inspectorCompact";
import {
  ChartPaletteFontSizeSelect,
  ChartPaletteNestedSection,
  ChartPaletteSectionSwitch,
  ChartTableColorGridCell,
} from "./chartPaletteShared";
import type { ChartLabelStyle, ChartTooltipStyle } from "@/lib/chartDeStyle";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";

export type ChartPaletteFieldDensity = "narrow" | "wide";

type ChartPaletteLabelTooltipFieldsProps = {
  density?: ChartPaletteFieldDensity;
  labelShow: boolean;
  tooltipShow: boolean;
  labelStyle: Pick<ChartLabelStyle, "fontSize" | "color">;
  tooltipStyle: Pick<ChartTooltipStyle, "fontSize" | "color" | "background">;
  labelColorFallback?: string;
  tooltipColorFallback?: string;
  tooltipBackgroundFallback?: string;
  showLabelToggle: boolean;
  showTooltipToggle: boolean;
  labelDisabled?: boolean;
  onLabelShowChange?: (show: boolean) => void;
  onTooltipShowChange?: (show: boolean) => void;
  onLabelStyleChange: (patch: Partial<ChartLabelStyle>) => void;
  onTooltipStyleChange: (patch: Partial<ChartTooltipStyle>) => void;
};

/** 对标 DataEase：图表标签 / 图表提示 折叠组 + 常显子项 */
export function ChartPaletteLabelTooltipFields({
  density = "wide",
  labelShow,
  tooltipShow,
  labelStyle,
  tooltipStyle,
  labelColorFallback,
  tooltipColorFallback,
  tooltipBackgroundFallback,
  showLabelToggle,
  showTooltipToggle,
  labelDisabled = false,
  onLabelShowChange,
  onTooltipShowChange,
  onLabelStyleChange,
  onTooltipStyleChange,
}: ChartPaletteLabelTooltipFieldsProps) {
  const compact = density === "narrow";

  return (
    <>
      {showLabelToggle && onLabelShowChange ? (
        <ChartPaletteNestedSection
          compact={compact}
          title="图表标签"
          action={
            <ChartPaletteSectionSwitch
              checked={labelShow}
              disabled={labelDisabled}
              aria-label="显示图表标签"
              onCheckedChange={onLabelShowChange}
            />
          }
        >
          <InspectorInlineColorRow
            label="字体颜色"
            allowClear
            swatches={TEXT_COLOR_RECOMMENDED}
            value={labelStyle.color ?? ""}
            fallbackValue={labelColorFallback}
            onChange={(color) => onLabelStyleChange({ color: color || undefined })}
          />
          <ChartPaletteFontSizeSelect
            density={density}
            value={labelStyle.fontSize}
            onChange={(fontSize) => onLabelStyleChange({ fontSize })}
          />
        </ChartPaletteNestedSection>
      ) : null}

      {showTooltipToggle && onTooltipShowChange ? (
        <ChartPaletteNestedSection
          compact={compact}
          title="图表提示"
          action={
            <ChartPaletteSectionSwitch
              checked={tooltipShow}
              aria-label="显示图表提示"
              onCheckedChange={onTooltipShowChange}
            />
          }
        >
          <InspectorInlineColorRow
            label="背景颜色"
            allowClear
            swatches={WIDGET_BORDER_RECOMMENDED}
            value={tooltipStyle.background ?? ""}
            fallbackValue={tooltipBackgroundFallback}
            onChange={(background) =>
              onTooltipStyleChange({ background: background || undefined })
            }
          />
          <InspectorInlineColorRow
            label="字体颜色"
            allowClear
            swatches={TEXT_COLOR_RECOMMENDED}
            value={tooltipStyle.color ?? ""}
            fallbackValue={tooltipColorFallback}
            onChange={(color) => onTooltipStyleChange({ color: color || undefined })}
          />
          <ChartPaletteFontSizeSelect
            density={density}
            value={tooltipStyle.fontSize}
            onChange={(fontSize) => onTooltipStyleChange({ fontSize })}
          />
        </ChartPaletteNestedSection>
      ) : null}
    </>
  );
}

type ChartTableColorFieldsProps = {
  tableStyle: ChartDeTableStyle;
  onPatch: (patch: Partial<ChartDeTableStyle>) => void;
  compact?: boolean;
  /** 外层已有「表格配色」折叠时设为 false，避免双层标题 */
  wrapSection?: boolean;
};

/** 对标 DataEase：表格配色两列色块栅格 */
export function ChartTableColorFields({
  tableStyle,
  onPatch,
  compact = false,
  wrapSection = true,
}: ChartTableColorFieldsProps) {
  const swatches = WIDGET_BORDER_RECOMMENDED;

  const fields = (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-0.5">
        <ChartTableColorGridCell
          label="表头/行背景"
          swatches={swatches}
          value={tableStyle.headerBg ?? ""}
          onChange={(headerBg) => onPatch({ headerBg: headerBg || undefined })}
        />
        <ChartTableColorGridCell
          label="表格背景"
          swatches={swatches}
          value={tableStyle.bodyBg ?? ""}
          onChange={(bodyBg) => onPatch({ bodyBg: bodyBg || undefined })}
        />
        <ChartTableColorGridCell
          label="斑马纹"
          swatches={swatches}
          value={tableStyle.zebraBg ?? ""}
          onChange={(zebraBg) => {
            onPatch({
              zebraBg: zebraBg || undefined,
              ...(zebraBg ? { zebraStriped: undefined } : { zebraStriped: false }),
            });
          }}
        />
        <ChartTableColorGridCell
          label="表头字体"
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tableStyle.headerFg ?? ""}
          onChange={(headerFg) => onPatch({ headerFg: headerFg || undefined })}
        />
        <ChartTableColorGridCell
          label="列背景"
          swatches={swatches}
          value={tableStyle.columnBg ?? ""}
          onChange={(columnBg) => onPatch({ columnBg: columnBg || undefined })}
        />
        <ChartTableColorGridCell
          label="角背景"
          swatches={swatches}
          value={tableStyle.cornerBg ?? ""}
          onChange={(cornerBg) => onPatch({ cornerBg: cornerBg || undefined })}
        />
        <ChartTableColorGridCell
          label="表格字体"
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tableStyle.bodyFg ?? ""}
          onChange={(bodyFg) => onPatch({ bodyFg: bodyFg || undefined })}
        />
        <ChartTableColorGridCell
          label="边框颜色"
          swatches={swatches}
          value={tableStyle.borderColor ?? ""}
          onChange={(borderColor) => onPatch({ borderColor: borderColor || undefined })}
        />
        <ChartTableColorGridCell
          label="滚动条颜色"
          swatches={swatches}
          value={tableStyle.scrollbarColor ?? ""}
          onChange={(scrollbarColor) => onPatch({ scrollbarColor: scrollbarColor || undefined })}
        />
        <ChartTableColorGridCell
          label="无数据提示"
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tableStyle.emptyHintFg ?? ""}
          onChange={(emptyHintFg) => onPatch({ emptyHintFg: emptyHintFg || undefined })}
        />
      </div>
      <div className="mt-1 space-y-0 border-t border-gray-100 pt-1 dark:border-white/[0.06]">
        <ChartPaletteFontSizeSelect
          density="wide"
          className="border-b-0 py-0"
          label="表头字号"
          value={tableStyle.headerFontSize}
          fallback={12}
          onChange={(headerFontSize) => onPatch({ headerFontSize })}
        />
        <ChartPaletteFontSizeSelect
          density="wide"
          className="border-b-0 py-0"
          label="表格字号"
          value={tableStyle.bodyFontSize}
          fallback={15}
          onChange={(bodyFontSize) => onPatch({ bodyFontSize })}
        />
        <InspectorInlineColorRow
          label="分页器字色"
          allowClear
          swatches={TEXT_COLOR_RECOMMENDED}
          value={tableStyle.paginationFg ?? ""}
          onChange={(paginationFg) => onPatch({ paginationFg: paginationFg || undefined })}
        />
        <ChartPaletteFontSizeSelect
          density="wide"
          className="border-b-0 py-0"
          label="分页器字号"
          value={tableStyle.paginationFontSize}
          fallback={14}
          onChange={(paginationFontSize) => onPatch({ paginationFontSize })}
        />
      </div>
    </>
  );

  if (!wrapSection) return fields;

  return (
    <ChartPaletteNestedSection compact={compact} title="表格配色">
      {fields}
    </ChartPaletteNestedSection>
  );
}
