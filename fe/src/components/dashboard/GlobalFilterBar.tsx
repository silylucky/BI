import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import { resolveFilterControlType, type Linkage } from "./dashboardFilterUtils";
import { FilterControl } from "./FilterWidgetControls";

type GlobalFilterBarProps = {
  dashboardId: string;
  values: Record<string, string>;
  onChange: (filterId: string, value: string) => void;
  dashboardStyle?: DashboardStyleConfig;
};

function resolveFilterValue(
  filter: Linkage["filters"][number],
  values: Record<string, string>,
): string {
  return values[filter.filterId] ?? filter.defaultValue ?? "";
}

export function GlobalFilterBar({
  dashboardId,
  values,
  onChange,
  dashboardStyle,
}: GlobalFilterBarProps) {
  const { data, isError, error } = useQuery({
    queryKey: queryKeys.dashboards.globalFilters(dashboardId),
    queryFn: () => apiFetch<Linkage>(`/api/v1/dashboards/${dashboardId}/global-filters`),
    retry: false,
  });

  const refreshMode = data?.refreshMode ?? "eager";
  const isLazy = refreshMode === "lazy";
  const [draftValues, setDraftValues] = useState(values);

  useEffect(() => {
    setDraftValues(values);
  }, [values]);

  const hasPendingChanges = useMemo(() => {
    if (!data?.filters?.length || !isLazy) return false;
    return data.filters.some(
      (filter) => resolveFilterValue(filter, draftValues) !== resolveFilterValue(filter, values),
    );
  }, [data?.filters, draftValues, isLazy, values]);

  if (isError) {
    const code = (error as ApiRequestError)?.code;
    if (code === "GLOBAL_FILTERS_NOT_FOUND" || (error as ApiRequestError)?.message?.includes("404")) {
      return null;
    }
    const status = (error as { status?: number })?.status;
    if (status === 404) return null;
    return null;
  }

  if (!data?.filters?.length) return null;

  const labelPosition = dashboardStyle?.filterChromeStyle?.titlePosition ?? "top";
  const labelStyle = dashboardStyle?.filterChromeStyle?.titleColor
    ? { color: dashboardStyle.filterChromeStyle.titleColor }
    : undefined;
  const controlHeight = dashboardStyle?.filterControlStyle?.height;
  const controlRadius = dashboardStyle?.filterControlStyle?.borderRadius;
  const inputStyle = {
    height: controlHeight ? `${controlHeight}px` : undefined,
    borderRadius: controlRadius ? `${controlRadius}px` : undefined,
  };

  const handleFieldChange = (filterId: string, next: string) => {
    if (isLazy) {
      setDraftValues((prev) => ({ ...prev, [filterId]: next }));
      return;
    }
    onChange(filterId, next);
  };

  const handleApply = () => {
    for (const filter of data.filters) {
      const next = resolveFilterValue(filter, draftValues);
      const current = resolveFilterValue(filter, values);
      if (next !== current) onChange(filter.filterId, next);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      {data.filters.map((filter) => {
        const controlType = resolveFilterControlType(filter);
        const displayValues = isLazy ? draftValues : values;
        return (
          <FilterControl
            key={filter.filterId}
            id={`gf-${filter.filterId}`}
            label={filter.dimensionRef}
            controlType={controlType}
            value={resolveFilterValue(filter, displayValues)}
            options={filter.options}
            onChange={(next) => handleFieldChange(filter.filterId, next)}
            labelPosition={labelPosition}
            labelStyle={labelStyle}
            inputStyle={inputStyle}
          />
        );
      })}
      {isLazy ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!hasPendingChanges}
          onClick={handleApply}
        >
          应用筛选
        </Button>
      ) : null}
    </div>
  );
}

export function useGlobalFiltersQuery(dashboardId: string) {
  return useQuery({
    queryKey: queryKeys.dashboards.globalFilters(dashboardId),
    queryFn: () => apiFetch<Linkage>(`/api/v1/dashboards/${dashboardId}/global-filters`),
    retry: false,
  });
}
