import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { VizComponentLivePreview } from "@/components/dashboard/viz-components/VizComponentLivePreview";
import type { DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

const STUDIO_WIDTH = 864;
const STUDIO_HEIGHT = 540;

type VizComponentThumbnailBatchStudioProps = {
  widget: LayoutWidget | null;
  studioKey: number;
  dashboardStyle: DashboardStyleConfig;
};

/** 离屏渲染组件预览，供 Hub 批量截图；须保持固定 16:10 尺寸。 */
export function VizComponentThumbnailBatchStudio({
  widget,
  studioKey,
  dashboardStyle,
}: VizComponentThumbnailBatchStudioProps) {
  if (!widget) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 -left-[2400px]"
      style={{ width: STUDIO_WIDTH, height: STUDIO_HEIGHT }}
      aria-hidden
      data-testid="viz-component-thumbnail-batch-studio"
    >
      <VizComponentLivePreview
        key={studioKey}
        widget={widget}
        dashboardStyle={dashboardStyle}
        className="h-full w-full"
      />
    </div>
  );
}
