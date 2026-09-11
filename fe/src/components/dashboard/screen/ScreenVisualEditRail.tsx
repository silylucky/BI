import { cn } from "@/lib/utils";
import type { LayoutWidget, TextWidgetConfig } from "@/components/dashboard/layoutUtils";
import {
  isScreenBorderWidget,
  isScreenClockWidget,
  isScreenDateTimeWidget,
  isScreenIconWidget,
  isScreenShapeWidget,
} from "@/lib/screenVisualAssets";
import { WidgetInspectorDelete } from "@/components/dashboard/widget-inspector-delete";
import { WidgetRailPanelHeader } from "@/components/dashboard/widgetRailChrome";
import { WidgetComponentNameSection, WidgetShellBackgroundSection } from "@/components/dashboard/widgetRailStyleSections";
import {
  ScreenIconStylePanel,
  ScreenShapeStylePanel,
} from "./ScreenMaterialStylePanels";
import {
  patchScreenVisualStyle,
  ScreenBorderStylePanel,
  ScreenClockStylePanel,
  ScreenDateTimeStylePanel,
} from "./ScreenVisualStylePanels";

export type ScreenVisualEditRailProps = {
  widget: LayoutWidget & { textConfig: NonNullable<LayoutWidget["textConfig"]> };
  onTitleChange?: (title: string) => void;
  onTextConfigChange?: (config: TextWidgetConfig) => void;
  onDelete?: () => void;
  onRailCollapse?: () => void;
  className?: string;
};

export function ScreenVisualEditRail({
  widget,
  onTitleChange,
  onTextConfigChange,
  onDelete,
  onRailCollapse,
  className,
}: ScreenVisualEditRailProps) {
  const isClock = isScreenClockWidget(widget);
  const isBorder = isScreenBorderWidget(widget);
  const isDateTime = isScreenDateTimeWidget(widget);
  const isShape = isScreenShapeWidget(widget);
  const isIcon = isScreenIconWidget(widget);
  const kindLabel = isClock
    ? "时钟"
    : isBorder
      ? "边框"
      : isDateTime
        ? "日期时间"
        : isShape
          ? "图形"
          : isIcon
            ? "图标"
            : "素材";
  const screenStyle = widget.textConfig.screenStyle ?? {};

  const patchStyle = (
    key: "clock" | "datetime" | "border" | "shape" | "icon",
    partial: object,
  ) => {
    onTextConfigChange?.({
      ...widget.textConfig,
      screenStyle: patchScreenVisualStyle(screenStyle, key, partial),
    });
  };

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-white dark:bg-gray-900", className)}>
      <WidgetRailPanelHeader
        title={widget.title || kindLabel}
        subtitle={`素材 · ${kindLabel}`}
        onCollapse={onRailCollapse}
        collapseAriaLabel="收起配置"
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar px-2 py-1.5">
        <div className="flex flex-col gap-0" data-testid="screen-visual-style-panel">
          <WidgetComponentNameSection
            widgetId={widget.id}
            title={widget.title}
            onTitleChange={onTitleChange}
          />

          <WidgetShellBackgroundSection
            value={widget.textConfig.widgetStyle ?? {}}
            onChange={(patch) =>
              onTextConfigChange?.({
                ...widget.textConfig,
                widgetStyle: { ...widget.textConfig.widgetStyle, ...patch },
              })
            }
          />

          {isClock ? (
            <ScreenClockStylePanel
              value={screenStyle.clock}
              onChange={(clock) => patchStyle("clock", clock)}
            />
          ) : isDateTime ? (
            <ScreenDateTimeStylePanel
              value={screenStyle.datetime}
              onChange={(datetime) => patchStyle("datetime", datetime)}
            />
          ) : isBorder ? (
            <ScreenBorderStylePanel
              value={screenStyle.border}
              onChange={(border) => patchStyle("border", border)}
            />
          ) : isShape ? (
            <ScreenShapeStylePanel
              value={screenStyle.shape}
              onChange={(shape) => patchStyle("shape", shape)}
            />
          ) : isIcon ? (
            <ScreenIconStylePanel
              value={screenStyle.icon}
              onChange={(icon) => patchStyle("icon", icon)}
            />
          ) : null}
        </div>
      </div>

      {onDelete ? (
        <div className="shrink-0 border-t border-gray-200 px-3 py-2 dark:border-gray-800">
          <WidgetInspectorDelete widgetTitle={widget.title} onDelete={onDelete} embedded />
        </div>
      ) : null}
    </div>
  );
}
