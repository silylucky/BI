import type { ReactNode } from "react";
import {
  DASHBOARD_EDIT_RAIL_PASS_THROUGH_CLASS,
  DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS,
  DASHBOARD_EDIT_RAIL_SHELL_FIXED_WIDTH_CLASS,
} from "@/components/dashboard/dashboardEditRailLayout";
import { cn } from "@/lib/utils";

type VizComponentEditLayoutProps = {
  preview: ReactNode;
  rail: ReactNode;
};

export function VizComponentEditLayout({ preview, rail }: VizComponentEditLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch [&>*]:min-h-0">
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        data-testid="viz-component-edit-preview"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{preview}</div>
      </div>

      <aside
        className={cn(
          "flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]",
          DASHBOARD_EDIT_RAIL_SHELL_FIXED_WIDTH_CLASS,
        )}
        data-testid="viz-component-edit-rail"
      >
        <div className={DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS}>
          <div className={DASHBOARD_EDIT_RAIL_PASS_THROUGH_CLASS}>{rail}</div>
        </div>
      </aside>
    </div>
  );
}
