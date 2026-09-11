import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAiVizArtifacts } from "@/lib/aiVizArtifacts";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  AiVizArtifactDeleteDialog,
  type AiVizArtifactDeleteTarget,
} from "./AiVizArtifactDeleteDialog";

type AiVizArtifactsHubGridProps = {
  canManage: boolean;
  enabled?: boolean;
  className?: string;
};

/** 管理端 Hub「自定义」筛选：AI artifact 缩略栅格（对标编辑态图表盘自定义区） */
export function AiVizArtifactsHubGrid({
  canManage,
  enabled = true,
  className,
}: AiVizArtifactsHubGridProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AiVizArtifactDeleteTarget | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.aiViz.list({ limit: 50, offset: 0 }),
    queryFn: () => fetchAiVizArtifacts(50, 0),
    enabled: canManage && enabled,
  });

  if (!canManage || !enabled) return null;

  const items = listQuery.data?.items ?? [];

  return (
    <>
      {listQuery.isLoading ? (
        <div
          className={cn(
            "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
            className,
          )}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? null : (
        <div
          className={cn(
            "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
            className,
          )}
        >
          {items.map((item) => {
            const label = item.manifest.displayName ?? item.manifest.id ?? "自定义组件";
            return (
              <div
                key={item.artifactId}
                className="relative flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 p-2 text-center dark:border-gray-800"
                data-testid={`ai-viz-hub-tile-${item.artifactId}`}
              >
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 z-10 flex size-5 items-center justify-center rounded-md text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                  aria-label={`从组件库移除 ${label}`}
                  title="从组件库移除"
                  onClick={() => setDeleteTarget({ artifactId: item.artifactId, label })}
                >
                  <Trash2 className="size-3" strokeWidth={2} aria-hidden />
                </button>
                <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-brand-500 dark:bg-white/[0.06]">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <span className="line-clamp-2 w-full text-[11px] leading-tight text-gray-700 dark:text-gray-300">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <AiVizArtifactDeleteDialog
        target={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.aiViz.all });
        }}
      />
    </>
  );
}
