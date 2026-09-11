import { ChevronsDown, ChevronsUp, ClipboardPaste, Copy, Eye, EyeOff, Lock, Maximize2, Trash2, Unlock, ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ColorScheme, DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { LayoutWidget } from "./layoutUtils";
import {
  WidgetContextMenuStyleItems,
  menuItemClass,
} from "./WidgetContextMenuStyleItems";
import type { WidgetContextMenuSurface, WidgetQuickStyleAction, WidgetQuickStyleActionOptions } from "./widgetContextMenuStyle";

export type DashboardWidgetActions = {
  surface?: WidgetContextMenuSurface;
  dashboardStyle?: Pick<DashboardStyleConfig, "widgetStyle" | "titleStyle" | "paletteId" | "paletteColors">;
  onCopy?: (widgetId: string) => void;
  onPaste?: () => void;
  clipboardReady?: boolean;
  onDelete?: (widgetId: string) => void;
  onBringToFront?: (widgetId: string) => void;
  onSendToBack?: (widgetId: string) => void;
  onStyleQuickAction?: (
    widgetId: string,
    action: WidgetQuickStyleAction,
    options?: WidgetQuickStyleActionOptions,
  ) => void;
  showLayerActions?: boolean;
  onMoveLayerUp?: (widgetId: string) => void;
  onMoveLayerDown?: (widgetId: string) => void;
  onToggleHidden?: (widgetId: string) => void;
  onToggleLocked?: (widgetId: string) => void;
  onEnlarge?: (widgetId: string) => void;
  onViewData?: (widgetId: string) => void;
  onTitleChange?: (widgetId: string, title: string) => void;
};

/** @deprecated 使用 {@link DashboardWidgetActions} */
export type PixelWidgetActions = DashboardWidgetActions;

type WidgetContextMenuContentProps = {
  widget: Pick<
    LayoutWidget,
    "id" | "type" | "locked" | "hidden" | "chartConfig" | "textConfig" | "mediaConfig" | "tabsConfig"
  >;
  actions: DashboardWidgetActions;
  colorScheme?: ColorScheme;
};

function DataScreenLayerMenuItems({
  widget,
  actions,
  colorScheme,
}: {
  widget: Pick<LayoutWidget, "id" | "locked" | "hidden">;
  actions: DashboardWidgetActions;
  colorScheme: ColorScheme;
}) {
  const locked = Boolean(widget.locked);
  const hidden = Boolean(widget.hidden);

  return (
    <>
      {actions.onMoveLayerUp ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onMoveLayerUp?.(widget.id)}
        >
          <ArrowUp className="size-3.5" aria-hidden />
          上移一层
        </ContextMenuItem>
      ) : null}
      {actions.onMoveLayerDown ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onMoveLayerDown?.(widget.id)}
        >
          <ArrowDown className="size-3.5" aria-hidden />
          下移一层
        </ContextMenuItem>
      ) : null}
      {actions.onBringToFront ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onBringToFront?.(widget.id)}
        >
          <ChevronsUp className="size-3.5" aria-hidden />
          置顶
        </ContextMenuItem>
      ) : null}
      {actions.onSendToBack ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onSendToBack?.(widget.id)}
        >
          <ChevronsDown className="size-3.5" aria-hidden />
          置底
        </ContextMenuItem>
      ) : null}
      {actions.onToggleHidden ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onToggleHidden?.(widget.id)}
        >
          {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
          {hidden ? "显示图层" : "隐藏图层"}
        </ContextMenuItem>
      ) : null}
      {actions.onToggleLocked ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          onSelect={() => actions.onToggleLocked?.(widget.id)}
        >
          {locked ? <Unlock className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
          {locked ? "解锁图层" : "锁定图层"}
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator className={menuSeparatorClass(colorScheme)} />
    </>
  );
}

