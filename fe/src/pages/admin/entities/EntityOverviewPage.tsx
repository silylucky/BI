import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { mapApiError } from "@/lib/apiError";
import { EntityDetailSheet } from "./EntityDetailSheet";
import { useEntityOverview } from "./useEntityOverview";
import { PageErrorBanner } from "@/components/ui/page-error-banner";

export function EntityOverviewPage() {
  const navigate = useNavigate();
  const {
    canRead,
    activeType,
    setActiveType,
    dashboardId,
    setDashboardId,
    selectedRow,
    setSelectedRow,
    entityTypesQuery,
    physicalQuery,
    dashboardsQuery,
    overviewQuery,
    drillTargetId,
    entityTypeMismatch,
    activeEntityType,
    entityTypes,
    physicalItems,
    statCards,
    valuesByMetricKey,
    statMetricsLoading,
  } = useEntityOverview();

  const [detailOpen, setDetailOpen] = useState(false);

  if (!canRead) {
    return (
      <AdminPageShell title="实体总览" description="按实体类型浏览登记物理表并下钻至仪表板。">
        <Card>
          <CardContent className="py-10 text-center text-theme-sm text-gray-600 dark:text-gray-400">
            无权查看实体总览
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="实体总览"
      description="按实体类型浏览登记物理表并下钻至仪表板。"
    >
      {entityTypesQuery.isError ? (
        <PageErrorBanner message={mapApiError(entityTypesQuery.error)} onRetry={() => void entityTypesQuery.refetch()} />
      ) : null}

      {entityTypesQuery.isLoading ? (
        <Skeleton className="h-10 w-full max-w-xl" />
      ) : entityTypes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-theme-sm text-gray-600 dark:text-gray-400">
            请先配置实体类型
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {entityTypes.map((t) => (
              <Button
                key={t.typeCode}
                type="button"
                variant="outline"
                size="sm"
                className={
                  activeType === t.typeCode
                    ? "border-brand-500 bg-brand-50 text-brand-600 focus-visible:ring-2 dark:bg-brand-500/15 dark:text-brand-400"
                    : "focus-visible:ring-2"
                }
                onClick={() => setActiveType(t.typeCode)}
              >
                {t.displayName}
              </Button>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-400">
          <span>关联仪表板</span>
          <Select value={dashboardId} onValueChange={setDashboardId}>
            <SelectTrigger className="w-[220px]" aria-label="选择仪表板">
              <SelectValue placeholder="选择仪表板" />
            </SelectTrigger>
            <SelectContent>
              {(dashboardsQuery.data?.items ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {entityTypeMismatch ? (
            <Badge variant="light" color="warning" size="sm">
              配置实体类型与当前 Tab 不一致
            </Badge>
          ) : null}
        </div>
        {activeType ? (
          <Badge variant="light" color="primary" size="sm">
            {entityTypes.find((t) => t.typeCode === activeType)?.displayName ?? activeType}
          </Badge>
        ) : null}
      </div>

      {overviewQuery.isError ? (
        <PageErrorBanner message={mapApiError(overviewQuery.error)} onRetry={() => void overviewQuery.refetch()} />
      ) : null}

      {overviewQuery.isLoading && dashboardId ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : statCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.metricKey}>
              <CardHeader className="pb-2">
                <CardTitle className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-title-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                  {card.metricKey === "count"
                    ? (physicalQuery.data?.total ?? "—")
                    : statMetricsLoading
                      ? "…"
                      : (valuesByMetricKey[card.metricKey] ?? "—")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {physicalQuery.isError ? (
        <PageErrorBanner message={mapApiError(physicalQuery.error)} onRetry={() => void physicalQuery.refetch()} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-theme-sm font-semibold">登记物理表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {physicalQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : physicalItems.length === 0 ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-theme-sm text-gray-600 dark:text-gray-400">暂无登记的实体表</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/datasources">前往数据源浏览 schema</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-only">
              <table className="min-w-[640px] w-full text-left text-theme-sm" aria-label="登记物理表">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">显示名</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">tableFqn</th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {physicalItems.map((row) => (
                    <tr
                      key={row.tableFqn}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 text-gray-800 dark:text-white/90">{row.displayName}</td>
                      <td className="px-4 py-3 font-mono text-theme-xs text-gray-600 dark:text-gray-400">
                        {row.tableFqn}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="focus-visible:ring-2"
                            aria-label="详情"
                            onClick={() => {
                              setSelectedRow(row);
                              setDetailOpen(true);
                            }}
                          >
                            详情
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="focus-visible:ring-2"
                            disabled={!drillTargetId}
                            tooltip={drillTargetId ? undefined : "请先在仪表板配置实体总览下钻目标"}
                            onClick={() => {
                              if (drillTargetId) navigate(`/admin/dashboards/${drillTargetId}`);
                            }}
                          >
                            下钻
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EntityDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        row={selectedRow}
        entityType={activeEntityType}
        drillTargetId={drillTargetId}
        onDrill={() => {
          if (drillTargetId) navigate(`/admin/dashboards/${drillTargetId}`);
        }}
        loading={physicalQuery.isLoading}
      />
    </AdminPageShell>
  );
}
