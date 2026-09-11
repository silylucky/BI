import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { type WorkflowTemplate } from "./components/workflow-labels";
import { WorkflowEmptyState } from "./components/WorkflowEmptyState";
import { WorkflowTemplateDetail } from "./components/WorkflowTemplateDetail";
import { WorkflowTemplateList } from "./components/WorkflowTemplateList";
import { CreateWorkflowTemplateDialog } from "./components/CreateWorkflowTemplateDialog";
import { WorkflowInstancesPanel } from "./WorkflowInstancesPanel";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

const SHELL_CLASS = cn(
  "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm",
  "dark:border-gray-800 dark:bg-white/[0.03]",
);

export function GovernanceWorkflowPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.gov.workflowTemplates,
    queryFn: () => apiFetch<{ items: WorkflowTemplate[] }>("/api/v1/gov/workflow/templates"),
  });

  const items = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <AdminPageShell
      title="治理工单"
      description="管理流程模板与工单实例，回看设计快照并推进审批发布。"
      actions={<CreateWorkflowTemplateDialog onCreated={setSelectedId} />}
    >
      {isError ? <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} /> : null}

      <Tabs defaultValue="templates" className="w-full">
        <div className={SHELL_CLASS}>
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <TabsList variant="line" className="w-fit">
              <TabsTrigger value="templates">流程模板</TabsTrigger>
              <TabsTrigger value="instances">工单实例</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates" className="mt-0 focus-visible:outline-hidden">
            {isLoading ? (
              <div className="space-y-0 p-6">
                <Skeleton className="h-[480px] w-full rounded-xl" />
              </div>
            ) : items.length === 0 ? (
              <WorkflowEmptyState embedded />
            ) : (
              <div className="grid min-h-[520px] min-w-0 overflow-hidden xl:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
                <aside className="flex min-w-0 flex-col overflow-hidden border-b border-gray-200 xl:border-b-0 xl:border-r dark:border-gray-800">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3.5 dark:border-gray-800">
                    <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">模板</h2>
                    <Badge variant="light" color="light" size="sm">
                      {items.length}
                    </Badge>
                  </div>
                  <WorkflowTemplateList
                    templates={items}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </aside>
                <section className="min-h-[420px] min-w-0">
                  {selected ? <WorkflowTemplateDetail template={selected} /> : null}
                </section>
              </div>
            )}
          </TabsContent>

          <TabsContent value="instances" className="mt-0 focus-visible:outline-hidden">
            <WorkflowInstancesPanel embedded />
          </TabsContent>
        </div>
      </Tabs>
    </AdminPageShell>
  );
}
