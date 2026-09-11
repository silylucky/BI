import type { Linkage } from "@/components/dashboard/dashboardFilterUtils";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { DashboardLayoutPreview } from "@/components/dashboard/DashboardLayoutPreview";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import type { DashboardPreviewProfile } from "@/lib/dashboardPreviewProfile";
import { CanvasScaleViewport } from "./CanvasScaleViewport";
import type { PresentationMode } from "./presentationScale";
import { DATA_SCREEN_EDIT_PRESENTATION_DEFAULT } from "./presentationScale";

export type DataScreenPresenterProps = {
  layout: DashboardLayout;
  presentationMode?: PresentationMode;
  linkage?: Linkage | null;
  filterValues?: Record<string, string>;
  onFilterValueChange?: (filterId: string, value: string) => void;
  globalChartRefreshKey?: number;
  className?: string;
  geo3dRenderTier?: Geo3dRenderTier;
  mountMaxConcurrent?: number;
  previewProfile?: DashboardPreviewProfile;
};

export function DataScreenPresenter({
  layout,
  presentationMode = DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  linkage = null,
  filterValues = {},
  onFilterValueChange,
  globalChartRefreshKey = 0,
  className,
  geo3dRenderTier = "full",
  mountMaxConcurrent,
  previewProfile = "default",
}: DataScreenPresenterProps) {
  if (layout.version !== 2) {
    return (
      <DashboardLayoutPreview
        layout={layout}
        linkage={linkage}
        filterValues={filterValues}
        onFilterValueChange={onFilterValueChange}
        className={className}
        geo3dRenderTier={geo3dRenderTier}
        mountMaxConcurrent={mountMaxConcurrent}
        previewProfile={previewProfile}
      />
    );
  }

  const { width, height } = layout.canvas;

  return (
    <CanvasScaleViewport
      canvasWidth={width}
      canvasHeight={height}
      mode={presentationMode}
      pinTopLeft
      className={className}
    >
      <div className="h-full w-full" style={{ width, height }}>
        <DashboardLayoutPreview
          layout={layout}
          linkage={linkage}
          filterValues={filterValues}
          onFilterValueChange={onFilterValueChange}
          fixedDesignViewport
          globalChartRefreshKey={globalChartRefreshKey}
          className="h-full w-full"
          geo3dRenderTier={geo3dRenderTier}
          mountMaxConcurrent={mountMaxConcurrent}
          previewProfile={previewProfile}
        />
      </div>
    </CanvasScaleViewport>
  );
}
