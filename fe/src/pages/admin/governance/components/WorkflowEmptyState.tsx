import { Workflow } from "lucide-react";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { cn } from "@/lib/utils";

type WorkflowEmptyStateProps = {
  embedded?: boolean;
};

export function WorkflowEmptyState({ embedded = false }: WorkflowEmptyStateProps) {
  return (
    <div
      className={cn(
        embedded
          ? "min-h-[420px]"
          : "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]",
      )}
    >
      <PanelEmptyState
        icon={<Workflow className="size-7" aria-hidden />}
        title="暂无流程模板"
        description="创建模板以定义工单节点与负责角色；内置「标准查询发布」模板可在首次接入后自动注册。"
        size="lg"
        variant="plain"
      />
    </div>
  );
}
