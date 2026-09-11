import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";
import type { DashboardStyleConfig } from "./layoutUtils";
import {
  effectiveCanvasBackground,
  effectiveWidgetShellBackground,
  dashboardShapeGapStyle,
  hasUserCanvasBackground,
} from "./dashboardStyleConfig";
import { getDashboardThemeTokens, themeTokensToScopeVars } from "./dashboardThemeTokens";
import { resolveDialogScopeStyle } from "./dashboardChromeConfig";

type DashboardStyleSurfaceProps = {
  styleConfig?: DashboardStyleConfig;
  /** DataEase curGap：组件 shape 外层 padding（px） */
  componentGapPx?: number;
  className?: string;
  children: ReactNode;
};

/**
 * 仪表板主题作用域（DE §5.1）：传播 colorScheme 与固定视觉令牌。
 * 画布背景由 artboard/backdrop 层的 resolveArtboardStyle 负责（DE §5.3）。
 */
export function DashboardStyleSurface({
  styleConfig,
  componentGapPx = 0,
  className,
  children,
}: DashboardStyleSurfaceProps) {
  const scheme = styleConfig?.colorScheme ?? "light";
  const tokens = getDashboardThemeTokens(scheme);
  const userCanvasBackground = styleConfig ? hasUserCanvasBackground(styleConfig) : false;
  const scopeStyle: CSSProperties = { colorScheme: scheme };
  if (styleConfig?.fontFamily) scopeStyle.fontFamily = styleConfig.fontFamily;

  const rawCanvas = styleConfig ? effectiveCanvasBackground(styleConfig) : undefined;
  const artboardBg = rawCanvas ?? tokens.canvas;

  const widgetSurfaceBg = styleConfig
    ? effectiveWidgetShellBackground(styleConfig)
    : tokens.widgetShell;

  Object.assign(scopeStyle, themeTokensToScopeVars({
    ...tokens,
    canvas: artboardBg,
    widgetShell: widgetSurfaceBg ?? tokens.widgetShell,
  }));

  if (styleConfig?.actionIconColor) {
    (scopeStyle as Record<string, string>)["--dashboard-action-icon"] = styleConfig.actionIconColor;
    (scopeStyle as Record<string, string>)["--dashboard-action-icon-hover"] =
      styleConfig.actionIconColor;
  }
  Object.assign(scopeStyle, resolveDialogScopeStyle(styleConfig));
  Object.assign(scopeStyle, dashboardShapeGapStyle(componentGapPx));

  return (
    <div
      className={cn("dashboard-theme-scope min-h-0 w-full", scheme === "dark" && "dark", className)}
      data-dashboard-color-scheme={scheme}
      data-canvas-user-bg={userCanvasBackground ? "true" : undefined}
      data-dashboard-gap-enabled={componentGapPx > 0 ? "true" : undefined}
      style={scopeStyle}
    >
      {children}
    </div>
  );
}
