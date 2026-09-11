import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchField } from "@/components/ui/search-field";
import type { ReactNode } from "react";

export type SyncJobStatusFilter = "all" | "enabled" | "disabled" | "scheduled";

type SyncJobsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: SyncJobStatusFilter;
  onStatusFilterChange: (value: SyncJobStatusFilter) => void;
  resultLabel: string;
  trailing?: ReactNode;
};

export function SyncJobsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  resultLabel,
  trailing,
}: SyncJobsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          className="w-full sm:max-w-md"
          value={search}
          onChange={onSearchChange}
          placeholder="搜索任务名称、源类型或目标表…"
          aria-label="搜索同步任务"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as SyncJobStatusFilter)}
        >
          <SelectTrigger className="h-11 w-full sm:w-[140px]" aria-label="筛选任务状态">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="enabled">仅启用</SelectItem>
            <SelectItem value="disabled">仅停用</SelectItem>
            <SelectItem value="scheduled">仅定时</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {trailing}
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">{resultLabel}</p>
      </div>
    </div>
  );
}
