import { ChevronRight, Workflow } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { nodeLabel, type WorkflowTemplate } from "./workflow-labels";

type WorkflowTemplateListProps = {
  templates: WorkflowTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function WorkflowTemplateList({
  templates,
  selectedId,
  onSelect,
}: WorkflowTemplateListProps) {
  return (
    <ScrollArea className="h-full max-h-[min(560px,calc(100vh-300px))]">
      <div className="space-y-0.5 p-2">
        {templates.map((tpl) => {
          const selected = tpl.id === selectedId;
          const firstNode = tpl.nodes[0]?.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
                selected
                  ? "bg-brand-50 dark:bg-brand-500/10"
                  : "hover:bg-gray-50 dark:hover:bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  selected
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-500 group-hover:bg-brand-100 group-hover:text-brand-600 dark:bg-white/5 dark:text-gray-400",
                )}
              >
                <Workflow className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-theme-sm font-medium",
                    selected ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-white/90",
                  )}
                >
                  {tpl.name}
                </p>
                <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {tpl.nodes.length} 个节点
                  {firstNode ? ` · 起始于${nodeLabel(firstNode)}` : ""}
                </p>
              </div>
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-gray-300 transition-transform",
                  selected && "text-brand-400",
                  "group-hover:translate-x-0.5",
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
