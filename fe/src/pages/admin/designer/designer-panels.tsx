import { useState } from "react";
import { ArrowDown, ArrowUp, Filter, FunctionSquare, GripVertical, Plus, TableProperties, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AggregateRow,
  ComputeRuleRow,
  ConditionRow,
  OutputFieldRow,
} from "./useDesignerWorkspace";

const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "like", "is_null", "is_not_null"];
const VALUE_TYPES = ["string", "number", "boolean", "date", "array"];
const RULE_TYPES = ["sum", "avg", "add", "sub", "mul", "div", "format"];
const AGG_FNS = ["sum", "avg", "count", "min", "max"];

type ConditionsPanelProps = {
  logic: "AND" | "OR";
  onLogicChange: (v: "AND" | "OR") => void;
  conditions: ConditionRow[];
  onChange: (rows: ConditionRow[]) => void;
  fieldOptions: string[];
  fieldErrors: Record<string, string>;
};

export function ConditionsPanel({
  logic,
  onLogicChange,
  conditions,
  onChange,
  fieldOptions,
  fieldErrors,
}: ConditionsPanelProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addRow = () => {
    onChange([
      ...conditions,
      { fieldId: fieldOptions[0] ?? "order_amount", operator: "eq", value: "", valueType: "string" },
    ]);
  };

  const updateRow = (index: number, patch: Partial<ConditionRow>) => {
    onChange(conditions.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => onChange(conditions.filter((_, i) => i !== index));

  const moveRow = (from: number, to: number) => {
    if (to < 0 || to >= conditions.length) return;
    const next = [...conditions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    moveRow(dragIndex, target);
    setDragIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-theme-sm text-gray-600 dark:text-gray-400">组合逻辑</Label>
        <Select value={logic} onValueChange={(v) => onLogicChange(v as "AND" | "OR")}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" aria-hidden />
          添加条件
        </Button>
      </div>
      {fieldErrors._form ? (
        <p className="text-theme-sm text-error-600 dark:text-error-400" role="alert">
          {fieldErrors._form}
        </p>
      ) : null}
      {conditions.length === 0 ? (
        <PanelEmptyState
          icon={<Filter className="size-7" aria-hidden />}
          title="暂无过滤条件"
          description="点击添加条件，或使用上移/下移调整顺序。"
          variant="framed"
        />
      ) : (
        <ul className="space-y-3">
          {conditions.map((row, index) => (
            <li
              key={index}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.02] sm:flex-row sm:items-end"
            >
              <div className="flex items-center gap-2 sm:self-center">
                <GripVertical className="size-4 cursor-grab text-gray-400" aria-hidden />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="上移条件行"
                  disabled={index === 0}
                  onClick={() => moveRow(index, index - 1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="下移条件行"
                  disabled={index === conditions.length - 1}
                  onClick={() => moveRow(index, index + 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-4">
                <Select value={row.fieldId} onValueChange={(v) => updateRow(index, { fieldId: v })}>
                  <SelectTrigger aria-invalid={!!fieldErrors[`conditions[${index}].fieldId`]}>
                    <SelectValue placeholder="字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={row.operator} onValueChange={(v) => updateRow(index, { operator: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="运算符" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={row.valueType}
                  onValueChange={(v) => updateRow(index, { valueType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="值类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>
                        {vt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={row.value === null ? "" : String(row.value)}
                  aria-invalid={!!fieldErrors[`conditions[${index}].value`]}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const val =
                      row.valueType === "number"
                        ? raw === ""
                          ? null
                          : Number(raw)
                        : row.valueType === "boolean"
                          ? raw === "true"
                          : raw;
                    updateRow(index, { value: val });
                  }}
                  placeholder="值"
                />
              </div>
              {conditions.length > 1 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="删除条件行">
                      <Trash2 className="size-4 text-error-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>删除此条件？</AlertDialogTitle>
                      <AlertDialogDescription>删除后需重新保存条件配置。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeRow(index)}>删除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ComputeRulesPanelProps = {
  rules: ComputeRuleRow[];
  onChange: (rules: ComputeRuleRow[]) => void;
  fieldOptions: string[];
};

export function ComputeRulesPanel({ rules, onChange, fieldOptions }: ComputeRulesPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ComputeRuleRow | null>(null);
  const [dialogErrors, setDialogErrors] = useState<Record<string, string>>({});

  const openNew = () => {
    setDraft({
      id: `r${rules.length + 1}`,
      name: "",
      ruleType: "sum",
      targetField: fieldOptions[0] ?? "amount",
      expression: "",
      dependsOn: [],
    });
    setDialogErrors({});
    setOpen(true);
  };

  const saveDraft = () => {
    if (!draft) return;
    const next = [...rules.filter((r) => r.id !== draft.id), draft];
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="primary" size="sm" onClick={openNew}>
          <Plus className="size-4" aria-hidden />
          添加规则
        </Button>
      </div>
      {rules.length === 0 ? (
        <PanelEmptyState
          icon={<FunctionSquare className="size-7" aria-hidden />}
          title="暂无运算规则"
          description="添加规则以定义计算字段。"
          variant="framed"
        />
      ) : (
        <div className="overflow-x-only rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="min-w-[720px] w-full text-left text-theme-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
              <tr>
                {["ID", "名称", "类型", "目标字段", "表达式"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-mono text-theme-xs">{rule.id}</td>
                  <td className="px-4 py-3">{rule.name}</td>
                  <td className="px-4 py-3">{rule.ruleType}</td>
                  <td className="px-4 py-3">{rule.targetField}</td>
                  <td className="px-4 py-3 font-mono text-theme-xs">{rule.expression}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <AdminFormDialogContent size="md">
          <AdminFormDialogHeader>
            <DialogTitle>{draft?.id ? "编辑规则" : "新建规则"}</DialogTitle>
          </AdminFormDialogHeader>
          {draft ? (
            <AdminFormDialogBody>
              <AdminFormField label="规则 ID">
                <Input value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
              </AdminFormField>
              <AdminFormField label="名称">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </AdminFormField>
              <AdminFormField label="规则类型">
                <Select value={draft.ruleType} onValueChange={(v) => setDraft({ ...draft, ruleType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdminFormField>
              <AdminFormField label="目标字段" error={dialogErrors.targetField}>
                <Input
                  value={draft.targetField}
                  aria-invalid={!!dialogErrors.targetField}
                  onChange={(e) => setDraft({ ...draft, targetField: e.target.value })}
                />
              </AdminFormField>
              <AdminFormField label="表达式" error={dialogErrors.expression}>
                <Input
                  value={draft.expression}
                  aria-invalid={!!dialogErrors.expression}
                  onChange={(e) => setDraft({ ...draft, expression: e.target.value })}
                />
              </AdminFormField>
            </AdminFormDialogBody>
          ) : null}
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="primary" onClick={() => void saveDraft()}>
              确定
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>
    </div>
  );
}

type OutputFieldsPanelProps = {
  fields: OutputFieldRow[];
  aggregates: AggregateRow[];
  onFieldsChange: (f: OutputFieldRow[]) => void;
  onAggregatesChange: (a: AggregateRow[]) => void;
  fieldOptions: string[];
  glossaryOptions: string[];
};

export function OutputFieldsPanel({
  fields,
  aggregates,
  onFieldsChange,
  onAggregatesChange,
  fieldOptions,
  glossaryOptions,
}: OutputFieldsPanelProps) {
  const addField = () =>
    onFieldsChange([
      ...fields,
      { fieldId: fieldOptions[0] ?? "order_amount", visible: true, sortOrder: fields.length },
    ]);

  const addAggregate = () =>
    onAggregatesChange([
      ...aggregates,
      { fn: "sum", fieldId: fieldOptions[0] ?? "order_amount", groupBy: [] },
    ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">输出字段</h3>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="size-4" aria-hidden />
            添加字段
          </Button>
        </div>
        {fields.length === 0 ? (
          <PanelEmptyState
            icon={<TableProperties className="size-7" aria-hidden />}
            title="暂无输出字段"
            description="至少添加一个输出字段。"
            variant="framed"
          />
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-4 dark:border-gray-800"
              >
                <Select
                  value={field.fieldId}
                  onValueChange={(v) =>
                    onFieldsChange(fields.map((f, i) => (i === index ? { ...f, fieldId: v } : f)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="别名"
                  value={field.alias ?? ""}
                  onChange={(e) =>
                    onFieldsChange(
                      fields.map((f, i) => (i === index ? { ...f, alias: e.target.value } : f)),
                    )
                  }
                />
                <Select
                  value={field.metaFieldRef ?? "__none__"}
                  onValueChange={(v) =>
                    onFieldsChange(
                      fields.map((f, i) =>
                        i === index ? { ...f, metaFieldRef: v === "__none__" ? undefined : v } : f,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="元数据引用" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">无</SelectItem>
                    {glossaryOptions.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="排序"
                  value={field.sortOrder ?? ""}
                  onChange={(e) =>
                    onFieldsChange(
                      fields.map((f, i) =>
                        i === index ? { ...f, sortOrder: Number(e.target.value) } : f,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">聚合</h3>
          <Button type="button" variant="outline" size="sm" onClick={addAggregate}>
            <Plus className="size-4" aria-hidden />
            添加聚合
          </Button>
        </div>
        {aggregates.length === 0 ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">可选：添加 sum/avg/count 等聚合。</p>
        ) : (
          <div className="space-y-2">
            {aggregates.map((agg, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-800"
              >
                <Select
                  value={agg.fn}
                  onValueChange={(v) =>
                    onAggregatesChange(aggregates.map((a, i) => (i === index ? { ...a, fn: v } : a)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGG_FNS.map((fn) => (
                      <SelectItem key={fn} value={fn}>
                        {fn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={agg.fieldId}
                  onValueChange={(v) =>
                    onAggregatesChange(aggregates.map((a, i) => (i === index ? { ...a, fieldId: v } : a)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
