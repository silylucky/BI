import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { LIST_PAGE_CONTENT_PAD_CLASS } from "@/components/layout/list-page-kit";
import { cn } from "@/lib/utils";

/** 标准分析工作台内容区横向内边距（与报表中心列表页对齐） */
export const STANDARD_ANALYSIS_CONTENT_PAD_CLASS = LIST_PAGE_CONTENT_PAD_CLASS;

export function ConfigSection({
  title,
  description,
  children,
  className,
  inset = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** 内嵌子块（无独立卡片外框，用于投递等折叠区） */
  inset?: boolean;
}) {
  if (inset) {
    return (
      <section className={cn("grid gap-4", className)}>
        <div>
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]",
        className,
      )}
    >
      <div className="border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description ? (
          <p className="mt-1 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 px-5 py-4">{children}</div>
    </section>
  );
}

export function ConfigInset({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]",
        className,
      )}
    >
      {title ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-theme-xs font-medium text-gray-800 dark:text-white/90">{title}</p>
            {description ? (
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function ConfigField({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label htmlFor={id} className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}
