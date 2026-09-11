import { useState, type DragEvent } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { GalleryThumbFrame } from "@/components/dashboard/GalleryThumbFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RailDivider() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="h-px min-w-0 flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">或</span>
      <div className="h-px min-w-0 flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

type ImageUploadDropZoneProps = {
  onOpen: () => void;
  onFile: (file: File) => void;
  hasError?: boolean;
  label?: string;
};

export function ImageUploadDropZone({
  onOpen,
  onFile,
  hasError = false,
  label = "本地上传",
}: ImageUploadDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void onFile(file);
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
        hasError
          ? "border-error-300 bg-error-50/40 dark:border-error-500/40 dark:bg-error-500/10"
          : dragOver
            ? "border-brand-400 bg-brand-50/60 dark:border-brand-500/50 dark:bg-brand-500/10"
            : "border-gray-200 bg-gray-50/50 hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-white/[0.02] dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5",
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full",
          dragOver
            ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
            : "bg-white text-gray-500 shadow-theme-xs dark:bg-gray-900 dark:text-gray-400",
        )}
      >
        <Upload className="size-4" aria-hidden />
      </span>
      <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className="text-[10px] leading-snug text-gray-400 dark:text-gray-500">
        点击选择或拖拽图片到此处
      </span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">JPG · PNG · WebP · SVG · 最大 2MB</span>
    </button>
  );
}

type ImagePreviewCardProps = {
  previewUrl: string;
  caption?: string;
  onReplace: () => void;
  onClear?: () => void;
  allowClear?: boolean;
  showReplace?: boolean;
  objectFit?: "cover" | "contain";
};

export function ImagePreviewCard({
  previewUrl,
  caption,
  onReplace,
  onClear,
  allowClear = true,
  showReplace = true,
  objectFit = "cover",
}: ImagePreviewCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      <GalleryThumbFrame className="h-28">
        <img
          key={previewUrl}
          src={previewUrl}
          alt=""
          className={cn(
            "h-full w-full",
            objectFit === "contain" ? "object-contain object-center" : "object-cover object-center",
          )}
          role="img"
          aria-label="图片预览"
        />
      </GalleryThumbFrame>
      <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-1.5 dark:border-gray-700">
        <p className="min-w-0 flex-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
          {caption ?? "已设置图片"}
        </p>
        {showReplace ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-[10px]"
            onClick={onReplace}
          >
            <ImagePlus className="size-3" aria-hidden />
            替换
          </Button>
        ) : null}
        {allowClear && onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 shrink-0 px-0 text-gray-500"
            aria-label="清除图片"
            onClick={onClear}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
