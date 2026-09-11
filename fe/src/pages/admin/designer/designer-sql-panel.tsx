import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

type SqlModePayload = {
  dataSourceId: string;
  sql: string;
  refId: string;
};

export function DesignerSqlPanel({
  refId,
  readOnly,
  onSaved,
  onSqlChange,
}: {
  refId: string;
  readOnly?: boolean;
  onSaved?: () => void;
  onSqlChange?: (sql: string) => void;
}) {
  const qc = useQueryClient();
  const [dataSourceId, setDataSourceId] = useState<string>("");
  const [sql, setSql] = useState("");
  const [sqlError, setSqlError] = useState<string | null>(null);

  const datasourcesQuery = useQuery({
    queryKey: queryKeys.datasources.list(),
    queryFn: () => apiFetch<{ items: Array<{ id: string; name: string }> }>("/api/v1/datasources"),
  });

  const sqlModeQuery = useQuery({
    queryKey: queryKeys.designer.sqlMode(refId),
    queryFn: () =>
      apiFetch<{ dataSourceId: string; sql: string }>(
        `/api/v1/designer/sql-mode?refId=${refId}`,
      ),
  });

  const loadedKey = `${sqlModeQuery.data?.dataSourceId ?? ""}:${sqlModeQuery.data?.sql ?? ""}`;
  useEffect(() => {
    if (!sqlModeQuery.data) return;
    setDataSourceId(sqlModeQuery.data.dataSourceId);
    setSql(sqlModeQuery.data.sql);
    onSqlChange?.(sqlModeQuery.data.sql);
  }, [loadedKey, onSqlChange, sqlModeQuery.data]);

  const validateMutation = useMutation({
    mutationFn: (body: SqlModePayload) =>
      apiFetch("/api/v1/designer/sql-mode/validate", {
        method: "POST",
        body: JSON.stringify({ ...body, schemaVersion: "1.0", refType: "design_draft" }),
      }),
    onSuccess: () => {
      setSqlError(null);
      toast.success("SQL 校验通过");
    },
    onError: (err) => {
      const msg = mapApiError(err);
      setSqlError(msg);
      toast.error(msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (body: SqlModePayload) =>
      apiFetch("/api/v1/designer/sql-mode", {
        method: "PUT",
        body: JSON.stringify({ ...body, schemaVersion: "1.0", refType: "design_draft" }),
      }),
    onSuccess: () => {
      setSqlError(null);
      void qc.invalidateQueries({ queryKey: queryKeys.designer.sqlMode(refId) });
      onSaved?.();
      toast.success("SQL 已保存");
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const payload = (): SqlModePayload => ({
    dataSourceId,
    sql,
    refId,
  });

  const busy = validateMutation.isPending || saveMutation.isPending;
  const disabled = readOnly || busy;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Code2 className="size-4 text-gray-500" aria-hidden />
        <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">传统 SQL 模式</span>
      </div>

      {datasourcesQuery.isLoading || sqlModeQuery.isLoading ? (
        <Skeleton className="h-[320px] w-full rounded-xl" />
      ) : (
        <>
          <div className="space-y-2">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">数据源</span>
            <Select
              value={dataSourceId || undefined}
              onValueChange={setDataSourceId}
              disabled={disabled}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                {(datasourcesQuery.data?.items ?? []).map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            className="min-h-[280px] font-mono text-theme-xs"
            value={sql}
            onChange={(e) => {
              setSql(e.target.value);
              onSqlChange?.(e.target.value);
            }}
            readOnly={readOnly}
            disabled={disabled}
            aria-invalid={sqlError ? true : undefined}
            aria-label="SQL 编辑器"
            placeholder="SELECT ..."
          />
          {sqlError ? (
            <p className="text-theme-xs text-error-600 dark:text-error-400" role="alert">
              {sqlError}
            </p>
          ) : null}

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !dataSourceId || !sql.trim()}
                onClick={() => validateMutation.mutate(payload())}
              >
                {validateMutation.isPending ? "校验中…" : "校验 SQL"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={disabled || !dataSourceId || !sql.trim()}
                onClick={() => saveMutation.mutate(payload())}
              >
                {saveMutation.isPending ? "保存中…" : "保存 SQL"}
              </Button>
            </div>
          ) : null}
        </>
      )}
      <span className="sr-only" data-loaded-key={loadedKey} />
    </div>
  );
}
