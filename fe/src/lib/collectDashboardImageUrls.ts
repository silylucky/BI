import type { DashboardStyleConfig, LayoutWidget } from "@/components/dashboard/layoutUtils";
import { resolveLegacyTitleBarWidgetStyle } from "@/lib/screenTitleBarAssets";

function pushImageUrl(bucket: Set<string>, raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.startsWith("data:")) return;
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    bucket.add(trimmed);
  }
}

/** 收集看板内已引用的图片 URL（画布底图 + 组件背景等） */
export function collectDashboardImageUrls(
  widgets: LayoutWidget[],
  styleConfig?: DashboardStyleConfig,
): string[] {
  const urls = new Set<string>();
  pushImageUrl(urls, styleConfig?.canvasBackgroundImage);

  for (const widget of widgets) {
    if (widget.type === "text") {
      const ws =
        resolveLegacyTitleBarWidgetStyle(widget) ?? widget.textConfig?.widgetStyle ?? {};
      if (ws.backgroundShow !== false) pushImageUrl(urls, ws.backgroundImage);
      continue;
    }
    if (widget.type === "media") {
      pushImageUrl(urls, widget.mediaConfig?.url);
      const ws = widget.mediaConfig?.widgetStyle;
      if (ws && ws.backgroundShow !== false) pushImageUrl(urls, ws.backgroundImage);
      continue;
    }
    if (widget.type === "tabs") {
      const ws = widget.tabsConfig?.widgetStyle;
      if (ws && ws.backgroundShow !== false) pushImageUrl(urls, ws.backgroundImage);
    }
  }

  return [...urls];
}
