import type { VizWidgetType } from "@/lib/vizComponents";
import { ComponentPreviewShell } from "./ComponentCardPreview";
import { VizComponentThumbnailPreview } from "./VizComponentThumbnailPreview";

type ComponentPayloadPreviewProps = {
  widgetType: VizWidgetType;
  thumbnailUrl?: string | null;
  className?: string;
};

/** 组件库 Hub 卡片预览：静态封面截图，元信息由 VizComponentCard 正文展示。 */
export function ComponentPayloadPreview({
  widgetType,
  thumbnailUrl,
  className,
}: ComponentPayloadPreviewProps) {
  return (
    <ComponentPreviewShell className={className}>
      <VizComponentThumbnailPreview thumbnailUrl={thumbnailUrl} widgetType={widgetType} />
    </ComponentPreviewShell>
  );
}
