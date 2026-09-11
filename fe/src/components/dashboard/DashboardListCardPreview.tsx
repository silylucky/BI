import { LayoutDashboard } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CHART_MOUNT_MAX_EDIT } from "@/components/charts/ChartMountContext";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import {
  ListPreviewSlotResetError,
} from "@/lib/listPreviewActivation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAdminHeavyRenderSuspended } from "@/hooks/useAdminHeavyRenderSuspended";
import { useDashboardListCardLayout } from "@/hooks/useDashboardListCardLayout";
import { isDataScreenLayout } from "@/lib/dataScreenLayout";
import {
  releaseListPreviewSlot,
  requestListPreviewSlot,
  unregisterListPreviewWaiter,
  updateListPreviewPriority,
} from "@/lib/listPreviewActivation";
import { DashboardLayoutPreview } from "./DashboardLayoutPreview";
import { DataScreenPresenter } from "./screen/DataScreenPresenter";
import { prepareLayoutForListPreview } from "./stylePipeline";
import { TemplateGridFitPreview } from "@/components/dashboard/templates/TemplateGridFitPreview";
import type { DashboardLayout } from "./layoutUtils";

type DashboardListCardPreviewProps = {
  dashboardId?: string;
  layoutJson?: DashboardLayout;
  className?: string;
  /** 测试用：跳过后台懒加载，直接挂载真实预览 */
  eager?: boolean;
};

function layoutHasFullChartConfig(layout?: DashboardLayout): boolean {
  if (!layout?.widgets?.length) return false;
  return layout.widgets.some((w) => {
    if (w.type !== "chart") return true;
    const cfg = w.chartConfig;
    if (!cfg) return false;
    return Boolean(
      cfg.dataSourceId ||
        cfg.datasetId ||
        cfg.sql ||
        cfg.table ||
        cfg.bindingId,
    );
  });
}

/**
 * 看板列表卡片真实预览：视口内挂载完整布局，card 档位降级查询与特效。
 */
