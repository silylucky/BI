import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { ReportCenterBackLink } from "./components/ReportCenterBackLink";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { matchesCapability, resolveEffectiveCapabilities } from "@/lib/capabilities";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/context/auth-context";
import type { ReportCatalogNode } from "@/lib/reportCatalogUtils";
import { localizeTemplateReadiness, type TemplateReadiness } from "@/lib/reportTemplateReadiness";
import { reportTemplatePath } from "./components/reportTemplateUi";
import { ReportExportCard } from "./components/ReportExportCard";
import { ReportCrosstabResultTable } from "./components/ReportCrosstabResultTable";
import { ReportResultTable } from "./components/ReportResultTable";
import { useCatalogExtension } from "./useReportTemplates";

type RenderSection = {
  kind: string;
  columns?: string[];
  rows?: unknown[][];
  colLabels?: string[];
  rowLabels?: string[];
  matrix?: unknown[][];
  placeholder?: boolean;
  errorMessage?: string;
  title?: string;
};

type RenderRunOut = {
  status: string;
  renderSpec: {
    sections: RenderSection[];
    meta?: { translationNote?: string };
  };
  exportHook?: { integrationPath: string; format: string; placeholder: boolean };
};

export function ReportViewPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const { user } = useAuth();
  const caps = resolveEffectiveCapabilities(user);
  const canManage = matchesCapability(caps, "report:manage");

  const nodeQuery = useQuery({
    queryKey: queryKeys.reports.catalogNode(nodeId ?? ""),
    queryFn: () => apiFetch<ReportCatalogNode>(`/api/v1/reports/catalog/nodes/${nodeId}`),
    enabled: Boolean(nodeId),
  });

  const extQuery = useCatalogExtension(nodeId ?? null);
  const readinessQuery = useQuery({
    queryKey: ["reports", "template-readiness", nodeId],
    queryFn: () =>
      apiFetch<{ items: { nodeId: string; readiness: TemplateReadiness }[] }>(
        "/api/v1/reports/catalog/templates/readiness",
        {
          method: "POST",
          body: JSON.stringify({ nodeIds: [nodeId] }),
        },
      ),
    enabled: Boolean(nodeId),
  });
  const readiness = readinessQuery.data?.items?.[0]?.readiness;
  const extensionReady =
    Boolean(extQuery.data) &&
    extQuery.data!.catalogNodeId === nodeId &&
    (extQuery.data!.metrics?.length ?? 0) > 0;

  const runMutation = useMutation({
    mutationFn: () =>
      apiFetch<RenderRunOut>(`/api/v1/reports/templates/${nodeId}/run`, {
        method: "POST",
        body: JSON.stringify({ format: "web", parameters: {} }),
      }),
  });

  const node = nodeQuery.data;
  const sections = runMutation.data?.renderSpec.sections ?? [];
  const { mutate: runReport, isPending: isRunning } = runMutation;
  const autoRanRef = useRef(false);

  useEffect(() => {
    autoRanRef.current = false;
  }, [nodeId]);

  useEffect(() => {
    if (!node || node.nodeType !== "template" || autoRanRef.current || isRunning) return;
    autoRanRef.current = true;
    runReport();
  }, [node, isRunning, runReport]);

  return (
    <AdminPageShell
      title={node?.name ?? "报表查看"}
      description="运行报表模板并查看 Web 展现结果。"
      actions={<ReportCenterBackLink label="返回全部报表" />}
    >
      {nodeQuery.isError ? (
        <PageErrorBanner message={mapApiError(nodeQuery.error)} onRetry={() => void nodeQuery.refetch()} />
      ) : null}

      {nodeQuery.isLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}

      {node && node.nodeType !== "template" ? (
        <PanelEmptyState
          title="非模板节点"
          description="请选择目录中的具体报表模板进行查看。"
          variant="framed"
        />
      ) : null}

      {node?.nodeType === "template" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  运行中…
                </>
              ) : (
                "运行报表"
              )}
            </Button>
            {canManage ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to={reportTemplatePath(node.id)}>编辑模板</Link>
              </Button>
            ) : null}
            {readiness ? (
              <Badge variant="outline">{localizeTemplateReadiness(readiness)}</Badge>
            ) : null}
          </div>

          {runMutation.isError ? (
            <PageErrorBanner
              message={mapApiError(runMutation.error)}
              onRetry={() => runMutation.mutate()}
            />
          ) : null}

          {sections.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-theme-sm">运行结果</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {runMutation.data?.renderSpec.meta?.translationNote ? (
                  <p className="text-theme-xs text-amber-700 dark:text-amber-400">
                    {runMutation.data.renderSpec.meta.translationNote}
                  </p>
                ) : null}
                {sections.map((section, index) => (
                  <div key={`${section.kind}-${section.title ?? index}`} className="space-y-2">
                    {section.title ? (
                      <h3 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {section.title}
                      </h3>
                    ) : null}
                    {section.placeholder ? (
                      <Alert severity="info">
                        <AlertTitle>示例态展示</AlertTitle>
                        <AlertDescription>
                          {canManage ? (
                            <>
                              模板尚未接入真实数据源，当前为占位结果。请前往
                              <Link to={reportTemplatePath(node.id)} className="mx-1 text-brand-600 hover:underline">
                                模板编辑
                              </Link>
                              配置扩展指标与数据源后再运行。
                            </>
                          ) : (
                            "模板尚未接入业务数据，当前为示例展示。如需完整报表，请联系管理员完善模板配置。"
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : section.kind === "error" ? (
                      <Alert severity="error">
                        <AlertTitle>区块渲染失败</AlertTitle>
                        <AlertDescription>{section.errorMessage ?? "交叉表或数据块处理失败"}</AlertDescription>
                      </Alert>
                    ) : section.kind === "crosstab" ? (
                      <ReportCrosstabResultTable section={section} />
                    ) : section.columns && section.rows ? (
                      <ReportResultTable columns={section.columns} rows={section.rows} />
                    ) : (
                      <p className="text-theme-sm text-gray-500">
                        该区块暂不支持 Web 预览，请尝试导出 PDF 或 Excel。
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <ReportExportCard
            defaultTemplateId={node.id}
            disabled={!extensionReady}
            disabledHint="请先在模板编辑页的「扩展配置」中添加指标、配置数据集并保存后再导出。"
          />
        </div>
      ) : null}
    </AdminPageShell>
  );
}
