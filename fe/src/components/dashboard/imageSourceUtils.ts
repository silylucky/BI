export const IMAGE_SOURCE_ACCEPT = "image/jpeg,image/png,image/gif,image/svg+xml,image/webp";
export const MAX_IMAGE_SOURCE_BYTES = 2 * 1024 * 1024;
/** 与后端 IMAGE_DATA_URL_MAX_LENGTH 对齐（2MB 文件 base64 膨胀 + data URL 头） */
export const MAX_IMAGE_DATA_URL_CHARS = 3_145_728;

export function isHttpImageUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

export function isDataImageUrl(value: string): boolean {
  return value.trim().startsWith("data:image/");
}

/** 应用内静态资源路径（内置素材等） */
export function isAppImagePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return false;
  return /\.(svg|png|jpe?g|gif|webp)(\?|#|$)/i.test(trimmed);
}

export function isImageSourceValue(value: string): boolean {
  const trimmed = value.trim();
  return isHttpImageUrl(trimmed) || isDataImageUrl(trimmed) || isAppImagePath(trimmed);
}

/** CSS background-image：避免重复 url() 包裹，data URL 用引号防止解析失败 */
export function formatWidgetBackgroundImageCss(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^url\s*\(/i.test(trimmed)) return trimmed;
  const escaped = trimmed.replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/** 从 CSS `url("...")` 或裸路径解析图片地址 */
export function parseWidgetBackgroundImageUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^url\(\s*["']?(.+?)["']?\s*\)$/i);
  if (match) return match[1].replace(/\\"/g, '"');
  return trimmed;
}

export async function readImageFileAsDataUrl(
  file: File,
  maxBytes = MAX_IMAGE_SOURCE_BYTES,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件（JPG、PNG、GIF、SVG、WebP）");
  }
  if (file.size > maxBytes) {
    throw new Error(`图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
        reject(new Error("图片编码后过大，请压缩后再上传（建议小于 2MB）"));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}
