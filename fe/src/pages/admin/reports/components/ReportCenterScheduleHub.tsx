import { Link } from "react-router";
import { CalendarClock, ChevronRight, Monitor, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { describeCron } from "@/lib/scheduleCronWizard";
import {
  dashboardsListForScheduleCreate,
  filterSchedulesByTab,
  localizeSourceType,
  summarizeRecipients,
} from "@/lib/scheduleSourceMeta";
import {
  localizeScheduleStatus,
  scheduleStatusColor,
  type ReportScheduleRow,
} from "../useReportSchedules";
import { Badge } from "@/components/ui/badge";
import { CreateEntryCard, ScheduleStatCard } from "./SchedulePageOverview";
import { DOC_TEMPLATE_PRODUCT_LINE } from "@/lib/reportCenterNav";

function ScheduleMiniRow({
  schedule,
  canManage,
}: {
  schedule: ReportScheduleRow;
  canManage?: boolean;
}) {
  const label =
    schedule.sourceLabel ??
    (schedule.sourceType === "dashboard" || schedule.sourceType === "data_screen"
      ? `${localizeSourceType(schedule.sourceType)} ${schedule.sourceId?.slice(0, 8) ?? ""}`
      : "模板调度");

  const rowClassName = cn(
    "group flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 transition-colors dark:border-gray-800 dark:bg-white/[0.02]",
    canManage &&
      "hover:border-brand-200 hover:bg-brand-50/30 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5",
  );

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{label}</p>
        <p className="mt-0.5 line-clamp-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {describeCron(schedule.cron)} · {summarizeRecipients(schedule.recipients)}
        </p>
      </div>
      <Badge variant="light" color={scheduleStatusColor(schedule.status)} size="sm" className="shrink-0">
        {localizeScheduleStatus(schedule.status)}
      </Badge>
      {canManage ? (
        <ChevronRight
          className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-brand-500 dark:text-gray-600"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (canManage) {
    return (
      <li className="min-w-0">
        <Link
          to={`/admin/reports/schedules?tab=all&expand=${schedule.id}`}
          className={rowClassName}
        >
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li className={cn(rowClassName, "min-w-0")}>
      {inner}
    </li>
  );
}

type HubProps = {
  schedules: ReportScheduleRow[];
  loading?: boolean;
  canManage?: boolean;
};

function cardShell(className?: string) {
  return cn(
    "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]",
    className,
  );
}

/** 右侧：指标 + 快捷创建 */
export function ReportCenterQuickAside({ schedules, loading, canManage }: HubProps) {
  const dashboardSchedules = filterSchedulesByTab(schedules, "dashboard");
  const active = schedules.filter((s) => s.status === "scheduled").length;
  const paused = schedules.filter((s) => s.status === "paused").length;

  if (loading) {
    return (
      <aside className="space-y-3">
        <div className={cardShell("p-4")}>
          <Skeleton className="mb-3 h-5 w-24" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className={cardShell("p-4")}>
          <Skeleton className="mb-3 h-5 w-20" />
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <div className={cardShell("p-4")}>
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">运行概览</h2>
        <div className="mt-2.5 grid gap-2.5">
          <ScheduleStatCard label="调度任务" value={schedules.length} hint="看板/大屏 + 模板 + 标准分析" />
          <ScheduleStatCard label="已调度" value={active} hint="按 cron 自动执行" />
          <ScheduleStatCard label="看板/大屏" value={dashboardSchedules.length} hint="推荐主路径" />
          {paused > 0 ? (
            <ScheduleStatCard label="已暂停" value={paused} hint="需人工恢复" />
          ) : null}
        </div>
      </div>

      <div className={cardShell("p-4")}>
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">快捷创建</h2>
        <div className="mt-2.5 grid gap-2.5">
          <CreateEntryCard
            primary
            title="从看板/大屏创建"
            description="编辑页「定时推送」配置 PDF（推荐）"
            to={dashboardsListForScheduleCreate()}
            icon={<Monitor className="size-5" aria-hidden />}
          />
          {canManage ? (
            <CreateEntryCard
              title="文档模板调度"
              description={DOC_TEMPLATE_PRODUCT_LINE}
              to="/admin/reports/templates"
              icon={<LayoutTemplate className="size-5" aria-hidden />}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** 左侧：看板定时报告列表 */
export function ReportCenterScheduleList({ schedules, loading, canManage }: HubProps) {
  const dashboardSchedules = filterSchedulesByTab(schedules, "dashboard");

  if (loading) {
    return (
      <div className={cardShell("p-5")}>
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cardShell("p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
            我的看板定时报告
          </h2>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            最近创建的看板/大屏 PDF 定时任务
          </p>
        </div>
        {canManage && dashboardSchedules.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" asChild>
            <Link to="/admin/reports/schedules?tab=dashboard">查看全部</Link>
          </Button>
        ) : null}
      </div>

      {dashboardSchedules.length > 0 ? (
        <ul className="space-y-2">
          {dashboardSchedules.slice(0, 8).map((schedule) => (
            <ScheduleMiniRow key={schedule.id} schedule={schedule} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-10 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Monitor className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-theme-sm font-medium text-gray-800 dark:text-white/90">
            暂无看板/大屏定时报告
          </p>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            打开看板/大屏编辑页 → 定时推送
          </p>
          <Button type="button" variant="primary" size="sm" className="mt-4" asChild>
            <Link to={dashboardsListForScheduleCreate()}>
              <Monitor className="size-3.5" aria-hidden />
              从看板创建
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/** 页头主操作 */
export function ReportCenterHeaderActions({ canManage }: { canManage: boolean }) {
  if (!canManage) return null;
  return (
    <Button type="button" variant="primary" size="sm" asChild>
      <Link to="/admin/reports/schedules?tab=dashboard">
        <CalendarClock className="size-4" aria-hidden />
        管理调度与投递
      </Link>
    </Button>
  );
}
