import type { ReactNode } from "react";
import {
  ChevronsDown,
  ChevronsUp,
  Copy,
  Droplets,
  Eye,
  EyeOff,
  Frame,
  Layers,
  ListTree,
  Paintbrush,
  Palette,
  Tag,
  Trash2,
  Type,
} from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import type { LayoutWidget } from "./layoutUtils";
import { CHART_PALETTE_CATALOG, CHART_PALETTE_INHERIT_LABEL } from "@/lib/chartPalette";
import {
  readWidgetChartQuickStyleState,
  readWidgetShellStyleState,
  supportsWidgetQuickStyleAction,
  type WidgetContextMenuSurface,
  type WidgetQuickStyleAction,
  type WidgetQuickStyleActionOptions,
} from "./widgetContextMenuStyle";

function menuItemClass(scheme: ColorScheme, destructive = false): string | undefined {
  if (destructive) {
    return scheme === "dark"
      ? "text-error-400 focus:bg-error-500/10 focus:text-error-300"
      : "text-error-600 focus:text-error-600";
  }
  return scheme === "dark" ? "text-gray-300 focus:bg-white/5 focus:text-gray-200" : undefined;
}

function menuSubTriggerClass(scheme: ColorScheme): string | undefined {
  return scheme === "dark"
    ? "text-gray-300 focus:bg-white/5 data-[state=open]:bg-white/5"
    : undefined;
}

function menuChromeClass(scheme: ColorScheme): string {
  return scheme === "dark"
    ? "border-gray-700 bg-gray-900 text-gray-300"
    : "border-gray-200 bg-white text-gray-700";
}

function menuSeparatorClass(scheme: ColorScheme): string | undefined {
  return scheme === "dark" ? "bg-gray-800" : undefined;
}

type StyleMenuItemProps = {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
  colorScheme: ColorScheme;
};

function StyleMenuItem({ label, icon, disabled, onSelect, colorScheme }: StyleMenuItemProps) {
  return (
    <ContextMenuItem
      className={menuItemClass(colorScheme)}
      disabled={disabled}
      onSelect={onSelect}
    >
      {icon}
      {label}
    </ContextMenuItem>
  );
}

type WidgetContextMenuStyleItemsProps = {
  widget: Pick<LayoutWidget, "id" | "type" | "chartConfig" | "textConfig" | "mediaConfig" | "tabsConfig">;
  surface: WidgetContextMenuSurface;
  dashboardStyle?: Pick<DashboardStyleConfig, "widgetStyle" | "titleStyle" | "paletteId" | "paletteColors">;
  locked: boolean;
  onStyleQuickAction?: (
    widgetId: string,
    action: WidgetQuickStyleAction,
    options?: WidgetQuickStyleActionOptions,
  ) => void;
  colorScheme: ColorScheme;
};

