import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileJson, Play } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  DataTable,
  ListPageBody,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  PageErrorBanner,
  RowActions,
} from "@/components/layout/list-page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";
import {
  QueryServiceTrialSheet,
  type QueryServiceTrialTarget,
} from "./QueryServiceTrialSheet";

type QueryService = QueryServiceTrialTarget & {
  status: string;
  version: string;
};

export function QueryServicesPage() {
  const [trialService, setTrialService] = useState<QueryService | null>(null);
  const [openapiOnly, setOpenapiOnly] = useState(false);
  const pagination = useListPagination(20);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.services.list({
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    queryFn: () =>
      apiFetch<{ items: QueryService[]; total: number }>(
        `/api/v1/services?limit=${pagination.pageSize}&offset=${pagination.offset}`,
      ),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const openTrial = (svc: QueryService, opts?: { openapiOnly?: boolean }) => {
    setTrialService(svc);
    setOpenapiOnly(Boolean(opts?.openapiOnly));
  };

  return (
    <AdminPageShell
      layout="list"
      title="查询服务"
      description="浏览已发布的治理查询服务，并试执行验证。"
    >
      <ListPageSection>
        {isError ? (
          <ListPageBody>
            <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
          </ListPageBody>
        ) : null}
        <ListPageTableFrame>
          <DataTable
            loading={isLoading}
            empty={items.length === 0}
            lastColumnAlign="right"
            emptyState={{
              icon: <FileJson className="size-7" aria-hidden />,
              title: "暂无已发布查询服务",
              description: "请先在发布流水线中批准 catalog 条目，再在此试执行验证。",
            }}
            headers={["服务", "接口", "状态", "操作"]}
            rows={items.map((svc) => [
              <span key="n" className="font-medium text-gray-900 dark:text-white/90">
                {svc.name}
              </span>,
              <code
                key="p"
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300"
              >
                {svc.httpMethod} {svc.path.split(";")[0]}
              </code>,
              <Badge
                key="s"
                variant="light"
                color={svc.status === "published" ? "success" : "light"}
                size="sm"
              >
                {svc.status}
              </Badge>,
              <RowActions key="a">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openTrial(svc)}
                >
                  <Play className="size-4" aria-hidden />
                  试执行
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => openTrial(svc, { openapiOnly: true })}
                >
                  <FileJson className="size-4" aria-hidden />
                  OpenAPI
                </Button>
              </RowActions>,
            ])}
          />
        </ListPageTableFrame>

        {!isLoading && total > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>

      <QueryServiceTrialSheet
        service={trialService}
        open={Boolean(trialService)}
        onOpenChange={(open) => {
          if (!open) {
            setTrialService(null);
            setOpenapiOnly(false);
          }
        }}
        initialTab={openapiOnly ? "openapi" : "trial"}
      />
    </AdminPageShell>
  );
}
