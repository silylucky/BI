import type { ReactNode } from "react";
import { Link } from "react-router";
import { CalendarClock, LayoutTemplate, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardsListForScheduleCreate } from "@/lib/scheduleSourceMeta";
import {
  DOC_TEMPLATE_PRODUCT_LINE,
  VISUAL_SCHEDULE_PRODUCT_LINE,
} from "@/lib/reportCenterNav";

type ScheduleStat = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
  borderless?: boolean;
};

export function ScheduleStatCard({ label, value, hint, className, borderless }: ScheduleStat) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl bg-white px-3.5 py-2.5 dark:bg-white/[0.03]",
        borderless
          ? "border-0 shadow-none"
          : "border border-gray-200 shadow-theme-xs dark:border-gray-800",
        className,
      )}
    >
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-title-sm font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CreateEntryCard({
  title,
  description,
  to,
  icon,
  primary,
}: {
  title: string;
  description: string;
  to: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex min-w-0 items-start gap-2.5 rounded-xl border p-3.5 shadow-theme-xs transition-colors",
        primary
          ? "border-brand-200 bg-brand-50/40 hover:bg-brand-50/70 dark:border-brand-500/30 dark:bg-brand-500/5"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02]",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          primary
            ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
            : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          {title}
        </span>
        <span className="mt-0.5 block line-clamp-2 text-theme-xs leading-snug text-gray-500 dark:text-gray-400">
          {description}
        </span>
      </span>
    </Link>
  );
}

type SchedulePageOverviewProps = {
  stats: {
    total: number;
    active: number;
    inactive: number;
  };
};

export function SchedulePageOverview({ stats }: SchedulePageOverviewProps) {
  return (
    <div className="grid shrink-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <ScheduleStatCard label="全部调度任务" value={stats.total} hint="看板/大屏 + 文档模板 + 标准分析" />
        <ScheduleStatCard label="已调度" value={stats.active} hint="已激活并按 cron 执行" />
        <ScheduleStatCard label="已暂停 / 取消" value={stats.inactive} hint="暂停、草稿或已取消" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <CreateEntryCard
          primary
          title="从看板/大屏创建"
          description={VISUAL_SCHEDULE_PRODUCT_LINE}
          to={dashboardsListForScheduleCreate()}
          icon={<Monitor className="size-5" aria-hidden />}
        />
        <CreateEntryCard
          title="从文档模板创建"
          description={DOC_TEMPLATE_PRODUCT_LINE}
          to="/admin/reports/templates"
          icon={<LayoutTemplate className="size-5" aria-hidden />}
        />
      </div>
    </div>
  );
}

export function SchedulePageOverviewSkeleton() {
  return (
    <div className="grid shrink-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}
