import { Trash2 } from "lucide-react";
import { ListRowCheckbox } from "@/components/layout/list-batch-delete";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EtlColumnField } from "./EtlColumnField";
import { EtlFormField } from "./EtlFormField";

export type EtlRule = {
  type: string;
  [key: string]: string;
};

export const ETL_RULE_TYPES = [
  { value: "rename_column", label: "列重命名" },
  { value: "cast_type", label: "类型转换" },
  { value: "fill_null", label: "空值填充" },
  { value: "filter_rows", label: "行过滤" },
] as const;

const TYPE_BADGE_COLOR: Record<string, "primary" | "info" | "warning" | "success"> = {
  rename_column: "primary",
  cast_type: "info",
  fill_null: "warning",
  filter_rows: "success",
};

const CONTROL_CLASS = "h-11";

type EtlRuleCardProps = {
  rule: EtlRule;
  index: number;
  batchMode: boolean;
  selected: boolean;
  columnNames: string[];
  fieldErrors: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onTypeChange: (type: string) => void;
  onFieldChange: (key: string, value: string) => void;
};

export function EtlRuleCard({
  rule,
  index,
  batchMode,
  selected,
  columnNames,
  fieldErrors,
  onToggleSelect,
  onRemove,
  onTypeChange,
  onFieldChange,
}: EtlRuleCardProps) {
  const typeMeta = ETL_RULE_TYPES.find((item) => item.value === rule.type);
  const badgeColor = TYPE_BADGE_COLOR[rule.type] ?? "light";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs transition-colors",
        "dark:border-gray-800 dark:bg-white/[0.02]",
        batchMode && selected && "border-brand-300 ring-2 ring-brand-500/20 dark:border-brand-500/40",
      )}
    >
      <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
        {batchMode ? (
          <ListRowCheckbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            ariaLabel={`选择规则 ${index + 1}`}
          />
        ) : null}
        <Badge variant="light" color="light" size="sm" className="shrink-0 font-mono tabular-nums">
          #{index + 1}
        </Badge>
        <Badge variant="light" color={badgeColor} size="sm" className="shrink-0">
          {typeMeta?.label ?? rule.type}
        </Badge>
        <div className="min-w-0 flex-1 sm:max-w-[200px]">
          <Select value={rule.type} onValueChange={onTypeChange}>
            <SelectTrigger aria-label="规则类型" className="h-9 bg-white dark:bg-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETL_RULE_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="删除规则"
          className="ml-auto shrink-0 text-gray-400 hover:text-error-500"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </header>

      <div className="grid gap-x-5 gap-y-4 px-4 py-4 sm:grid-cols-2">
        {rule.type === "rename_column" ? (
          <>
            <EtlColumnField
              label="源列名"
              value={rule.from ?? ""}
              columnNames={columnNames}
              placeholder="product_name"
              invalid={fieldErrors && !rule.from?.trim()}
              onChange={(value) => onFieldChange("from", value)}
            />
            <EtlFormField label="目标列名" htmlFor={`etl-rename-to-${index}`}>
              <Input
                id={`etl-rename-to-${index}`}
                className={CONTROL_CLASS}
                value={rule.to ?? ""}
                placeholder="product"
                aria-invalid={fieldErrors && !rule.to?.trim() ? true : undefined}
                onChange={(e) => onFieldChange("to", e.target.value)}
              />
            </EtlFormField>
          </>
        ) : null}

        {rule.type === "cast_type" ? (
          <>
            <EtlColumnField
              label="列名"
              value={rule.column ?? ""}
              columnNames={columnNames}
              placeholder="amount"
              invalid={fieldErrors && !rule.column?.trim()}
              onChange={(value) => onFieldChange("column", value)}
            />
            <EtlFormField label="目标类型" htmlFor={`etl-cast-to-${index}`}>
              <Select value={rule.to ?? "float"} onValueChange={(v) => onFieldChange("to", v)}>
                <SelectTrigger id={`etl-cast-to-${index}`} className={CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="float">float</SelectItem>
                  <SelectItem value="integer">integer</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                  <SelectItem value="string">string</SelectItem>
                </SelectContent>
              </Select>
            </EtlFormField>
          </>
        ) : null}

        {rule.type === "fill_null" ? (
          <>
            <EtlColumnField
              label="列名"
              value={rule.column ?? ""}
              columnNames={columnNames}
              placeholder="note"
              invalid={fieldErrors && !rule.column?.trim()}
              onChange={(value) => onFieldChange("column", value)}
            />
            <EtlFormField label="填充值" htmlFor={`etl-fill-value-${index}`}>
              <Input
                id={`etl-fill-value-${index}`}
                className={CONTROL_CLASS}
                value={rule.value ?? ""}
                placeholder="无备注"
                onChange={(e) => onFieldChange("value", e.target.value)}
              />
            </EtlFormField>
          </>
        ) : null}

        {rule.type === "filter_rows" ? (
          <>
            <EtlColumnField
              label="列名"
              value={rule.column ?? ""}
              columnNames={columnNames}
              placeholder="status"
              invalid={fieldErrors && !rule.column?.trim()}
              onChange={(value) => onFieldChange("column", value)}
            />
            <EtlFormField label="操作符" htmlFor={`etl-filter-op-${index}`}>
              <Select value={rule.op ?? "ne"} onValueChange={(v) => onFieldChange("op", v)}>
                <SelectTrigger id={`etl-filter-op-${index}`} className={CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">等于</SelectItem>
                  <SelectItem value="ne">不等于</SelectItem>
                  <SelectItem value="is_null">为空</SelectItem>
                  <SelectItem value="is_not_null">非空</SelectItem>
                </SelectContent>
              </Select>
            </EtlFormField>
            <EtlFormField
              label="比较值"
              htmlFor={`etl-filter-value-${index}`}
              className="sm:col-span-2 sm:max-w-md"
            >
              <Input
                id={`etl-filter-value-${index}`}
                className={CONTROL_CLASS}
                value={rule.value ?? ""}
                placeholder="deleted"
                disabled={rule.op === "is_null" || rule.op === "is_not_null"}
                onChange={(e) => onFieldChange("value", e.target.value)}
              />
            </EtlFormField>
          </>
        ) : null}
      </div>
    </article>
  );
}
