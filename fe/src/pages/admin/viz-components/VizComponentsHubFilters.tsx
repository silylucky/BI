import { Boxes, LayoutDashboard, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SURFACE_TABS,
  VIZ_COMPONENTS_HUB,
  WIDGET_TYPE_FILTERS,
  type VizComponentHubWidgetFilter,
} from "@/components/dashboard/viz-components/componentLabels";
import {
  HUB_FILTER_LABEL_CLASS,
  HUB_FILTER_ROW_CLASS,
  HUB_FILTERS_STACK_CLASS,
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import type { VizSurfaceKind } from "@/lib/vizComponents";
import { cn } from "@/lib/utils";

type VizComponentsHubFiltersProps = {
  surfaceTab: VizSurfaceKind | "all";
  widgetFilter: VizComponentHubWidgetFilter;
  onSurfaceTabChange: (tab: VizSurfaceKind | "all") => void;
  onWidgetFilterChange: (filter: VizComponentHubWidgetFilter) => void;
};

export function VizComponentsHubFilters({
  surfaceTab,
  widgetFilter,
  onSurfaceTabChange,
  onWidgetFilterChange,
}: VizComponentsHubFiltersProps) {
  return (
    <div className={HUB_FILTERS_STACK_CLASS} data-testid="viz-components-hub-filters">
      <div className={HUB_FILTER_ROW_CLASS}>
        <span className={HUB_FILTER_LABEL_CLASS}>{VIZ_COMPONENTS_HUB.filterSurfaceLabel}</span>
        <div
          role="group"
          aria-label={VIZ_COMPONENTS_HUB.filterSurfaceAriaLabel}
          className={HUB_SEGMENTED_SHELL_CLASS}
        >
          {SURFACE_TABS.map((tab) => {
            const Icon =
              tab.key === "data-screen"
                ? Monitor
                : tab.key === "dashboard"
                  ? LayoutDashboard
                  : Boxes;
            const active = surfaceTab === tab.key;
            const usePrimary = active && tab.key !== "all";
            return (
              <Button
                key={tab.key}
                type="button"
                size="sm"
                variant={active ? (usePrimary ? "primary" : "subtle") : "ghost"}
                className={cn(
                  HUB_SEGMENTED_BUTTON_CLASS,
                  !active && "text-gray-600 dark:text-gray-400",
                )}
                onClick={() => onSurfaceTabChange(tab.key)}
              >
                {tab.key !== "all" ? <Icon className="size-4" aria-hidden /> : null}
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className={HUB_FILTER_ROW_CLASS}>
        <span className={HUB_FILTER_LABEL_CLASS}>{VIZ_COMPONENTS_HUB.filterWidgetTypeLabel}</span>
        <div
          role="group"
          aria-label={VIZ_COMPONENTS_HUB.filterWidgetTypeAriaLabel}
          className={cn(HUB_SEGMENTED_SHELL_CLASS, "flex min-w-0 flex-wrap gap-0.5")}
        >
          {WIDGET_TYPE_FILTERS.map((filter) => {
            const active = widgetFilter === filter.key;
            return (
              <Button
                key={filter.key}
                type="button"
                size="sm"
                variant={active ? "subtle" : "ghost"}
                className={HUB_SEGMENTED_BUTTON_CLASS}
                onClick={() => onWidgetFilterChange(filter.key)}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
