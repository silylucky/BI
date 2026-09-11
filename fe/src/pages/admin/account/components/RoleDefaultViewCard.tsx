import { useQuery } from "@tanstack/react-query";
import { ExternalLink, LayoutDashboard } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { primaryRoleCode, primaryRoleLabel, type SessionRole } from "@/lib/session";
import {
  buildDashboardNameMap,
  useDashboardOptions,
} from "./DashboardPickerSelect";

type RoleDefaultViews = {
  dashboardId: string | null;
  reportTemplateNodeId?: string | null;
  inheritFromRoleId?: string | null;
};

type RoleDefaultViewCardProps = {
  roles: string[];
};

export function RoleDefaultViewCard({ roles }: RoleDefaultViewCardProps) {
  const primaryRole = primaryRoleCode(roles);
  const roleLabel = primaryRoleLabel(roles as SessionRole[]);
  const dashboardsQuery = useDashboardOptions();

  const defaultsQuery = useQuery({
    queryKey: ["roles", primaryRole, "default-views"],
    queryFn: () =>
      apiFetch<RoleDefaultViews>(
        `/api/v1/roles/${encodeURIComponent(primaryRole)}/default-views`,
      ),
    enabled: roles.length > 0,
  });

  const dashboardMap = buildDashboardNameMap(dashboardsQuery.data?.items);
  const dashboardId = defaultsQuery.data?.dashboardId ?? null;
  const dashboardName = dashboardId ? dashboardMap.get(dashboardId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-title-sm">
          <LayoutDashboard className="size-4" aria-hidden />
          角色默认入口
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          未配置个人视图时，登录后将按平台角色「{roleLabel}」的默认设置进入工作台。
        </p>
        {defaultsQuery.isLoading || dashboardsQuery.isLoading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : defaultsQuery.isError ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-theme-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
            无法读取角色默认配置，请联系管理员在「角色与权限」中设置。
          </p>
        ) : dashboardId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
            <div>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">默认仪表板</p>
              <p className="mt-1 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {dashboardName ?? "未命名仪表板"}
              </p>
              <p className="mt-0.5 font-mono text-theme-xs text-gray-500">{dashboardId}</p>
            </div>
            <Link
              to={`/admin/dashboards/${dashboardId}`}
              className="inline-flex items-center gap-1 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              打开
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : defaultsQuery.data?.reportTemplateNodeId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
            <div>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">默认报表视图</p>
              <p className="mt-1 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                {defaultsQuery.data.reportTemplateNodeId}
              </p>
            </div>
            <Badge variant="light" color="info" size="sm">
              报表模板
            </Badge>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-theme-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            当前角色尚未配置默认仪表板，将使用工作台首页。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
