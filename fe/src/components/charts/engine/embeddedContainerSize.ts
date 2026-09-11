import type { ShapeEdgeInset } from "@/components/dashboard/pixelCanvas/shapeVisualInset";

/** 外框 layout 坐标 → 内容区可用 footprint（扣 gap 壳层、边框 padding、顶栏标题） */
export function resolveEmbeddedLayoutFootprint(
  outer: { width: number; height: number },
  options: {
    gapPx?: number;
    chromeInset?: ShapeEdgeInset;
    titleChromePx?: number;
  } = {},
): { width: number; height: number } {
  const gap = Math.max(0, options.gapPx ?? 0);
  const inset = options.chromeInset ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const title = Math.max(0, options.titleChromePx ?? 0);
  return {
    width: Math.max(48, outer.width - gap * 2 - inset.left - inset.right),
    height: Math.max(48, outer.height - gap * 2 - inset.top - inset.bottom - title),
  };
}

/** 嵌入图表容器测量（看板/大屏 widget 内） */
export function readEmbeddedContainerSize(
  el: HTMLElement | null | undefined,
): { width: number; height: number } | null {
  if (!el) return null;
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** 像素画布 CSS scale 下用视觉尺寸反推绘制分辨率（对标 ECharts resize） */
export function readChartPaintSize(
  el: HTMLElement,
  options: {
    fill?: boolean;
    visualScale?: number;
    layoutFootprint?: { width: number; height: number };
    width?: number;
    height?: number;
    observedWidth?: number;
  } = {},
): { width: number; height: number } | null {
  const scale = options.visualScale && options.visualScale > 0 ? options.visualScale : 1;
  if (options.fill) {
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) {
      return {
        width: Math.max(1, Math.round(width / scale)),
        height: Math.max(1, Math.round(height / scale)),
      };
    }
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        width: Math.max(1, Math.round(rect.width / scale)),
        height: Math.max(1, Math.round(rect.height / scale)),
      };
    }
  }
  const rawWidth = options.fill
    ? el.clientWidth
    : (typeof options.width === "number" ? options.width : 0) ||
      options.observedWidth ||
      el.clientWidth;
  const rawHeight = options.fill ? el.clientHeight : (options.height ?? el.clientHeight);
  const height = rawHeight > 0 ? rawHeight : 180;
  const width = rawWidth > 0 ? rawWidth : Math.max(320, height);
  if (height <= 0) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

export function embeddedSizeChanged(
  next: { width: number; height: number },
  last: { width: number; height: number },
): boolean {
  return next.width !== last.width || next.height !== last.height;
}
