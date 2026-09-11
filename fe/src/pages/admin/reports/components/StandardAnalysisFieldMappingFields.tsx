import { useMemo } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DatasetFieldKind } from "@/components/dashboard/datasetFieldClassification";
import type { AnalysisPack } from "../useStandardAnalysis";
import {
  listMappingColumnOptions,
  suggestStandardFieldMapping,
} from "../standardAnalysisValidation";
import { ConfigField, ConfigInset } from "./standardAnalysisConfigUi";

type Props = {
  draft: AnalysisPack;
  columnOptions: string[];
  columnKinds?: Record<string, DatasetFieldKind>;
  onChange: (updater: (current: AnalysisPack) => AnalysisPack) => void;
};

function FieldMappingInput({
  id,
  label,
  value,
  columns,
  autoValue,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  columns: string[];
  autoValue: string;
  onChange: (value: string) => void;
}) {
  const isAuto = Boolean(value && autoValue && value === autoValue);

  if (columns.length > 0) {
    return (
      <ConfigField
        id={id}
        label={label}
        hint={isAuto ? "已自动识别，可手动改" : undefined}
      >
        <div className="space-y-2">
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger id={id} className="h-11">
              <SelectValue placeholder="自动识别或选择列" />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column} value={column}>
                  {column}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAuto ? (
            <Badge variant="light" color="info" size="sm" className="gap-1">
              <Sparkles className="size-3" aria-hidden />
              自动识别
            </Badge>
          ) : null}
        </div>
      </ConfigField>
    );
  }

  return (
    <ConfigField id={id} label={label}>
      <Input id={id} className="h-11" value={value} onChange={(event) => onChange(event.target.value)} />
    </ConfigField>
  );
}

export function StandardAnalysisFieldMappingFields({
  draft,
  columnOptions,
  columnKinds,
  onChange,
}: Props) {
  const suggested = useMemo(
    () => suggestStandardFieldMapping(columnOptions, columnKinds),
    [columnOptions, columnKinds],
  );

  const statusOptions = useMemo(
    () => listMappingColumnOptions("status", columnOptions, columnKinds),
    [columnOptions, columnKinds],
  );
  const regionOptions = useMemo(
    () => listMappingColumnOptions("region", columnOptions, columnKinds),
    [columnOptions, columnKinds],
  );
  const createdAtOptions = useMemo(
    () => listMappingColumnOptions("createdAt", columnOptions, columnKinds),
    [columnOptions, columnKinds],
  );

  const applySuggestion = () => {
    onChange((current) => ({
      ...current,
      fieldMapping: suggestStandardFieldMapping(columnOptions, columnKinds),
    }));
  };

  return (
    <ConfigInset
      title="字段映射"
      description="绑定数据集后按列名与字段类型自动识别；识别结果可手动覆盖。活跃度与趋势需数据集含日期列。"
      action={
        columnOptions.length > 0 ? (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={applySuggestion}>
            <RefreshCw className="size-3.5" aria-hidden />
            重新识别
          </Button>
        ) : null
      }
    >
      {columnOptions.length > 0 && !suggested.createdAt ? (
        <p className="mb-3 text-theme-xs text-amber-700 dark:text-amber-400">
          当前数据集未识别到日期列，活跃度与趋势主题将无法使用；区域分布仍可配置。
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <FieldMappingInput
          id="status"
          label="状态字段"
          value={draft.fieldMapping.status ?? ""}
          columns={statusOptions}
          autoValue={suggested.status}
          onChange={(status) =>
            onChange((current) => ({
              ...current,
              fieldMapping: { ...current.fieldMapping, status },
            }))
          }
        />
        <FieldMappingInput
          id="region"
          label="区域字段"
          value={draft.fieldMapping.region ?? ""}
          columns={regionOptions}
          autoValue={suggested.region}
          onChange={(region) =>
            onChange((current) => ({
              ...current,
              fieldMapping: { ...current.fieldMapping, region },
            }))
          }
        />
        <FieldMappingInput
          id="createdAt"
          label="时间字段"
          value={draft.fieldMapping.createdAt ?? ""}
          columns={createdAtOptions}
          autoValue={suggested.createdAt}
          onChange={(createdAt) =>
            onChange((current) => ({
              ...current,
              fieldMapping: { ...current.fieldMapping, createdAt },
            }))
          }
        />
      </div>
    </ConfigInset>
  );
}
