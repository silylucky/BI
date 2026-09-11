import { cn } from "@/lib/utils";
import type { LayoutWidget, TabsWidgetConfig } from "./layoutUtils";
import { ChartInspectorTabs } from "./ChartInspectorTabs";
import { WidgetInspectorDelete } from "./widget-inspector-delete";
import { TabsPaneList, TabsCarouselFields } from "./TabsWidgetFields";
import { TabsWidgetStylePanel } from "./widgetRailStyleSections";
import { WidgetRailPanelHeader } from "./widgetRailChrome";
import { INSPECTOR_HINT } from "./inspectorCompact";

type TabsEditRailProps = {
  widget: LayoutWidget & { tabsConfig: TabsWidgetConfig };
  allWidgets: LayoutWidget[];
  selectedChildId?: string | null;
  onChange: (tabsConfig: TabsWidgetConfig) => void;
  onSelectChild?: (childId: string) => void;
  onTitleChange?: (title: string) => void;
  onDelete?: () => void;
  onRailCollapse?: () => void;
  className?: string;
};

export function TabsEditRail({
  widget,
  allWidgets,
  selectedChildId,
  onChange,
  onSelectChild,
  onTitleChange,
  onDelete,
  onRailCollapse,
  className,
}: TabsEditRailProps) {
  const cfg = widget.tabsConfig;
  const activePane = cfg.panes.find((p) => p.id === cfg.activePaneId);

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-white dark:bg-gray-900", className)}>
      <WidgetRailPanelHeader
        title={widget.title || "页签"}
        subtitle="Tab 容器"
        onCollapse={onRailCollapse}
        collapseAriaLabel="收起配置"
      />

      <ChartInspectorTabs
        className="min-h-0 flex-1"
        defaultTab="data"
        tabs={["data", "style"]}
        data={
          <div className="space-y-2">
            <p className={INSPECTOR_HINT}>
              当前激活：
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {activePane?.title ?? "—"}
              </span>
              · 从工具栏添加或拖入画布页签区
            </p>
            <TabsPaneList
              widget={widget}
              allWidgets={allWidgets}
              selectedChildId={selectedChildId}
              onChange={onChange}
              onSelectChild={onSelectChild}
            />
            <TabsCarouselFields cfg={cfg} onChange={onChange} />
          </div>
        }
        style={<TabsWidgetStylePanel widget={widget} onChange={onChange} onTitleChange={onTitleChange} />}
      />

      {onDelete ? (
        <div className="shrink-0 border-t border-gray-200 px-3 py-2 dark:border-gray-800">
          <WidgetInspectorDelete widgetTitle={widget.title} onDelete={onDelete} embedded />
        </div>
      ) : null}
    </div>
  );
}
