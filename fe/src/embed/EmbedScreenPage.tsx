import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { DataScreenPresenter } from "@/components/dashboard/screen/DataScreenPresenter";
import { useScreenAutoRefresh } from "@/components/dashboard/screen/useScreenAutoRefresh";
import type { PresentationMode } from "@/components/dashboard/screen/presentationScale";
import { localizeApiMessage } from "@/lib/apiError";
import { isEmbedPageAuthorized } from "./embedAccess";

type EmbedDashboardDetail = {
  id: string;
  name: string;
  layoutJson: DashboardLayout;
};

export function EmbedScreenPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const [searchParams] = useSearchParams();
  const parentOrigin = window.location.origin;
  const embedToken = searchParams.get("token");

  const presentationMode = (searchParams.get("mode") as PresentationMode | null) ?? "fit";
  const authorized = isEmbedPageAuthorized(searchParams, parentOrigin, Boolean(embedToken));

  const [detail, setDetail] = useState<EmbedDashboardDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(dashboardId && embedToken));

  useEffect(() => {
    if (!dashboardId) {
      setDetail(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (!embedToken) {
      setDetail(null);
      setLoadError("缺少嵌入令牌，请通过分享页签发链接");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ token: embedToken, dashboardId });
    void fetch(`/api/v1/embed/dashboard-layout?${qs.toString()}`)
      .then(async (resp) => {
        const body = (await resp.json().catch(() => ({}))) as {
          message?: string;
          layoutJson?: DashboardLayout;
        };
        if (!resp.ok) {
          throw new Error(localizeApiMessage(body.message || "加载大屏失败"));
        }
        return body as EmbedDashboardDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setLoadError(err instanceof Error ? localizeApiMessage(err.message) : "加载大屏失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, embedToken]);

  const refreshIntervalSec = detail?.layoutJson?.styleConfig?.refreshIntervalSec;
  const autoRefresh = useScreenAutoRefresh({
    refreshIntervalSec,
    enabled: Boolean(detail),
  });

  if (!authorized) {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white"
      >
        <p className="text-theme-lg font-medium text-error-400">当前来源未授权嵌入</p>
        <p className="text-theme-sm text-white/60">来源：{parentOrigin}</p>
      </div>
    );
  }

  if (!dashboardId) {
    return (
      <div role="alert" className="p-6 text-theme-sm text-error-600">
        缺少大屏 ID
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-theme-sm text-white/70">
        正在加载大屏…
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center"
      >
        <p className="text-theme-sm text-error-400">{loadError ?? "无法加载大屏"}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-950" data-embed-screen>
      <DataScreenPresenter
        layout={detail.layoutJson}
        presentationMode={presentationMode}
        globalChartRefreshKey={autoRefresh.globalChartRefreshKey}
        className="h-full min-h-0"
      />
    </div>
  );
}
