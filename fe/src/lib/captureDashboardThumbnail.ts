import { toPng } from "html-to-image";

export const DASHBOARD_THUMBNAIL_CAPTURE_ATTR = "data-dashboard-thumbnail-capture";
export const VIZ_COMPONENT_THUMBNAIL_CAPTURE_ATTR = "data-viz-component-thumbnail-capture";
/** 与 Hub 卡片 16/10 预览框一致：按宽度铺满，多余高度从顶部裁掉 */
export const DASHBOARD_THUMB_ASPECT = 16 / 10;
/** 小于此体积视为空图（0 字节或 1×1 占位），禁止上传 */
export const MIN_THUMBNAIL_BYTES = 256;
/** 列表卡很小，大屏 1920 全尺寸 PNG 会超过后端 3MB */
export const THUMBNAIL_MAX_EDGE = 960;
const CAPTURE_TIMEOUT_MS = 12_000;

const STAGE_SELECTOR = '[data-testid="pixel-canvas-stage"]';
const HOST_SELECTOR = '[data-testid="pixel-canvas-host"]';

export function findDashboardThumbnailCaptureRoot(): HTMLElement | null {
  const stage = document.querySelector<HTMLElement>(
    `${STAGE_SELECTOR}[${DASHBOARD_THUMBNAIL_CAPTURE_ATTR}]`,
  );
  if (stage) {
    return stage.closest<HTMLElement>(HOST_SELECTOR) ?? stage;
  }
  return document.querySelector<HTMLElement>(`[${DASHBOARD_THUMBNAIL_CAPTURE_ATTR}]`);
}

export function findVizComponentThumbnailCaptureRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${VIZ_COMPONENT_THUMBNAIL_CAPTURE_ATTR}]`);
}

/** 看板/大屏编辑页：按 widget id 截取画布上的组件外形（发布到组件库用） */
export function findDashboardWidgetCaptureRoot(widgetId: string): HTMLElement | null {
  return document.getElementById(`shape-id-${widgetId}`);
}

export function resolveVisibleCaptureTarget(root: HTMLElement): HTMLElement {
  return root.closest<HTMLElement>(HOST_SELECTOR) ?? root;
}

export function coverCropFromTop(
  srcW: number,
  srcH: number,
  aspect = DASHBOARD_THUMB_ASPECT,
): { width: number; height: number } {
  const cropH = Math.max(1, Math.round(srcW / aspect));
  return { width: srcW, height: Math.min(srcH, cropH) };
}

export function fitThumbnailSize(
  srcW: number,
  srcH: number,
  maxEdge = THUMBNAIL_MAX_EDGE,
  aspect = DASHBOARD_THUMB_ASPECT,
): { width: number; height: number } {
  const crop = coverCropFromTop(srcW, srcH, aspect);
  const scale = Math.min(1, maxEdge / crop.width);
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale)),
  };
}

function isVisibleBackground(value: string | null | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "transparent" && normalized !== "rgba(0, 0, 0, 0)";
}

export function resolveCaptureBackground(root: HTMLElement): string {
  const artboard = root.querySelector<HTMLElement>('[data-testid="pixel-canvas-artboard"]');
  if (artboard) {
    const bg = getComputedStyle(artboard).backgroundColor;
    if (isVisibleBackground(bg)) return bg;
  }
  const host = root.closest<HTMLElement>(HOST_SELECTOR) ?? root;
  const hostBg = getComputedStyle(host).backgroundColor;
  if (isVisibleBackground(hostBg)) return hostBg;
  return "#ffffff";
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** 等待截图区域完成布局（图表/WebGL 首帧） */
export async function waitForThumbnailCaptureReady(
  resolveRoot: () => HTMLElement | null,
  timeoutMs = 5000,
): Promise<HTMLElement> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const root = resolveRoot();
    if (root) {
      const box = measureCaptureBox(root);
      if (box.width >= 8 && box.height >= 8) {
        await nextPaint();
        return root;
      }
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 80);
    });
  }
  throw new Error("画布尚未完成布局，无法截取封面");
}

function shouldIncludeNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  if (node.closest("[data-thumbnail-ignore]")) return false;
  if (node.hasAttribute("data-thumbnail-canvas-hide")) return false;
  const testId = node.getAttribute("data-testid");
  if (
    testId?.startsWith("pixel-resize") ||
    testId?.startsWith("pixel-align") ||
    testId?.startsWith("pixel-shape-drag")
  ) {
    return false;
  }
  return true;
}

export function assertUsableImageBlob(blob: Blob | null | undefined): asserts blob is Blob {
  if (!blob || blob.size < MIN_THUMBNAIL_BYTES) {
    throw new Error("截图生成为空");
  }
}

export function measureCaptureBox(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    width: Math.max(el.clientWidth, Math.round(rect.width)),
    height: Math.max(el.clientHeight, Math.round(rect.height)),
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    task.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function encodeThumbnailBlob(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const { width, height } = fitThumbnailSize(bitmap.width, bitmap.height);
      const crop = coverCropFromTop(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, crop.width, crop.height, 0, 0, width, height);
      const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.84);
      if (jpeg && jpeg.size >= MIN_THUMBNAIL_BYTES) {
        return jpeg;
      }
      const png = await canvasToBlob(canvas, "image/png");
      return png && png.size >= MIN_THUMBNAIL_BYTES ? png : blob;
    } finally {
      bitmap.close();
    }
  } catch {
    return blob;
  }
}

const GIS_MAP_VIEW_SELECTOR = '[data-testid="gis-map-view"]';
const MAPLIBRE_CANVAS_SELECTOR = "canvas.maplibregl-canvas";
/** 球面瓦片截图的 data URL 明显长于纯色底或空缓冲 */
const MIN_MAP_CANVAS_SNAPSHOT_CHARS = 4_000;

/** GisMapView 监听：截图前触发 MapLibre 重绘，避免 WebGL 缓冲为空 */
export const GIS_MAP_CAPTURE_PREP_EVENT = "vs-gis-capture-prep";

export function isUsableCanvasSnapshot(dataUrl: string): boolean {
  return Boolean(dataUrl && dataUrl !== "data:," && dataUrl.length > 200);
}

function canvasSnapshotLooksDrawable(
  canvas: HTMLCanvasElement,
  minChars = 200,
): boolean {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    return Boolean(dataUrl && dataUrl !== "data:," && dataUrl.length > minChars);
  } catch {
    return false;
  }
}

function findGisMapLibreCanvas(gisView: HTMLElement): HTMLCanvasElement | null {
  return gisView.querySelector<HTMLCanvasElement>(MAPLIBRE_CANVAS_SELECTOR);
}

function gisMapLibreCanvasLooksReady(gisView: HTMLElement): boolean {
  const mapCanvas = findGisMapLibreCanvas(gisView);
  if (!mapCanvas || mapCanvas.width < 8 || mapCanvas.height < 8) return false;
  return canvasSnapshotLooksDrawable(mapCanvas, MIN_MAP_CANVAS_SNAPSHOT_CHARS);
}

function dispatchGisMapCapturePrep(gisView: HTMLElement): void {
  gisView.dispatchEvent(new CustomEvent(GIS_MAP_CAPTURE_PREP_EVENT, { bubbles: true }));
}

/** GIS / MapLibre 需等底图、星空与光晕绘制完成后再截图，否则只剩深蓝底。 */
export async function waitForGisMapCaptureReady(
  root: HTMLElement,
  timeoutMs = 30_000,
): Promise<void> {
  const gisView = root.querySelector<HTMLElement>(GIS_MAP_VIEW_SELECTOR);
  if (!gisView) return;

  dispatchGisMapCapturePrep(gisView);

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const basemap = gisView.getAttribute("data-basemap");
    const paintState = gisView.getAttribute("data-gis-paint-state");
    if (basemap === "error" || paintState === "error") return;

    if (paintState === "ready" && gisMapLibreCanvasLooksReady(gisView)) {
      dispatchGisMapCapturePrep(gisView);
      await nextPaint();
      await nextPaint();
      if (gisMapLibreCanvasLooksReady(gisView)) return;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 200);
    });
  }
}

/** html-to-image 直接 clone WebGL canvas 会 toDataURL 失败或读到空缓冲；先换成静态 img。 */
export function snapshotCanvasesForHtmlCapture(root: HTMLElement): () => void {
  const restores: Array<() => void> = [];
  for (const canvas of Array.from(root.querySelectorAll("canvas"))) {
    if (canvas.width < 2 || canvas.height < 2) continue;
    const parent = canvas.parentElement;
    if (!parent) continue;
    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      dataUrl = "";
    }
    if (!isUsableCanvasSnapshot(dataUrl)) continue;
    const img = document.createElement("img");
    img.setAttribute("data-thumbnail-canvas-snapshot", "");
    img.alt = "";
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    img.width = width;
    img.height = height;
    const computed = getComputedStyle(canvas);
    img.style.cssText = canvas.style.cssText;
    img.style.display = "block";
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    if (computed.position && computed.position !== "static") {
      img.style.position = computed.position;
      img.style.top = computed.top;
      img.style.left = computed.left;
      img.style.right = computed.right;
      img.style.bottom = computed.bottom;
      img.style.zIndex = computed.zIndex;
      img.style.pointerEvents = "none";
    }
    img.src = dataUrl;
    const prevDisplay = canvas.style.display;
    canvas.setAttribute("data-thumbnail-canvas-hide", "");
    canvas.style.display = "none";
    parent.insertBefore(img, canvas);
    restores.push(() => {
      img.remove();
      canvas.style.display = prevDisplay;
      canvas.removeAttribute("data-thumbnail-canvas-hide");
    });
  }
  return () => {
    restores.forEach((restore) => restore());
  };
}

/**
 * 截当前已绘制的 host 视口，不改 live transform。
 * 必须在 resetLayout / 离开编辑页之前调用。
 */
export async function captureDashboardThumbnailBlob(root: HTMLElement): Promise<Blob> {
  const target = resolveVisibleCaptureTarget(root);
  const box = measureCaptureBox(target);
  if (box.width < 8 || box.height < 8) {
    throw new Error("画布尚未完成布局，无法截取封面");
  }
  await nextPaint();
  await waitForGisMapCaptureReady(root);
  const restoreCanvases = snapshotCanvasesForHtmlCapture(target);
  try {
    const dataUrl = await withTimeout(
      toPng(target, {
        pixelRatio: 1,
        cacheBust: true,
        skipFonts: true,
        backgroundColor: resolveCaptureBackground(root),
        filter: (node: HTMLElement) => shouldIncludeNode(node),
      }),
      CAPTURE_TIMEOUT_MS,
      "截图超时",
    );
    const blob = dataUrlToBlob(dataUrl);
    assertUsableImageBlob(blob);
    const encoded = await encodeThumbnailBlob(blob);
    assertUsableImageBlob(encoded);
    return encoded;
  } finally {
    restoreCanvases();
  }
}
