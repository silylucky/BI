import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  INSPECTOR_COLLAPSE_TRIGGER,
  InspectorCollapseChevron,
} from "@/components/dashboard/inspectorCompact";

type DashboardConfigSectionProps = {
  title: string;
  children?: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  compact?: boolean;
  action?: ReactNode;
  placeholder?: string;
  "data-testid"?: string;
};

/** DataEase「仪表板配置」折叠分组：灰底标题条 + 右三角展开 */
export function DashboardConfigSection({
  title,
  children,
  defaultOpen = false,
  disabled = false,
  compact = false,
  action,
  placeholder,
  "data-testid": testId,
}: DashboardConfigSectionProps) {
  const headerBarClass = cn(
    "bg-gray-50 dark:bg-white/[0.03]",
    disabled && "opacity-60",
  );

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      disabled={disabled}
      className="border-b border-gray-100 dark:border-white/[0.06]"
      data-testid={testId}
    >
      <div className={cn("flex w-full items-stretch", headerBarClass)}>
        <CollapsibleTrigger
          className={cn(
            INSPECTOR_COLLAPSE_TRIGGER,
            "flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium text-gray-700 transition-colors",
            compact ? "px-2.5 py-1.5 text-[11px]" : "gap-2 px-3 py-2.5 text-theme-xs",
            "hover:bg-gray-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30",
            "dark:text-gray-300 dark:hover:bg-white/[0.05]",
            disabled && "cursor-default hover:bg-transparent dark:hover:bg-transparent",
          )}
        >
          <InspectorCollapseChevron
            size={compact ? "sm" : "md"}
            className={disabled ? "rotate-0" : undefined}
          />
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </CollapsibleTrigger>
        {action ? (
          <div className="flex shrink-0 items-center border-l border-gray-100 px-2 dark:border-white/[0.06]">
            {action}
          </div>
        ) : null}
      </div>
      {!disabled && children ? (
        <CollapsibleContent
          className={cn(
            "bg-white dark:bg-transparent",
            compact ? "px-2 py-1.5" : "px-2.5 py-2",
          )}
        >
          {children}
        </CollapsibleContent>
      ) : null}
      {disabled && placeholder ? (
        <p className="bg-white px-3 py-2.5 text-theme-xs text-gray-400 dark:bg-transparent dark:text-gray-500">
          {placeholder}
        </p>
      ) : null}
    </Collapsible>
  );
}
