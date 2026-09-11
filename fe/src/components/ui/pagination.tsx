import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LIST_PAGE_SIZE_OPTIONS } from "@/lib/list-pagination";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="分页"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn("flex flex-row items-center gap-0.5 rounded-lg bg-white p-0.5 dark:bg-gray-900", className)}
      {...props}
    />
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />,
);
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<"button">;

const PaginationLink = ({ className, isActive, disabled, ...props }: PaginationLinkProps) => (
  <button
    type="button"
    aria-current={isActive ? "page" : undefined}
    disabled={disabled}
    className={cn(
      "inline-flex size-8 items-center justify-center rounded-md text-theme-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:pointer-events-none disabled:opacity-40",
      isActive
        ? "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600"
        : "bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/[0.04]",
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="上一页"
    className={cn("size-8 px-0", className)}
    {...props}
  >
    <ChevronLeft className="size-4" aria-hidden />
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="下一页"
    className={cn("size-8 px-0", className)}
    {...props}
  >
    <ChevronRight className="size-4" aria-hidden />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex size-8 items-center justify-center text-gray-400 dark:text-gray-500", className)}
    {...props}
  >
    <MoreHorizontal className="size-4" />
    <span className="sr-only">更多页</span>
  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export type PaginationSizeChangerProps = {
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
  className?: string;
};

export function PaginationSizeChanger({
  pageSize,
  pageSizeOptions = [...LIST_PAGE_SIZE_OPTIONS],
  onPageSizeChange,
  className,
}: PaginationSizeChangerProps) {
  const labelId = React.useId();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-0.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900",
        className,
      )}
    >
      <span id={labelId} className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        每页
      </span>
      <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
        <SelectTrigger
          className="h-7 w-[4rem] shrink-0 border-0 bg-gray-50 px-1.5 text-theme-xs shadow-none focus-visible:ring-2 dark:bg-white/5"
          aria-label="每页条数"
          aria-labelledby={labelId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" align="start" position="popper" className="min-w-[5.5rem]">
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)} className="py-2 pr-8 pl-3">
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">条</span>
    </div>
  );
}

export type PaginationSummaryProps = {
  start: number;
  end: number;
  total: number;
  current: number;
  totalPages: number;
  className?: string;
};

export function PaginationSummary({
  start,
  end,
  total,
  current,
  totalPages,
  className,
}: PaginationSummaryProps) {
  return (
    <p className={cn("text-theme-xs leading-none text-gray-500 dark:text-gray-400", className)}>
      显示{" "}
      <span className="font-medium tabular-nums text-gray-800 dark:text-white/90">
        {start}–{end}
      </span>
      <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
      共{" "}
      <span className="font-medium tabular-nums text-gray-800 dark:text-white/90">{total}</span> 条
      <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
      第{" "}
      <span className="font-medium tabular-nums text-gray-800 dark:text-white/90">{current}</span> /{" "}
      {totalPages} 页
    </p>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
