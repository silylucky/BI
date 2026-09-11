import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/button";
import { dwTablePaginationText } from "@/components/dashboard/dashboardWidgetTypography";
import { cn } from "@/lib/utils";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/chartDeTableStyle";

type TablePaginationBarProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  tableStyle?: ChartDeTableStyle;
  onPageChange: (page: number) => void;
};

/** 对标 DataEase 表格分页器：精简 / 常规两种风格 */
export function TablePaginationBar({
  page,
  totalPages,
  pageSize,
  totalRows,
  tableStyle = {},
  onPageChange,
}: TablePaginationBarProps) {
  const paginationVariant = tableStyle.paginationVariant ?? "compact";
  const barStyle = {
    fontSize:
      tableStyle.paginationFontSize != null
        ? `${tableStyle.paginationFontSize}px`
        : "var(--dashboard-table-pagination-font-size, 14px)",
    ...(tableStyle.paginationFg ? { color: tableStyle.paginationFg } : {}),
  };

  if (paginationVariant === "compact") {
    return (
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--dashboard-table-border,#f2f4f7)] bg-[var(--dashboard-table-footer-bg,var(--dashboard-table-header-bg))] px-2.5 py-1.5 text-[var(--dashboard-table-pagination-fg,inherit)]"
        style={barStyle}
        data-testid="table-pagination-compact"
      >
        <span className={dwTablePaginationText}>共 {totalRows.toLocaleString("zh-CN")} 条</span>
        <div className="flex items-center gap-0.5">
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 text-inherit"
            showTooltip={false}
            disabled={page <= 1}
            aria-label="上一页"
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className={cn(dwTablePaginationText, "min-w-[4.5rem] text-center")}>
            {page}/{totalPages}
          </span>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 text-inherit"
            showTooltip={false}
            disabled={page >= totalPages}
            aria-label="下一页"
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
        <span className={dwTablePaginationText}>
          {pageSize || DEFAULT_TABLE_PAGE_SIZE} 条/页
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-[var(--dashboard-table-border,#f2f4f7)] bg-[var(--dashboard-table-footer-bg,var(--dashboard-table-header-bg))] px-2.5 py-1.5 text-[var(--dashboard-table-pagination-fg,inherit)]"
      style={barStyle}
      data-testid="table-pagination-normal"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-inherit"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        上一页
      </Button>
      <span className={dwTablePaginationText}>
        第 {page}/{totalPages} 页，共 {totalRows.toLocaleString("zh-CN")} 条
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2.5 text-inherit"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </Button>
    </div>
  );
}
