import type { LayoutWidget, TabsWidgetConfig } from "./layoutUtils";
import { TabsEditRail } from "./TabsEditRail";

type TabsWidgetInspectorProps = {
  widget: LayoutWidget & { tabsConfig: TabsWidgetConfig };
  onChange: (tabsConfig: TabsWidgetConfig) => void;
  embedded?: boolean;
};

/** @deprecated 使用 TabsEditRail；保留兼容 embedded 壳 */
export function TabsWidgetInspector({ widget, onChange, embedded = false }: TabsWidgetInspectorProps) {
  if (embedded) {
    return <TabsEditRail widget={widget} onChange={onChange} />;
  }
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <TabsEditRail widget={widget} onChange={onChange} />
    </div>
  );
}