export function WidgetContextMenuContent({
  widget,
  actions,
  colorScheme = "light",
}: WidgetContextMenuContentProps) {
  const locked = Boolean(widget.locked);
  const surface = actions.surface ?? "dashboard";

  return (
    <>
      <ContextMenuItem
        className={menuItemClass(colorScheme)}
        disabled={locked || !actions.onCopy}
        onSelect={() => actions.onCopy?.(widget.id)}
      >
        <Copy className="size-3.5" aria-hidden />
        复制
      </ContextMenuItem>
      <ContextMenuItem
        className={menuItemClass(colorScheme)}
        disabled={locked || !actions.onPaste || !actions.clipboardReady}
        onSelect={() => actions.onPaste?.()}
      >
        <ClipboardPaste className="size-3.5" aria-hidden />
        粘贴
      </ContextMenuItem>
      {widget.type === "chart" && actions.onEnlarge ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onEnlarge?.(widget.id)}
        >
          <Maximize2 className="size-3.5" aria-hidden />
          放大
        </ContextMenuItem>
      ) : null}
      {(widget.type === "chart" || widget.type === "customViz") && actions.onViewData ? (
        <ContextMenuItem
          className={menuItemClass(colorScheme)}
          disabled={locked}
          onSelect={() => actions.onViewData?.(widget.id)}
        >
          <Eye className="size-3.5" aria-hidden />
          查看数据
        </ContextMenuItem>
      ) : null}
      {surface === "data-screen" &&
      (actions.onMoveLayerUp ||
        actions.onMoveLayerDown ||
        actions.onBringToFront ||
        actions.onSendToBack ||
        actions.onToggleHidden ||
        actions.onToggleLocked) ? (
        <DataScreenLayerMenuItems widget={widget} actions={actions} colorScheme={colorScheme} />
      ) : null}
      {surface !== "data-screen" && actions.showLayerActions ? (
        <>
          <ContextMenuItem
            className={menuItemClass(colorScheme)}
            disabled={locked || !actions.onBringToFront}
            onSelect={() => actions.onBringToFront?.(widget.id)}
          >
            <ChevronsUp className="size-3.5" aria-hidden />
            置顶
          </ContextMenuItem>
          <ContextMenuItem
            className={menuItemClass(colorScheme)}
            disabled={locked || !actions.onSendToBack}
            onSelect={() => actions.onSendToBack?.(widget.id)}
          >
            <ChevronsDown className="size-3.5" aria-hidden />
            置底
          </ContextMenuItem>
        </>
      ) : null}
      <WidgetContextMenuStyleItems
        widget={widget}
        surface={surface}
        dashboardStyle={actions.dashboardStyle}
        locked={locked}
        onStyleQuickAction={actions.onStyleQuickAction}
        colorScheme={colorScheme}
      />
      <ContextMenuSeparator className={menuSeparatorClass(colorScheme)} />
      <ContextMenuItem
        variant="destructive"
        className={menuItemClass(colorScheme, true)}
        disabled={locked || !actions.onDelete}
        onSelect={() => actions.onDelete?.(widget.id)}
      >
        <Trash2 className="size-3.5" aria-hidden />
        删除
      </ContextMenuItem>
    </>
  );
}

function menuSeparatorClass(scheme: ColorScheme): string | undefined {
  return scheme === "dark" ? "bg-gray-800" : undefined;
}

type DashboardWidgetContextMenuProps = {
  widget: Pick<
    LayoutWidget,
    "id" | "type" | "locked" | "hidden" | "chartConfig" | "textConfig" | "mediaConfig" | "tabsConfig"
  >;
  actions: DashboardWidgetActions;
  colorScheme?: ColorScheme;
  selected?: boolean;
  onSelect?: (widgetId: string, additive: boolean) => void;
  children: ReactNode;
  className?: string;
  /** 测试用：受控展开菜单 */
  open?: boolean;
};

export function DashboardWidgetContextMenu({
  widget,
  actions,
  colorScheme = "light",
  selected,
  onSelect,
  children,
  className,
  open,
}: DashboardWidgetContextMenuProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !selected) {
      onSelect?.(widget.id, false);
    }
  };

  return (
    <ContextMenu
      modal={false}
      onOpenChange={handleOpenChange}
      {...(open !== undefined ? { open } : {})}
    >
      <ContextMenuTrigger asChild className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className={
          colorScheme === "dark"
            ? "z-[90] min-w-[10.5rem] border-gray-700 bg-gray-900 text-gray-300"
            : "z-[90] min-w-[10.5rem] border-gray-200 bg-white text-gray-700"
        }
        data-dashboard-menu=""
        data-dashboard-color-scheme={colorScheme}
        data-testid={`widget-context-menu-${widget.id}`}
      >
        <WidgetContextMenuContent widget={widget} actions={actions} colorScheme={colorScheme} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
