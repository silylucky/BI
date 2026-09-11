import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import {
  buildExecuteParameters,
  parseServicePathMeta,
} from "./queryServicePathUtils";

export type QueryServiceTrialTarget = {
  id: string;
  name: string;
  httpMethod: string;
  path: string;
};

type ExecuteResult = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated?: boolean;
};

type QueryServiceTrialSheetProps = {
  service: QueryServiceTrialTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "trial" | "openapi";
};

export function QueryServiceTrialSheet({
  service,
  open,
  onOpenChange,
  initialTab = "trial",
}: QueryServiceTrialSheetProps) {
  const pathMeta = useMemo(
    () => parseServicePathMeta(service?.path ?? ""),
    [service?.path],
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !service) return;
    const initial: Record<string, string> = {};
    for (const name of pathMeta.requiredParams) initial[name] = "";
    setParamValues(initial);
    setExecuteResult(null);
    setExecuteError(null);
  }, [open, service, pathMeta.requiredParams]);

  const openapiQuery = useQuery({
    queryKey: queryKeys.services.openapi(service?.id ?? ""),
    enabled: open && Boolean(service?.id),
    queryFn: () =>
      apiFetch<Record<string, unknown>>(`/api/v1/services/${service!.id}/openapi`),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!service) throw new Error("未选择服务");
      const parameters = buildExecuteParameters(pathMeta.requiredParams, paramValues);
      return apiFetch<ExecuteResult>(`/api/v1/services/${service.id}/execute`, {
        method: "POST",
        body: JSON.stringify({ parameters }),
      });
    },
    onSuccess: (result) => {
      setExecuteResult(result);
      setExecuteError(null);
    },
    onError: (err) => {
      setExecuteResult(null);
      setExecuteError(mapApiError(err));
    },
  });

  if (!service) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{service.name}</SheetTitle>
          <p className="font-mono text-theme-xs text-gray-500 dark:text-gray-400">
            {service.httpMethod} {pathMeta.basePath}
          </p>
        </SheetHeader>

        <Tabs
          key={`${service.id}-${initialTab}`}
          defaultValue={initialTab}
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <TabsList variant="enclosed" size="sm">
            <TabsTrigger value="trial">试执行</TabsTrigger>
            <TabsTrigger value="openapi">OpenAPI</TabsTrigger>
          </TabsList>

          <TabsContent value="trial" className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto">
            {pathMeta.requiredParams.length > 0 ? (
              <div className="space-y-3">
                <p className="text-theme-sm text-gray-600 dark:text-gray-300">请求参数</p>
                {pathMeta.requiredParams.map((name) => (
                  <div key={name} className="space-y-1.5">
                    <Label htmlFor={`svc-param-${name}`}>{name}</Label>
                    <Input
                      id={`svc-param-${name}`}
                      value={paramValues[name] ?? ""}
                      onChange={(e) =>
                        setParamValues((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      placeholder={`输入 ${name}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">此服务无需参数。</p>
            )}

            <Button
              type="button"
              size="sm"
              disabled={executeMutation.isPending}
              onClick={() => executeMutation.mutate()}
            >
              <Play className="size-4" aria-hidden />
              {executeMutation.isPending ? "执行中…" : "执行"}
            </Button>

            {executeError ? (
              <PageErrorBanner message={executeError} onRetry={() => executeMutation.mutate()} />
            ) : null}

            {executeResult ? (
              <div className="space-y-2">
                <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                  返回 {executeResult.rowCount} 行
                  {executeResult.truncated ? "（已截断）" : ""}
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full text-left text-theme-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                      <tr>
                        {executeResult.columns.map((col) => (
                          <th key={col} className="px-3 py-2 font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {executeResult.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 font-mono">
                              {cell == null ? "—" : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="openapi" className="mt-4 flex-1 overflow-y-auto">
            {openapiQuery.isLoading ? <Skeleton className="h-64 w-full" /> : null}
            {openapiQuery.isError ? (
              <PageErrorBanner
                message={mapApiError(openapiQuery.error)}
                onRetry={() => void openapiQuery.refetch()}
              />
            ) : null}
            {openapiQuery.data ? (
              <Textarea
                readOnly
                className="min-h-[400px] font-mono text-theme-xs"
                value={JSON.stringify(openapiQuery.data, null, 2)}
                aria-label="OpenAPI JSON"
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
