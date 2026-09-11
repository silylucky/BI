import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeSegmentGroup } from "./dashboardInspectorUi";
import { TEXT_COLOR_RECOMMENDED } from "./dashboardStyleConfig";
import { INSPECTOR_LABEL, INSPECTOR_SELECT_TRIGGER, InspectorInlineColorRow } from "./inspectorCompact";
import {
  LEGEND_H_ALIGN_SEGMENT_OPTIONS,
  LEGEND_V_ALIGN_SEGMENT_OPTIONS,
} from "./inspectorSegmentIcons";
import type { ChartLegendIconShape, ChartLegendStyle } from "@/lib/chartDeStyle";
import {
  CHART_LEGEND_FONT_SIZE_OPTIONS,
  LEGEND_ICON_SHAPE_SELECT_OPTIONS,
  normalizeLegendIconShape,
  readChartLegendHAlign,
  readChartLegendIcon,
  readChartLegendIconSize,
  readChartLegendOrient,
  readChartLegendVAlign,
  resolveLegendIconSizeOptions,
  resolveLegendPositionFromAlign,
} from "@/lib/chartLegendPresentation";
import { resolveChartFontSizeOptions } from "@/lib/chartFontSizes";
import { readChartLegendPosition, type ChartDeStyle } from "@/lib/chartDeStyle";
import type { ChartType } from "@/lib/chartViewConfig";
import type { LegendEditorMode } from "@/lib/chartStylePanelGates";
import { cn } from "@/lib/utils";

const legendSelectContentClass = "z-[100001] max-h-56 min-w-[var(--radix-select-trigger-width)]";

/** 对标 DE ed-form--label-top */
function ChartLegendFormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-gray-100 py-2 last:border-b-0 dark:border-white/[0.06]",
        className,
      )}
    >
      <p className={cn(INSPECTOR_LABEL, "mb-1.5 text-gray-600 dark:text-gray-300")}>{label}</p>
      {children}
    </div>
  );
}

type ChartLegendDeParityFieldsProps = {
  chartType?: ChartType;
  deStyle: ChartDeStyle;
  editorMode?: LegendEditorMode;
  onPatch: (patch: Partial<NonNullable<ChartDeStyle["legend"]>>) => void;
};

/** 对标 DataEase attr-style · 图例：图标 / 文本 / 方向 / 位置 */
export function ChartLegendDeParityFields({
  deStyle,
  editorMode = "shell",
  onPatch,
}: ChartLegendDeParityFieldsProps) {
  const iconSize = readChartLegendIconSize(deStyle);
  const iconSizeOptions = resolveLegendIconSizeOptions(deStyle.legend?.iconSize);
  const iconShape = normalizeLegendIconShape(readChartLegendIcon(deStyle));
  const fontSize = deStyle.legend?.fontSize ?? 12;
  const fontSizeOptions = resolveChartFontSizeOptions(
    deStyle.legend?.fontSize,
    12,
    CHART_LEGEND_FONT_SIZE_OPTIONS,
  );
  const hAlign = readChartLegendHAlign(deStyle);
  const vAlign = readChartLegendVAlign(deStyle);
  const position = readChartLegendPosition(deStyle);
  const isSidePosition = position === "left" || position === "right";
  const showLayoutControls = editorMode !== "none";

  const patchAlign = (nextH: typeof hAlign, nextV: typeof vAlign) => {
    const nextPosition = resolveLegendPositionFromAlign(nextH, nextV);
    const patch: Partial<NonNullable<ChartDeStyle["legend"]>> = {
      hAlign: nextH,
      vAlign: nextV,
      position: nextPosition,
    };
    if (nextPosition === "left" || nextPosition === "right") {
      patch.orient = "vertical";
    }
    onPatch(patch);
  };

  return (
    <div className="relative z-0 flex flex-col pb-0.5" data-testid="chart-legend-de-form">
      <ChartLegendFormField label="图标">
        <div className="flex items-center gap-1.5">
          <Select
            value={iconShape}
            onValueChange={(value) => onPatch({ icon: value as ChartLegendIconShape })}
          >
            <SelectTrigger
              className={cn(INSPECTOR_SELECT_TRIGGER, "min-w-0 flex-1")}
              aria-label="图例图标形状"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={legendSelectContentClass}>
              {LEGEND_ICON_SHAPE_SELECT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(iconSize)}
            onValueChange={(value) => onPatch({ iconSize: Number(value) })}
          >
            <SelectTrigger
              className={cn(INSPECTOR_SELECT_TRIGGER, "w-14 shrink-0 px-1.5")}
              aria-label="图标大小"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={legendSelectContentClass}>
              {iconSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ChartLegendFormField>

      <ChartLegendFormField label="文本">
        <Select
          value={String(fontSize)}
          onValueChange={(value) => onPatch({ fontSize: Number(value) })}
        >
          <SelectTrigger className={INSPECTOR_SELECT_TRIGGER} aria-label="图例文本字号">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={legendSelectContentClass}>
            {fontSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChartLegendFormField>

      <InspectorInlineColorRow
        label="文本颜色"
        value={deStyle.legend?.color ?? "#667085"}
        allowClear={false}
        swatches={TEXT_COLOR_RECOMMENDED}
        onChange={(color) => onPatch({ color: color ?? "#667085" })}
      />

      {showLayoutControls ? (
        <ChartLegendFormField label="方向">
          <DeSegmentGroup
            value={readChartLegendOrient(deStyle)}
            options={[
              { value: "horizontal", label: "水平", ariaLabel: "水平排列" },
              {
                value: "vertical",
                label: "垂直",
                ariaLabel: "垂直排列",
                disabled: isSidePosition,
              },
            ]}
            columns={2}
            sizing="fill"
            onChange={(value) =>
              onPatch({ orient: value as NonNullable<ChartLegendStyle["orient"]> })
            }
          />
        </ChartLegendFormField>
      ) : null}

      {showLayoutControls ? (
        <ChartLegendFormField label="位置" className="border-b-0 pb-0">
          <div className="flex items-center gap-1">
          <DeSegmentGroup
            value={hAlign}
            options={LEGEND_H_ALIGN_SEGMENT_OPTIONS}
            columns={3}
            sizing="compact"
            className="min-w-0 flex-1"
            onChange={(value) => patchAlign(value as typeof hAlign, vAlign)}
          />
          <span className="h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
          <DeSegmentGroup
            value={vAlign}
            options={LEGEND_V_ALIGN_SEGMENT_OPTIONS}
            columns={3}
            sizing="compact"
            className="min-w-0 flex-1"
            onChange={(value) => patchAlign(hAlign, value as typeof vAlign)}
          />
        </div>
        </ChartLegendFormField>
      ) : null}
    </div>
  );
}
