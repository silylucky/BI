import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ScheduleFormSection,
  SCHEDULE_SECTION_BODY_CLASS,
  SCHEDULE_SECTION_CARD_CLASS,
  SCHEDULE_SECTION_FOOTER_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
} from "./scheduleDialogUi";

export {
  ScheduleFormSection as TemplatePanelSection,
  SCHEDULE_SECTION_BODY_CLASS,
  SCHEDULE_SECTION_CARD_CLASS,
  SCHEDULE_SECTION_FOOTER_CLASS,
  SCHEDULE_SECTION_HEADER_CLASS,
};

export function TemplateTabShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-5", className)}>{children}</div>;
}

export function TemplateMetaGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";
  return (
    <dl
      className={cn(
        "grid gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]",
        colClass,
      )}
    >
      {children}
    </dl>
  );
}

export function TemplateMetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-theme-sm font-medium text-gray-800 dark:text-white/90">{children}</dd>
    </div>
  );
}

export function TemplateField({
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
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="min-h-5 leading-5">
        {label}
      </Label>
      <div className="min-h-11">{children}</div>
      <p
        className={cn(
          "min-h-[1.125rem] text-theme-xs leading-[1.125rem] text-gray-500 dark:text-gray-400",
          !hint && "invisible",
        )}
        aria-hidden={!hint}
      >
        {hint ?? "\u00a0"}
      </p>
    </div>
  );
}

export function TemplatePanelHeader({
  title,
  kindLabel,
  templateKey,
  parentPath,
  icon: Icon,
  actions,
}: {
  title: string;
  kindLabel?: string;
  templateKey?: string | null;
  parentPath?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50/90 via-white to-white px-6 py-5 dark:border-gray-800 dark:from-white/[0.04] dark:via-transparent dark:to-transparent">
      <div className="flex flex-wrap items-start gap-4">
        {Icon ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            {kindLabel ? (
              <Badge variant="light" color="primary" size="sm">
                {kindLabel}
              </Badge>
            ) : null}
          </div>
          {templateKey ? (
            <p className="mt-1 font-mono text-theme-xs text-gray-500 dark:text-gray-400">{templateKey}</p>
          ) : null}
          {parentPath ? (
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">所在目录：{parentPath}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function TemplateEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 px-6 py-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
