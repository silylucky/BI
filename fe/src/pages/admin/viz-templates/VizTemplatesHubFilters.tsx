import { LayoutDashboard, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SURFACE_TABS, VIZ_TEMPLATES_HUB } from "@/components/dashboard/templates/templateLabels";
import { TEMPLATE_CATEGORIES, type VizSurfaceKind } from "@/lib/dashboardTemplates";
import {
  HUB_FILTER_LABEL_CLASS,
  HUB_FILTER_ROW_CLASS,
  HUB_FILTERS_STACK_CLASS,
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { cn } from "@/lib/utils";

type VizTemplatesHubFiltersProps = {
  surfaceKind: VizSurfaceKind;
  categoryKey: string | null;
  onSurfaceKindChange: (kind: VizSurfaceKind) => void;
  onCategoryChange: (key: string | null) => void;
};

export function VizTemplatesHubFilters({
  surfaceKind,
  categoryKey,
  onSurfaceKindChange,
  onCategoryChange,
}: VizTemplatesHubFiltersProps) {
  return (
    <div className={HUB_FILTERS_STACK_CLASS} data-testid="viz-templates-hub-filters">
      <div className={HUB_FILTER_ROW_CLASS}>
        <span className={HUB_FILTER_LABEL_CLASS}>{VIZ_TEMPLATES_HUB.filterSurfaceLabel}</span>
        <div
          role="group"
          aria-label={VIZ_TEMPLATES_HUB.filterSurfaceAriaLabel}
          className={HUB_SEGMENTED_SHELL_CLASS}
        >
          {SURFACE_TABS.map((tab) => {
            const Icon = tab.key === "data-screen" ? Monitor : LayoutDashboard;
            const active = surfaceKind === tab.key;
            return (
              <Button
                key={tab.key}
                type="button"
                size="sm"
                aria-pressed={active}
                variant={active ? "primary" : "ghost"}
                className={cn(HUB_SEGMENTED_BUTTON_CLASS, !active && "text-gray-600 dark:text-gray-400")}
                onClick={() => onSurfaceKindChange(tab.key)}
              >
                <Icon className="size-4" aria-hidden />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className={HUB_FILTER_ROW_CLASS}>
        <span className={HUB_FILTER_LABEL_CLASS}>{VIZ_TEMPLATES_HUB.filterCategoryLabel}</span>
        <div
          role="group"
          aria-label={VIZ_TEMPLATES_HUB.filterCategoryAriaLabel}
          className={cn(HUB_SEGMENTED_SHELL_CLASS, "flex min-w-0 flex-wrap gap-0.5")}
        >
          <Button
            type="button"
            size="sm"
            aria-pressed={categoryKey === null}
            variant={categoryKey === null ? "subtle" : "ghost"}
            className={HUB_SEGMENTED_BUTTON_CLASS}
            onClick={() => onCategoryChange(null)}
          >
            {VIZ_TEMPLATES_HUB.allCategories}
          </Button>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              type="button"
              size="sm"
              aria-pressed={categoryKey === cat.key}
              variant={categoryKey === cat.key ? "subtle" : "ghost"}
              className={HUB_SEGMENTED_BUTTON_CLASS}
              onClick={() => onCategoryChange(cat.key)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
