import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileJson } from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

type CatalogEntry = {
  id: string;
  name: string;
  httpMethod: string;
  path: string;
  status: string;
};

const STATUS_COLOR: Record<string, "primary" | "success" | "warning" | "light"> = {
  draft: "light",
  pending_publish: "warning",
  published: "success",
};

export function GovernancePublishPage() {
  const qc = useQueryClient();
  const [openapiEntryId, setOpenapiEntryId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    entryId: string;
    action: "submit" | "approve" | "reject";
  } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.gov.entries({ limit: 100, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: CatalogEntry[]; total: number }>(
        "/api/v1/gov/catalog/entries?limit=100&offset=0",
      ),
  });

  const openapiQuery = useQuery({
    queryKey: queryKeys.gov.publishOpenapi(openapiEntryId ?? ""),
    enabled: Boolean(openapiEntryId),
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/v1/gov/publish/entries/${openapiEntryId}/openapi`),
  });

  const actionMutation = useMutation({
    mutationFn: ({ entryId, action }: { entryId: string; action: string }) =>
      apiFetch(`/api/v1/gov/publish/entries/${entryId}/${action}`, { method: "POST" }),
    onSuccess: () => {
      toast.success("操作成功");
      void qc.invalidateQueries({ queryKey: queryKeys.gov.entries({ limit: 100, offset: 0 }) });
      setConfirmAction(null);
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const items = data?.items ?? [];

  return (
    <AdminPageShell
      title="发布流水线"
      description="管理目录条目发布状态、审批与 OpenAPI 文档预览。"
    >
      {isError ? <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} /> : null}

      <div className="overflow-x-only rounded-xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-[720px] w-full text-left text-theme-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">条目</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">接口</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">发布状态</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              : null}
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">{e.name}</td>
                <td className="px-4 py-3 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                  {e.httpMethod} {e.path}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="light" color={STATUS_COLOR[e.status] ?? "light"} size="sm">
                    {e.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {e.status === "draft" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAction({ entryId: e.id, action: "submit" })}
                      >
                        提交发布
                      </Button>
                    ) : null}
                    {e.status === "pending_publish" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => setConfirmAction({ entryId: e.id, action: "approve" })}
                        >
                          批准
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmAction({ entryId: e.id, action: "reject" })}
                        >
                          驳回
                        </Button>
                      </>
                    ) : null}
                    {e.status === "published" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenapiEntryId(e.id)}
                        >
                          <FileJson className="size-4" aria-hidden />
                          OpenAPI
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/admin/services">查询服务</Link>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(openapiEntryId)} onOpenChange={(open) => !open && setOpenapiEntryId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>OpenAPI 文档预览</SheetTitle>
          </SheetHeader>
          {openapiQuery.isLoading ? <Skeleton className="mt-4 h-64 w-full" /> : null}
          {openapiQuery.isError ? (
            <PageErrorBanner
              className="mt-4"
              message={mapApiError(openapiQuery.error)}
              onRetry={() => void openapiQuery.refetch()}
            />
          ) : null}
          {openapiQuery.data ? (
            <Textarea
              readOnly
              className="mt-4 min-h-[400px] font-mono text-theme-xs"
              value={JSON.stringify(openapiQuery.data, null, 2)}
              aria-label="OpenAPI JSON"
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发布操作</AlertDialogTitle>
            <AlertDialogDescription>此操作将变更条目发布状态，是否继续？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              onClick={() => {
                if (confirmAction) {
                  actionMutation.mutate({
                    entryId: confirmAction.entryId,
                    action: confirmAction.action,
                  });
                }
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
