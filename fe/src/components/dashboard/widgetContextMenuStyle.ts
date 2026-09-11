import {
  patchChartDeStyleNested,
  patchChartPaletteDeStyle,
  patchChartShowLabel,
  readChartDeStyle,
  readChartLegendVisible,
  readChartShowLabel,
  readChartTitleVisible,
  readEffectiveChartBorder,
  resolveEffectivePaletteId,
  resolveEffectiveWidgetShellConfig,
} from "@/lib/chartDeStyle";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  CHART_PALETTE_INHERIT_LABEL,
  CHART_PALETTE_PRESETS,
  chartPaletteLabel,
  resolvePaletteId,
} from "@/lib/chartPalette";
import type { DashboardStyleConfig, WidgetStyleConfig } from "./dashboardStyleConfig";
import type { LayoutWidget } from "./layoutUtils";
import { mergeWidgetOverrideStyle } from "./widgetRailStyleSections";

export type WidgetContextMenuSurface = "dashboard" | "data-screen";

export type WidgetQuickStyleAction =
  | "toggleTitle"
  | "toggleBackground"
  | "toggleBorder"
  | "toggleBackdropBlur"
  | "toggleTransparentBg"
  | "toggleLegend"
  | "toggleLabel"
  | "setPalette";

export type WidgetQuickStyleActionOptions = {
  /** null 表示清除组件 override，跟随看板配色 */
  paletteId?: string | null;
};

export type WidgetShellStyleState = {
  titleVisible: boolean;
  backgroundShow: boolean;
  borderEnabled: boolean;
  backdropBlur: number;
  /** 0–1；undefined 表示沿用看板/大屏默认 */
  opacity?: number;
};

export type WidgetChartQuickStyleState = {
  legendVisible: boolean;
  labelVisible: boolean;
  paletteLabel: string;
  usingDashboardPalette: boolean;
};

type StyleContext = {
  surface: WidgetContextMenuSurface;
  dashboardStyle?: Pick<
    DashboardStyleConfig,
    "widgetStyle" | "titleStyle" | "paletteId" | "paletteColors"
  >;
};

const DATA_SCREEN_BLUR_PX = 12;
const DATA_SCREEN_SOLID_OPACITY = 0.85;

function patchChartShell(
  chartConfig: ChartViewConfig,
  patch: Partial<WidgetStyleConfig>,
  borderPatch?: { show?: boolean },
): ChartViewConfig {
  let next = patchChartDeStyleNested(chartConfig, "background", patch);
  if (borderPatch) {
    next = patchChartDeStyleNested(next, "border", borderPatch);
  }
  return next;
}

function patchWidgetStyleOverride(
  widget: LayoutWidget,
  stylePatch: Partial<WidgetStyleConfig>,
): LayoutWidget {
  switch (widget.type) {
    case "text":
      return {
        ...widget,
        textConfig: {
          ...(widget.textConfig ?? { content: "", variant: "plain" }),
          widgetStyle: {
            ...(widget.textConfig?.widgetStyle ?? {}),
            ...stylePatch,
          },
        },
      };
    case "media":
      return {
        ...widget,
        mediaConfig: {
          ...(widget.mediaConfig ?? { url: "", alt: "", fit: "contain" }),
          widgetStyle: {
            ...(widget.mediaConfig?.widgetStyle ?? {}),
            ...stylePatch,
          },
        },
      };
    case "tabs":
      return {
        ...widget,
        tabsConfig: {
          ...(widget.tabsConfig ?? { tabsId: widget.id, panes: [], activePaneId: "" }),
          widgetStyle: {
            ...(widget.tabsConfig?.widgetStyle ?? {}),
            ...stylePatch,
          },
        },
      };
    case "customViz":
      return {
        ...widget,
        customVizConfig: {
          ...(widget.customVizConfig ?? { artifactId: "" }),
          widgetStyle: {
            ...(widget.customVizConfig?.widgetStyle ?? {}),
            ...stylePatch,
          },
        },
      };
    default:
      return widget;
  }
}

function chartCaps(widget: Pick<LayoutWidget, "type" | "chartConfig">) {
  if (widget.type !== "chart" || !widget.chartConfig) return null;
  return chartInspectorCapabilities(widget.chartConfig.chartType);
}

export function readWidgetChartQuickStyleState(
  widget: Pick<LayoutWidget, "type" | "chartConfig">,
  context: StyleContext,
): WidgetChartQuickStyleState {
  const cfg = widget.chartConfig!;
  const deStyle = readChartDeStyle(cfg);
  const usingDashboardPalette = deStyle.paletteId == null;
  const effectiveId = resolveEffectivePaletteId(cfg, context.dashboardStyle?.paletteId);
  return {
    legendVisible: readChartLegendVisible(deStyle, { embedded: true }),
    labelVisible: readChartShowLabel(cfg, context.dashboardStyle),
    paletteLabel: usingDashboardPalette
      ? CHART_PALETTE_INHERIT_LABEL
      : (chartPaletteLabel(deStyle.paletteId) ?? effectiveId ?? CHART_PALETTE_INHERIT_LABEL),
    usingDashboardPalette,
  };
}

