import { Plus, Trash2 } from "lucide-react";
import {
  ListPageBatchActions,
  ListRowCheckbox,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { DatasetComputedField } from "./types";

export function ComputedFieldsEditor({
  fields,
  onChange,
  disabled = false,
}: {
  fields: DatasetComputedField[];
  onChange: (next: DatasetComputedField[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<DatasetComputedField>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const remove = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...fields, { name: "", expression: "" }]);
  };

  const rowIds = useMemo(() => fields.map((_, index) => String(index)), [fields]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const removeSelected = () => {
    const indices = new Set([...selection.selectedIds].map(Number));
    onChange(fields.filter((_, i) => !indices.has(i)));
    selection.clear();
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!disabled ? (
          <ListPageBatchActions
            batchMode={batch.batchMode}
            onToggleBatchMode={batch.toggleBatchMode}
            selectedCount={selection.selectedCount}
            entityLabel="个字段"
            onClear={selection.clear}
            onDelete={removeSelected}
            className="mr-auto"
          />
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
          <Plus className="size-4" aria-hidden />
          添加计算字段
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-800">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            暂无计算字段。可添加名称与表达式，例如 <code className="font-mono">amt2</code> ={" "}
            <code className="font-mono">amount * 2</code>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {fields.map((field, index) => (
            <div
              key={`cf-${index}`}
              className={cn(
                "grid gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]",
                batch.batchMode
                  ? "sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
                  : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end",
              )}
            >
              {batch.batchMode ? (
                <ListRowCheckbox
                  checked={selection.isSelected(String(index))}
                  onCheckedChange={() => selection.toggle(String(index))}
                  ariaLabel={`选择计算字段 ${field.name || index + 1}`}
                  className="sm:mb-0.5 sm:justify-self-start"
                />
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor={`cf-name-${index}`} className="text-theme-xs text-gray-500">
                  字段名
                </Label>
                <Input
                  id={`cf-name-${index}`}
                  value={field.name}
                  placeholder="amt2"
                  disabled={disabled}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`cf-expr-${index}`} className="text-theme-xs text-gray-500">
                  表达式
                </Label>
                <Input
                  id={`cf-expr-${index}`}
                  value={field.expression}
                  placeholder="amount * 2"
                  className="font-mono text-theme-xs"
                  disabled={disabled}
                  onChange={(e) => update(index, { expression: e.target.value })}
                />
              </div>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-end sm:mb-0.5"
                aria-label={`删除计算字段 ${field.name || index + 1}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
