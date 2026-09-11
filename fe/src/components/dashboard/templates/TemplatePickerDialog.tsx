import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutTemplate, LayoutDashboard, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { mapApiError } from "@/lib/apiError";
import {
  fetchDashboardTemplates,
  filterTemplatesForHub,
  type DashboardTemplateListItem,
  type VizSurfaceKind,
} from "@/lib/dashboardTemplates";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

type TemplatePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surfaceKind: VizSurfaceKind;
  onSelect: (template: DashboardTemplateListItem) => void;
  pending?: boolean;
};

function SurfaceIcon({ kind }: { kind: VizSurfaceKind }) {
  if (kind === "data-screen") return <Monitor className="size-4" aria-hidden />;
  return <LayoutDashboard className="size-4" aria-hidden />;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
  surfaceKind,
  onSelect,
  pending,
}: TemplatePickerDialogProps) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const listQuery = useQuery({
    queryKey: queryKeys.dashboardTemplates.list({ surfaceKind, q }),
    queryFn: () => fetchDashboardTemplates({ surfaceKind, q: q || undefined, limit: 50 }),
    enabled: open,
  });

  const pickerItems = filterTemplatesForHub(listQuery.data?.items ?? []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-5" aria-hidden />
            使用模板新建
          </DialogTitle>
          <DialogDescription>
            从企业模板库选择布局，创建后可继续编辑与绑定数据。
          </DialogDescription>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索模板名称…"
          aria-label="搜索模板"
        />

        <div className="custom-scrollbar max-h-[min(50vh,360px)] overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <PageErrorBanner
              message={mapApiError(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          ) : pickerItems.length === 0 ? (
            <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              暂无可用模板
            </p>
          ) : (
            <ul className="grid gap-2">
              {pickerItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={pending}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border border-gray-200 p-3 text-left transition-colors",
                      "hover:border-brand-200 hover:bg-brand-50/50 dark:border-gray-800 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5",
                      "disabled:opacity-60",
                    )}
                    onClick={() => onSelect(item)}
                  >
                    <span className="flex items-center gap-2 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      <SurfaceIcon kind={item.surfaceKind} />
                      {item.name}
                      {item.visibility === "builtin" ? (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                          内置
                        </span>
                      ) : null}
                    </span>
                    {item.description ? (
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
