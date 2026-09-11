import { useMemo, type MouseEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Filter,
  Image,
  LayoutList,
  Lock,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import {
  moveWidget,
  sortWidgets,
  type LayoutWidget,
} from "@/components/dashboard/layoutUtils";
import { resolveScreenWidgetLayerLabel } from "@/lib/screenVisualAssets";
import { IconButton } from "@/components/ui/button";
import { WidgetInlineTitle } from "@/components/dashboard/WidgetInlineTitle";
import { widgetChartIcon } from "@/components/dashboard/widgetIcons";
import { cn } from "@/lib/utils";

export type LayerPanelProps = {
  widgets: LayoutWidget[];
  selectedId?: string | null;
  onSelect: (widgetId: string) => void;
  onWidgetsChange: (widgets: LayoutWidget[]) => void;
  onDelete?: (widgetId: string) => void;
  onBringToFront?: (widgetId: string) => void;
  onSendToBack?: (widgetId: string) => void;
  className?: string;
};

type LayerRow = {
  widget: LayoutWidget;
  depth: number;
  sortReadOnly?: boolean;
  stackRank?: number;
  stackTotal?: number;
};

function buildLayerRows(widgets: LayoutWidget[]): LayerRow[] {
  const topLevel = sortWidgets(widgets.filter((w) => !w.parentTabsId)).reverse();
  const rows: LayerRow[] = [];
  const stackTotal = topLevel.length;
  let stackRank = stackTotal;
  for (const widget of topLevel) {
    rows.push({ widget, depth: 0, stackRank: stackRank--, stackTotal });
    if (widget.type === "tabs" && widget.tabsConfig) {
      const childIds = widget.tabsConfig.panes.flatMap((pane) => pane.childWidgetIds);
      for (const childId of childIds) {
        const child = widgets.find((w) => w.id === childId);
        if (child) rows.push({ widget: child, depth: 1, sortReadOnly: true });
      }
    }
  }
  return rows;
}

function resolveLayerWidgetIcon(widget: LayoutWidget) {
  if (widget.type === "chart" && widget.chartConfig?.chartType) {
    return widgetChartIcon(widget.chartConfig.chartType);
  }
  if (widget.type === "filter") return Filter;
  if (widget.type === "media") return Image;
  if (widget.type === "tabs") return LayoutList;
  return Type;
}

function stopRowSelect(event: MouseEvent) {
  event.stopPropagation();
}

export function LayerPanel({
  widgets,
  selectedId,
  onSelect,
  onWidgetsChange,
  onDelete,
  onBringToFront,
  onSendToBack,
  className,
}: LayerPanelProps) {
  const rows = useMemo(() => buildLayerRows(widgets), [widgets]);
  const topLevelCount = rows.filter((row) => row.depth === 0).length;
  const showStackHints = Boolean(onBringToFront || onSendToBack);

  const patchWidget = (id: string, patch: Partial<LayoutWidget>) => {
    onWidgetsChange(widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  return (
    <section className={cn("flex min-h-0 flex-col", className)} data-layer-panel>
      <header className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">图层管理</h3>
          <p className="text-[10px] leading-snug text-gray-400 dark:text-gray-500">
            自上而下为叠放顺序；点击图层可选中组件
            {showStackHints ? "，画布重叠处 Alt+点击可轮换" : ""}
          </p>
        </div>
        <span className="shrink-0 text-theme-xs text-gray-500">{topLevelCount} 项</span>
      </header>

      <ul className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {rows.map(({ widget, depth, sortReadOnly, stackRank, stackTotal }) => {
          const Icon = resolveLayerWidgetIcon(widget);
          const selected = selectedId === widget.id;
          return (
            <li key={widget.id}>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "group flex cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors",
                  depth > 0 && "ml-3 border-dashed",
                  selected
                    ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700",
                  widget.hidden && "opacity-50",
                )}
                onClick={() => onSelect(widget.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(widget.id);
                  }
                }}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    selected
                      ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
                      : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1 py-0.5">
                  <WidgetInlineTitle
                    value={resolveScreenWidgetLayerLabel(widget)}
                    editable={selected}
                    ariaLabel="图层名称"
                    className="!px-0 !text-theme-xs !font-medium"
                    onChange={(title) => patchWidget(widget.id, { title })}
                  />
                  {depth > 0 ? (
                    <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">Tab 内嵌</p>
                  ) : stackTotal && stackTotal > 1 && stackRank ? (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      叠放 {stackRank}/{stackTotal}
                      {stackRank === stackTotal ? " · 最前" : stackRank === 1 ? " · 最后" : ""}
                    </p>
                  ) : null}
                </div>

                <div
                  className="flex shrink-0 items-center gap-px"
                  onClick={stopRowSelect}
                  onKeyDown={stopRowSelect}
                >
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={cn(
                      "dashboard-no-drag size-7",
                      widget.hidden
                        ? "bg-gray-100 text-gray-400 dark:bg-white/10"
                        : "text-gray-600 dark:text-gray-300",
                    )}
                    aria-label={widget.hidden ? "显示图层" : "隐藏图层"}
                    tooltip={widget.hidden ? "显示" : "隐藏"}
                    onClick={() => patchWidget(widget.id, { hidden: !widget.hidden })}
                  >
                    {widget.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={cn(
                      "dashboard-no-drag size-7",
                      widget.locked
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                        : "text-gray-600 dark:text-gray-300",
                    )}
                    aria-label={widget.locked ? "解锁图层" : "锁定图层"}
                    tooltip={widget.locked ? "解锁" : "锁定"}
                    onClick={() => patchWidget(widget.id, { locked: !widget.locked })}
                  >
                    {widget.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                  </IconButton>
                  {!sortReadOnly ? (
                    <>
                      {onBringToFront ? (
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="dashboard-no-drag size-7 opacity-70 group-hover:opacity-100"
                          aria-label="置于顶层"
                          tooltip="置于顶层"
                          onClick={() => onBringToFront(widget.id)}
                        >
                          <ChevronUp className="size-3.5" />
                        </IconButton>
                      ) : null}
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="dashboard-no-drag size-7 opacity-70 group-hover:opacity-100"
                        aria-label="上移一层"
                        tooltip="上移一层"
                        onClick={() => onWidgetsChange(moveWidget(widgets, widget.id, "down"))}
                      >
                        <ArrowUp className="size-3.5" />
                      </IconButton>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="dashboard-no-drag size-7 opacity-70 group-hover:opacity-100"
                        aria-label="下移一层"
                        tooltip="下移一层"
                        onClick={() => onWidgetsChange(moveWidget(widgets, widget.id, "up"))}
                      >
                        <ArrowDown className="size-3.5" />
                      </IconButton>
                      {onSendToBack ? (
                        <IconButton
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="dashboard-no-drag size-7 opacity-70 group-hover:opacity-100"
                          aria-label="置于底层"
                          tooltip="置于底层"
                          onClick={() => onSendToBack(widget.id)}
                        >
                          <ChevronDown className="size-3.5" />
                        </IconButton>
                      ) : null}
                    </>
                  ) : null}
                  {onDelete ? (
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="dashboard-no-drag size-7 text-gray-500 hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                      aria-label="删除图层"
                      tooltip="删除"
                      onClick={() => onDelete(widget.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
        {topLevelCount === 0 ? (
          <li className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-theme-xs text-gray-500 dark:border-gray-800">
            画布中暂无组件
          </li>
        ) : null}
      </ul>
    </section>
  );
}
