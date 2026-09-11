import type { ChartTimeRangePreset, ChartTimeRangeRef } from "@/lib/chartViewConfig";
import {
  INSPECTOR_HINT,
  INSPECTOR_LABEL,
  InspectorFieldRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PRESETS: { value: ChartTimeRangePreset; label: string }[] = [
  { value: "last_7d", label: "近 7 天" },
  { value: "last_30d", label: "近 30 天" },
  { value: "last_90d", label: "近 90 天" },
  { value: "mtd", label: "本月至今" },
  { value: "ytd", label: "本年至今" },
];

type Props = {
  value?: ChartTimeRangeRef;
  columns: string[];
  disabled?: boolean;
  dense?: boolean;
  onChange: (next: ChartTimeRangeRef | undefined) => void;
};

const DEFAULT_RANGE: ChartTimeRangeRef = {
  enabled: true,
  mode: "relative",
  relativePreset: "last_7d",
};

export function TimeRangeConfig({ value, columns, disabled, dense = false, onChange }: Props) {
  const tr = value ?? { enabled: false, mode: "relative", relativePreset: "last_7d" };
  const fieldClass = dense ? "h-8 rounded-md text-theme-xs" : "h-11 rounded-lg";
  const panelClass = dense
    ? "space-y-2.5 rounded-md border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-white/[0.02]"
    : "space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800";
  const noColumns = columns.length === 0;

  const patch = (p: Partial<ChartTimeRangeRef>) => {
    onChange({ ...tr, ...p });
  };

  const toggleEnabled = (checked: boolean) => {
    if (!checked) {
      onChange({ ...tr, enabled: false });
      return;
    }
    onChange({ ...DEFAULT_RANGE, ...tr, enabled: true });
  };

  return (
    <div className="space-y-2">
      <InspectorSwitchRow
        label="时间范围"
        checked={tr.enabled}
        disabled={disabled}
        onCheckedChange={toggleEnabled}
        aria-label="启用时间范围筛选"
        hint={
          disabled
            ? "请先在数据 Tab 绑定数据源"
            : !tr.enabled
              ? "启用后可配置相对或绝对时间范围"
              : undefined
        }
      />
      {tr.enabled ? (
        <div className={panelClass}>
          <InspectorFieldRow label="模式">
            <Select
              value={tr.mode}
              onValueChange={(v) => patch({ mode: v as ChartTimeRangeRef["mode"] })}
              disabled={disabled}
            >
              <SelectTrigger className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relative">相对</SelectItem>
                <SelectItem value="absolute">绝对</SelectItem>
              </SelectContent>
            </Select>
          </InspectorFieldRow>

          {tr.mode === "relative" ? (
            <InspectorFieldRow label="预设">
              <Select
                value={tr.relativePreset ?? "last_7d"}
                onValueChange={(v) => patch({ relativePreset: v as ChartTimeRangePreset })}
                disabled={disabled}
              >
                <SelectTrigger className={fieldClass} aria-label="时间范围预设">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </InspectorFieldRow>
          ) : (
            <div className="space-y-2">
              <InspectorFieldRow label="开始日期">
                <DateField
                  value={tr.start}
                  onChange={(start) => patch({ start })}
                  disabled={disabled}
                  dense={dense}
                  placeholder="选择开始日期"
                  aria-label="时间范围开始日期"
                />
              </InspectorFieldRow>
              <InspectorFieldRow label="结束日期">
                <DateField
                  value={tr.end}
                  onChange={(end) => patch({ end })}
                  disabled={disabled}
                  dense={dense}
                  placeholder="选择结束日期"
                  aria-label="时间范围结束日期"
                />
              </InspectorFieldRow>
              {!tr.start && !tr.end ? (
                <p className={INSPECTOR_HINT}>选择起止日期后生效；也可点「今天」快速填入</p>
              ) : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className={INSPECTOR_LABEL}>时间字段（可选）</Label>
            {noColumns ? (
              <div
                className={cn(
                  fieldClass,
                  "flex items-center rounded-md border border-dashed border-gray-200 bg-white/60 px-2 text-gray-400 dark:border-gray-700 dark:bg-transparent dark:text-gray-500",
                )}
              >
                <span className="truncate text-[10px]">自动识别（绑定数据源后可选列）</span>
              </div>
            ) : (
              <Select
                value={tr.field ?? "__auto__"}
                onValueChange={(v) => patch({ field: v === "__auto__" ? undefined : v })}
                disabled={disabled}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder="自动" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">自动</SelectItem>
                  {columns.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <p className={INSPECTOR_HINT}>SQL 模式将注入 time_start / time_end 命名参数</p>
        </div>
      ) : null}
    </div>
  );
}
