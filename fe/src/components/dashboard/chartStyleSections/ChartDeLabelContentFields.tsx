import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMetricValue } from "@/components/dashboard/dashboardStyleConfig";
import { ChartDeAttrField } from "../chartInspectorDeFields";
import { INSPECTOR_HINT, INSPECTOR_SELECT, InspectorSwitchRow } from "../inspectorCompact";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";

const FORMAT_TYPES = [
  { value: "auto", label: "自动" },
  { value: "number", label: "数值" },
  { value: "percent", label: "百分比" },
  { value: "currency", label: "货币" },
] as const;

const PERCENT_DECIMAL_OPTIONS = [
  { value: "0", label: "整数" },
  { value: "1", label: "一位" },
  { value: "2", label: "两位" },
];

const UNIT_LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" },
] as const;

const QUANTITY_UNITS_ZH = ["千", "万", "亿"] as const;
const QUANTITY_UNITS_EN = ["K", "M", "B"] as const;

type ChartDeLabelContentFieldsProps = {
  label: ChartLabelStyle | undefined;
  patchLabel: (patch: Partial<ChartLabelStyle>) => void;
  /** 饼图/玫瑰图：全量显示外置标签（允许重叠） */
  showAllToggle?: boolean;
  /** 是否展示「维度」勾选项 */
  showDimensionOption?: boolean;
  /** 是否展示「占比」勾选项 */
  showPercentOption?: boolean;
  defaultShowDimension?: boolean;
  defaultShowPercent?: boolean;
};

/** 维度 / 指标 / 占比 + 格式（对标 DataEase 标签内容区） */
export function ChartDeLabelContentFields({
  label,
  patchLabel,
  showAllToggle = false,
  showDimensionOption = true,
  showPercentOption = true,
  defaultShowDimension = false,
  defaultShowPercent = false,
}: ChartDeLabelContentFieldsProps) {
  const showDimension = label?.showDimension ?? defaultShowDimension;
  const showIndicator = label?.showIndicator !== false;
  const showPercent = label?.showPercent ?? defaultShowPercent;
  const percentDecimals = label?.percentDecimals ?? label?.ratioDecimals ?? 2;
  const unitLanguage = label?.unitLanguage ?? "zh";
  const quantityUnits = unitLanguage === "en" ? QUANTITY_UNITS_EN : QUANTITY_UNITS_ZH;
  const metricUnit = label?.metricUnit ?? label?.unit;
  const unitSelectValue =
    !metricUnit
      ? "none"
      : quantityUnits.includes(metricUnit as typeof quantityUnits[number])
        ? metricUnit
        : "custom";

  const formatPreview = formatMetricValue(1234567.89, {
    type: label?.formatType ?? "auto",
    decimals: label?.metricDecimals ?? label?.decimals ?? 2,
    unit: metricUnit,
    thousandSeparator: label?.thousandSeparator !== false,
  });

  return (
    <>
      {showAllToggle ? (
        <InspectorSwitchRow
          label="全量显示"
          checked={label?.showAll === true}
          onCheckedChange={(checked) => patchLabel({ showAll: checked })}
        />
      ) : null}

      {showDimensionOption ? (
        <InspectorSwitchRow
          label="维度"
          checked={showDimension}
          onCheckedChange={(checked) => patchLabel({ showDimension: checked })}
        />
      ) : null}

      <InspectorSwitchRow
        label="指标"
        checked={showIndicator}
        onCheckedChange={(checked) => patchLabel({ showIndicator: checked })}
      />

      {showIndicator ? (
        <div className="space-y-0 border-b border-gray-100 pb-2 pl-2 dark:border-white/[0.06]">
          <ChartDeAttrField label="格式类型">
            <Select
              value={label?.formatType ?? "auto"}
              onValueChange={(formatType) =>
                patchLabel({ formatType: formatType as ChartLabelStyle["formatType"] })
              }
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_TYPES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          <ChartDeAttrField label="单位语言">
            <Select
              value={unitLanguage}
              onValueChange={(v) => {
                const lang = v as "zh" | "en";
                const zhUnits = [...QUANTITY_UNITS_ZH];
                const enUnits = [...QUANTITY_UNITS_EN];
                let mapped = metricUnit;
                if (metricUnit) {
                  const zi = zhUnits.indexOf(metricUnit as typeof QUANTITY_UNITS_ZH[number]);
                  const ei = enUnits.indexOf(metricUnit as typeof QUANTITY_UNITS_EN[number]);
                  if (lang === "en" && zi >= 0) mapped = enUnits[zi];
                  else if (lang === "zh" && ei >= 0) mapped = zhUnits[ei];
                }
                patchLabel({ unitLanguage: lang, metricUnit: mapped, unit: undefined });
              }}
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          <ChartDeAttrField label="数量单位">
            <Select
              value={unitSelectValue}
              onValueChange={(v) => {
                if (v === "none") patchLabel({ metricUnit: undefined, unit: undefined });
                else if (v === "custom") patchLabel({ metricUnit: metricUnit ?? "", unit: undefined });
                else patchLabel({ metricUnit: v, unit: undefined });
              }}
            >
              <SelectTrigger className={INSPECTOR_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {quantityUnits.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
                <SelectItem value="custom">自定义后缀</SelectItem>
              </SelectContent>
            </Select>
          </ChartDeAttrField>
          {unitSelectValue === "custom" ? (
            <ChartDeAttrField label="单位后缀">
              <Input
                placeholder="请输入内容"
                value={metricUnit ?? ""}
                onChange={(e) => patchLabel({ metricUnit: e.target.value || undefined, unit: undefined })}
              />
            </ChartDeAttrField>
          ) : null}
          <ChartDeAttrField label="小数位数">
            <Select
              value={String(label?.metricDecimals ?? label?.decimals ?? 2)}
              onValueChange={(v) => patchLabel({ metricDecimals: Number(v), decimals: Number(v) })}
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
          <InspectorSwitchRow
            label="千分符"
            checked={label?.thousandSeparator !== false}
            onCheckedChange={(checked) => patchLabel({ thousandSeparator: checked })}
          />
          <p className="px-0 py-1 text-[10px] text-gray-400">指标示例：{formatPreview}</p>
        </div>
      ) : null}

      {showPercentOption ? (
        <>
          <InspectorSwitchRow
            label="占比"
            checked={showPercent}
            onCheckedChange={(checked) => patchLabel({ showPercent: checked })}
          />
          {showPercent ? (
            <ChartDeAttrField label="保留小数">
              <Select
                value={String(percentDecimals)}
                onValueChange={(v) => patchLabel({ percentDecimals: Number(v) })}
              >
                <SelectTrigger className={INSPECTOR_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERCENT_DECIMAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChartDeAttrField>
          ) : null}
        </>
      ) : null}

      <p className={INSPECTOR_HINT}>示例：维度 14,998 (6.28%)</p>
    </>
  );
}
