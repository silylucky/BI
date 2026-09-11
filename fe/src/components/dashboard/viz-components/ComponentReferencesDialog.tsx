import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchVizComponentReferences } from "@/lib/vizComponents";
import { queryKeys } from "@/lib/queryKeys";

type ComponentReferencesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string | null;
  componentName?: string;
};

function editPathFor(surfaceKind: "dashboard" | "data-screen", dashboardId: string) {
  return surfaceKind === "data-screen"
    ? `/admin/data-screens/${dashboardId}/edit`
    : `/admin/dashboards/${dashboardId}/edit`;
}

export function ComponentReferencesDialog({
  open,
  onOpenChange,
  componentId,
  componentName,
}: ComponentReferencesDialogProps) {
  const refsQuery = useQuery({
    queryKey: queryKeys.vizComponents.references(componentId ?? ""),
    queryFn: () => fetchVizComponentReferences(componentId!),
    enabled: open && Boolean(componentId),
  });

  const items = refsQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>引用明细</DialogTitle>
          <DialogDescription>
            {componentName ? `「${componentName}」` : "该组件"}被以下看板/大屏引用（未断链）。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(50vh,320px)] overflow-y-auto">
          {refsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              暂无引用
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
              {items.map((item) => (
                <li key={`${item.dashboardId}-${item.widgetId}`} className="py-3">
                  <Link
                    to={editPathFor(item.dashboardSurfaceKind, item.dashboardId)}
                    className="block rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                    onClick={() => onOpenChange(false)}
                  >
                    <p className="text-theme-sm font-medium text-gray-900 dark:text-white">
                      {item.dashboardName}
                    </p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      组件实例：{item.widgetTitle || item.widgetId}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
