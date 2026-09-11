import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartInspector } from "../ChartInspectorContext";
import {
  ChartInspectorSection,
  InspectorSwitchRow,
  INSPECTOR_SECTION_GAP,
  InspectorInlineColorRow,
  INSPECTOR_SELECT,
} from "../inspectorCompact";
import { ChartDeSliderField } from "../deAttrSlider";
import { patchChartDeStyleNested, readChartDeStyle } from "@/lib/chartDeStyle";
import type { AxisLabelRotate } from "@/lib/chartDeStyleBlocks";
import { resolveChartTypeStyleProfile } from "@/lib/chartTypeStyleProfiles";
import {
  resolveCartesianShapeFields,
  resolveCategoryLabelAxisSides,
} from "@/lib/chartStyleCartesianFields";
import { DEFAULT_CARTESIAN_BAR_WIDTH_RATIO, DEFAULT_CARTESIAN_LINE_WIDTH, DEFAULT_CARTESIAN_POINT_SIZE } from "@/lib/chartDeStyleBlocks";

const AXIS_LABEL_ROTATE_OPTIONS: Array<{ value: string; label: string; rotate: AxisLabelRotate }> = [
  { value: "0", label: "水平", rotate: 0 },
  { value: "-45", label: "倾斜", rotate: -45 },
  { value: "-90", label: "垂直", rotate: -90 },
  { value: "auto", label: "自动", rotate: "auto" },
];

function axisLabelRotateSelectValue(rotate: AxisLabelRotate | undefined): string {
  if (rotate === "auto") return "auto";
  if (rotate === -45) return "-45";
  if (rotate === -90) return "-90";
  return "0";
}

function axisLabelRotateFromSelect(value: string): AxisLabelRotate {
  const option = AXIS_LABEL_ROTATE_OPTIONS.find((item) => item.value === value);
  return option?.rotate ?? 0;
}

export function ChartAxisStyleSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const axis = readChartDeStyle(cfg).axis ?? {};
  const categoryLabelSides = resolveCategoryLabelAxisSides(cfg.chartType);

  const patchAxis = (side: "x" | "y", patch: Record<string, unknown>) =>
    mutateChartConfig((current) =>
      patchChartDeStyleNested(current, "axis", { [side]: { ...axis[side], ...patch } }),
    );

  return (
    <ChartInspectorSection title="坐标轴" data-testid="chart-axis-style">
      <div className={INSPECTOR_SECTION_GAP}>
        {(["x", "y"] as const).map((side) => (
          <div key={side} className="border-b border-gray-100 py-2 dark:border-white/[0.06]">
            <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
              {side === "x" ? "横轴" : "纵轴"}
            </p>
            <InspectorSwitchRow
              label="显示轴线"
              checked={axis[side]?.show !== false}
              onCheckedChange={(show) => patchAxis(side, { show })}
            />
            <div className="mt-2">
              <p className="mb-1 text-[11px] text-gray-500">轴名称</p>
              <Input
                className="h-8 text-xs"
                value={axis[side]?.name ?? ""}
                onChange={(e) => patchAxis(side, { name: e.target.value || undefined })}
                placeholder={side === "x" ? "类别轴" : "数值轴"}
              />
            </div>
            {categoryLabelSides.includes(side) ? (
              <div className="mt-2">
                <p className="mb-1 text-[11px] text-gray-500">标签方向</p>
                <Select
                  value={axisLabelRotateSelectValue(axis[side]?.labelRotate)}
                  onValueChange={(value) => patchAxis(side, { labelRotate: axisLabelRotateFromSelect(value) })}
                >
                  <SelectTrigger className={INSPECTOR_SELECT} aria-label={`${side === "x" ? "横轴" : "纵轴"}标签方向`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AXIS_LABEL_ROTATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="mt-2">
              <InspectorInlineColorRow
                label="轴线颜色"
                value={axis[side]?.lineColor ?? "#cbd5e1"}
                onChange={(lineColor) => patchAxis(side, { lineColor })}
              />
            </div>
            <ChartDeSliderField
              label="轴线宽度"
              value={axis[side]?.lineWidth}
              fallback={1}
              min={0.5}
              max={4}
              step={0.5}
              onChange={(lineWidth) => patchAxis(side, { lineWidth })}
            />
          </div>
        ))}
      </div>
    </ChartInspectorSection>
  );
}

export function ChartCartesianShapeSection() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const profileFields = resolveChartTypeStyleProfile(cfg.chartType).fields?.cartesianShape;
  const fields = profileFields ?? resolveCartesianShapeFields(cfg.chartType);
  const cartesian = readChartDeStyle(cfg).cartesian ?? {};

  const patch = (next: Record<string, unknown>) =>
    mutateChartConfig((current) => patchChartDeStyleNested(current, "cartesian", next));

  const patchLineSmooth = (lineSmooth: boolean) =>
    mutateChartConfig((current) => {
      let next = patchChartDeStyleNested(current, "cartesian", { lineSmooth });
      if (current.chartType === "line") {
        next = {
          ...next,
          styleVariant: lineSmooth
            ? "smooth"
            : next.styleVariant === "smooth"
              ? "default"
              : next.styleVariant,
        };
      }
      return next;
    });

  if (!fields?.length) return null;

  return (
    <ChartInspectorSection title="图形属性" data-testid="chart-cartesian-shape">
      <div className={INSPECTOR_SECTION_GAP}>
        {fields.includes("barWidthRatio") ? (
          <ChartDeSliderField
            label="柱宽比例"
            value={cartesian.barWidthRatio}
            fallback={DEFAULT_CARTESIAN_BAR_WIDTH_RATIO}
            min={0.2}
            max={0.9}
            step={0.05}
            onChange={(barWidthRatio) => patch({ barWidthRatio })}
          />
        ) : null}
        {fields.includes("barRadius") ? (
          <ChartDeSliderField
            label="圆角"
            value={cartesian.barRadius}
            fallback={0}
            min={0}
            max={12}
            step={1}
            onChange={(barRadius) => patch({ barRadius })}
          />
        ) : null}
        {fields.includes("lineSmooth") ? (
          <InspectorSwitchRow
            label="平滑曲线"
            checked={cartesian.lineSmooth === true}
            onCheckedChange={patchLineSmooth}
          />
        ) : null}
        {fields.includes("lineWidth") ? (
          <ChartDeSliderField
            label="线宽"
            value={cartesian.lineWidth}
            fallback={DEFAULT_CARTESIAN_LINE_WIDTH}
            min={1}
            max={6}
            step={0.5}
            onChange={(lineWidth) => patch({ lineWidth })}
          />
        ) : null}
        {fields.includes("pointSize") ? (
          <ChartDeSliderField
            label="点大小"
            value={cartesian.pointSize}
            fallback={DEFAULT_CARTESIAN_POINT_SIZE}
            min={2}
            max={12}
            step={1}
            onChange={(pointSize) => patch({ pointSize })}
          />
        ) : null}
        {fields.includes("areaOpacity") ? (
          <ChartDeSliderField
            label="面积透明度"
            value={cartesian.areaOpacity}
            fallback={0.35}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(areaOpacity) => patch({ areaOpacity })}
          />
        ) : null}
      </div>
    </ChartInspectorSection>
  );
}
