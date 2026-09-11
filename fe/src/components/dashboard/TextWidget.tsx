import { useRef, useState } from "react";
import { GripVertical, Trash2, Type } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import { RichTextEditor } from "./RichTextEditor";
import { TabNestedDragRail } from "./TabNestedDragRail";
import { WidgetInlineTitle } from "./WidgetInlineTitle";
import { isRichTextEmpty, textConfigToHtml } from "./richTextHtml";
import { ScreenBorderDisplay } from "./screen/ScreenBorderDisplay";
import { ScreenClockDisplay } from "./screen/ScreenClockDisplay";
import { ScreenDateTimeDisplay } from "./screen/ScreenDateTimeDisplay";
import { ScreenIconDisplay } from "./screen/ScreenIconDisplay";
import { ScreenShapeDisplay } from "./screen/ScreenShapeDisplay";
import type { LayoutWidget, TextWidgetConfig, DashboardStyleConfig } from "./layoutUtils";
import { normalizeScreenTitleBarStyle } from "@/lib/screenVisualStyle";
import { gridWidgetShellClassName, GridWidgetShellFrame, resolveGridWidgetShell } from "./widgetRailStyleSections";
import {
  isScreenBorderWidget,
  isScreenClockWidget,
  isScreenDateTimeWidget,
  isScreenIconWidget,
  isScreenShapeWidget,
  isScreenTitleBarWidget,
  isScreenVisualWidget,
} from "@/lib/screenVisualAssets";

type TextWidgetProps = {
  widget: LayoutWidget & { textConfig: TextWidgetConfig };
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  nested?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  onTextConfigChange?: (id: string, config: TextWidgetConfig) => void;
  dashboardStyle?: DashboardStyleConfig;
  showToolbarDelete?: boolean;
};

