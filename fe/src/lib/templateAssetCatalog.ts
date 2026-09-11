import catalog from "./templateAssetsCatalog.generated.json";
import { resolvePublicAssetUrl } from "./appBasePath";

export type TemplateAssetCatalogItem = {
  id: string;
  pack: string;
  category: string;
  palette: string;
  pattern: string;
  label: string;
  url: string;
  thumbUrl: string;
};

export type TemplateAssetGalleryScope = "background" | "widget" | "canvas" | "screen" | "all";

/** 组件底图 / 看板背景等图片选择器统一使用的 scope */
export const BACKGROUND_IMAGE_GALLERY_SCOPE: TemplateAssetGalleryScope = "background";

export const TEMPLATE_ASSET_CATALOG = catalog.items as TemplateAssetCatalogItem[];

export const TEMPLATE_ASSET_CATEGORY_LABELS: Record<string, string> = {
  "borderless-decor": "无边框装饰",
  "screen-header": "顶栏整图",
  "title-strip": "顶部装饰",
  "component-panel": "组件面板",
  "canvas-dark": "大屏深色",
  "canvas-light": "大屏浅色",
  "screen-bg": "背景图",
};

/** 图库不展示：缩略图、废弃仪表板线框、变体预览等 */
export const GALLERY_EXCLUDED_CATEGORIES = new Set([
  "thumb",
  "canvas-thumb",
  "dashboard-template",
  "dashboard-variant",
  "top-decor-clear",
]);

/** 图库不展示：带网格/蜂窝/HUD 扫描/点阵/条纹等纹理感素材 */
export const GALLERY_EXCLUDED_PATTERNS = new Set([
  // 蜂窝 / 电路 / HUD
  "honeycomb",
  "circuit",
  "hud-scan",
  "hud-bracket",
  "de-circuit-wing",
  "de-circuit-sym",
  // 显式网格 / 点阵 / 条纹
  "grid",
  "grid-ops",
  "mesh",
  "hex-nodes",
  "dots",
  "stripes",
  "band",
  "tech-rail",
  // 角线网格 / 指挥台底纹 / 雷达脉冲
  "aurora",
  "command",
  "radial-pulse",
]);

const CANVAS_CATEGORIES = new Set(["canvas-dark", "canvas-light", "screen-bg"]);

const WIDGET_CATEGORIES = new Set([
  "borderless-decor",
  "screen-header",
  "title-strip",
  "component-panel",
]);

/** 底图图库：组件装饰 + 大屏/看板背景（各入口共用，避免分类不一致） */
const BACKGROUND_IMAGE_CATEGORIES = new Set([...WIDGET_CATEGORIES, ...CANVAS_CATEGORIES]);

export function isGalleryEligibleAsset(item: TemplateAssetCatalogItem): boolean {
  if (GALLERY_EXCLUDED_CATEGORIES.has(item.category)) return false;
  if (GALLERY_EXCLUDED_PATTERNS.has(item.pattern)) return false;
  return true;
}

/** @deprecated 使用 resolvePublicAssetUrl；保留别名避免大范围重命名 */
export function resolveTemplateAssetUrl(url: string): string {
  return resolvePublicAssetUrl(url);
}

/** 图库格子预览：canvas/screen-bg 用 packs/thumbs；其余用 thumbUrl 或全图 url */
export function galleryPreviewRawPath(item: TemplateAssetCatalogItem): string {
  const thumb = item.thumbUrl?.trim() ?? "";
  const url = item.url?.trim() ?? "";
  if (item.category === "canvas-thumb") return url || thumb;
  if (
    (item.category === "canvas-dark" ||
      item.category === "canvas-light" ||
      item.category === "screen-bg") &&
    item.id
  ) {
    return `/template-assets/packs/gov-enterprise-v1/thumbs/${item.id}.svg`;
  }
  if (thumb.includes("/thumbs/")) return thumb;
  if (thumb && thumb !== url) return thumb;
  return url || thumb;
}

/** img onError 回退链：全图 url（始终可用） */
export function galleryPreviewFallbackUrl(item: TemplateAssetCatalogItem): string {
  return resolveTemplateAssetUrl(item.url?.trim() ?? "");
}

export function galleryPreviewUrl(item: TemplateAssetCatalogItem): string {
  return resolveTemplateAssetUrl(galleryPreviewRawPath(item));
}

export function isWideTransparentGalleryCategory(_category: string): boolean {
  return false;
}

function applyGalleryExclusions(items: TemplateAssetCatalogItem[]): TemplateAssetCatalogItem[] {
  return items.filter(isGalleryEligibleAsset);
}

export function listTemplateAssetCategories(
  items: TemplateAssetCatalogItem[] = TEMPLATE_ASSET_CATALOG,
): string[] {
  const eligible = applyGalleryExclusions(items);
  return [...new Set(eligible.map((item) => item.category))].sort((a, b) => {
    const order = [
      "title-strip",
      "screen-header",
      "borderless-decor",
      "component-panel",
      "canvas-dark",
      "canvas-light",
      "screen-bg",
    ];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
      (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });
}

export function filterTemplateAssetsByScope(
  scope: TemplateAssetGalleryScope,
  items: TemplateAssetCatalogItem[] = TEMPLATE_ASSET_CATALOG,
): TemplateAssetCatalogItem[] {
  const eligible = applyGalleryExclusions(items);
  if (scope === "all") return eligible;
  if (scope === "canvas") {
    return eligible.filter((item) => CANVAS_CATEGORIES.has(item.category));
  }
  if (scope === "background" || scope === "widget" || scope === "screen") {
    return eligible.filter((item) => BACKGROUND_IMAGE_CATEGORIES.has(item.category));
  }
  return [];
}

export function groupTemplateAssetsByCategory(items: TemplateAssetCatalogItem[]) {
  const map = new Map<string, TemplateAssetCatalogItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

export function findTemplateAssetByUrl(
  url: string,
  items: TemplateAssetCatalogItem[] = TEMPLATE_ASSET_CATALOG,
): TemplateAssetCatalogItem | undefined {
  const normalized = url.trim();
  if (!normalized) return undefined;
  return items.find((item) => item.url === normalized || item.thumbUrl === normalized);
}
