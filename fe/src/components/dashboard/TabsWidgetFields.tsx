import { Filter, ImageIcon, Plus, Trash2, Type } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/randomId";
import type { LayoutWidget, TabsWidgetConfig } from "./layoutUtils";
import { TABS_CAROUSEL_MIN_INTERVAL_SEC, getTabChildWidgets } from "./layoutUtils";
import { InspectorPanelSection } from "./inspector-panel-section";
import { DE_INPUT, DeAttrToggleRow } from "./dashboardInspectorUi";
import { INSPECTOR_HINT, InspectorSubtleEmpty } from "./inspectorCompact";
import { widgetChartIcon, WIDGET_CHART_LABELS } from "./widgetIcons";

const MAX_PANES = 8;

function tabChildTypeLabel(widget: LayoutWidget): string {
  if (widget.type === "chart") {
    return WIDGET_CHART_LABELS[widget.chartConfig?.chartType ?? "bar"] ?? "图表";
  }
  if (widget.type === "media") return "图片";
  if (widget.type === "text") return "富文本";
  if (widget.type === "filter") return "筛选器";
  return widget.type;
}

function TabChildTypeIcon({ widget }: { widget: LayoutWidget }) {
  const className = "size-3.5 shrink-0 text-gray-500 dark:text-gray-400";
  if (widget.type === "media") return <ImageIcon className={className} aria-hidden />;
  if (widget.type === "text") return <Type className={className} aria-hidden />;
  if (widget.type === "filter") return <Filter className={className} aria-hidden />;
  if (widget.type === "chart") {
    const Icon = widgetChartIcon(widget.chartConfig?.chartType ?? "bar");
    return <Icon className={className} aria-hidden />;
  }
  return null;
}

export type TabsPaneListProps = {
  widget: LayoutWidget & { tabsConfig: TabsWidgetConfig };
  allWidgets: LayoutWidget[];
  selectedChildId?: string | null;
  onChange: (tabsConfig: TabsWidgetConfig) => void;
  onSelectChild?: (childId: string) => void;
};

