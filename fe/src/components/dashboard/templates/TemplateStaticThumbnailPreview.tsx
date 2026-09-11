import { cn } from "@/lib/utils";

type TemplateStaticThumbnailPreviewProps = {
  src: string;
  className?: string;
};

/** 与 Hub 卡片一致的静态示意图预览（对标 DataEase 模板弹窗） */
export function TemplateStaticThumbnailPreview({
  src,
  className,
}: TemplateStaticThumbnailPreviewProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[420px] w-full items-center justify-center bg-[#f0f2f5] p-3 sm:p-6",
        className,
      )}
      data-testid="template-static-thumbnail-preview"
    >
      <img
        src={src}
        alt=""
        className="h-full max-h-full w-full max-w-full rounded-lg object-contain shadow-theme-sm"
        decoding="async"
      />
    </div>
  );
}
