import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildCustomRefreshFromParts,
  buildCustomRefreshMode,
  CHART_REFRESH_PRESET_OPTIONS,
  CUSTOM_REFRESH_UNIT_OPTIONS,
  customRefreshAmountBounds,
  formatChartRefreshSelectValue,
  isCustomRefreshMode,
  parseCustomRefreshParts,
  patchChartDeDisplay,
  parseCustomRefreshSec,
  readChartDeDisplay,
  splitCustomRefreshSec,
  type CustomRefreshUnit,
} from "@/lib/chartDeDisplay";
import { useChartInspector } from "./chartInspectorContext";
import { ChartResultLimitField } from "./ChartResultLimitField";
import { DE_SELECT, DeAttrField, DeAttrForm } from "./dashboardInspectorUi";
import { InspectorSwitchRow } from "./inspectorCompact";
import { cn } from "@/lib/utils";

/** DataEase 数据 Tab：刷新频率 + 结果展示 */
export function ChartDataOptions() {
  const { cfg, onChange } = useChartInspector();
  const display = readChartDeDisplay(cfg);
  const refreshMode = display.refreshMode ?? "off";
  const refreshOn = refreshMode !== "off";
  const refreshSelect = formatChartRefreshSelectValue(refreshMode);
  const customRefresh = parseCustomRefreshParts(refreshMode);
  const isCustom = refreshSelect === "custom" || isCustomRefreshMode(refreshMode);
  const customBounds = customRefreshAmountBounds(customRefresh.unit);

  const setRefreshMode = (mode: string) => {
    onChange(patchChartDeDisplay(cfg, { refreshMode: mode }));
  };

  const setCustomParts = (amount: number, unit: CustomRefreshUnit) => {
    setRefreshMode(buildCustomRefreshFromParts(amount, unit));
  };

  return (
    <DeAttrForm className="border-t border-gray-100 pt-1 dark:border-white/[0.06]">
      <DeAttrField label="刷新频率" compact>
        <div className="space-y-1.5">
          <InspectorSwitchRow
            label="启用刷新"
            checked={refreshOn}
            onCheckedChange={(checked) => setRefreshMode(checked ? "30s" : "off")}
          />
          {refreshOn ? (
            <Select
              value={refreshSelect}
              onValueChange={(value) => {
                if (value === "custom") {
                  setRefreshMode(buildCustomRefreshMode(60));
                  return;
                }
                setRefreshMode(value);
              }}
            >
              <SelectTrigger
                className={cn(DE_SELECT, "h-8 min-w-0 w-full")}
                aria-label="刷新间隔"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_REFRESH_PRESET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {refreshOn && isCustom ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={customBounds.min}
                max={customBounds.max}
                value={customRefresh.amount}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(next)) return;
                  setCustomParts(next, customRefresh.unit);
                }}
                className={cn(DE_SELECT, "h-8 min-w-0 flex-1 px-2")}
                aria-label="自定义刷新间隔"
              />
              <Select
                value={customRefresh.unit}
                onValueChange={(unit) => {
                  const nextUnit = unit as CustomRefreshUnit;
                  const sec = parseCustomRefreshSec(refreshMode, 60);
                  const { amount } = splitCustomRefreshSec(sec, nextUnit);
                  setCustomParts(amount, nextUnit);
                }}
              >
                <SelectTrigger
                  className={cn(DE_SELECT, "h-8 w-[3.75rem] shrink-0 px-2")}
                  aria-label="刷新间隔单位"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOM_REFRESH_UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </DeAttrField>
      <ChartResultLimitField
        key={cfg.chartId ?? "chart-result-limit"}
        stored={display.resultLimit}
        onChange={(value) => onChange(patchChartDeDisplay(cfg, { resultLimit: value }))}
      />
    </DeAttrForm>
  );
}
