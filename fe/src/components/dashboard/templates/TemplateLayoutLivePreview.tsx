import { DashboardLayoutPreview } from "@/components/dashboard/DashboardLayoutPreview";
import { DataScreenPresenter } from "@/components/dashboard/screen/DataScreenPresenter";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import type { DashboardTemplateListItem } from "@/lib/dashboardTemplates";
import { CanvasScaleViewport } from "@/components/dashboard/screen/CanvasScaleViewport";
import { TemplateGridFitPreview } from "@/components/dashboard/templates/TemplateGridFitPreview";
import type { TemplateGridFitMode } from "@/components/dashboard/templates/templateGridFitScale";
import { cn } from "@/lib/utils";

type TemplateLayoutLivePreviewProps = {
  layout: DashboardLayout;
  surfaceKind: DashboardTemplateListItem["surfaceKind"];
  className?: string;
  geo3dRenderTier?: Geo3dRenderTier;
  demoDatasourceMissing?: boolean;
  /** card=Hub 缩略图；dialog=全屏预览弹窗 */
  variant?: "card" | "dialog";
};

/** 模板布局实时预览（Hub 卡片 / 预览弹窗共用） */
export function TemplateLayoutLivePreview({
  layout,
  surfaceKind,
  className,
  geo3dRenderTier = "thumbnail",
  demoDatasourceMissing = false,
  variant = "card",
}: TemplateLayoutLivePreviewProps) {
  const isScreen = surfaceKind === "data-screen";
  const gridFitMode: TemplateGridFitMode = variant === "dialog" ? "dialog" : "card";
  const effectiveTier = variant === "dialog" && geo3dRenderTier === "thumbnail" ? "embed" : geo3dRenderTier;

  return (
    <div
      className={cn("relative h-full w-full", className)}
      data-testid="template-layout-live-preview"
      data-preview-variant={variant}
    >
      {demoDatasourceMissing ? (
        <p
          className="pointer-events-none absolute inset-x-0 top-2 z-20 mx-auto max-w-[90%] rounded-md bg-amber-50/90 px-2 py-1 text-center text-[10px] leading-snug text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 sm:text-theme-xs"
          data-testid="template-demo-ds-hint"
        >
          请先在数据连接中配置 sample_db 演示数据源以预览真实图表
        </p>
      ) : null}
      {isScreen ? (
        <DataScreenPresenter
          layout={layout}
          presentationMode="fit"
          geo3dRenderTier={effectiveTier}
          className="pointer-events-none h-full min-h-0 select-none"
        />
      ) : layout.version === 1 ? (
        <TemplateGridFitPreview layout={layout} fitMode={gridFitMode}>
          <DashboardLayoutPreview
            layout={layout}
            styleConfig={layout.styleConfig}
            scaleMode="component"
            geo3dRenderTier={effectiveTier}
            mountMaxConcurrent={8}
            className="pointer-events-none min-h-0 w-full select-none"
          />
        </TemplateGridFitPreview>
      ) : (
        <CanvasScaleViewport
          canvasWidth={layout.canvas.width}
          canvasHeight={layout.canvas.height}
          mode="fit"
          className="h-full w-full"
        >
          <DashboardLayoutPreview
            layout={layout}
            styleConfig={layout.styleConfig}
            fixedDesignViewport
            geo3dRenderTier={effectiveTier}
            mountMaxConcurrent={8}
            className="pointer-events-none h-full w-full select-none"
          />
        </CanvasScaleViewport>
      )}
    </div>
  );
}
