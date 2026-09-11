import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  ChartPreviewMock,
  CustomVizPreviewMock,
  FilterPreviewMock,
  MediaPreviewMock,
  TextPreviewMock,
} from "@/components/dashboard/viz-components/ComponentCardPreview";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthenticatedBlobUrl } from "@/hooks/useAuthenticatedBlobUrl";
import type { VizWidgetType } from "@/lib/vizComponents";
import { cn } from "@/lib/utils";

function PreviewMock({ widgetType }: { widgetType: VizWidgetType }) {
  if (widgetType === "filter") return <FilterPreviewMock />;
  if (widgetType === "text") return <TextPreviewMock />;
  if (widgetType === "media") return <MediaPreviewMock />;
  if (widgetType === "customViz") return <CustomVizPreviewMock />;
  return <ChartPreviewMock />;
}

type VizComponentThumbnailPreviewProps = {
  thumbnailUrl?: string | null;
  widgetType: VizWidgetType;
  className?: string;
};

/** 组件库 Hub 卡片：静态封面截图，无实时渲染 */
export function VizComponentThumbnailPreview({
  thumbnailUrl,
  widgetType,
  className,
}: VizComponentThumbnailPreviewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedPath = thumbnailUrl?.trim() || null;
  const { url: blobUrl, loading, error: fetchFailed } = useAuthenticatedBlobUrl(resolvedPath);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedPath]);

  if (resolvedPath && loading) {
    return (
      <Skeleton
        className={cn("h-full w-full rounded-none", className)}
        data-testid="viz-component-thumbnail-loading"
      />
    );
  }

  if (blobUrl && !imgFailed) {
    return (
      <img
        src={blobUrl}
        alt=""
        data-testid="viz-component-thumbnail"
        className={cn("absolute inset-0 h-full w-full object-cover object-top bg-gray-50 dark:bg-gray-900/60", className)}
        decoding="async"
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (resolvedPath && (imgFailed || fetchFailed)) {
    return (
      <div
        data-testid="viz-component-thumbnail-fallback"
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-gray-400",
          className,
        )}
      >
        <ImageIcon className="size-8 opacity-40" aria-hidden />
        <p className="text-theme-xs">封面截图加载失败，请重新保存</p>
      </div>
    );
  }

  return (
    <div data-testid="viz-component-thumbnail-placeholder" className={cn("relative h-full w-full", className)}>
      <PreviewMock widgetType={widgetType} />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-3">
        <p className="rounded bg-white/80 px-2 py-0.5 text-[10px] text-gray-500 shadow-sm dark:bg-gray-900/80 dark:text-gray-400">
          暂无封面，请保存或批量生成
        </p>
      </div>
    </div>
  );
}
