import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { FileBarChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { LIST_PAGE_CONTENT_PAD_CLASS, ListPageSection, PageErrorBanner } from "@/components/layout/list-page-kit";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { matchesCapability, resolveEffectiveCapabilities } from "@/lib/capabilities";
import { mapApiError } from "@/lib/apiError";
import { fetchAllCatalogTemplates } from "@/lib/reportCatalogUtils";
import { queryKeys } from "@/lib/queryKeys";
import {
  canRetryReportSchedules,
  localizeCenterResourceType,
  resolveCenterRecentHref,
} from "@/lib/reportCenterNav";
import { sortStandardByPin } from "@/lib/reportCenterPrefs";
import { useReportCenterPreferences } from "./useReportCenterPrefs";
import { useAuth } from "@/context/auth-context";
import { ReportCenterHeaderActions, ReportCenterQuickAside } from "./components/ReportCenterScheduleHub";
import { ReportCenterDashboardScheduleHint } from "./components/ReportCenterDashboardScheduleHint";
import { ReportCenterHubEntryCards } from "./components/ReportCenterHubEntryCards";
import { ScheduleRecentFailuresPanel } from "./components/ScheduleRecentFailuresPanel";
import { useReportSchedulesList, useReportScheduleMutations } from "./useReportSchedules";

type AnalysisPackSummary = {
  packKey: string;
  displayName: string;
  enabledThemes: string[];
};

export function ReportCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const caps = resolveEffectiveCapabilities(user);
  const centerPrefsQuery = useReportCenterPreferences();
  const schedulesQuery = useReportSchedulesList();
  const { retryExecution } = useReportScheduleMutations();

  const templatesQuery = useQuery({
    queryKey: ["reports", "center", "templates"],
    queryFn: fetchAllCatalogTemplates,
    enabled: matchesCapability(caps, "report:manage"),
  });

  const standardQuery = useQuery({
    queryKey: queryKeys.reports.standardPacks,
    queryFn: () =>
      apiFetch<{ items: AnalysisPackSummary[]; total: number }>("/api/v1/reports/standard/packs"),
    enabled: matchesCapability(caps, "report:read"),
  });

  const canManage = matchesCapability(caps, "report:manage");
  const canRetrySchedules = canRetryReportSchedules(caps);
  const recentViews = centerPrefsQuery.data?.recent ?? [];
  const standardItems = standardQuery.data?.items ?? [];
  const pinnedKeys = useMemo(
    () =>
      (centerPrefsQuery.data?.favorites ?? [])
        .filter((f) => f.resourceType === "standard")
        .map((f) => f.resourceId),
    [centerPrefsQuery.data],
  );
  const sortedStandardItems = useMemo(
    () => sortStandardByPin(standardItems, pinnedKeys),
    [standardItems, pinnedKeys],
  );
  const pinnedStandard = sortedStandardItems[0] ?? null;
  const pinnedPackKey = pinnedKeys[0] ?? null;
  const schedules = schedulesQuery.data?.items ?? [];
  const activeScheduleCount = schedules.filter((item) => item.status === "scheduled").length;

  return (
    <AdminPageShell
      layout="list"
      title="报表中心"
      icon={
        <AdminPageHeaderIcon>
          <FileBarChart className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="最近访问、失败告警与各模块快捷入口。"
      actions={<ReportCenterHeaderActions canManage={canManage} />}
    >
      <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_260px]">
        <ListPageSection className="min-h-0 flex-1">
          {schedulesQuery.isError ? (
            <div className="shrink-0 border-b border-gray-100 px-4 py-2.5 dark:border-white/[0.06]">
              <PageErrorBanner
                message={mapApiError(schedulesQuery.error)}
                onRetry={() => void schedulesQuery.refetch()}
              />
            </div>
          ) : null}

          <div className={cn(LIST_PAGE_CONTENT_PAD_CLASS, "custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto")}>
            <ReportCenterDashboardScheduleHint canManageSchedules={canManage} />

            <ReportCenterHubEntryCards
              standardCount={standardItems.length}
              pinnedStandard={pinnedStandard}
              pinnedPackKey={pinnedPackKey}
              templateCount={templatesQuery.data?.length ?? 0}
              activeScheduleCount={activeScheduleCount}
              canManage={canManage}
            />

            <ScheduleRecentFailuresPanel
              schedules={schedules}
              onSelectSchedule={(id) => navigate(`/admin/reports/schedules?tab=all&expand=${id}`)}
              onRetry={
                canRetrySchedules
                  ? (executionId, scheduleId) =>
                      void retryExecution.mutateAsync({ executionId, scheduleId })
                  : undefined
              }
              retryPending={retryExecution.isPending}
              retryPendingExecutionId={
                retryExecution.isPending ? retryExecution.variables?.executionId : undefined
              }
            />

            {recentViews.length > 0 ? (
              <div className="border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                <p className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">最近访问</p>
                <ul className="mt-2 space-y-1">
                  {recentViews.slice(0, 8).map((item) => (
                    <li key={`${item.resourceType}-${item.resourceId}`}>
                      <Link
                        to={resolveCenterRecentHref(item)}
                        className="flex flex-wrap items-baseline gap-2 rounded-lg px-2 py-1.5 text-theme-xs text-gray-700 transition-colors hover:bg-gray-50 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-white/[0.04] dark:hover:text-brand-400"
                      >
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {item.resourceLabel || item.resourceId}
                        </span>
                        <span className="text-gray-400">
                          {localizeCenterResourceType(item.resourceType)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ListPageSection>

        <div className="hidden min-w-0 xl:block xl:sticky xl:top-0 xl:self-start">
          <ReportCenterQuickAside
            schedules={schedules}
            loading={schedulesQuery.isLoading}
            canManage={canManage}
          />
        </div>
      </div>
    </AdminPageShell>
  );
}
