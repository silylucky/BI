import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Button } from "@/components/ui/button";
import { SaveFormButton } from "@/components/ui/save-form-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChartEditRail } from "@/components/dashboard/ChartEditRail";
import { CustomVizEditRail } from "@/components/dashboard/custom-viz/CustomVizEditRail";
import { FilterWidgetInspector } from "@/components/dashboard/FilterWidgetInspector";
import { TextEditRail } from "@/components/dashboard/TextEditRail";
import { MediaEditRail } from "@/components/dashboard/MediaEditRail";
import { VizComponentEditLayout } from "@/components/dashboard/viz-components/VizComponentEditLayout";
import { VizComponentLivePreview } from "@/components/dashboard/viz-components/VizComponentLivePreview";
import { widgetTypeLabel } from "@/components/dashboard/viz-components/componentLabels";
import { useVizComponentEditor } from "@/hooks/useVizComponentEditor";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { mapApiError } from "@/lib/apiError";
import { vizComponentPreviewDashboardStyle } from "@/lib/vizComponentPreviewStyle";
import type {
  DashboardStyleConfig,
  FilterWidgetConfig,
  MediaWidgetConfig,
  TextWidgetConfig,
  CustomVizWidgetConfig,
} from "@/components/dashboard/layoutUtils";

function EditPageSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto]">
      <Skeleton className="min-h-0 flex-1 rounded-xl" />
      <Skeleton className="h-full w-[432px] shrink-0 rounded-xl" />
    </div>
  );
}

function ComponentEditRail({
  componentId,
  contentRevision,
  widget,
  patchWidget,
  dashboardStyle,
}: {
  componentId: string;
  contentRevision: number;
  widget: NonNullable<ReturnType<typeof useVizComponentEditor>["widget"]>;
  patchWidget: ReturnType<typeof useVizComponentEditor>["patchWidget"];
  dashboardStyle: DashboardStyleConfig;
}) {
  if (widget.type === "chart") {
    return (
      <ChartEditRail
        key={`${componentId}-${contentRevision}`}
        className="min-h-0 flex-1"
        widget={widget}
        onTitleChange={(name) => patchWidget({ title: name })}
        onChange={(chartConfig) => patchWidget({ chartConfig })}
      />
    );
  }
  if (widget.type === "filter" && widget.filterConfig) {
    return (
      <FilterWidgetInspector
        embedded
        widget={widget as typeof widget & { filterConfig: FilterWidgetConfig }}
        onChange={(filterConfig) => patchWidget({ filterConfig })}
      />
    );
  }
  if (widget.type === "text" && widget.textConfig) {
    return (
      <TextEditRail
        className="min-h-0 flex-1"
        widget={widget as typeof widget & { textConfig: TextWidgetConfig }}
        onTitleChange={(name) => patchWidget({ title: name })}
        onConfigChange={(textConfig) => patchWidget({ textConfig })}
      />
    );
  }
  if (widget.type === "media" && widget.mediaConfig) {
    return (
      <MediaEditRail
        className="min-h-0 flex-1"
        widget={widget as typeof widget & { mediaConfig: MediaWidgetConfig }}
        onTitleChange={(name) => patchWidget({ title: name })}
        onChange={(mediaConfig) => patchWidget({ mediaConfig })}
      />
    );
  }
  if (widget.type === "customViz" && widget.customVizConfig) {
    return (
      <CustomVizEditRail
        key={`${componentId}-${contentRevision}`}
        className="min-h-0 flex-1"
        dashboardStyle={dashboardStyle}
        widget={widget as typeof widget & { customVizConfig: CustomVizWidgetConfig }}
        onTitleChange={(name) => patchWidget({ title: name })}
        onChange={(customVizConfig) => patchWidget({ customVizConfig })}
      />
    );
  }
  return null;
}

export function VizComponentEditPage() {
  const { id } = useParams<{ id: string }>();
  const {
    component,
    widget,
    saving,
    isDirty,
    isLoading,
    isError,
    error,
    refetch,
    save,
    patchWidget,
  } = useVizComponentEditor(id);

  const title = component?.name ?? "编辑组件";
  const typeMeta = component
    ? `${widgetTypeLabel(component.widgetType)} · v${component.contentRevision}`
    : null;

  const previewDashboardStyle = useMemo(() => vizComponentPreviewDashboardStyle(), []);

  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: Boolean(component && widget && isDirty),
  });

  const handleSaveAndLeave = async () => {
    const ok = await save();
    if (ok) confirmLeave();
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/viz-components">
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">返回</span>
        </Link>
      </Button>

      {component && widget ? (
        <>
          <span
            className="hidden h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block"
            aria-hidden
          />
          <SaveFormButton
            type="button"
            variant="primary"
            size="sm"
            isDirty={isDirty}
            saving={saving}
            onClick={() => void save()}
          />
        </>
      ) : null}
    </div>
  );

  const pageDescription =
    component && widget
      ? isDirty
        ? "有未保存的更改 · 保存后生效"
        : typeMeta
          ? `已保存 · ${typeMeta}`
          : "已保存"
      : undefined;

  return (
    <AdminPageShell
      layout="fill"
      title={title}
      description={pageDescription}
      className="min-h-0"
      actions={headerActions}
    >
      {isLoading ? (
        <EditPageSkeleton />
      ) : isError ? (
        <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
      ) : !component || !widget ? (
        <PageErrorBanner message="组件不存在或无权访问" />
      ) : (
        <VizComponentEditLayout
          preview={
            <VizComponentLivePreview
              widget={widget}
              dashboardStyle={previewDashboardStyle}
              onChartConfigChange={(chartConfig) => patchWidget({ chartConfig })}
            />
          }
          rail={
            <ComponentEditRail
              componentId={component.id}
              contentRevision={component.contentRevision}
              widget={widget}
              patchWidget={patchWidget}
              dashboardStyle={previewDashboardStyle}
            />
          }
        />
      )}
      {component && widget ? (
        <AlertDialog open={leaveDialogOpen} onOpenChange={(open) => !open && cancelLeave()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>未保存的更改</AlertDialogTitle>
              <AlertDialogDescription>
                组件有未保存的修改，离开后将丢失。请先保存，或确认放弃更改。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel onClick={cancelLeave}>留在此页</AlertDialogCancel>
              <AlertDialogAction variant="outline" onClick={confirmLeave}>
                放弃更改并离开
              </AlertDialogAction>
              <SaveFormButton
                type="button"
                variant="primary"
                size="sm"
                isDirty={isDirty}
                saving={saving}
                saveLabel="保存并离开"
                onClick={() => void handleSaveAndLeave()}
              />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </AdminPageShell>
  );
}
