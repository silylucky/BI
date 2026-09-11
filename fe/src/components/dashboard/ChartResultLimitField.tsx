import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildCustomResultLimit,
  CHART_RESULT_LIMIT_CUSTOM,
  CHART_RESULT_LIMIT_MAX,
  CHART_RESULT_LIMIT_SELECT_OPTIONS,
  formatResultLimitSelectValue,
  persistResultLimitSelection,
  resultLimitCustomAmount,
} from "@/lib/chartDeDisplay";
import { MIN_QUERY_LIMIT } from "./dashboardStyleConfig";
import { DE_SELECT, DeAttrField } from "./dashboardInspectorUi";
import { cn } from "@/lib/utils";

type ChartResultLimitFieldProps = {
  stored?: string;
  onChange: (value: string) => void;
  hint?: string;
  compact?: boolean;
};

export function ChartResultLimitField({
  stored,
  onChange,
  hint = "取最新 N 条",
  compact = true,
}: ChartResultLimitFieldProps) {
  const derivedCustom = formatResultLimitSelectValue(stored) === CHART_RESULT_LIMIT_CUSTOM;
  const [customPinned, setCustomPinned] = useState(derivedCustom);
  const isCustom = customPinned || derivedCustom;
  const selectValue = isCustom ? CHART_RESULT_LIMIT_CUSTOM : formatResultLimitSelectValue(stored);
  const customAmount = resultLimitCustomAmount(stored);

  return (
    <DeAttrField label="结果展示" compact={compact} hint={hint}>
      <div className="space-y-1.5">
        <Select
          value={selectValue}
          onValueChange={(value) => {
            if (value === CHART_RESULT_LIMIT_CUSTOM) {
              setCustomPinned(true);
            } else {
              setCustomPinned(false);
            }
            onChange(persistResultLimitSelection(value, stored));
          }}
        >
          <SelectTrigger className={cn(DE_SELECT, "h-8 min-w-0 w-full px-2")} aria-label="结果条数">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_RESULT_LIMIT_SELECT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCustom ? (
          <Input
            type="number"
            min={MIN_QUERY_LIMIT}
            max={CHART_RESULT_LIMIT_MAX}
            value={customAmount}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(next)) return;
              setCustomPinned(true);
              onChange(buildCustomResultLimit(next));
            }}
            className={cn(DE_SELECT, "h-8 min-w-0 px-2")}
            aria-label="自定义结果条数"
          />
        ) : null}
      </div>
    </DeAttrField>
  );
}
