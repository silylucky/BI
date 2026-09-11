import { useRef, useState } from "react";
import {
  BACKGROUND_IMAGE_GALLERY_SCOPE,
  findTemplateAssetByUrl,
  galleryPreviewUrl,
  resolveTemplateAssetUrl,
  type TemplateAssetGalleryScope,
} from "@/lib/templateAssetCatalog";
import { inferDefaultBackgroundImageFitForUrl } from "@/lib/widgetBackgroundImageFit";
import { localizeApiMessage } from "@/lib/apiError";
import {
  IMAGE_SOURCE_ACCEPT,
  isDataImageUrl,
  isImageSourceValue,
  readImageFileAsDataUrl,
} from "./imageSourceUtils";
import { TemplateAssetImageGallery } from "./TemplateAssetImageGallery";
import { WidgetBackgroundImageFitFields } from "./WidgetBackgroundImageFitFields";
import { ImagePreviewCard, ImageUploadDropZone, RailDivider } from "./imageSourceFieldRail";
import type { WidgetStyleConfig } from "./dashboardStyleConfig";

type BackgroundPatch = Partial<WidgetStyleConfig>;

export function patchWidgetBackgroundImageSelection(
  value: WidgetStyleConfig | undefined,
  backgroundImage: string | undefined,
): BackgroundPatch {
  const trimmed = backgroundImage?.trim();
  const fitDefaults = trimmed ? inferDefaultBackgroundImageFitForUrl(trimmed) : null;
  return {
    backgroundImage: trimmed || undefined,
    backgroundShow: true,
    backgroundMode: "image",
    framePresetId: undefined,
    frameColor: undefined,
    ...(trimmed && value?.backgroundImageOpacity == null ? { backgroundImageOpacity: 1 } : {}),
    ...(fitDefaults
      ? {
          backgroundImageFit: fitDefaults.backgroundImageFit,
          backgroundImagePosition: fitDefaults.backgroundImagePosition,
        }
      : trimmed
        ? {}
        : {
            backgroundImageFit: undefined,
            backgroundImagePosition: undefined,
          }),
  };
}

function resolveBackgroundImagePreview(imageUrl: string) {
  const trimmed = imageUrl.trim();
  const hasPreview = trimmed.length > 0 && isImageSourceValue(trimmed);
  if (!hasPreview) return null;
  const catalogAsset = findTemplateAssetByUrl(trimmed);
  return {
    displayUrl: catalogAsset ? galleryPreviewUrl(catalogAsset) : resolveTemplateAssetUrl(trimmed),
    caption: catalogAsset?.label ?? (isDataImageUrl(trimmed) ? "本地图片" : "当前底图"),
  };
}

export function WidgetBackgroundImagePicker({
  value,
  onChange,
  highlightUrls,
  galleryScope = BACKGROUND_IMAGE_GALLERY_SCOPE,
  showFitFields = true,
  allowCustomUpload = true,
}: {
  value: WidgetStyleConfig;
  onChange: (patch: BackgroundPatch) => void;
  highlightUrls?: string[];
  galleryScope?: TemplateAssetGalleryScope;
  showFitFields?: boolean;
  allowCustomUpload?: boolean;
}) {
  const imageUrl = value?.backgroundImage ?? "";
  const preview = resolveBackgroundImagePreview(imageUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const applyImage = (next: string | undefined) => {
    onChange(patchWidgetBackgroundImageSelection(value, next));
  };

  const processFile = async (file: File) => {
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setUploadError(null);
      applyImage(dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? localizeApiMessage(err.message) : "读取图片失败");
    }
  };

  return (
    <div className="space-y-2" data-testid="widget-background-image-picker">
      <TemplateAssetImageGallery
        value={imageUrl}
        scope={galleryScope}
        highlightUrls={highlightUrls}
        onSelect={(url) => {
          setUploadError(null);
          applyImage(url);
        }}
      />
      <RailDivider />
      {preview ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">正在使用</p>
          <ImagePreviewCard
            previewUrl={preview.displayUrl}
            caption={preview.caption}
            showReplace={false}
            onReplace={() => {}}
            onClear={() => {
              setUploadError(null);
              applyImage(undefined);
            }}
            objectFit="contain"
          />
        </div>
      ) : allowCustomUpload ? (
        <>
          <ImageUploadDropZone
            onOpen={() => fileRef.current?.click()}
            onFile={(file) => void processFile(file)}
            hasError={Boolean(uploadError)}
          />
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_SOURCE_ACCEPT}
            className="sr-only"
            aria-label="选择自定义图片"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void processFile(file);
            }}
          />
          {uploadError ? (
            <p className="text-theme-xs text-error-600 dark:text-error-400" role="alert">
              {uploadError}
            </p>
          ) : null}
        </>
      ) : null}
      {showFitFields && preview ? (
        <WidgetBackgroundImageFitFields value={value} onChange={onChange} />
      ) : null}
    </div>
  );
}
