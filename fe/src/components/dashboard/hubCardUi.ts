import type { CSSProperties } from "react";

/** 看板 / 模板 / 组件库 Hub 卡片统一预览比例 */
export const HUB_CARD_ASPECT_RATIO = "16 / 10";

/** 数据大屏预览比例：与 1920×1080 设计画布一致，等比缩放后无留白无变形 */
export const HUB_CARD_SCREEN_ASPECT_RATIO = "16 / 9";

/** @deprecated 使用 HUB_CARD_ASPECT_RATIO */
export const DASHBOARD_LIST_CARD_ASPECT_RATIO = HUB_CARD_ASPECT_RATIO;

export const HUB_CARD_SHELL_CLASS =
  "group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs transition hover:border-brand-200 hover:shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/30";

export const HUB_CARD_PREVIEW_FRAME_CLASS =
  "relative overflow-hidden border-b border-gray-100 dark:border-white/[0.06]";

/** Hub 卡片预览内容：置于浮层下方，列表缩略图不响应图表拖拽 */
export const HUB_CARD_PREVIEW_CONTENT_CLASS =
  "relative z-0 h-full min-h-0 w-full pointer-events-none";

/** 预览区 hover 操作浮层（看板 / 模板 / 组件库 Hub 卡片） */
export const HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 z-10 flex flex-row flex-wrap items-center justify-center gap-2 p-2.5 bg-gray-900/30 opacity-0 backdrop-blur-[3px] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100";

/** 浮层内主/次按钮：横排紧凑、长文案不换行 */
export const HUB_CARD_PREVIEW_HOVER_BTN_CLASS = "shrink-0 whitespace-nowrap";

/** 浮层上的次要按钮（浅底预览上） */
export const HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS =
  "border-white/30 bg-white/10 text-white hover:bg-white/20";

export const HUB_CARD_BODY_CLASS = "flex flex-1 flex-col gap-1 p-3";

/** 标题行：固定行高，避免有无副标题时正文区高度漂移 */
export const HUB_CARD_TITLE_CLASS =
  "block min-h-5 truncate leading-5 text-theme-sm font-semibold text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400";

/** 副标题行：固定行高，长描述单行截断 */
export const HUB_CARD_SUBTITLE_CLASS =
  "mt-1 min-h-5 truncate leading-5 text-theme-xs text-gray-500 dark:text-gray-400";

export const HUB_CARD_SUBTITLE_MUTED_CLASS =
  "mt-1 min-h-5 truncate leading-5 text-theme-xs text-gray-400 dark:text-gray-500";

/** 底栏：拉伸卡片时贴底对齐 */
export const HUB_CARD_FOOTER_CLASS = "mt-auto flex min-h-6 items-center gap-2";

/** 卡片正文区更多菜单触发器（始终可见） */
export const HUB_CARD_BODY_MORE_TRIGGER_CLASS = "shrink-0";

/** 卡片正文右侧：标签与更多操作上下分布 */
export const HUB_CARD_BODY_ACTION_RAIL_CLASS =
  "flex min-h-[2.75rem] shrink-0 flex-col items-end justify-between gap-0.5 self-stretch py-px";

export function hubCardPreviewFrameStyle(
  surfaceKind?: "dashboard" | "data-screen",
): CSSProperties {
  return {
    aspectRatio:
      surfaceKind === "data-screen" ? HUB_CARD_SCREEN_ASPECT_RATIO : HUB_CARD_ASPECT_RATIO,
  };
}

export const HUB_CARD_SKELETON_PREVIEW_CLASS = "aspect-[16/10] animate-pulse bg-gray-100 dark:bg-white/[0.04]";

export const HUB_CARD_SKELETON_BODY_CLASS = "space-y-2 p-3";
