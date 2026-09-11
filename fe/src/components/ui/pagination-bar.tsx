import { cn } from "@/lib/utils";
import { getPaginationRange, LIST_PAGE_SIZE_DEFAULT, LIST_PAGE_SIZE_OPTIONS } from "@/lib/list-pagination";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSizeChanger,
  PaginationSummary,
} from "@/components/ui/pagination";

export type PaginationBarProps = {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  onChange: (page: number, pageSize: number) => void;
  className?: string;
};

function buildPageNumbers(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export function PaginationBar({
  current,
  pageSize,
  total,
  showSizeChanger = false,
  pageSizeOptions = [...LIST_PAGE_SIZE_OPTIONS],
  onChange,
  className,
}: PaginationBarProps) {
  const range = getPaginationRange(
    Number.isFinite(current) ? current : 1,
    Number.isFinite(pageSize) && pageSize > 0 ? pageSize : LIST_PAGE_SIZE_DEFAULT,
    total,
  );
  const { totalPages, start, end } = range;
  const safeCurrent = range.current;
  const pageItems = buildPageNumbers(safeCurrent, totalPages);

  const emit = (page: number, size = pageSize) => {
    onChange(Math.min(Math.max(1, page), totalPages), size);
  };

  if (total <= 0) return null;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {showSizeChanger ? (
          <PaginationSizeChanger
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={(size) => onChange(1, size)}
          />
        ) : null}
        <PaginationSummary
          start={start}
          end={end}
          total={total}
          current={safeCurrent}
          totalPages={totalPages}
        />
      </div>

      <Pagination className="mx-0 w-auto shrink-0 justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={safeCurrent <= 1} onClick={() => emit(safeCurrent - 1)} />
          </PaginationItem>
          {pageItems.map((item, idx) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  isActive={item === safeCurrent}
                  onClick={() => emit(item)}
                  aria-label={`第 ${item} 页`}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              disabled={safeCurrent >= totalPages}
              onClick={() => emit(safeCurrent + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
