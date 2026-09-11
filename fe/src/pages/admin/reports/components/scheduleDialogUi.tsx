import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  HUB_SEGMENTED_BUTTON_CLASS,
  HUB_SEGMENTED_SHELL_CLASS,
} from "@/components/dashboard/hubFilterUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeCron } from "./ScheduleWizard";
import { localizeScheduleStatus, scheduleStatusColor, type ReportScheduleRow } from "../useReportSchedules";

export const SCHEDULE_SECTION_CARD_CLASS =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.02]";

export const SCHEDULE_SECTION_HEADER_CLASS =
  "border-b border-gray-100 bg-gray-50/60 px-5 py-3.5 dark:border-gray-800 dark:bg-white/[0.02]";

export const SCHEDULE_SECTION_BODY_CLASS = "px-5 py-4";

export const SCHEDULE_SECTION_FOOTER_CLASS =
  "border-t border-gray-100 bg-gray-50/40 px-5 py-3 dark:border-gray-800 dark:bg-white/[0.02]";

type ScheduleFormSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ScheduleFormSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  footer,
  className,
}: ScheduleFormSectionProps) {
  return (
    <section className={cn(SCHEDULE_SECTION_CARD_CLASS, className)}>
      <div className={SCHEDULE_SECTION_HEADER_CLASS}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
                <Icon className="size-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
              {description ? (
                <p className="mt-0.5 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className={SCHEDULE_SECTION_BODY_CLASS}>{children}</div>
      {footer ? <div className={SCHEDULE_SECTION_FOOTER_CLASS}>{footer}</div> : null}
    </section>
  );
}

type ScheduleSwitcherProps = {
  schedules: ReportScheduleRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  readOnly?: boolean;
};

function statusBadgeColor(status: string): "primary" | "success" | "warning" | "error" {
  const tone = scheduleStatusColor(status);
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  if (tone === "error") return "error";
  return "primary";
}

export function ScheduleSwitcher({
  schedules,
  selectedId,
  onSelect,
  onCreate,
  readOnly,
}: ScheduleSwitcherProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className={cn(HUB_SEGMENTED_SHELL_CLASS, "flex max-w-full flex-wrap gap-0.5 p-1")}>
        {schedules.map((schedule) => {
          const active = selectedId === schedule.id;
          return (
            <Button
              key={schedule.id}
              type="button"
              variant={active ? "primary" : "ghost"}
              size="sm"
              className={cn(HUB_SEGMENTED_BUTTON_CLASS, "h-8 max-w-full gap-1.5 px-3")}
              onClick={() => onSelect(schedule.id)}
            >
              <span className="truncate">{schedule.name || describeCron(schedule.cron)}</span>
              <Badge
                variant="light"
                color={statusBadgeColor(schedule.status)}
                size="sm"
                className="shrink-0 px-1.5 py-0 text-[10px] font-medium"
              >
                {localizeScheduleStatus(schedule.status)}
              </Badge>
            </Button>
          );
        })}
      </div>
      {!readOnly && onCreate ? (
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onCreate}>
          + 新建
        </Button>
      ) : null}
    </div>
  );
}

type ScheduleActionBarProps = {
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function ScheduleActionBar({ hint, children, className }: ScheduleActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-white/[0.03]",
        className,
      )}
    >
      {hint ? (
        <p className="text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
