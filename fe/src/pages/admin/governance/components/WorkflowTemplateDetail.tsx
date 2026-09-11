import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  nodeLabel,
  roleLabel,
  type WorkflowNodeRole,
  type WorkflowTemplate,
} from "./workflow-labels";

type WorkflowTemplateDetailProps = {
  template: WorkflowTemplate;
};

function FlowStepper({ nodes }: { nodes: WorkflowTemplate["nodes"] }) {
  if (!nodes.length) {
    return (
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">该模板尚未配置流程节点。</p>
    );
  }

  return (
    <div className="overflow-x-only">
      <ol className="flex min-w-max items-start">
        {nodes.map((node, index) => (
          <Fragment key={node.id}>
            <li className="flex w-[120px] flex-col items-center text-center">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white shadow-theme-xs">
                {index + 1}
              </span>
              <p className="mt-2.5 text-theme-sm font-medium text-gray-900 dark:text-white">
                {nodeLabel(node.id)}
              </p>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{roleLabel(node.role)}</p>
            </li>
            {index < nodes.length - 1 ? (
              <li className="flex h-8 min-w-[40px] flex-1 items-center px-1" aria-hidden>
                <div className="h-px w-full bg-gradient-to-r from-brand-300/80 via-brand-200/60 to-brand-100/40 dark:from-brand-500/40 dark:via-brand-500/20 dark:to-transparent" />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

function NodeRolesTable({
  nodes,
  descriptions,
  loading,
}: {
  nodes: WorkflowTemplate["nodes"];
  descriptions: WorkflowNodeRole[];
  loading: boolean;
}) {
  const descByNode = new Map(descriptions.map((d) => [d.nodeId, d.description]));

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14">#</TableHead>
          <TableHead>节点</TableHead>
          <TableHead className="w-28">负责角色</TableHead>
          <TableHead>说明</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: Math.max(nodes.length, 3) }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          : null}
        {!loading
          ? nodes.map((node, index) => (
              <TableRow key={node.id}>
                <TableCell className="text-gray-400">{index + 1}</TableCell>
                <TableCell className="font-medium text-gray-800 dark:text-white/90">
                  {nodeLabel(node.id)}
                </TableCell>
                <TableCell>
                  <Badge variant="light" color="primary" size="sm">
                    {roleLabel(node.role)}
                  </Badge>
                </TableCell>
                <TableCell className="text-theme-sm text-gray-600 dark:text-gray-400">
                  {descByNode.get(node.id) ?? "—"}
                </TableCell>
              </TableRow>
            ))
          : null}
      </TableBody>
    </Table>
  );
}

export function WorkflowTemplateDetail({ template }: WorkflowTemplateDetailProps) {
  const rolesQuery = useQuery({
    queryKey: queryKeys.gov.workflowNodeRoles(template.id),
    queryFn: () =>
      apiFetch<{ items: WorkflowNodeRole[] }>(
        `/api/v1/gov/workflow/templates/${template.id}/node-roles`,
      ).then((r) => r.items),
  });

  const isCustom = template.id.startsWith("custom_");
  const roleCount = new Set(template.nodes.map((n) => n.role)).size;

  return (
    <div className="flex min-h-0 flex-col">
      <header className="shrink-0 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Workflow className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-theme-base font-semibold text-gray-900 dark:text-white">{template.name}</h2>
              <Badge variant="light" color={isCustom ? "primary" : "success"} size="sm">
                {isCustom ? "自定义" : "内置"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono">{template.id}</span>
              <span aria-hidden>·</span>
              <span>{template.nodes.length} 个节点</span>
              <span aria-hidden>·</span>
              <span>{roleCount} 个角色</span>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
        <section>
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">流转路径</h3>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            从左到右为工单状态推进顺序。
          </p>
          <div className="mt-4 rounded-xl bg-gray-50/80 px-4 py-5 dark:bg-white/[0.02]">
            <FlowStepper nodes={template.nodes} />
          </div>
        </section>

        <section>
          <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">节点职责</h3>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            各节点绑定的角色与说明，供审批与设计环节参考。
          </p>
          <div
            className={cn(
              "mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800",
            )}
          >
            <NodeRolesTable
              nodes={template.nodes}
              descriptions={rolesQuery.data ?? []}
              loading={rolesQuery.isLoading}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
