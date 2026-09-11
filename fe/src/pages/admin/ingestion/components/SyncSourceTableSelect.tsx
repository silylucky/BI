import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { SYNC_CONTROL_CLASS, SyncFormField } from "./SyncFormField";
import {
  resolveSyncSourceSchema,
  supportsSyncSourceTablePicker,
} from "./syncSourceTablePicker";

type SyncSourceTableSelectProps = {
  id?: string;
  label: string;
  placeholder?: string;
  hint?: string;
  dataSourceId: string;
  sourceType?: string;
  database?: string;
  sourceSchema: string;
  onSourceSchemaChange: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
};

function ManualSourceTableInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <SyncFormField label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        className={SYNC_CONTROL_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
      />
    </SyncFormField>
  );
}

export function SyncSourceTableSelect({
  id = "table",
  label,
  placeholder,
  hint,
  dataSourceId,
  sourceType,
  database,
  sourceSchema,
  onSourceSchemaChange,
  value,
  onChange,
}: SyncSourceTableSelectProps) {
  const pickerEnabled = supportsSyncSourceTablePicker(sourceType) && Boolean(dataSourceId);

  const schemasQuery = useQuery({
    queryKey: queryKeys.datasources.schemas(dataSourceId),
    queryFn: () =>
      apiFetch<{ items: Array<{ name: string }> }>(
        `/api/v1/datasources/${dataSourceId}/schemas`,
      ),
    enabled: pickerEnabled,
    staleTime: 60_000,
  });

  const resolvedSchema = useMemo(() => {
    if (!pickerEnabled) return "";
    if (sourceSchema.trim()) return sourceSchema.trim();
    const names = (schemasQuery.data?.items ?? []).map((item) => item.name);
    return resolveSyncSourceSchema(names, database, sourceType);
  }, [database, pickerEnabled, schemasQuery.data?.items, sourceSchema, sourceType]);

  useEffect(() => {
    if (!pickerEnabled || !resolvedSchema || resolvedSchema === sourceSchema.trim()) return;
    if (!sourceSchema.trim() && schemasQuery.isSuccess) {
      onSourceSchemaChange(resolvedSchema);
    }
  }, [
    onSourceSchemaChange,
    pickerEnabled,
    resolvedSchema,
    schemasQuery.isSuccess,
    sourceSchema,
  ]);

  const schema = resolvedSchema;

  const tablesQuery = useQuery({
    queryKey: queryKeys.datasources.tables(dataSourceId, schema),
    queryFn: () =>
      apiFetch<{ items: Array<{ name: string; type?: string }> }>(
        `/api/v1/datasources/${dataSourceId}/tables?schema=${encodeURIComponent(schema)}`,
      ),
    enabled: pickerEnabled && Boolean(schema),
    staleTime: 60_000,
  });

  const tableNames = useMemo(() => {
    const names = (tablesQuery.data?.items ?? [])
      .filter((item) => !item.type || item.type === "table" || item.type === "view")
      .map((item) => item.name);
    const trimmed = value.trim();
    if (trimmed && !names.includes(trimmed)) return [trimmed, ...names];
    return names;
  }, [tablesQuery.data?.items, value]);

  if (!pickerEnabled) {
    return (
      <ManualSourceTableInput
        id={id}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        hint={hint}
      />
    );
  }

  if (!dataSourceId) {
    return (
      <ManualSourceTableInput
        id={id}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        hint="请先选择业务源连接。"
      />
    );
  }

  const metadataLoading =
    schemasQuery.isLoading || (Boolean(schema) && tablesQuery.isLoading && tableNames.length === 0);
  const metadataError = schemasQuery.isError || tablesQuery.isError;

  if (metadataLoading) {
    return (
      <SyncFormField label={label} htmlFor={id} hint="加载表列表…">
        <Skeleton className={SYNC_CONTROL_CLASS} />
      </SyncFormField>
    );
  }

  if (metadataError || tableNames.length === 0) {
    return (
      <ManualSourceTableInput
        id={id}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        hint={
          metadataError
            ? `无法加载表列表（${mapApiError(schemasQuery.error ?? tablesQuery.error)}），请手动输入。`
            : schema
              ? `Schema ${schema} 下暂无可用表，请手动输入。`
              : "暂无 Schema，请手动输入。"
        }
      />
    );
  }

  return (
    <SyncFormField
      label={label}
      htmlFor={id}
      hint={schema ? `Schema：${schema}` : hint}
    >
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className={SYNC_CONTROL_CLASS} aria-label={label}>
          <SelectValue placeholder={placeholder ?? "选择源表"} />
        </SelectTrigger>
        <SelectContent>
          {tableNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SyncFormField>
  );
}
