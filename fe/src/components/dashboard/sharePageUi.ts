import type { CSSProperties } from "react";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";

/** 分享/嵌入配置页区块 Card（与详情页 `rounded-2xl shadow-theme-sm` 一致） */
export const SHARE_SECTION_CARD_CLASS =
  "rounded-2xl border-gray-200 shadow-theme-sm dark:border-gray-800";

/** 预览区 Card：裁切画布圆角 */
export const SHARE_PREVIEW_CARD_CLASS = `${SHARE_SECTION_CARD_CLASS} overflow-hidden`;

export const SHARE_SECTION_CARD_HEADER_CLASS =
  "border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-white/[0.02]";

/** 分享页 fill 布局根 */
export const SHARE_FILL_BODY_CLASS = "flex h-full min-h-0 flex-1 flex-col";

/**
 * 左右分栏：左预览、右配置。
 * - lg：同行等高，右栏内部滚动
 * - 窄屏：预览 auto 高度，配置区占剩余空间并滚动
 */
export const SHARE_SPLIT_GRID_CLASS =
  "grid h-full min-h-0 flex-1 gap-3 overflow-hidden grid-rows-[minmax(0,auto)_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]";

export const SHARE_SPLIT_PREVIEW_COLUMN_CLASS = "flex min-h-0 flex-col overflow-hidden";

export const SHARE_SPLIT_CONFIG_COLUMN_CLASS = "flex min-h-0 min-w-0 flex-col overflow-hidden";

export const SHARE_FILL_GRID_CLASS =
  "grid min-h-0 flex-1 gap-3 overflow-hidden grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-none";

/** 窄屏堆叠时预览限高 */
export const SHARE_SCREEN_PREVIEW_STACKED_CLASS =
  "max-h-[min(36vh,360px)] shrink-0 lg:max-h-none lg:min-h-0 lg:shrink";

export const SHARE_SCROLL_REGION_CLASS = "custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden";

export const SHARE_FILL_CARD_CLASS = "flex min-h-0 flex-col overflow-hidden";

export const SHARE_FILL_CARD_BODY_CLASS = "flex min-h-0 flex-1 flex-col overflow-hidden pt-4";

/** 布局预览在窄屏/堆叠时的限高 */
export const SHARE_PREVIEW_STACKED_MAX_CLASS = "h-[min(40vh,380px)] lg:h-full lg:min-h-0";

/** 右侧分享配置区：独立纵向滚动，底部留白避免按钮贴边被裁 */
export const SHARE_FILL_SIDE_STACK_CLASS =
  "custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pb-8 pr-0.5";

/** 弹窗内分享配置纵向堆叠 */
export const SHARE_DIALOG_STACK_CLASS = "divide-y divide-gray-100 dark:divide-gray-800";

/** 弹窗内容区滚动容器 */
export const SHARE_DIALOG_CONTENT_CLASS = "gap-0 overflow-hidden p-0 sm:max-w-2xl";

export const SHARE_DIALOG_HEADER_CLASS =
  "border-b border-gray-100 px-6 py-5 dark:border-white/[0.06]";

export const SHARE_DIALOG_BODY_CLASS =
  "custom-scrollbar max-h-[min(78vh,720px)] overflow-y-auto overflow-x-hidden px-6 py-3 pb-6";

/** 定时推送弹窗：宽于默认 Dialog；Select 走 Portal，壳层可 overflow-hidden 以贴合圆角 */
export const SCHEDULE_DIALOG_CONTENT_CLASS =
  "flex max-h-[min(90vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl";

export const SCHEDULE_DIALOG_HEADER_CLASS = `${SHARE_DIALOG_HEADER_CLASS} shrink-0`;

export const SCHEDULE_DIALOG_BODY_CLASS =
  "custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/40 px-6 py-4 pb-6 dark:bg-gray-950/20";

/** 与 `DatasourceDetailPage` DetailSkeleton 同高 */
export const SHARE_PAGE_SKELETON_CLASS = "h-[520px] w-full rounded-xl";

const DEFAULT_SCREEN_ASPECT = "16 / 9";

/** 预览容器比例跟画布，避免 fit 模式多余 letterbox */
export function screenPreviewContainerStyle(layout: DashboardLayout): CSSProperties {
  if (layout.version === 2 && layout.canvas.width > 0 && layout.canvas.height > 0) {
    return { aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}` };
  }
  return { aspectRatio: DEFAULT_SCREEN_ASPECT };
}