export function TextWidget({
  widget,
  mode,
  shell = "grid",
  nested = false,
  selected = false,
  onSelect,
  onDelete,
  onTitleChange,
  onTextConfigChange,
  dashboardStyle,
  showToolbarDelete = true,
}: TextWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const html = textConfigToHtml(widget.textConfig);
  const inShapeShell = shell === "shape";
  const screenClock = isScreenClockWidget(widget);
  const screenBorder = isScreenBorderWidget(widget);
  const screenTitleBar = isScreenTitleBarWidget(widget);
  const screenDateTime = isScreenDateTimeWidget(widget);
  const screenShape = isScreenShapeWidget(widget);
  const screenIcon = isScreenIconWidget(widget);
  const screenVisual = isScreenVisualWidget(widget);
  const screenStyle = widget.textConfig.screenStyle;
  const legacyTitleBarStyle = screenTitleBar
    ? normalizeScreenTitleBarStyle(screenStyle?.titleBar)
    : null;

  const beginEditing = () => {
    if (mode !== "edit" || screenVisual) return;
    onSelect?.();
    setIsEditing(true);
  };

  const commit = (nextHtml: string) => {
    onTextConfigChange?.(widget.id, {
      ...widget.textConfig,
      content: isRichTextEmpty(nextHtml) ? "" : nextHtml,
      variant: "html",
    });
    setIsEditing(false);
  };

  const cancel = () => {
    setIsEditing(false);
  };

  const showGridChrome = shell === "grid";
  const gridShell = resolveGridWidgetShell(widget, dashboardStyle);

  const content = (
    <div
      ref={widgetRef}
      className={cn(
        inShapeShell && screenVisual && "flex h-full min-h-0 w-full flex-1 flex-col",
        nested && inShapeShell && mode === "edit" && "pl-7",
        mode === "edit" && "group/text-widget",
      )}
      style={undefined}
    >
      {showGridChrome && mode === "edit" && !isEditing ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <div
            className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
            role="group"
            aria-label="拖动以移动组件"
          >
            <GripVertical className="size-3.5 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden />
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-theme-xs dark:bg-white/5">
            <Type className="size-3.5" aria-hidden />
          </span>
          <WidgetInlineTitle
            value={widget.title}
            editable={Boolean(onTitleChange)}
            onChange={onTitleChange ? (next) => onTitleChange(widget.id, next) : undefined}
            ariaLabel="富文本标题"
            testId={`widget-inline-title-${widget.id}`}
          />
          {onDelete && showToolbarDelete ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              className="dashboard-no-drag size-7 shrink-0 text-gray-400 hover:text-error-600"
              aria-label="删除组件"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : showGridChrome && mode === "view" ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
            <Type className="size-3.5" aria-hidden />
          </span>
          <h4 className="min-w-0 flex-1 truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
            {widget.title}
          </h4>
        </div>
      ) : null}

      <div
        data-testid="text-widget-content"
        role={mode === "edit" && !isEditing ? "button" : undefined}
        tabIndex={mode === "edit" && !isEditing ? 0 : undefined}
        onClick={
          mode === "edit" && !isEditing
            ? (event) => {
                event.stopPropagation();
                onSelect?.();
              }
            : undefined
        }
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!screenVisual) beginEditing();
        }}
        className={cn(
          "dashboard-no-drag min-h-0 flex-1",
          screenBorder ? "relative h-full overflow-hidden p-0" : "dashboard-scroll overflow-auto",
          mode === "edit" && !isEditing && "cursor-pointer",
          !screenBorder && !inShapeShell && mode === "edit" && !isEditing && "hover:bg-gray-50/50 dark:hover:bg-white/[0.02]",
        )}
      >
        {isEditing ? (
          <RichTextEditor
            anchorRef={widgetRef}
            initialHtml={html}
            inset={inShapeShell ? "none" : "comfortable"}
            onCommit={commit}
            onCancel={cancel}
          />
        ) : screenClock ? (
          <ScreenClockDisplay styleConfig={screenStyle?.clock} />
        ) : screenBorder ? (
          <ScreenBorderDisplay className="absolute inset-0" styleConfig={screenStyle?.border} />
        ) : screenTitleBar && legacyTitleBarStyle ? (
          <div
            data-screen-title-bar-legacy
            className="flex h-full items-center justify-center px-6 text-center font-semibold tracking-wide"
            style={{
              color: legacyTitleBarStyle.titleColor,
              fontSize: legacyTitleBarStyle.fontSize,
            }}
          >
            {widget.title || "数据大屏标题"}
          </div>
        ) : screenDateTime ? (
          <ScreenDateTimeDisplay styleConfig={screenStyle?.datetime} />
        ) : screenShape ? (
          <ScreenShapeDisplay styleConfig={screenStyle?.shape} />
        ) : screenIcon ? (
          <ScreenIconDisplay styleConfig={screenStyle?.icon} />
        ) : isRichTextEmpty(html) && mode === "edit" ? (
          <p
            className={cn(
              "hidden h-full items-center justify-center text-gray-400 group-hover/text-widget:flex",
              inShapeShell ? "px-2 text-theme-xs" : "p-3 text-theme-sm",
            )}
          >
            双击编辑文字
          </p>
        ) : isRichTextEmpty(html) ? null : (
          <div
            className={cn(
              "rich-main-class text-gray-700 dark:text-gray-300",
              inShapeShell ? "px-2 py-1.5" : "p-4",
            )}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );

  if (inShapeShell && nested) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {mode === "edit" ? (
          <TabNestedDragRail widgetId={widget.id} className="h-full w-7" />
        ) : null}
        {content}
      </div>
    );
  }

  if (showGridChrome) {
    return (
      <GridWidgetShellFrame
        shell={gridShell}
        widgetId={widget.id}
        className={cn(
          gridWidgetShellClassName(true, Boolean(selected && !isEditing)),
          isEditing && "ring-2 ring-brand-500/50 border-brand-400 dark:border-brand-500/60",
        )}
      >
        {content}
      </GridWidgetShellFrame>
    );
  }

  return content;
}