export function DashboardListCardPreview({
  dashboardId,
  layoutJson,
  className,
  eager = false,
}: DashboardListCardPreviewProps) {
  const navSuspended = useAdminHeavyRenderSuspended();
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const previewKey = dashboardId ?? `layout-preview-${instanceId}`;
  const hasFullLayout = layoutHasFullChartConfig(layoutJson);
  const [active, setActive] = useState(eager);
  const [slotGranted, setSlotGranted] = useState(eager);
  const [intersectionPriority, setIntersectionPriority] = useState(eager ? 1 : 0);
  const shouldFetch = Boolean(dashboardId && !hasFullLayout);
  const liveEligible = eager || active;
  const layoutQuery = useDashboardListCardLayout(
    dashboardId,
    liveEligible && slotGranted && shouldFetch && !navSuspended,
  );
  const rawLayout = layoutQuery.data ?? layoutJson;
  const resolvedLayout = useMemo(
    () => (rawLayout ? prepareLayoutForListPreview(rawLayout) : undefined),
    [rawLayout],
  );
  const isScreen = isDataScreenLayout(resolvedLayout ?? layoutJson);
  const loading = liveEligible && slotGranted && shouldFetch && layoutQuery.isLoading;

  useEffect(() => {
    if (navSuspended) {
      setSlotGranted((prev) => {
        if (prev && !eager) return false;
        return prev;
      });
      if (!eager) {
        setActive(false);
        unregisterListPreviewWaiter(previewKey);
      }
      return undefined;
    }
    if (!liveEligible || slotGranted || eager) return undefined;
    let cancelled = false;
    void requestListPreviewSlot({ key: previewKey, priority: intersectionPriority })
      .then(() => {
        if (!cancelled) setSlotGranted(true);
      })
      .catch((err) => {
        if (cancelled || err instanceof ListPreviewSlotResetError) return;
        console.warn("[list-preview] slot request failed", err);
      });
    return () => {
      cancelled = true;
      unregisterListPreviewWaiter(previewKey);
    };
  }, [
    liveEligible,
    slotGranted,
    eager,
    navSuspended,
    previewKey,
    intersectionPriority,
  ]);

  useEffect(() => {
    if (!slotGranted || eager) return undefined;
    return () => releaseListPreviewSlot(previewKey);
  }, [slotGranted, eager, previewKey]);

  useEffect(() => {
    if (!liveEligible || navSuspended) return undefined;
    setChartAnimationSuppressed(true);
    return () => setChartAnimationSuppressed(false);
  }, [liveEligible, navSuspended]);

  useEffect(() => {
    if (eager) {
      setActive(true);
      setIntersectionPriority(1);
      return undefined;
    }
    const el = hostRef.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      setIntersectionPriority(1);
      return undefined;
    }

    const leaveViewport = () => {
      setActive(false);
      setSlotGranted(false);
      unregisterListPreviewWaiter(previewKey);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (navSuspended) return;
        if (entry?.isIntersecting) {
          const ratio = entry.intersectionRatio;
          setActive(true);
          setIntersectionPriority(ratio);
          updateListPreviewPriority(previewKey, ratio);
        } else {
          leaveViewport();
        }
      },
      { rootMargin: "80px" },
    );
    observer.observe(el);

    const syncVisible = () => {
      if (navSuspended) return;
      const rect = el.getBoundingClientRect();
      const margin = 80;
      if (rect.bottom >= -margin && rect.top <= window.innerHeight + margin) {
        setActive(true);
        setIntersectionPriority(1);
        updateListPreviewPriority(previewKey, 1);
      }
    };
    syncVisible();
    if (!navSuspended) {
      requestAnimationFrame(syncVisible);
    }

    return () => {
      observer.disconnect();
      unregisterListPreviewWaiter(previewKey);
    };
  }, [eager, dashboardId, navSuspended, previewKey]);

  const hasWidgets =
    Boolean(resolvedLayout?.widgets?.length) || Boolean(layoutJson?.widgets?.length);

  if (!hasWidgets) {
    return (
      <div
        ref={hostRef}
        className={cn(
          "flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900/60",
          isScreen && "bg-slate-950",
          className,
        )}
        data-testid="dashboard-list-card-preview"
        aria-hidden
      >
        <LayoutDashboard className="size-10 text-gray-300 dark:text-gray-600" aria-hidden />
      </div>
    );
  }

  const showLive =
    !navSuspended && liveEligible && slotGranted && !loading && Boolean(resolvedLayout);

  return (
    <div
      ref={hostRef}
      className={cn(
        "dashboard-canvas-surface dashboard-list-card-preview relative h-full overflow-hidden",
        isScreen ? "bg-slate-950" : "bg-white dark:bg-gray-900/60",
        !navSuspended &&
          "transition-[filter,transform] duration-300 group-hover:scale-[1.02] group-hover:blur-[2px]",
        className,
      )}
      data-testid="dashboard-list-card-preview"
      data-live={showLive ? "true" : "false"}
      data-preview-profile="card"
      aria-hidden
    >
      {showLive ? (
        <div className="h-full w-full" data-testid="dashboard-list-card-live-preview">
          {isScreen ? (
            <DataScreenPresenter
              layout={resolvedLayout!}
              presentationMode="fit"
              previewProfile="card"
              geo3dRenderTier="thumbnail"
              mountMaxConcurrent={CHART_MOUNT_MAX_EDIT}
              className="pointer-events-none h-full min-h-0 select-none"
            />
          ) : resolvedLayout!.version === 1 ? (
            <TemplateGridFitPreview layout={resolvedLayout!} fitMode="card">
              <DashboardLayoutPreview
                layout={resolvedLayout!}
                scaleMode="component"
                previewProfile="card"
                geo3dRenderTier="thumbnail"
                mountMaxConcurrent={CHART_MOUNT_MAX_EDIT}
                className="pointer-events-none min-h-0 select-none"
              />
            </TemplateGridFitPreview>
          ) : (
            <DashboardLayoutPreview
              layout={resolvedLayout!}
              scaleMode="component"
              previewProfile="card"
              geo3dRenderTier="thumbnail"
              mountMaxConcurrent={CHART_MOUNT_MAX_EDIT}
              className="pointer-events-none h-full min-h-0 select-none [&_.pixel-canvas-host]:h-full [&_.pixel-canvas-host]:min-h-0 [&_.pixel-canvas-host]:overflow-hidden"
            />
          )}
        </div>
      ) : (
        <Skeleton
          className="h-full w-full rounded-none"
          data-testid="dashboard-list-card-preview-skeleton"
        />
      )}
    </div>
  );
}
