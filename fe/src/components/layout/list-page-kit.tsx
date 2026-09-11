import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { PaginationBar, type PaginationBarProps } from "@/components/ui/pagination-bar";
import type { ListEmptyPreviewLayout } from "@/components/ui/list-empty-preview";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableSize,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export { PageErrorBanner } from "@/components/ui/page-error-banner";

/** 管理页白色面板外框：列表区、页头栏等与 main 灰底区分 */
export const ADMIN_PAGE_SURFACE_CLASS =
  "rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]";

/** AdminPageShell 页头外框（内边距由内部区块控制） */
export const ADMIN_PAGE_HEADER_FRAME_CLASS = cn(ADMIN_PAGE_SURFACE_CLASS, "shrink-0 overflow-hidden");

/** 页头内容区内边距 */
export const ADMIN_PAGE_HEADER_BODY_CLASS = "px-4 py-3";

/** 列表页内容区内边距（表格/卡片栅格） */
export const LIST_PAGE_CONTENT_PAD_CLASS = "px-4 py-3";

/** 页头操作区：与标题块右对齐 */
export const ADMIN_PAGE_HEADER_ACTIONS_CLASS =
  "flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5";

/** 页头左侧图标块（对标 TailAdmin 页面 Hero 头图） */
export function AdminPageHeaderIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 看板 / 大屏等列表卡片栅格：宽屏一行 4 列 */
export const LIST_PAGE_CARD_GRID_CLASS =
  "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function ListPageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        ADMIN_PAGE_SURFACE_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ListPageTableFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
        LIST_PAGE_CONTENT_PAD_CLASS,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListPageToolbar({
  filters,
  actions,
  className,
}: {
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const hasFilters = filters != null;
  const actionsOnly = !hasFilters && actions != null;

  return (
    <div
      className={cn(
        "flex shrink-0 border-b border-gray-100 bg-gray-50/80 dark:border-white/[0.06] dark:bg-white/[0.02]",
        actionsOnly
          ? "justify-end px-4 py-2"
          : "flex-col gap-2 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      {hasFilters ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{filters}</div>
      ) : null}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function ListPageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("shrink-0 p-4", className)}>{children}</div>;
}

export function ListPageFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto shrink-0 border-t border-gray-100 bg-gray-50/80 px-4 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListPagePagination(props: PaginationBarProps) {
  return (
    <ListPageFooter>
      <PaginationBar {...props} />
    </ListPageFooter>
  );
}

export type ListPageCardGridEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  headingId?: string;
  layout?: Extract<ListEmptyPreviewLayout, "cards" | "data-screen">;
};

/** 卡片栅格列表空态（仪表板 / 数据大屏等）。 */
export function ListPageCardGridEmptyState({
  icon,
  title,
  description,
  action,
  headingId,
  layout = "cards",
}: ListPageCardGridEmptyStateProps) {
  return (
    <ListGhostEmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      headingId={headingId}
      layout={layout}
      rows={3}
    />
  );
}

type DataTableEmptyProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  layout?: ListEmptyPreviewLayout;
  density?: "default" | "compact";
  rows?: number;
};

export type DataTableProps = {
  loading: boolean;
  empty: boolean;
  headers: ReactNode[];
  rows: ReactNode[][];
  emptyState?: DataTableEmptyProps;
  lastColumnAlign?: "left" | "right";
  loadingRows?: number;
  size?: TableSize;
  /** 表体区域最大高度，超出后纵向滚动；表头 sticky */
  maxBodyHeight?: string;
};

export function DataTable({
  loading,
  empty,
  headers,
  rows,
  emptyState,
  lastColumnAlign = "left",
  loadingRows = 4,
  size = "comfortable",
  maxBodyHeight,
}: DataTableProps) {
  const lastIndex = headers.length - 1;

  if (empty && !loading && emptyState) {
    return (
      <ListGhostEmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
        headingId="data-table-empty"
        layout={emptyState.layout}
        density={emptyState.density}
        rows={emptyState.rows}
      />
    );
  }

  return (
    <div
      className={cn("overflow-x-only", maxBodyHeight && "custom-scrollbar overflow-y-auto")}
      style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
    >
      <Table
        size={size}
        stickyHeader={Boolean(maxBodyHeight)}
        wrapperClassName="min-w-[640px] border-0 shadow-none"
      >
      <TableHeader className="bg-gray-50/80 dark:bg-white/[0.02]">
        <TableRow className="hover:bg-transparent">
          {headers.map((header, index) => (
            <TableHead
              key={index}
              className={cn(
                index === lastIndex && lastColumnAlign === "right" && "text-right",
              )}
            >
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: loadingRows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell colSpan={headers.length}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          : null}
        {!loading && empty ? (
          <TableRow>
            <TableCell
              colSpan={headers.length}
              className="py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400"
            >
              暂无数据
            </TableCell>
          </TableRow>
        ) : null}
        {!loading
          ? rows.map((cells, rowIndex) => (
              <TableRow key={rowIndex}>
                {cells.map((cell, cellIndex) => (
                  <TableCell
                    key={cellIndex}
                    className={cn(
                      cellIndex === lastIndex && lastColumnAlign === "right" && "text-right",
                    )}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          : null}
      </TableBody>
      </Table>
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-0.5">{children}</div>;
}

/** 列表行删除：禁用时垃圾桶加斜杠，表示不可删除 */
export function DeleteRowIconButton({
  label,
  disabled,
  disabledTitle,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  disabledTitle?: string;
  onClick?: () => void;
}) {
  const button = (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      disabled={disabled}
      showTooltip={!disabled}
      className={cn(
        disabled
          ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
          : "text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300",
      )}
      onClick={onClick}
    >
      <span className="relative inline-flex">
        <Trash2 className={cn("size-4", disabled && "opacity-60")} aria-hidden />
        {disabled ? (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-px w-[140%] rotate-[-45deg] bg-current opacity-90" />
          </span>
        ) : null}
      </span>
    </IconButton>
  );

  if (disabled && disabledTitle) {
    return (
      <HintTooltip label={disabledTitle}>
        <span className="inline-flex">{button}</span>
      </HintTooltip>
    );
  }

  return button;
}
