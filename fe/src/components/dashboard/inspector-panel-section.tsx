import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TruncateHint } from "@/components/ui/hint-tooltip";

/** Dashboard 编辑区右栏分段标题（窄栏 ~300px） */
export function InspectorPanelSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {title}
          </h3>
          {description ? (
            <TruncateHint
              title={description}
              as="p"
              className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400"
            >
              {description}
            </TruncateHint>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
