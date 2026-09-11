import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { buildDashboardsListUrl } from "@/lib/dashboardsListQuery";
import { queryKeys } from "@/lib/queryKeys";

type DashboardOption = { id: string; name: string };

type DashboardListResponse = {
  items: DashboardOption[];
};

export function useDashboardOptions() {
  return useQuery({
    queryKey: queryKeys.dashboards.list({ limit: 100, offset: 0 }),
    queryFn: () =>
      apiFetch<DashboardListResponse>(
        buildDashboardsListUrl({ limit: 100, offset: 0 }),
      ),
    staleTime: 60_000,
  });
}

export function buildDashboardNameMap(
  items: DashboardOption[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items ?? []) {
    map.set(item.id, item.name);
  }
  return map;
}

type DashboardPickerSelectProps = {
  value: string;
  onValueChange: (dashboardId: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function DashboardPickerSelect({
  value,
  onValueChange,
  id = "dashboard-picker",
  disabled,
  placeholder = "选择仪表板",
}: DashboardPickerSelectProps) {
  const query = useDashboardOptions();
  const items = query.data?.items ?? [];

  if (query.isLoading) {
    return <Skeleton className="h-11 w-full" />;
  }

  if (query.isError) {
    return (
      <p className="text-theme-xs text-error-600 dark:text-error-400">
        无法加载仪表板列表，请稍后重试
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        暂无可用仪表板，请先在「仪表板」中创建。
      </p>
    );
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
