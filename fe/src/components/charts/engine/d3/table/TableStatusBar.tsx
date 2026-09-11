import { dwTablePaginationText } from "@/components/dashboard/dashboardWidgetTypography";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import { cn } from "@/lib/utils";

type TableStatusBarProps = {
  totalRows: number;
  scrollMode?: boolean;
  tableStyle?: ChartDeTableStyle;
  className?: string;
};

/** 表格底栏：下拉模式显示滚动提示；翻页模式由 TablePaginationBar 承担 */
export function TableStatusBar({
  totalRows,
  scrollMode,
  tableStyle = {},
  className,
}: TableStatusBarProps) {
  const barStyle = {
    fontSize:
      tableStyle.paginationFontSize != null
        ? `${tableStyle.paginationFontSize}px`
        : "var(--dashboard-table-pagination-font-size, 14px)",
    ...(tableStyle.paginationFg ? { color: tableStyle.paginationFg } : {}),
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between border-t border-[var(--dashboard-table-border,#f2f4f7)]",
        "bg-[var(--dashboard-table-footer-bg,var(--dashboard-table-header-bg,#f9fafb))] px-3 py-1.5",
        "text-[var(--dashboard-table-pagination-fg,inherit)]",
        className,
      )}
      style={barStyle}
      data-testid="table-status-bar"
    >
      <span className={dwTablePaginationText}>共 {totalRows.toLocaleString("zh-CN")} 条</span>
      {scrollMode ? (
        <span className={dwTablePaginationText}>下拉滚动浏览</span>
      ) : null}
    </div>
  );
}