export function readWidgetShellStyleState(
  widget: Pick<LayoutWidget, "type" | "chartConfig" | "textConfig" | "mediaConfig" | "tabsConfig">,
  context: StyleContext,
): WidgetShellStyleState {
  const globalWidgetStyle = context.dashboardStyle?.widgetStyle;
  const titleStyle = context.dashboardStyle?.titleStyle;

  if (widget.type === "chart" && widget.chartConfig) {
    const effective = resolveEffectiveWidgetShellConfig(globalWidgetStyle, widget.chartConfig);
    const border = readEffectiveChartBorder(widget.chartConfig, globalWidgetStyle);
    return {
      titleVisible: readChartTitleVisible(widget.chartConfig, titleStyle),
      backgroundShow: effective.backgroundShow !== false,
      borderEnabled: border.show !== false,
      backdropBlur: effective.backdropBlur ?? 0,
      opacity: effective.opacity,
    };
  }

  const merged = mergeWidgetOverrideStyle(globalWidgetStyle, widget as LayoutWidget) ?? {};
  return {
    titleVisible: true,
    backgroundShow: merged.backgroundShow !== false,
    borderEnabled: merged.borderEnabled !== false,
    backdropBlur: merged.backdropBlur ?? 0,
    opacity: merged.opacity,
  };
}

export function applyWidgetQuickStyleAction(
  widget: LayoutWidget,
  action: WidgetQuickStyleAction,
  context: StyleContext,
  options?: WidgetQuickStyleActionOptions,
): LayoutWidget {
  const state = readWidgetShellStyleState(widget, context);

  if (widget.type === "chart" && widget.chartConfig) {
    const chartState = readWidgetChartQuickStyleState(widget, context);
    switch (action) {
      case "toggleTitle":
        return {
          ...widget,
          chartConfig: patchChartDeStyleNested(widget.chartConfig, "title", {
            show: !state.titleVisible,
          }),
        };
      case "toggleBackground":
        return {
          ...widget,
          chartConfig: patchChartShell(widget.chartConfig, {
            backgroundShow: !state.backgroundShow,
          }),
        };
      case "toggleBorder":
        return {
          ...widget,
          chartConfig: patchChartShell(
            widget.chartConfig,
            { backgroundShow: true },
            { show: !state.borderEnabled },
          ),
        };
      case "toggleBackdropBlur":
        return {
          ...widget,
          chartConfig: patchChartShell(widget.chartConfig, {
            backdropBlur: state.backdropBlur > 0 ? 0 : DATA_SCREEN_BLUR_PX,
            backgroundShow: true,
          }),
        };
      case "toggleTransparentBg": {
        const transparent = (state.opacity ?? 0) <= 0.05;
        return {
          ...widget,
          chartConfig: patchChartShell(widget.chartConfig, {
            opacity: transparent ? DATA_SCREEN_SOLID_OPACITY : 0,
            backgroundShow: true,
          }),
        };
      }
      case "toggleLegend":
        return {
          ...widget,
          chartConfig: patchChartDeStyleNested(widget.chartConfig, "legend", {
            show: !chartState.legendVisible,
          }),
        };
      case "toggleLabel":
        return {
          ...widget,
          chartConfig: patchChartShowLabel(widget.chartConfig, !chartState.labelVisible),
        };
      case "setPalette": {
        const paletteId = options?.paletteId;
        if (paletteId == null) {
          return {
            ...widget,
            chartConfig: patchChartPaletteDeStyle(widget.chartConfig, undefined, []),
          };
        }
        const resolved = resolvePaletteId(paletteId) ?? paletteId;
        const colors = CHART_PALETTE_PRESETS[resolved] ?? [];
        return {
          ...widget,
          chartConfig: patchChartPaletteDeStyle(widget.chartConfig, resolved, colors),
        };
      }
      default:
        return widget;
    }
  }

  switch (action) {
    case "toggleTitle":
      return widget;
    case "toggleBackground":
      return patchWidgetStyleOverride(widget, { backgroundShow: !state.backgroundShow });
    case "toggleBorder":
      return patchWidgetStyleOverride(widget, {
        borderEnabled: !state.borderEnabled,
        backgroundShow: true,
      });
    case "toggleBackdropBlur":
      return patchWidgetStyleOverride(widget, {
        backdropBlur: state.backdropBlur > 0 ? 0 : DATA_SCREEN_BLUR_PX,
        backgroundShow: true,
      });
    case "toggleTransparentBg": {
      const transparent = (state.opacity ?? 0) <= 0.05;
      return patchWidgetStyleOverride(widget, {
        opacity: transparent ? DATA_SCREEN_SOLID_OPACITY : 0,
        backgroundShow: true,
      });
    }
    default:
      return widget;
  }
}

export function supportsWidgetQuickStyleAction(
  widget: Pick<LayoutWidget, "type" | "chartConfig">,
  action: WidgetQuickStyleAction,
): boolean {
  const caps = chartCaps(widget);
  if (action === "toggleLegend") return Boolean(caps?.legend);
  if (action === "toggleLabel") {
    return Boolean(caps?.label && widget.chartConfig?.chartType !== "kpi");
  }
  if (action === "setPalette") return widget.type === "chart";
  if (action === "toggleTitle") return widget.type === "chart";
  if (action === "toggleBackdropBlur" || action === "toggleTransparentBg") {
    return (
      widget.type === "chart" ||
      widget.type === "text" ||
      widget.type === "media" ||
      widget.type === "tabs" ||
      widget.type === "customViz"
    );
  }
  return (
    widget.type === "chart" ||
    widget.type === "text" ||
    widget.type === "media" ||
    widget.type === "tabs" ||
    widget.type === "customViz"
  );
}
