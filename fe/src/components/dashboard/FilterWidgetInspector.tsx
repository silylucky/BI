import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FilterControlType, FilterWidgetConfig, LayoutWidget } from "./layoutUtils";
import { FILTER_CONTROL_META, FILTER_CONTROL_TYPES } from "./layoutUtils";
import { WidgetRailPanelHeader } from "./widgetRailChrome";

type FilterWidgetInspectorProps = {
  widget: LayoutWidget & { filterConfig: FilterWidgetConfig };
  onChange: (filterConfig: FilterWidgetConfig) => void;
  embedded?: boolean;
  onRailCollapse?: () => void;
};

const CONTROL_OPTIONS = FILTER_CONTROL_TYPES.map((value) => ({
  value,
  label: FILTER_CONTROL_META[value].label,
}));

export function FilterWidgetInspector({
  widget,
  onChange,
  embedded = false,
  onRailCollapse,
}: FilterWidgetInspectorProps) {
  const cfg = widget.filterConfig;

  const patch = (partial: Partial<FilterWidgetConfig>) => {
    onChange({ ...cfg, ...partial });
  };

  const body = (
    <div className="space-y-4 p-4">
      <p className="text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
        维度对应图表查询字段；参数名须与 SQL 占位符一致（如 {"{{region}}"}），筛选值会注入关联图表。
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`fc-dim-${widget.id}`}>维度 / 字段</Label>
        <Input
          id={`fc-dim-${widget.id}`}
          value={cfg.dimensionRef}
          onChange={(e) => {
            const nextDim = e.target.value;
            const syncParam =
              !cfg.parameterKey?.trim() || cfg.parameterKey === cfg.dimensionRef;
            patch({
              dimensionRef: nextDim,
              ...(syncParam ? { parameterKey: nextDim } : {}),
            });
          }}
          placeholder="如 region"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fc-param-${widget.id}`}>参数名</Label>
        <Input
          id={`fc-param-${widget.id}`}
          value={cfg.parameterKey ?? ""}
          onChange={(e) => patch({ parameterKey: e.target.value })}
          placeholder="如 region（对应 {{region}}）"
        />
      </div>
      <div className="space-y-1.5">
        <Label>控件类型</Label>
        <Select
          value={cfg.controlType}
          onValueChange={(v) => patch({ controlType: v as FilterControlType })}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTROL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`fc-default-${widget.id}`}>默认值</Label>
        <Input
          id={`fc-default-${widget.id}`}
          value={cfg.defaultValue ?? ""}
          onChange={(e) => patch({ defaultValue: e.target.value })}
        />
      </div>
      {(cfg.controlType === "select" || cfg.controlType === "multiselect") && (
        <div className="space-y-1.5">
          <Label htmlFor={`fc-opts-${widget.id}`}>选项（每行 label=value）</Label>
          <textarea
            id={`fc-opts-${widget.id}`}
            className="min-h-[96px] w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-theme-sm text-gray-800 shadow-theme-xs focus-visible:border-brand-300 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={(cfg.options ?? []).map((o) => `${o.label}=${o.value}`).join("\n")}
            onChange={(e) => {
              const options = e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const eq = line.indexOf("=");
                  if (eq < 0) return { label: line, value: line };
                  return { label: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
                })
                .filter((o) => o.label && o.value);
              patch({ options });
            }}
            placeholder={"华东=east\n华北=north"}
          />
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("flex h-full min-h-0 w-full flex-col bg-white dark:bg-gray-900")}>
        <WidgetRailPanelHeader
          title={widget.title || "筛选器"}
          subtitle="全局筛选控件"
          onCollapse={onRailCollapse}
          collapseAriaLabel="收起配置"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </div>
    );
  }

  return (
    <aside className="w-full shrink-0">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
          <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">筛选器配置</h2>
        </div>
        {body}
      </div>
    </aside>
  );
}
