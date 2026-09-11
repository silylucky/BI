import { useState } from "react";
import { Filter as FilterIcon, GripVertical, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconButton } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { FilterControl } from "./FilterWidgetControls";
import { TabNestedDragRail } from "./TabNestedDragRail";
import { WidgetInlineTitle } from "./WidgetInlineTitle";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import type { FilterWidgetConfig, LayoutWidget, DashboardStyleConfig } from "./layoutUtils";
import { mergeTitleStyle } from "./dashboardStyleConfig";
import {
  gridWidgetShellClassName,
  GridWidgetShellFrame,
  resolveGridWidgetShell,
} from "./widgetRailStyleSections";

type FilterWidgetProps = {
  widget: LayoutWidget & { filterConfig: FilterWidgetConfig };
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  nested?: boolean;
  selected?: boolean;
  value: string;
  onValueChange: (filterId: string, value: string) => void;
  onSelect?: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  dashboardStyle?: DashboardStyleConfig;
  showToolbarDelete?: boolean;
};

export function FilterWidget({
  widget,
  mode,
  shell = "grid",
  nested = false,
  selected = false,
  value,
  onValueChange,
  onSelect,
  onDelete,
  onTitleChange,
  dashboardStyle,
  showToolbarDelete = true,
}: FilterWidgetProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cfg = widget.filterConfig;
  const controlId = `fw-${widget.id}`;
  const shellStyle = resolveGridWidgetShell(widget, dashboardStyle);
  const titleStyle = mergeTitleStyle(dashboardStyle?.titleStyle, {
    color: dashboardStyle?.filterChromeStyle?.titleColor,
  });
  const labelStyle = dashboardStyle?.filterChromeStyle?.titleColor
    ? { color: dashboardStyle.filterChromeStyle.titleColor }
    : undefined;
  const controlHeight = dashboardStyle?.filterControlStyle?.height;
  const controlRadius = dashboardStyle?.filterControlStyle?.borderRadius;
  const labelPosition = dashboardStyle?.filterChromeStyle?.titlePosition ?? "top";
  const inShapeShell = shell === "shape";
  const showGridChrome = shell === "grid";

  const filterBody = (
    <div
      role={mode === "edit" ? "button" : undefined}
      tabIndex={mode === "edit" ? 0 : undefined}
      onClick={
        mode === "edit"
          ? (e) => {
              e.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
      onKeyDown={
        mode === "edit"
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "dashboard-no-drag flex min-h-0 flex-1 items-start p-3",
        mode === "edit" && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]",
        nested && mode === "edit" && "pl-7",
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FilterControl
        id={controlId}
        label={widget.title || cfg.dimensionRef}
        placeholder={cfg.dimensionRef ? `输入${cfg.dimensionRef}` : "输入筛选值"}
        controlType={cfg.controlType}
        value={value}
        options={cfg.options}
        onChange={(next) => onValueChange(cfg.filterId, next)}
        className="w-full max-w-none sm:max-w-none"
        inputStyle={{
          height: controlHeight ? `${controlHeight}px` : undefined,
          borderRadius: controlRadius ? `${controlRadius}px` : undefined,
        }}
        labelPosition={labelPosition}
        labelStyle={labelStyle}
      />
    </div>
  );

  const deleteDialog = onDelete ? (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除组件</AlertDialogTitle>
          <AlertDialogDescription>
            确定删除「{widget.title}」？删除后需保存布局才会生效。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onDelete(widget.id);
              setConfirmOpen(false);
            }}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  if (inShapeShell) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {nested && mode === "edit" ? (
          <TabNestedDragRail widgetId={widget.id} className="h-full w-7" />
        ) : null}
        {filterBody}
        {deleteDialog}
      </div>
    );
  }

  return (
    <GridWidgetShellFrame
      shell={shellStyle}
      widgetId={widget.id}
      className={gridWidgetShellClassName(showGridChrome, Boolean(selected), shellStyle.className)}
    >
      {showGridChrome && mode === "edit" ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <HintTooltip label="拖动以移动组件">
            <div
              className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
              role="group"
              aria-label="拖动以移动组件"
            >
              <GripVertical
                className="size-3.5 shrink-0 text-gray-300 dark:text-gray-600"
                aria-hidden
              />
            </div>
          </HintTooltip>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-theme-xs dark:bg-white/5 dark:text-gray-400">
            <FilterIcon className="size-3.5" aria-hidden />
          </span>
          <WidgetInlineTitle
            value={widget.title}
            editable={Boolean(onTitleChange)}
            onChange={onTitleChange ? (next) => onTitleChange(widget.id, next) : undefined}
            titleStyle={titleStyle}
            ariaLabel="筛选器标题"
            testId={`widget-inline-title-${widget.id}`}
          />
          {onDelete && showToolbarDelete ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              className="dashboard-no-drag size-7 shrink-0 text-gray-400 hover:text-error-600 dark:hover:text-error-400"
              aria-label="删除组件"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : showGridChrome && mode === "view" ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
            <FilterIcon className="size-3.5" aria-hidden />
          </span>
          <h4
            className="min-w-0 flex-1 truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90"
            style={titleStyle}
          >
            {widget.title}
          </h4>
          <span className="shrink-0 text-theme-xs text-gray-400">筛选器</span>
        </div>
      ) : null}
      {filterBody}
      {deleteDialog}
    </GridWidgetShellFrame>
  );
}
