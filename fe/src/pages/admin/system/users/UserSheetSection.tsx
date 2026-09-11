import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type UserSheetSectionProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "muted" | "warning";
};

export function UserSheetSection({
  title,
  description,
  icon,
  children,
  footer,
  variant = "default",
}: UserSheetSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border shadow-theme-xs",
        variant === "warning" &&
          "border-warning-200/80 bg-warning-50/30 dark:border-warning-500/20 dark:bg-warning-500/5",
        variant === "muted" &&
          "border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-white/[0.02]",
        variant === "default" &&
          "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]",
      )}
    >
      <div
        className={cn(
          "px-4 py-3.5",
          (children || footer) && "border-b border-gray-100 dark:border-white/[0.06]",
        )}
      >
        <div className="flex items-start gap-3">
          {icon ? (
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                variant === "warning"
                  ? "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
                  : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</h3>
            {description ? (
              <p className="mt-1 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {children ? <div className="px-4 py-4">{children}</div> : null}
      {footer ? (
        <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
