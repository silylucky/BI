import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { useDocumentFullscreen } from "@/hooks/useDocumentFullscreen";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { normalizeDashboardDetail } from "@/lib/resolveDashboardLayoutJson";
import {
  dashboardEditPath,
  dataScreenPreviewPath,
  isDataScreenLayout,
} from "@/lib/dataScreenLayout";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { DataScreenPresenter } from "@/components/dashboard/screen/DataScreenPresenter";
import { ScreenPreviewChrome } from "@/components/dashboard/screen/ScreenPreviewChrome";
import { useScreenAutoRefresh } from "@/components/dashboard/screen/useScreenAutoRefresh";
import type { PresentationMode } from "@/components/dashboard/screen/presentationScale";
import { DATA_SCREEN_EDIT_PRESENTATION_DEFAULT } from "@/components/dashboard/screen/presentationScale";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardDetail = {
  id: string;
  name: string;
  layoutJson: DashboardLayout;
};

export function DashboardPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(
    DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  );
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const { isFullscreen, toggleFullscreen } = useDocumentFullscreen();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = normalizeDashboardDetail(
        await apiFetch<DashboardDetail>(`/api/v1/dashboards/${id}`),
      );
      setDetail(data);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshIntervalSec = detail?.layoutJson?.styleConfig?.refreshIntervalSec;
  const autoRefresh = useScreenAutoRefresh({
    refreshIntervalSec,
    enabled: Boolean(detail),
  });

  if (loading) {
    return (
      <div className="flex h-dvh flex-col bg-slate-950 p-4">
        <Skeleton className="mb-3 h-10 w-full max-w-xl" />
        <Skeleton className="flex-1" />
      </div>
    );
  }

  if (error || !detail || !id) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-950 p-6">
        <PageErrorBanner message={error ?? "看板不存在"} onRetry={() => void load()} />
      </div>
    );
  }

  if (isDataScreenLayout(detail.layoutJson)) {
    return <Navigate to={dataScreenPreviewPath(id)} replace />;
  }

  const isDarkCanvas = detail.layoutJson.styleConfig?.colorScheme === "dark";

  return (
    <div
      className={`flex h-dvh min-h-0 flex-col ${isDarkCanvas ? "bg-slate-950 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-white"}`}
      data-dashboard-preview
    >
      <ScreenPreviewChrome
        title={detail.name}
        editPath={dashboardEditPath(id)}
        presentationMode={presentationMode}
        onPresentationModeChange={setPresentationMode}
        isFullscreen={isFullscreen}
        onFullscreen={toggleFullscreen}
        refreshIntervalSec={refreshIntervalSec}
        refreshLastAt={autoRefresh.lastAt}
        refreshCountdownSec={autoRefresh.countdownSec}
        refreshState={autoRefresh.state}
        onManualRefresh={autoRefresh.manualRefresh}
      />
      <div className="min-h-0 flex-1">
        <DataScreenPresenter
          layout={detail.layoutJson}
          presentationMode={presentationMode}
          filterValues={filterValues}
          onFilterValueChange={(filterId, value) =>
            setFilterValues((prev) => ({ ...prev, [filterId]: value }))
          }
          globalChartRefreshKey={autoRefresh.globalChartRefreshKey}
          className="h-full"
        />
      </div>
    </div>
  );
}
