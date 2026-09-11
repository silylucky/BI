import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, LayoutDashboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { readSurfaceKind } from "@/lib/dataScreenLayout";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import { pixelWidgetToLayoutWidget } from "./dashboardCanvasMode";
import {
  coerceLayoutWidgets,
  type DashboardLayout,
  type LayoutWidget,
  type PixelLayoutWidget,
} from "./layoutUtils";
import { cloneLayoutWidget } from "./cloneLayoutWidget";
import { clonePixelLayoutWidget } from "./pixelCanvas/createPixelWidget";
import { instantiateVizComponentWidget, resolveWidgetForCrossDashboardCopy } from "@/lib/vizComponentEdit";
import {
  fetchVizComponent,
  fetchVizComponents,
  type VizComponentListItem,
  VIZ_COMPONENT_CATEGORIES,
} from "@/lib/vizComponents";

type DashboardListItem = { id: string; name: string };

type VizReuseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDashboardId?: string;
  widgets: LayoutWidget[];
  styleConfig?: DashboardStyleConfig;
  targetPixelWidgets?: PixelLayoutWidget[];
  onInsertCloned: (widget: LayoutWidget, sourcePixel?: PixelLayoutWidget) => void;
  onAfterLibraryInsert?: () => void;
};

function LibraryTab({
  styleConfig,
  onPick,
}: {
  styleConfig?: DashboardStyleConfig;
  onPick: (component: VizComponentListItem) => void;
}) {
  const surfaceKind = readSurfaceKind(styleConfig);
  const [q, setQ] = useState("");
  const [categoryKey, setCategoryKey] = useState("");

  const listQuery = useQuery({
    queryKey: queryKeys.vizComponents.list({ surfaceKind, q, categoryKey }),
    queryFn: () =>
      fetchVizComponents({
        surfaceKind,
        q: q || undefined,
        categoryKey: categoryKey || undefined,
        limit: 50,
      }),
  });

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索组件名称…"
        aria-label="搜索组件"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={categoryKey === "" ? "default" : "outline"}
          onClick={() => setCategoryKey("")}
        >
          全部
        </Button>
        {VIZ_COMPONENT_CATEGORIES.map((cat) => (
          <Button
            key={cat.key}
            type="button"
            size="sm"
            variant={categoryKey === cat.key ? "default" : "outline"}
            onClick={() => setCategoryKey(cat.key)}
          >
            {cat.label}
          </Button>
        ))}
      </div>
      <div className="custom-scrollbar max-h-[min(40vh,280px)] overflow-y-auto">
        {listQuery.isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : listQuery.data?.items.length === 0 ? (
          <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            暂无已发布组件
          </p>
        ) : (
          <ul className="grid gap-2">
            {listQuery.data?.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 text-left",
                    "hover:border-brand-500/40 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]",
                  )}
                  onClick={() => onPick(item)}
                >
                  <Boxes className="mt-0.5 size-4 shrink-0 text-gray-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-theme-sm font-medium text-gray-900 dark:text-white/90">
                      {item.name}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {item.widgetType} · v{item.contentRevision}
                      {typeof item.referenceCount === "number"
                        ? ` · 引用 ${item.referenceCount}`
                        : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DashboardCopyTab({
  currentDashboardId,
  widgets,
  targetPixelWidgets,
  onInsertCloned,
  onClose,
}: {
  currentDashboardId?: string;
  widgets: LayoutWidget[];
  targetPixelWidgets?: PixelLayoutWidget[];
  onInsertCloned: VizReuseDialogProps["onInsertCloned"];
  onClose: () => void;
}) {
  const [dashboardId, setDashboardId] = useState("");
  const [widgetId, setWidgetId] = useState("");

  const { data: listData } = useQuery({
    queryKey: queryKeys.dashboards.list({ limit: 50, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: DashboardListItem[] }>("/api/v1/dashboards?limit=50&offset=0"),
  });

  const { data: sourceDashboard, isFetching } = useQuery({
    queryKey: ["dashboards", "detail", dashboardId],
    queryFn: () =>
      apiFetch<{ layoutJson: DashboardLayout }>(`/api/v1/dashboards/${dashboardId}`),
    enabled: Boolean(dashboardId),
  });

  const sourceLayout = sourceDashboard?.layoutJson;
  const sourceWidgets = !sourceLayout
    ? []
    : sourceLayout.version === 1
      ? coerceLayoutWidgets(sourceLayout.widgets)
      : sourceLayout.widgets.map(pixelWidgetToLayoutWidget);

  const reusable = sourceWidgets.filter((w) => !w.parentTabsId && w.type !== "tabs");
  const dashboards = (listData?.items ?? []).filter((d) => d.id !== currentDashboardId);
  const [copying, setCopying] = useState(false);

  const handleConfirm = async () => {
    setCopying(true);
    try {
      if (sourceLayout?.version === 2) {
        const sourcePixel = sourceLayout.widgets.find((w) => w.id === widgetId);
        if (!sourcePixel) return;
        const resolved = await resolveWidgetForCrossDashboardCopy(
          pixelWidgetToLayoutWidget(sourcePixel),
        );
        const inlinePixel: PixelLayoutWidget = {
          ...sourcePixel,
          componentRef: undefined,
          ...(resolved.type === "chart" && resolved.chartConfig
            ? { chartConfig: resolved.chartConfig }
            : {}),
          ...(resolved.type === "filter" && resolved.filterConfig
            ? { filterConfig: resolved.filterConfig }
            : {}),
          ...(resolved.type === "text" && resolved.textConfig
            ? { textConfig: resolved.textConfig }
            : {}),
          ...(resolved.type === "media" && resolved.mediaConfig
            ? { mediaConfig: resolved.mediaConfig }
            : {}),
        };
        const clonedPixel = clonePixelLayoutWidget(inlinePixel, targetPixelWidgets ?? []);
        onInsertCloned(pixelWidgetToLayoutWidget(clonedPixel), clonedPixel);
      } else {
        const source = sourceWidgets.find((w) => w.id === widgetId);
        if (!source) return;
        const resolved = await resolveWidgetForCrossDashboardCopy(source);
        onInsertCloned(cloneLayoutWidget(resolved, widgets));
      }
      toast.info("已插入副本", {
        description: "可在右侧配置栏将组件发布到组织库，便于跨看板复用。",
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-4 py-1">
      <div className="space-y-1.5">
        <Label>来源看板</Label>
        <Select value={dashboardId} onValueChange={(v) => { setDashboardId(v); setWidgetId(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="选择看板" />
          </SelectTrigger>
          <SelectContent>
            {dashboards.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>组件</Label>
        <Select value={widgetId} onValueChange={setWidgetId} disabled={!dashboardId || isFetching}>
          <SelectTrigger>
            <SelectValue placeholder={isFetching ? "加载中…" : "选择组件"} />
          </SelectTrigger>
          <SelectContent>
            {reusable.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.title} ({w.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter className="px-0">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="button" disabled={!widgetId || copying} onClick={() => void handleConfirm()}>
          {copying ? "复制中…" : "插入副本"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function VizReuseDialog({
  open,
  onOpenChange,
  currentDashboardId,
  widgets,
  styleConfig,
  targetPixelWidgets,
  onInsertCloned,
  onAfterLibraryInsert,
}: VizReuseDialogProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"library" | "dashboard">("library");

  useEffect(() => {
    if (!open) setTab("library");
  }, [open]);

  const handleLibraryPick = (component: VizComponentListItem) => {
    void (async () => {
      try {
        const detail = await fetchVizComponent(component.id);
        const instance = instantiateVizComponentWidget(detail, widgets);
        onInsertCloned(instance);
        void queryClient.invalidateQueries({ queryKey: queryKeys.vizComponents.all });
        onAfterLibraryInsert?.();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "插入失败");
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="reuse-widget-dialog">
        <DialogHeader>
          <DialogTitle>复用组件</DialogTitle>
          <DialogDescription>
            从组织组件库插入当前快照到本看板，之后数据和样式只属于本页；或从其他看板复制。
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/5">
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-theme-xs font-medium",
              tab === "library"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400",
            )}
            onClick={() => setTab("library")}
          >
            <Boxes className="size-3.5" aria-hidden />
            组织组件库
          </button>
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-theme-xs font-medium",
              tab === "dashboard"
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-600 dark:text-gray-400",
            )}
            onClick={() => setTab("dashboard")}
          >
            <LayoutDashboard className="size-3.5" aria-hidden />
            从其他看板
          </button>
        </div>
        {tab === "library" ? (
          <>
            <LibraryTab styleConfig={styleConfig} onPick={handleLibraryPick} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DashboardCopyTab
            currentDashboardId={currentDashboardId}
            widgets={widgets}
            targetPixelWidgets={targetPixelWidgets}
            onInsertCloned={onInsertCloned}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
