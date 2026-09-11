/** Admin 顶栏与侧栏品牌区共用高度，保证底部分割线对齐 */
export const ADMIN_HEADER_HEIGHT_PX = 72;

export const ADMIN_HEADER_HEIGHT_CLASS = "h-[72px]";

/** Admin 侧栏展开宽度（原 290px，收窄以让编辑画布占比更大） */
export const ADMIN_SIDEBAR_EXPANDED_PX = 240;

export const ADMIN_SIDEBAR_COLLAPSED_PX = 90;

export const ADMIN_SIDEBAR_EXPANDED_CLASS = "w-[240px] px-4";

export const ADMIN_SIDEBAR_COLLAPSED_CLASS = "w-[90px] px-3";

/**
 * 视口分档（与 Tailwind md/lg/xl/2xl 对齐）：
 * - drawer <768：抽屉
 * - compact 768–1023：图标轨 + 2 列
 * - desktop 1024–1279：展开侧栏 + 2 列（图二）
 * - wideCompact 1280–1535：图标轨 + 3 列（轻微压缩）
 * - wide ≥1536：展开侧栏 + 3 列（完全展开）
 */
export const ADMIN_SIDEBAR_MOBILE_MAX_PX = 767;

export const ADMIN_SIDEBAR_COMPACT_MAX_PX = 1023;

export const ADMIN_SIDEBAR_DESKTOP_MAX_PX = 1279;

export const ADMIN_SIDEBAR_WIDE_COMPACT_MAX_PX = 1535;

export type AdminSidebarViewport =
  | "drawer"
  | "compact"
  | "desktop"
  | "wideCompact"
  | "wide";

export function resolveAdminSidebarViewport(width: number): AdminSidebarViewport {
  if (width <= ADMIN_SIDEBAR_MOBILE_MAX_PX) return "drawer";
  if (width <= ADMIN_SIDEBAR_COMPACT_MAX_PX) return "compact";
  if (width <= ADMIN_SIDEBAR_DESKTOP_MAX_PX) return "desktop";
  if (width <= ADMIN_SIDEBAR_WIDE_COMPACT_MAX_PX) return "wideCompact";
  return "wide";
}

/** 视口强制图标轨（不可展开文字侧栏） */
export function isAdminSidebarIconRailViewport(
  viewport: AdminSidebarViewport,
): boolean {
  return viewport === "compact" || viewport === "wideCompact";
}

export const ADMIN_CONTENT_MARGIN_EXPANDED_CLASS = "md:ml-[240px]";

export const ADMIN_CONTENT_MARGIN_COLLAPSED_CLASS = "md:ml-[90px]";
