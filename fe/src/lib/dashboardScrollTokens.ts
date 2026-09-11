/** DataEase 对标：看板内滚动条 — 白色半透明滑块 + 透明轨道 */
export const DASHBOARD_SCROLL_TRACK = "transparent";

export const DASHBOARD_SCROLL_THUMB = "rgb(255 255 255 / 0.35)";

export const DASHBOARD_SCROLL_THUMB_HOVER = "rgb(255 255 255 / 0.55)";

export const DASHBOARD_SCROLL_CSS_VARS = {
  "--dashboard-scroll-thumb": DASHBOARD_SCROLL_THUMB,
  "--dashboard-scroll-thumb-hover": DASHBOARD_SCROLL_THUMB_HOVER,
  "--dashboard-scroll-track": DASHBOARD_SCROLL_TRACK,
} as const;
