import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApiRequestError, apiFetch } from "@/lib/api";
import { formatChartFieldErrors, mapChartConfigError } from "@/lib/chartErrors";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import type { ChartFilterRef, ChartViewConfig } from "@/lib/chartViewConfig";
import { fetchChartTypeCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeRangeConfig } from "@/components/charts/TimeRangeConfig";
import { cn } from "@/lib/utils";

type Props = {
  config: ChartViewConfig;
  columns: string[];
  onChange: (next: ChartViewConfig) => void;
  /** 嵌入 Dashboard 右栏（~400px）时使用单列紧凑布局 */
  compact?: boolean;
  /** 仅渲染数据区、样式区、筛选区或全部（Inspector Tab 拆分） */
  section?: "data" | "style" | "filters" | "all";
  /** 筛选区不渲染时间范围（已下沉高级 Tab） */
  omitTimeRange?: boolean;
  /** 添加筛选按钮文案（DE：过滤） */
  addFilterLabel?: string;
  dimensionLabel?: string;
  metricLabel?: string;
};

const FILTER_OPS = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "in", label: "包含" },
] as const;

function FieldSelect({
  value,
  columns,
  placeholder,
  onChange,
  disabled,
  compact,
  "aria-label": ariaLabel,
}: {
  value: string;
  columns: string[];
  placeholder: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn("rounded-lg", compact ? "h-9 text-theme-xs" : "h-11")}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {columns.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChartConfigPanel({
  config,
  columns,
  onChange,
  compact = false,
  section = "all",
  omitTimeRange = false,
  addFilterLabel = "添加",
  dimensionLabel = "维度字段",
  metricLabel = "度量字段",
}: Props) {
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetchChartTypeCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const spec = catalog.find((c) => c.type === config.chartType);
  const styleVariants = spec?.styleVariants ?? ["default"];
  const rule = spec?.fieldRule;
  const columnsDisabled = columns.length === 0;

  const updateDim = (idx: number, field: string) => {
    const dimensions = [...(config.dimensions ?? [])];
    dimensions[idx] = { field };
    onChange({ ...config, dimensions });
  };

  const updateMetric = (idx: number, field: string) => {
    const metrics = [...(config.metrics ?? [])];
    metrics[idx] = { field };
    onChange({ ...config, metrics });
  };

  const addDimension = () => {
    const max = rule?.maxDimensions ?? 8;
    const dims = [...(config.dimensions ?? [])];
    if (dims.length >= max) return;
    onChange({ ...config, dimensions: [...dims, { field: columns[0] ?? "" }] });
  };

  const addMetric = () => {
    const max = rule?.maxMetrics ?? 8;
    const metrics = [...(config.metrics ?? [])];
    if (metrics.length >= max) return;
    onChange({ ...config, metrics: [...metrics, { field: columns[0] ?? "" }] });
  };

  const updateFilter = (idx: number, patch: Partial<ChartFilterRef>) => {
    const filters = [...(config.filters ?? [])];
    filters[idx] = { ...filters[idx], ...patch };
    onChange({ ...config, filters });
  };

  const addFilter = () => {
    const filters = [...(config.filters ?? []), { field: columns[0] ?? "", operator: "eq" as const, value: "" }];
    onChange({ ...config, filters });
  };

  const removeFilter = (idx: number) => {
    const filters = (config.filters ?? []).filter((_, i) => i !== idx);
    onChange({ ...config, filters });
  };

  const validate = async () => {
    setError(null);
    setFieldError(null);
    setValidating(true);
    try {
      await apiFetch("/api/v1/charts/validate", {
        method: "POST",
        body: JSON.stringify(sanitizeChartFieldsForValidate(config)),
      });
    } catch (e) {
      const err = e as ApiRequestError;
      const msg = mapChartConfigError(err.code ?? "", err.message);
      if (err.code === "CHART_INVALID_STYLE_VARIANT") {
        setError(msg);
      } else if (err.fields?.length) {
        setFieldError(formatChartFieldErrors(err.code ?? "", err.fields));
      } else {
        setError(msg);
      }
    } finally {
      setValidating(false);
    }
  };

  const dimCount = columnsDisabled
    ? config.dimensions?.length ?? 0
    : Math.max(rule?.minDimensions ?? 1, config.dimensions?.length ?? 0);
  const metCount = columnsDisabled
    ? config.metrics?.length ?? 0
    : Math.max(rule?.minMetrics ?? 1, config.metrics?.length ?? 0);

  const fieldGridClass = compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-2";
  const filterGridClass = compact
    ? "grid gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
    : "grid gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800 sm:grid-cols-3";

  const showData = section === "all" || section === "data";
  const showFilters = section === "all" || section === "data" || section === "filters";
  const showStyle = section === "all" || section === "style";
  const showFieldSlots = section === "all" || section === "data";
  const primaryActionLabel = compact ? "更新图表" : "校验配置";

  return (
    <div
      className={
        compact ? "space-y-4" : "rounded-xl border border-gray-200 p-4 dark:border-gray-800"
      }
    >
      <div className={compact ? "space-y-4" : "space-y-4"}>
        {columnsDisabled && !compact && showData ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5 text-theme-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
            绑定数据源并执行查询后，可配置维度、指标与筛选。
          </p>
        ) : null}

        {showFieldSlots && dimensionLabel ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{dimensionLabel}</Label>
                {rule && (config.dimensions?.length ?? 0) < (rule.maxDimensions ?? 8) ? (
                  <Button type="button" variant="ghost" size="xs" onClick={addDimension} aria-label="添加维度">
                    <Plus className="size-3.5" aria-hidden />
                    添加
                  </Button>
                ) : null}
              </div>
              {dimCount > 0 ? (
                <div className={fieldGridClass}>
                  {Array.from({ length: dimCount }, (_, idx) => (
                    <FieldSelect
                      key={`dim-${idx}`}
                      value={config.dimensions?.[idx]?.field ?? ""}
                      columns={columns}
                      placeholder="选择维度"
                      onChange={(v) => updateDim(idx, v)}
                      disabled={columnsDisabled}
                    />
                  ))}
                </div>
              ) : null}
              {spec?.fieldRule?.note ? (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">{spec.fieldRule.note}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{metricLabel}</Label>
                {rule && (config.metrics?.length ?? 0) < (rule.maxMetrics ?? 8) ? (
                  <Button type="button" variant="ghost" size="xs" onClick={addMetric} aria-label="添加指标">
                    <Plus className="size-3.5" aria-hidden />
                    添加
                  </Button>
                ) : null}
              </div>
              {metCount > 0 ? (
                <div className={fieldGridClass}>
                  {Array.from({ length: metCount }, (_, idx) => (
                    <FieldSelect
                      key={`met-${idx}`}
                      value={config.metrics?.[idx]?.field ?? ""}
                      columns={columns}
                      placeholder="选择度量"
                      onChange={(v) => updateMetric(idx, v)}
                      disabled={columnsDisabled}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {showFilters ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>过滤器</Label>
                <Button type="button" variant="ghost" size="xs" onClick={addFilter} aria-label="添加筛选">
                  <Plus className="size-3.5" aria-hidden />
                  {addFilterLabel}
                </Button>
              </div>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">汇总前过滤，条件编入查询 SQL</p>
              {(config.filters ?? []).map((f, i) => (
                <div key={`filter-${i}`} className={filterGridClass}>
                  <FieldSelect
                    value={f.field}
                    columns={columns}
                    placeholder="字段"
                    onChange={(v) => updateFilter(i, { field: v })}
                    disabled={columnsDisabled}
                    compact={compact}
                    aria-label={`筛选字段 ${i + 1}`}
                  />
                  <Select
                    value={f.operator ?? "eq"}
                    onValueChange={(v) => updateFilter(i, { operator: v as ChartFilterRef["operator"] })}
                  >
                    <SelectTrigger
                      className={cn("rounded-lg", compact ? "h-9 text-theme-xs" : "h-11")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      className={cn("rounded-lg", compact ? "h-9 text-theme-xs" : "h-11")}
                      value={String(f.value ?? "")}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                      aria-label={`筛选值 ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => removeFilter(i)}
                      aria-label={`删除筛选条件 ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {!omitTimeRange ? (
              <TimeRangeConfig
                value={config.timeRange}
                columns={columns}
                disabled={columnsDisabled}
                onChange={(timeRange) => onChange({ ...config, timeRange })}
              />
            ) : null}
          </>
        ) : null}

        {showStyle ? (
        <div>
          <Label>样式子类型</Label>
          <Select
            value={config.styleVariant ?? "default"}
            onValueChange={(v) => onChange({ ...config, styleVariant: v })}
          >
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {styleVariants.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        ) : null}
        {fieldError ? <p className="text-theme-sm text-error-600">{fieldError}</p> : null}
        {error ? (
          <div role="alert" className="rounded-lg border border-error-500 bg-error-50 p-3 text-theme-sm text-error-700 dark:bg-error-500/15 dark:text-error-400">
            {error}
          </div>
        ) : null}
        {showData && section !== "filters" ? (
        <Button
          type="button"
          variant={compact ? "outline" : "primary"}
          size={compact ? "sm" : "md"}
          className={compact ? "w-full" : "h-11 rounded-lg"}
          onClick={validate}
          disabled={validating}
        >
          {validating ? "更新中…" : primaryActionLabel}
        </Button>
        ) : null}
      </div>
    </div>
  );
}
