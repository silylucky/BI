import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type InspectorTabId = "data" | "style" | "advanced";

type ChartInspectorTabsProps = {
  data: ReactNode;
  style: ReactNode;
  advanced?: ReactNode;
  dataFooter?: ReactNode;
  /** 默认 data + style + advanced；不支持的能力勿传入对应 Tab */
  tabs?: InspectorTabId[];
  defaultTab?: InspectorTabId;
  className?: string;
  scrollMode?: "panel" | "parent";
};

const tabPanelScrollClass = (scrollMode: "panel" | "parent") =>
  scrollMode === "panel"
    ? "h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar"
    : "w-full";

const tabsShellClass = (scrollMode: "panel" | "parent", className?: string) =>
  cn(
    scrollMode === "panel"
      ? "flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
      : "flex w-full flex-col",
    className,
  );

const tabsContentClass = (scrollMode: "panel" | "parent") =>
  scrollMode === "panel"
    ? "mt-0 flex h-0 min-h-[120px] flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
    : "mt-0 flex flex-col data-[state=inactive]:hidden";

const TAB_LABELS: Record<InspectorTabId, string> = {
  data: "数据",
  style: "样式",
  advanced: "高级",
};

export function ChartInspectorTabs({
  data,
  style,
  advanced,
  dataFooter,
  tabs = ["data", "style", "advanced"],
  defaultTab,
  className,
  scrollMode = "panel",
}: ChartInspectorTabsProps) {
  const visibleTabs = tabs.filter((tab) => tab !== "advanced" || advanced != null);
  const initialTab = defaultTab && visibleTabs.includes(defaultTab) ? defaultTab : visibleTabs[0];
  const gridCols =
    visibleTabs.length === 1
      ? "grid-cols-1"
      : visibleTabs.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  const panelClass = cn(tabPanelScrollClass(scrollMode), "px-2 py-1.5");

  if (visibleTabs.length === 0) {
    return null;
  }

  if (visibleTabs.length === 1) {
    const only = visibleTabs[0];
    return (
      <div className={tabsShellClass(scrollMode, className)}>
        {only === "data" ? (
          <>
            <div className={panelClass}>{data}</div>
            {dataFooter}
          </>
        ) : null}
        {only === "style" ? <div className={panelClass}>{style}</div> : null}
        {only === "advanced" ? <div className={panelClass}>{advanced}</div> : null}
      </div>
    );
  }

  return (
    <Tabs
      defaultValue={initialTab}
      className={tabsShellClass(scrollMode, className)}
    >
      <TabsList
        variant="enclosed"
        size="sm"
        className={cn(
          "mx-2 mt-1.5 grid h-8 w-[calc(100%-1rem)] shrink-0 rounded-md p-0.5",
          gridCols,
        )}
      >
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab}
            variant="enclosed"
            size="sm"
            value={tab}
            className="h-7 px-1 text-[11px]"
          >
            {TAB_LABELS[tab]}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibleTabs.includes("data") ? (
        <TabsContent
          value="data"
          className={tabsContentClass(scrollMode)}
        >
          <div className={panelClass}>{data}</div>
          {dataFooter}
        </TabsContent>
      ) : null}
      {visibleTabs.includes("style") ? (
        <TabsContent
          value="style"
          className={tabsContentClass(scrollMode)}
        >
          <div className={panelClass}>{style}</div>
        </TabsContent>
      ) : null}
      {visibleTabs.includes("advanced") && advanced != null ? (
        <TabsContent
          value="advanced"
          className={tabsContentClass(scrollMode)}
        >
          <div className={panelClass}>{advanced}</div>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
