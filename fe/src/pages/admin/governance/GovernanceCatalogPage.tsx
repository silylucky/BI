import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  DataTable,
  ListPageBody,
  ListPagePagination,
  ListPageSection,
  ListPageTableFrame,
  ListPageToolbar,
  PageErrorBanner,
} from "@/components/layout/list-page-kit";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import { useListPagination } from "@/lib/list-pagination";

type CatalogCategory = { code: string; name: string; description?: string | null; kind: string };
type CatalogEntry = {
  id: string;
  name: string;
  httpMethod: string;
  path: string;
  categoryCodes: string[];
  status: string;
  createdAt: string;
};

export function GovernanceCatalogPage() {
  const [category, setCategory] = useState<string>("__all__");
  const pagination = useListPagination(20, [category]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.gov.categories,
    queryFn: () => apiFetch<{ items: CatalogCategory[] }>("/api/v1/gov/catalog/categories"),
  });

  const entriesQuery = useQuery({
    queryKey: queryKeys.gov.entries({
      category: category === "__all__" ? undefined : category,
      limit: pagination.pageSize,
      offset: pagination.offset,
    }),
    queryFn: () => {
      const q = new URLSearchParams({
        limit: String(pagination.pageSize),
        offset: String(pagination.offset),
      });
      if (category !== "__all__") q.set("category", category);
      return apiFetch<{ items: CatalogEntry[]; total: number }>(
        `/api/v1/gov/catalog/entries?${q}`,
      );
    },
  });

  const categories = categoriesQuery.data?.items ?? [];
  const entries = entriesQuery.data?.items ?? [];
  const total = entriesQuery.data?.total ?? 0;

  return (
    <AdminPageShell
      layout="list"
      title="接口分类目录"
      description="治理域接口目录登记与分类浏览。"
    >
      <ListPageSection>
        {entriesQuery.isError ? (
          <ListPageBody>
            <PageErrorBanner
              message={mapApiError(entriesQuery.error)}
              onRetry={() => void entriesQuery.refetch()}
            />
          </ListPageBody>
        ) : null}

        <ListPageToolbar
          filters={
            <div className="grid w-full gap-1.5 sm:max-w-xs">
              <Label className="text-theme-xs text-gray-500">分类筛选</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部分类</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        <ListPageTableFrame>
          <DataTable
            loading={entriesQuery.isLoading}
            empty={entries.length === 0}
            emptyState={{
              icon: <GitBranch className="size-7" aria-hidden />,
              title: "暂无 catalog 条目",
              description: "发布流水线批准后，接口条目将在此按分类展示。",
            }}
            headers={["名称", "方法", "路径", "分类", "状态"]}
            rows={entries.map((e) => [
              <span key="n" className="font-medium text-gray-900 dark:text-white/90">
                {e.name}
              </span>,
              <Badge key="m" variant="light" color="primary" size="sm">
                {e.httpMethod}
              </Badge>,
              <code
                key="p"
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/10 dark:text-gray-300"
              >
                {e.path}
              </code>,
              <div key="c" className="flex flex-wrap gap-1">
                {e.categoryCodes.map((c) => (
                  <Badge key={c} variant="light" color="light" size="sm">
                    {c}
                  </Badge>
                ))}
              </div>,
              e.status,
            ])}
          />
        </ListPageTableFrame>

        {!entriesQuery.isLoading && total > 0 ? (
          <ListPagePagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            showSizeChanger
            onChange={pagination.onPageChange}
          />
        ) : null}
      </ListPageSection>
    </AdminPageShell>
  );
}