export function WidgetContextMenuStyleItems({
  widget,
  surface,
  dashboardStyle,
  locked,
  onStyleQuickAction,
  colorScheme,
}: WidgetContextMenuStyleItemsProps) {
  if (!onStyleQuickAction) return null;

  const state = readWidgetShellStyleState(widget, { surface, dashboardStyle });
  const chartState =
    widget.type === "chart" && widget.chartConfig
      ? readWidgetChartQuickStyleState(widget, { surface, dashboardStyle })
      : null;
  const run = (action: WidgetQuickStyleAction, options?: WidgetQuickStyleActionOptions) => {
    if (locked || !supportsWidgetQuickStyleAction(widget, action)) return;
    onStyleQuickAction(widget.id, action, options);
  };

  const chartItems =
    chartState && widget.type === "chart" ? (
      <>
        <ContextMenuSeparator className={menuSeparatorClass(colorScheme)} />
        {supportsWidgetQuickStyleAction(widget, "toggleLegend") ? (
          <StyleMenuItem
            colorScheme={colorScheme}
            label={chartState.legendVisible ? "隐藏图例" : "显示图例"}
            icon={<ListTree className="size-3.5" aria-hidden />}
            disabled={locked}
            onSelect={() => run("toggleLegend")}
          />
        ) : null}
        {supportsWidgetQuickStyleAction(widget, "toggleLabel") ? (
          <StyleMenuItem
            colorScheme={colorScheme}
            label={chartState.labelVisible ? "隐藏标签" : "显示标签"}
            icon={<Tag className="size-3.5" aria-hidden />}
            disabled={locked}
            onSelect={() => run("toggleLabel")}
          />
        ) : null}
        {supportsWidgetQuickStyleAction(widget, "setPalette") ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger className={menuSubTriggerClass(colorScheme)} disabled={locked}>
              <Palette className="size-3.5" aria-hidden />
              图表配色
              <span className="ml-auto truncate pl-2 text-xs text-gray-400">{chartState.paletteLabel}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent
              className={menuChromeClass(colorScheme)}
              data-dashboard-menu=""
              data-dashboard-color-scheme={colorScheme}
            >
              <StyleMenuItem
                colorScheme={colorScheme}
                label={CHART_PALETTE_INHERIT_LABEL}
                icon={<Palette className="size-3.5" aria-hidden />}
                disabled={locked || chartState.usingDashboardPalette}
                onSelect={() => run("setPalette", { paletteId: null })}
              />
              {CHART_PALETTE_CATALOG.map((preset) => (
                <StyleMenuItem
                  key={preset.id}
                  colorScheme={colorScheme}
                  label={preset.label}
                  icon={
                    <span
                      className="size-3.5 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: preset.colors[0] }}
                      aria-hidden
                    />
                  }
                  disabled={locked}
                  onSelect={() => run("setPalette", { paletteId: preset.id })}
                />
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
      </>
    ) : null;

  const dashboardItems = (
    <>
      {supportsWidgetQuickStyleAction(widget, "toggleTitle") ? (
        <StyleMenuItem
          colorScheme={colorScheme}
          label={state.titleVisible ? "隐藏标题" : "显示标题"}
          icon={<Type className="size-3.5" aria-hidden />}
          disabled={locked}
          onSelect={() => run("toggleTitle")}
        />
      ) : null}
      <StyleMenuItem
        colorScheme={colorScheme}
        label={state.backgroundShow ? "隐藏背景" : "显示背景"}
        icon={state.backgroundShow ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleBackground")}
        onSelect={() => run("toggleBackground")}
      />
      <StyleMenuItem
        colorScheme={colorScheme}
        label={state.borderEnabled ? "隐藏边框" : "显示边框"}
        icon={<Frame className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleBorder")}
        onSelect={() => run("toggleBorder")}
      />
      {chartItems}
    </>
  );

  const dataScreenItems = (
    <>
      <StyleMenuItem
        colorScheme={colorScheme}
        label={state.backdropBlur > 0 ? "关闭毛玻璃" : "开启毛玻璃"}
        icon={<Droplets className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleBackdropBlur")}
        onSelect={() => run("toggleBackdropBlur")}
      />
      <StyleMenuItem
        colorScheme={colorScheme}
        label={(state.opacity ?? 0) <= 0.05 ? "实体背景" : "透明背景"}
        icon={<Layers className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleTransparentBg")}
        onSelect={() => run("toggleTransparentBg")}
      />
      <StyleMenuItem
        colorScheme={colorScheme}
        label={state.borderEnabled ? "隐藏边框" : "显示边框"}
        icon={<Frame className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleBorder")}
        onSelect={() => run("toggleBorder")}
      />
      <StyleMenuItem
        colorScheme={colorScheme}
        label={state.backgroundShow ? "隐藏背景" : "显示背景"}
        icon={state.backgroundShow ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        disabled={locked || !supportsWidgetQuickStyleAction(widget, "toggleBackground")}
        onSelect={() => run("toggleBackground")}
      />
      {supportsWidgetQuickStyleAction(widget, "toggleTitle") ? (
        <StyleMenuItem
          colorScheme={colorScheme}
          label={state.titleVisible ? "隐藏标题" : "显示标题"}
          icon={<Type className="size-3.5" aria-hidden />}
          disabled={locked}
          onSelect={() => run("toggleTitle")}
        />
      ) : null}
      {chartItems}
    </>
  );

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={menuSubTriggerClass(colorScheme)} disabled={locked}>
        <Paintbrush className="size-3.5" aria-hidden />
        快捷样式
      </ContextMenuSubTrigger>
      <ContextMenuSubContent
        className={menuChromeClass(colorScheme)}
        data-dashboard-menu=""
        data-dashboard-color-scheme={colorScheme}
      >
        {surface === "data-screen" ? dataScreenItems : dashboardItems}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export { menuItemClass, menuSubTriggerClass, menuChromeClass };
