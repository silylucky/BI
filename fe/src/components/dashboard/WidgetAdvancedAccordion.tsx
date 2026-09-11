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
  InspectorHintTip,
} from "@/components/dashboard/inspectorCompact";

export type WidgetAdvancedSection = {
  id: string;
  title: string;
  /** 折叠标题旁悬浮说明 */
  hint?: string;
  content: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  /** 右侧数量角标（如已配置规则数） */
  badge?: number | string;
};

type WidgetAdvancedAccordionProps = {
  sections: WidgetAdvancedSection[];
  className?: string;
};

/** DataEase「高级」Tab：与 ChartInspectorSection 同密度，适配 ~216px 窄栏 */
export function WidgetAdvancedAccordion({ sections, className }: WidgetAdvancedAccordionProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {sections.map((section) => (
        <Collapsible
          key={section.id}
          defaultOpen={section.defaultOpen ?? false}
          disabled={section.disabled}
          className="border-b border-gray-100 last:border-b-0 dark:border-white/[0.06]"
        >
          <div className="flex w-full items-center gap-1 px-1 py-2">
            <CollapsibleTrigger
              disabled={section.disabled}
              className={cn(
                INSPECTOR_COLLAPSE_TRIGGER,
                "flex min-w-0 flex-1 items-center gap-1 rounded-md text-left transition-colors",
                "text-[11px] font-semibold text-gray-800 dark:text-white/90",
                "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                "dark:hover:bg-white/[0.04]",
                section.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <InspectorCollapseChevron />
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
            </CollapsibleTrigger>
            {section.hint ? (
              <InspectorHintTip
                text={section.hint}
                className="shrink-0"
                side="left"
                aria-label={`${section.title}说明`}
              />
            ) : null}
            {section.badge != null && section.badge !== 0 && section.badge !== "" ? (
              <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-medium tabular-nums text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {section.badge}
              </span>
            ) : null}
          </div>
          <CollapsibleContent className="space-y-0 pb-2 pl-0.5 pt-0.5">
            {section.content}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
