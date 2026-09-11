import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMetricValue } from "@/components/dashboard/dashboardStyleConfig";
import { ChartDeAttrField, ChartDeSegmentField, CHART_DE_INPUT } from "../chartInspectorDeFields";
import { INSPECTOR_SELECT, InspectorSwitchRow } from "../inspectorCompact";
import type { ChartDeStyle } from "@/lib/chartDeStyle";
import {
  DEFAULT_LIQUID_MAX_MULTIPLIER,
  defaultLiquidFixMaxFromMetric,
  type ChartLiquidStyle,
} from "@/lib/chartDeStyleBlocks";
import { resolveLiquidMetricFormat } from "@/lib/liquidLabelFormat";

const METRIC_FORMAT_TYPES = [
  { value: "auto", label: "自动" },
  { value: "number", label: "数值" },
  { value: "currency", label: "货币" },
] as const;

const RATIO_DECIMAL_LABELS = ["零位", "一位", "二位", "三位", "四位"] as const;

type ChartLiquidLabelFieldsProps = {
  label: ChartDeStyle["label"];
  liquid: ChartLiquidStyle | undefined;
  columns: string[];
  patchLabel: (patch: Partial<NonNullable<ChartDeStyle["label"]>>) => void;
  patchLiquid: (patch: Partial<ChartLiquidStyle>) => void;
};

export function ChartLiquidLabelFields({
  label,
  liquid,
  columns,
  patchLabel,
  patchLiquid,
}: ChartLiquidLabelFieldsProps) {
  const showMetric = label?.showMetric !== false;
  const showRatio = label?.showRatio === true;
  const maxType = liquid?.maxType ?? "fix";

  const metricUnit = label?.metricUnit ?? label?.unit;
  const unitSelectValue =
    !metricUnit
      ? "none"
      : metricUnit === "千" || metricUnit === "万" || metricUnit === "亿"
        ? metricUnit
        : "custom";

  const metricFormat = resolveLiquidMetricFormat(label);
  const metricPreview = formatMetricValue(61930, metricFormat);
  const ratioSample =
    liquid?.max != null && Number.isFinite(liquid.max) && liquid.max > 0
      ? 61930 / liquid.max
      : 61930 / defaultLiquidFixMaxFromMetric(61930);
  const ratioPreview = formatMetricValue(ratioSample, {
    type: "percent",
    decimals: label?.ratioDecimals ?? 0,
    thousandSeparator: metricFormat.thousandSeparator,
  });

  return (
    <>
      <div className="border-b border-gray-100 pb-2 dark:border-white/[0.06]">
        <p className="py-2 text-[11px] font-medium text-gray-700 dark:text-gray-200">完成度</p>
        <p className="mb-2 text-[10px] text-gray-400">
          水位与占比均 = 指标 ÷ 目标值；固定目标留空时默认为指标的 {DEFAULT_LIQUID_MAX_MULTIPLIER} 倍。
        </p>
        <ChartDeSegmentField
          label="目标值类型"
          value={maxType}
          options={[
            { value: "fix", label: "固定值" },
            { value: "dynamic", label: "动态值" },
          ]}
          onChange={(value) =>
            patchLiquid({
              maxType: value as "fix" | "dynamic",
              ...(value === "fix" ? { maxField: undefined } : {}),
            })
          }
        />
        {maxType === "fix" ? (
          <ChartDeAttrField label="目标值">
            <Input
              type="number"
              min={1}
              className={CHART_DE_INPUT}
              value={liquid?.max ?? ""}
              placeholder={`留空则默认 ×${DEFAULT_LIQUID_MAX_MULTIPLIER}`}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patchLiquid({ max: raw ? Number(raw) : undefined });
              }}
            />
          </ChartDeAttrField>
        ) : (
          <ChartDeAttrField label="动态字段">
            <Select
              value={liquid?.maxField ?? ""}
              onValueChange={(maxField) => patchLiquid({ maxField })}
            >
              <SelectTrigger className={INSPECTOR_SELECT} aria-label="动态目标字段">
                <SelectValue placeholder="选择数值字段" />
              </SelectTrigger>
              <SelectContent>
                {columns.length === 0 ? (
                  <SelectItem value="__none__" disabled>暂无字段</SelectItem>
                ) : (
                  columns.map((col) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
        )}
      </div>

      <InspectorSwitchRow
        label="指标"
        checked={showMetric}
        onCheckedChange={(checked) => patchLabel({ showMetric: checked })}
      />
      {showMetric ? (
        <div className="space-y-0 border-b border-gray-100 pb-2 pl-2 dark:border-white/[0.06]">
          <ChartDeAttrField label="格式类型">
            <Select
              value={metricFormat.type ?? "auto"}
              onValueChange={(formatType) =>
                patchLabel({
                  metricFormatType: formatType as "auto" | "number" | "currency",
                  formatType: undefined,
                })
              }
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_FORMAT_TYPES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          <ChartDeAttrField label="小数位数">
            <Select
              value={String(metricFormat.decimals ?? 0)}
              onValueChange={(v) => patchLabel({ metricDecimals: Number(v), decimals: undefined })}
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          <ChartDeAttrField label="数量单位">
            <Select
              value={unitSelectValue}
              onValueChange={(v) => {
                if (v === "none") patchLabel({ metricUnit: undefined, unit: undefined });
                else if (v === "千" || v === "万" || v === "亿") patchLabel({ metricUnit: v, unit: undefined });
                else patchLabel({ metricUnit: metricUnit ?? "", unit: undefined });
              }}
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                <SelectItem value="千">千</SelectItem>
                <SelectItem value="万">万</SelectItem>
                <SelectItem value="亿">亿</SelectItem>
                <SelectItem value="custom">自定义后缀</SelectItem>
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          {unitSelectValue === "custom" ? (
            <ChartDeAttrField label="单位后缀">
              <Input
                className={CHART_DE_INPUT}
                placeholder="请输入内容"
                value={metricUnit ?? ""}
                onChange={(e) => patchLabel({ metricUnit: e.target.value || undefined, unit: undefined })}
              />
            </ChartDeAttrField>
          ) : null}
          <InspectorSwitchRow
            label="千分符"
            checked={metricFormat.thousandSeparator !== false}
            onCheckedChange={(checked) =>
              patchLabel({ metricThousandSeparator: checked, thousandSeparator: undefined })
            }
          />
          <p className="px-0 py-1 text-[10px] text-gray-400">指标示例：{metricPreview}</p>
        </div>
      ) : null}

      <InspectorSwitchRow
        label="占比"
        checked={showRatio}
        onCheckedChange={(checked) => patchLabel({ showRatio: checked })}
      />
      {showRatio ? (
        <div className="space-y-0 border-b border-gray-100 pb-2 pl-2 dark:border-white/[0.06]">
          <ChartDeAttrField label="保留小数">
            <Select
              value={String(label?.ratioDecimals ?? 0)}
              onValueChange={(v) => patchLabel({ ratioDecimals: Number(v) })}
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIO_DECIMAL_LABELS.map((name, n) => (
                  <SelectItem key={n} value={String(n)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          <p className="px-0 py-1 text-[10px] text-gray-400">占比示例：{ratioPreview}</p>
        </div>
      ) : null}
    </>
  );
}
