import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPickerSelect } from "@/pages/admin/account/components/DashboardPickerSelect";
import { apiFetch } from "@/lib/api";
import { buildDashboardsListUrl } from "@/lib/dashboardsListQuery";
import { queryKeys } from "@/lib/queryKeys";
import { fetchAllCatalogTemplates } from "@/lib/reportCatalogUtils";
import type { ResourceType } from "./grantFormSchema";

type NamedResource = { id: string; name: string };

type ResourceGrantPickerProps = {
  resourceType: ResourceType;
  value: string;
  onValueChange: (resourceId: string) => void;
  id?: string;
  disabled?: boolean;
};

function GenericResourceSelect({
  items,
  value,
  onValueChange,
  id,
  disabled,
  placeholder,
  loading,
  error,
  emptyHint,
}: {
  items: NamedResource[];
  value: string;
  onValueChange: (id: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
  error?: boolean;
  emptyHint: string;
}) {
  if (loading) return <Skeleton className="h-11 w-full" />;
  if (error) {
    return (
      <p className="text-theme-xs text-error-600 dark:text-error-400">无法加载资源列表，请稍后重试</p>
    );
  }
  if (items.length === 0) {
    return <p className="text-theme-xs text-gray-500 dark:text-gray-400">{emptyHint}</p>;
  }
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ResourceGrantPicker({
  resourceType,
  value,
  onValueChange,
  id = "grant-resource",
  disabled,
}: ResourceGrantPickerProps) {
  const datasourcesQuery = useQuery({
    queryKey: queryKeys.datasources.list({ limit: 100, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: NamedResource[] }>("/api/v1/datasources?limit=100&offset=0"),
    enabled: resourceType === "datasource",
    staleTime: 60_000,
  });

  const reportsQuery = useQuery({
    queryKey: queryKeys.reports.catalogNodes("grant-templates"),
    queryFn: async () => {
      const templates = await fetchAllCatalogTemplates();
      return {
        items: templates.map((n) => ({ id: n.id, name: n.name })),
      };
    },
    enabled: resourceType === "report",
    staleTime: 60_000,
  });

  if (resourceType === "dashboard") {
    return (
      <DashboardPickerSelect
        id={id}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder="选择仪表板"
      />
    );
  }

  if (resourceType === "datasource") {
    return (
      <GenericResourceSelect
        id={id}
        items={datasourcesQuery.data?.items ?? []}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        placeholder="选择数据源"
        loading={datasourcesQuery.isLoading}
        error={datasourcesQuery.isError}
        emptyHint="暂无数据源，请先在「数据连接」中创建。"
      />
    );
  }

  return (
    <GenericResourceSelect
      id={id}
      items={reportsQuery.data?.items ?? []}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      placeholder="选择报表模板"
      loading={reportsQuery.isLoading}
      error={reportsQuery.isError}
      emptyHint="暂无报表模板，请先在「报表」中创建。"
    />
  );
}

/** 批量解析授权列表展示名 */
export function useGrantResourceNameMaps() {
  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.list({ limit: 200, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: NamedResource[] }>(
        buildDashboardsListUrl({ limit: 200, offset: 0 }),
      ),
    staleTime: 60_000,
  });
  const datasourcesQuery = useQuery({
    queryKey: queryKeys.datasources.list({ limit: 200, offset: 0 }),
    queryFn: () =>
      apiFetch<{ items: NamedResource[] }>("/api/v1/datasources?limit=200&offset=0"),
    staleTime: 60_000,
  });
  const reportsQuery = useQuery({
    queryKey: queryKeys.reports.catalogNodes("grant-labels"),
    queryFn: async () => {
      const templates = await fetchAllCatalogTemplates();
      return { items: templates.map((n) => ({ id: n.id, name: n.name })) };
    },
    staleTime: 60_000,
  });

  const nameByTypeAndId = (type: ResourceType, id: string): string | null => {
    const source =
      type === "dashboard"
        ? dashboardsQuery.data?.items
        : type === "datasource"
          ? datasourcesQuery.data?.items
          : reportsQuery.data?.items;
    return source?.find((item) => item.id === id)?.name ?? null;
  };

  return { nameByTypeAndId };
}
