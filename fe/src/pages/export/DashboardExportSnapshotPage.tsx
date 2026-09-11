import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { DashboardLayoutPreview } from "@/components/dashboard/DashboardLayoutPreview";
import { DataScreenPresenter } from "@/components/dashboard/screen/DataScreenPresenter";
import { fetchExportLayout } from "@/lib/exportSnapshot";
import {
  EXPORT_LAYOUT_MODE_LABELS,
  EXPORT_SECTION_LABELS,
  parseExportLayoutMode,
  type ExportLayoutMode,
} from "@/lib/exportLayoutMode";
import {
  layoutWithEnlargedWidget,
  layoutWithSingleWidget,
  listExportWidgets,
  widgetDisplayTitle,
} from "@/lib/exportLayoutWidgets";
import { DASHBOARD_THUMBNAIL_CAPTURE_ATTR } from "@/lib/captureDashboardThumbnail";
import "./exportSnapshotPrint.css";

type ExportDetail = {
  id: string;
  name: string;
  layoutJson: DashboardLayout;
  surfaceKind: "dashboard" | "data-screen";
};

type DashboardExportSnapshotPageProps = {
  surface: "dashboard" | "data-screen";
};

function formatExportTimestamp(date: Date): string {
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeFilters(layout: DashboardLayout): string | null {
  const filters = layout.globalFilters ?? [];
  if (filters.length === 0) return null;
  return `已应用 ${filters.length} 项全局筛选`;
}

function ExportModeBanner({ mode }: { mode: ExportLayoutMode }) {
  const copy = EXPORT_LAYOUT_MODE_LABELS[mode];
  return (
    <div className="export-mode-banner" data-export-mode-banner={mode}>
      <strong>{copy.title}</strong>
      <p>{copy.hint}</p>
    </div>
  );
}

function ExportSectionBanner({
  title,
  hint,
  variant = "overview",
}: {
  title: string;
  hint: string;
  variant?: "overview" | "detail";
}) {
  return (
    <div
      className={
        variant === "detail"
          ? "export-section-banner export-section-banner--detail"
          : "export-section-banner"
      }
    >
      <strong>{title}</strong>
      <p>{hint}</p>
    </div>
  );
}

function OverviewCanvas({
  layout,
  isScreen,
  layoutMode,
}: {
  layout: DashboardLayout;
  isScreen: boolean;
  layoutMode: ExportLayoutMode;
}) {
  const fitContent = layoutMode === "full_page";
  if (isScreen && layout.version === 2) {
    return (
      <DataScreenPresenter
        layout={layout}
        presentationMode="original"
        className={fitContent ? "min-h-0" : "min-h-[calc(100dvh-4rem)]"}
      />
    );
  }
  return (
    <div
      className={fitContent ? "p-0" : "min-h-[calc(100dvh-4rem)] p-0"}
      data-export-widget-shell
      {...{ [DASHBOARD_THUMBNAIL_CAPTURE_ATTR]: "" }}
    >
      <DashboardLayoutPreview layout={layout} className={fitContent ? "min-h-0" : "min-h-full"} />
    </div>
  );
}

function PerWidgetPages({
  layout,
  widgets,
  enlarged = false,
}: {
  layout: DashboardLayout;
  widgets: ReturnType<typeof listExportWidgets>;
  enlarged?: boolean;
}) {
  return (
    <div className="export-per-widget-stack">
      {widgets.map((widget, index) => (
        <section
          key={widget.id}
          className={enlarged ? "export-widget-page export-widget-page-enlarged" : "export-widget-page"}
          data-export-widget-page
          data-export-widget-shell
        >
          <p className="export-widget-page-label">
            组件 {index + 1}/{widgets.length} · {widgetDisplayTitle(widget)}
            {enlarged ? "（放大）" : ""}
          </p>
          <DashboardLayoutPreview
            layout={
              enlarged
                ? layoutWithEnlargedWidget(layout, widget)
                : layoutWithSingleWidget(layout, widget)
            }
            className={enlarged ? "export-widget-enlarged-canvas" : "min-h-[60vh]"}
          />
        </section>
      ))}
    </div>
  );
}

export function DashboardExportSnapshotPage({ surface }: DashboardExportSnapshotPageProps) {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const layoutMode = parseExportLayoutMode(searchParams.get("layoutMode"));
  const [detail, setDetail] = useState<ExportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const generatedAt = useMemo(() => formatExportTimestamp(new Date()), [detail?.id]);
  const exportWidgets = useMemo(
    () => (detail ? listExportWidgets(detail.layoutJson) : []),
    [detail],
  );

  useEffect(() => {
    if (!id || !token) {
      setError("缺少 export token");
      return;
    }
    let cancelled = false;
    void fetchExportLayout(id, token)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "无法加载看板");
      });
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    if (!detail) return;
    const perWidgetMs = exportWidgets.length * (layoutMode === "combined" ? 500 : 250);
    const settleMs =
      layoutMode === "combined"
        ? 2200 + perWidgetMs
        : layoutMode === "per_widget"
          ? 1800 + perWidgetMs
          : 1400;
    const timer = window.setTimeout(() => setReady(true), settleMs);
    return () => window.clearTimeout(timer);
  }, [detail, exportWidgets.length, layoutMode]);

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-950 p-6 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <div className="h-dvh bg-gray-950" data-export-loading />;
  }

  const isScreen = surface === "data-screen" || detail.surfaceKind === "data-screen";
  const layout = detail.layoutJson;
  const filterSummary = summarizeFilters(layout);
  const rootClass =
    layoutMode === "per_widget" || layoutMode === "combined"
      ? "export-snapshot-root export-layout-per-widget min-h-dvh bg-gray-950 text-white"
      : "export-snapshot-root export-layout-full-page bg-gray-950 text-white";

  return (
    <div
      className={rootClass}
      data-export-snapshot
      data-export-layout-mode={layoutMode}
      data-export-ready={ready ? "true" : undefined}
      {...{ [DASHBOARD_THUMBNAIL_CAPTURE_ATTR]: "" }}
    >
      <header className="export-snapshot-header border-b border-white/10 bg-gray-900/95 px-6 py-3 print:border-gray-300 print:bg-white print:text-gray-900">
        <p className="text-lg font-semibold tracking-tight">{detail.name}</p>
        <p className="mt-0.5 text-xs text-gray-400 print:text-gray-600">
          {isScreen ? "数据大屏" : "仪表板"} · 生成时间 {generatedAt}
          {filterSummary ? ` · ${filterSummary}` : ""}
          {" · "}
          {EXPORT_LAYOUT_MODE_LABELS[layoutMode].badge}
        </p>
      </header>
      <main className="export-snapshot-body px-4 py-4 print:px-6 print:py-4">
        {layoutMode === "combined" ? (
          <>
            <section className="export-combined-overview">
              <ExportSectionBanner
                title={EXPORT_SECTION_LABELS.overview.title}
                hint={EXPORT_SECTION_LABELS.overview.hint}
              />
              <OverviewCanvas layout={layout} isScreen={isScreen} layoutMode={layoutMode} />
            </section>
            <section className="export-combined-detail">
              <ExportSectionBanner
                title={EXPORT_SECTION_LABELS.enlarged.title}
                hint={EXPORT_SECTION_LABELS.enlarged.hint}
                variant="detail"
              />
              <PerWidgetPages layout={layout} widgets={exportWidgets} enlarged />
            </section>
          </>
        ) : (
          <>
            <ExportModeBanner mode={layoutMode} />
            {layoutMode === "per_widget" ? (
              <PerWidgetPages layout={layout} widgets={exportWidgets} />
            ) : (
              <OverviewCanvas layout={layout} isScreen={isScreen} layoutMode={layoutMode} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
