import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileJson2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

type WorkflowInstance = {
  id: string;
  templateId: string;
  refId: string;
  status: string;
  allowedActions: string[];
  designSnapshot?: Record<string, unknown>;
};

const STATUS_COLOR: Record<string, "primary" | "success" | "warning" | "light"> = {
  draft: "light",
  pending_approval: "warning",
  designing: "primary",
  pending_publish: "warning",
  published: "success",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending_approval: "待审批",
  designing: "设计中",
  pending_publish: "待发布",
  published: "已发布",
};

type WorkflowInstancesPanelProps = {
  embedded?: boolean;
};

function InstanceListItem({
  inst,
  selected,
  onSelect,
}: {
  inst: WorkflowInstance;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:ring-inset",
        selected ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]",
      )}
    >
      <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{inst.id}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="light" color={STATUS_COLOR[inst.status] ?? "light"} size="sm">
          {STATUS_LABEL[inst.status] ?? inst.status}
        </Badge>
        <span className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{inst.templateId}</span>
      </div>
    </button>
  );
}

export function WorkflowInstancesPanel({ embedded = false }: WorkflowInstancesPanelProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.gov.workflowInstances(),
    queryFn: () =>
      apiFetch<{ items: WorkflowInstance[]; total: number }>("/api/v1/gov/workflow/instances"),
  });

  const items = listQuery.data?.items ?? [];

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const detailQuery = useQuery({
    queryKey: queryKeys.gov.workflowInstance(selectedId ?? "", true),
    enabled: Boolean(selectedId),
    queryFn: () =>
      apiFetch<WorkflowInstance>(
        `/api/v1/gov/workflow/instances/${selectedId}?includeDesignSnapshot=true`,
      ),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, action, actorRole }: { id: string; action: string; actorRole: string }) =>
      apiFetch(`/api/v1/gov/workflow/instances/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action, actorRole }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.gov.workflowInstances() });
      if (selectedId) {
        void qc.invalidateQueries({ queryKey: queryKeys.gov.workflowInstance(selectedId, true) });
      }
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/gov/workflow/instances/${id}/confirm-design`, { method: "POST" }),
    onSuccess: () => {
      toast.success("设计已确认");
      void qc.invalidateQueries({ queryKey: queryKeys.gov.workflowInstances() });
      if (selectedId) {
        void qc.invalidateQueries({ queryKey: queryKeys.gov.workflowInstance(selectedId, true) });
      }
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch("/api/v1/gov/publish/from-workflow", {
        method: "POST",
        body: JSON.stringify({ workflowInstanceId: id }),
      }),
    onSuccess: () => {
      toast.success("发布服务已创建");
      void qc.invalidateQueries({ queryKey: queryKeys.gov.workflowInstances() });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const detail = detailQuery.data;
  const snap = detail?.designSnapshot;

  const shellClass = embedded
    ? ""
    : cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm",
        "dark:border-gray-800 dark:bg-white/[0.03]",
      );

  if (listQuery.isLoading) {
    return <Skeleton className={cn("h-[520px] w-full", !embedded && "rounded-2xl")} />;
  }

  if (!items.length) {
    return (
      <div className={cn(shellClass, "min-h-[420px]")}>
        <PanelEmptyState
          icon={<ClipboardList className="size-7" aria-hidden />}
          title="暂无工单实例"
          description="在查询设计器提交申请后，工单将在此展示并推进审批发布。"
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="grid min-h-[520px] min-w-0 overflow-hidden xl:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col overflow-hidden border-b border-gray-200 xl:border-b-0 xl:border-r dark:border-gray-800">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3.5 dark:border-gray-800">
            <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">实例</h2>
            <Badge variant="light" color="light" size="sm">
              {items.length}
            </Badge>
          </div>
          <ul className="max-h-[min(560px,calc(100vh-300px))] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {items.map((inst) => (
              <li key={inst.id}>
                <InstanceListItem
                  inst={inst}
                  selected={selectedId === inst.id}
                  onSelect={() => setSelectedId(inst.id)}
                />
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0">
          {detailQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : detail ? (
            <div className="flex min-h-0 flex-col">
              <header className="border-b border-gray-200 px-6 py-5 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-mono text-theme-sm font-semibold text-gray-900 dark:text-white">
                      {detail.id}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="light" color={STATUS_COLOR[detail.status] ?? "light"} size="sm">
                        {STATUS_LABEL[detail.status] ?? detail.status}
                      </Badge>
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        模板 {detail.templateId}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.allowedActions.includes("approve") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={transitionMutation.isPending}
                        onClick={() =>
                          transitionMutation.mutate({
                            id: detail.id,
                            action: "approve",
                            actorRole: "approver",
                          })
                        }
                      >
                        审批通过
                      </Button>
                    ) : null}
                    {detail.status === "designing" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={confirmMutation.isPending}
                        onClick={() => confirmMutation.mutate(detail.id)}
                      >
                        确认设计
                      </Button>
                    ) : null}
                    {detail.status === "pending_publish" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate(detail.id)}
                      >
                        发布服务
                      </Button>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="space-y-5 p-6">
                {snap ? (
                  <section>
                    <div className="mb-4 flex items-center gap-2">
                      <FileJson2 className="size-4 text-brand-500" aria-hidden />
                      <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                        设计快照
                      </h3>
                    </div>
                    <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                      <div className="grid gap-2">
                        <Label htmlFor="wf-snap-conditions">条件</Label>
                        <Textarea
                          id="wf-snap-conditions"
                          readOnly
                          className="min-h-[100px] font-mono text-theme-xs"
                          value={JSON.stringify(snap.conditions ?? {}, null, 2)}
                          aria-label="条件快照"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wf-snap-rules">计算规则</Label>
                        <Textarea
                          id="wf-snap-rules"
                          readOnly
                          className="min-h-[88px] font-mono text-theme-xs"
                          value={JSON.stringify(snap.computeRules ?? {}, null, 2)}
                          aria-label="规则快照"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wf-snap-output">输出字段</Label>
                        <Textarea
                          id="wf-snap-output"
                          readOnly
                          className="min-h-[88px] font-mono text-theme-xs"
                          value={JSON.stringify(snap.outputFields ?? {}, null, 2)}
                          aria-label="输出快照"
                        />
                      </div>
                    </div>
                  </section>
                ) : (
                  <PanelEmptyState
                    icon={<FileJson2 className="size-6" aria-hidden />}
                    title="暂无设计快照"
                    description="该工单尚未附带设计器配置快照。"
                    size="sm"
                    tone="neutral"
                    variant="framed"
                  />
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
