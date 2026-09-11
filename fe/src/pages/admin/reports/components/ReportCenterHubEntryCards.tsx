import type { ReactNode } from "react";
import { Link } from "react-router";
import { CalendarClock, ChevronRight, LayoutTemplate, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { standardAnalysisPath } from "../standardRoutes";

type StandardSummary = {
  packKey: string;
  displayName: string;
};

type Props = {
  standardCount: number;
  pinnedStandard?: StandardSummary | null;
  pinnedPackKey?: string | null;
  templateCount: number;
  activeScheduleCount: number;
  canManage: boolean;
};

function HubEntryCard({
  icon,
  title,
  description,
  stat,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  stat?: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      aria-label={title}
      className="group flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50/50 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/30 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</span>
          {stat ? (
            <span className="rounded-lg bg-gray-50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
              {stat}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">{description}</span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-brand-500 dark:text-gray-600"
        aria-hidden
      />
    </Link>
  );
}

export function ReportCenterHubEntryCards({
  standardCount,
  pinnedStandard,
  pinnedPackKey,
  templateCount,
  activeScheduleCount,
  canManage,
}: Props) {
  const standardDescription =
    pinnedPackKey && pinnedStandard
      ? `置顶：${pinnedStandard.displayName}`
      : "面向业务对象的决策分析，支持周期快照对比。";

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <HubEntryCard
        icon={<TrendingUp className="size-5" aria-hidden />}
        title="标准分析"
        description={standardDescription}
        stat={standardCount > 0 ? `${standardCount} 个分析包` : undefined}
        href={pinnedStandard ? standardAnalysisPath(pinnedStandard.packKey) : standardAnalysisPath()}
      />
      {canManage ? (
        <>
          <HubEntryCard
            icon={<LayoutTemplate className="size-5" aria-hidden />}
            title="文档模板"
            description="Excel/PDF 套版填数，支持扩展配置与定时投递。"
            stat={templateCount > 0 ? `${templateCount} 个模板` : undefined}
            href="/admin/reports/templates"
          />
          <HubEntryCard
            icon={<CalendarClock className="size-5" aria-hidden />}
            title="调度与投递"
            description="管理看板、文档模板与标准分析的定时生成与邮件投递。"
            stat={activeScheduleCount > 0 ? `${activeScheduleCount} 个运行中` : undefined}
            href="/admin/reports/schedules"
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-theme-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400 sm:col-span-2">
          文档模板与调度管理需管理员权限。
          <Button type="button" variant="link" size="sm" className="ml-1 h-auto p-0" asChild>
            <Link to={standardAnalysisPath()}>前往标准分析</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