export function TabsPaneList({
  widget,
  allWidgets,
  selectedChildId,
  onChange,
  onSelectChild,
}: TabsPaneListProps) {
  const cfg = widget.tabsConfig;
  const paneSummaries = cfg.panes.map((pane) => ({
    pane,
    children: getTabChildWidgets(allWidgets, widget.id, pane.id),
  }));
  const totalChildren = paneSummaries.reduce((sum, item) => sum + item.children.length, 0);

  const updatePaneTitle = (paneId: string, title: string) => {
    onChange({
      ...cfg,
      panes: cfg.panes.map((p) => (p.id === paneId ? { ...p, title } : p)),
    });
  };

  const setActivePane = (paneId: string) => {
    onChange({ ...cfg, activePaneId: paneId });
  };

  const focusChild = (paneId: string, childId: string) => {
    if (cfg.activePaneId !== paneId) {
      onChange({ ...cfg, activePaneId: paneId });
    }
    onSelectChild?.(childId);
  };

  const addPane = () => {
    if (cfg.panes.length >= MAX_PANES) return;
    const id = randomId();
    onChange({
      ...cfg,
      panes: [...cfg.panes, { id, title: `页签 ${cfg.panes.length + 1}`, childWidgetIds: [] }],
      activePaneId: id,
    });
  };

  const removePane = (paneId: string) => {
    if (cfg.panes.length <= 1) return;
    const panes = cfg.panes.filter((p) => p.id !== paneId);
    const activePaneId =
      cfg.activePaneId === paneId ? panes[0]?.id ?? panes[panes.length - 1].id : cfg.activePaneId;
    onChange({ ...cfg, panes, activePaneId });
  };

  return (
    <InspectorPanelSection
      title="页签列表"
      description={`共 ${cfg.panes.length} 个页签 · ${totalChildren} 个组件`}
      action={
        cfg.panes.length < MAX_PANES ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2.5 text-theme-xs"
            onClick={addPane}
          >
            <Plus className="size-3.5" aria-hidden />
            添加
          </Button>
        ) : null
      }
    >
      <div className="space-y-1">
        {paneSummaries.map(({ pane, children }, index) => {
          const active = pane.id === cfg.activePaneId;
          const childCount = children.length;
          const showChildren =
            children.length > 0 && (active || children.some((child) => child.id === selectedChildId));
          return (
            <div key={pane.id} className="space-y-0.5">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors",
                  active
                    ? "border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums transition-colors",
                    active
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300",
                  )}
                  aria-label={`切换到页签 ${index + 1}`}
                  aria-pressed={active}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={() => setActivePane(pane.id)}
                >
                  {index + 1}
                </button>
                <Input
                  id={`tab-pane-${pane.id}`}
                  className={cn(DE_INPUT, "h-7 min-w-0 flex-1 px-2 text-[11px]")}
                  value={pane.title}
                  onChange={(e) => updatePaneTitle(pane.id, e.target.value)}
                  aria-label={`页签 ${index + 1} 名称`}
                />
                {childCount > 0 && onSelectChild ? (
                  <button
                    type="button"
                    className={cn(
                      "shrink-0 rounded px-1 py-0.5 text-[10px] tabular-nums transition-colors",
                      active
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                        : "text-gray-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-400",
                    )}
                    aria-label={`查看页签 ${pane.title} 内的 ${childCount} 个组件`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                    }}
                    onClick={() => focusChild(pane.id, children[0]!.id)}
                  >
                    {childCount}
                  </button>
                ) : (
                  <span className="shrink-0 px-1 text-[10px] tabular-nums text-gray-300 dark:text-gray-600">
                    0
                  </span>
                )}
                {cfg.panes.length > 1 ? (
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-6 shrink-0 text-gray-400 hover:text-error-500"
                    aria-label={`删除页签 ${pane.title}`}
                    onClick={() => removePane(pane.id)}
                  >
                    <Trash2 className="size-3" />
                  </IconButton>
                ) : null}
              </div>
              {showChildren ? (
                <div className="ml-2 space-y-0.5 border-l border-gray-200 pl-1.5 dark:border-gray-800">
                  {children.map((child) => {
                    const childSelected = selectedChildId === child.id;
                    const typeLabel = tabChildTypeLabel(child);
                    const displayTitle = child.title?.trim() || typeLabel;
                    const showTypeBadge = displayTitle !== typeLabel;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className={cn(
                          "flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors",
                          childSelected
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.04]",
                        )}
                        aria-label={`配置 ${displayTitle}`}
                        aria-current={childSelected ? "true" : undefined}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                        onClick={() => focusChild(pane.id, child.id)}
                      >
                        <TabChildTypeIcon widget={child} />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                          {displayTitle}
                        </span>
                        {showTypeBadge ? (
                          <span className="shrink-0 text-[9px] text-gray-400 dark:text-gray-500">
                            {typeLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : childCount === 0 && active ? (
                <InspectorSubtleEmpty message="拖入组件或从工具栏添加" className="ml-2" />
              ) : null}
            </div>
          );
        })}
      </div>
    </InspectorPanelSection>
  );
}

export { TabsWidgetStylePanel as TabsStyleFields } from "./widgetRailStyleSections";

export function TabsCarouselFields({
  cfg,
  onChange,
}: {
  cfg: TabsWidgetConfig;
  onChange: (tabsConfig: TabsWidgetConfig) => void;
}) {
  const carousel = cfg.carousel ?? { enabled: false, intervalSec: 5 };
  const intervalSec = Math.max(TABS_CAROUSEL_MIN_INTERVAL_SEC, carousel.intervalSec);

  return (
    <InspectorPanelSection title="预览轮播">
      <DeAttrToggleRow
        label="自动轮播"
        description="仅在预览/投放态生效"
        checked={carousel.enabled}
        onCheckedChange={(enabled) =>
          onChange({
            ...cfg,
            carousel: { enabled, intervalSec },
          })
        }
      />
      {carousel.enabled ? (
        <div className="mt-2">
          <label className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
            间隔（秒，≥{TABS_CAROUSEL_MIN_INTERVAL_SEC}）
          </label>
          <Input
            type="number"
            min={TABS_CAROUSEL_MIN_INTERVAL_SEC}
            className={DE_INPUT}
            value={intervalSec}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
              onChange({
                ...cfg,
                carousel: {
                  enabled: true,
                  intervalSec: Math.max(TABS_CAROUSEL_MIN_INTERVAL_SEC, Math.round(next)),
                },
              });
            }}
          />
        </div>
      ) : null}
    </InspectorPanelSection>
  );
}
