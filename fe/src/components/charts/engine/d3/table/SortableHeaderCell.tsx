import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { CSSProperties } from "react";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import type { TableSortState } from "@/components/charts/engine/d3/table/tableClientSort";
import { columnAlignClass } from "@/components/charts/engine/d3/table/tableColumnAlign";
import { TableResizeHandle } from "@/components/charts/engine/d3/table/TableResizeHandle";

type SortableHeaderCellProps = {
  label: string;
  field: string;
  align: "left" | "right" | "center";
  sort: TableSortState;
  sortable: boolean;
  sticky?: "lead" | "first" | false;
  className?: string;
  resizable?: boolean;
  cellStyle?: React.CSSProperties;
  onSort: (field: string) => void;
  onColumnResize?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onColumnAutoFit?: (field: string) => void;
};

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />;
  if (direction === "asc") return <ArrowUp className="size-3 shrink-0 text-brand-500" aria-hidden />;
  return <ArrowDown className="size-3 shrink-0 text-brand-500" aria-hidden />;
}

export function SortableHeaderCell({
  label,
  field,
  align,
  sort,
  sortable,
  sticky = false,
  className,
  resizable = false,
  cellStyle,
  onSort,
  onColumnResize,
  onColumnAutoFit,
}: SortableHeaderCellProps) {
  const active = sort?.field === field;
  const content = (
    <>
      <TruncateHint title={label} className="min-w-0">
        {label}
      </TruncateHint>
      {sortable ? <SortIcon active={active} direction={active ? sort?.direction : undefined} /> : null}
    </>
  );

  const baseClass = cn(
    "vs-table-th group/th relative border-b border-[var(--dashboard-table-border,#f2f4f7)]",
    "bg-[var(--dashboard-table-header-bg)] text-[var(--dashboard-table-header-fg,#667085)]",
    "text-[length:var(--dashboard-table-header-font-size,12px)] font-semibold tracking-wide",
    columnAlignClass(align),
    sticky && "vs-table-sticky-col",
    sticky === "lead" && "vs-table-sticky-lead",
    sticky === "first" && "vs-table-sticky-first",
    className,
  );

  const resize =
    resizable && onColumnResize ? (
      <TableResizeHandle
        orientation="column"
        onPointerDown={onColumnResize}
        onDoubleClick={
          onColumnAutoFit
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                onColumnAutoFit(field);
              }
            : undefined
        }
      />
    ) : null;

  if (!sortable) {
    return (
      <th scope="col" data-sticky={sticky || undefined} className={baseClass} style={cellStyle}>
        <div className="flex items-center gap-1.5">{content}</div>
        {resize}
      </th>
    );
  }

  return (
    <th scope="col" data-sticky={sticky || undefined} className={baseClass} style={cellStyle}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-sm pr-2 transition-colors",
          align === "right" && "justify-end",
          align === "center" && "justify-center",
          "hover:text-[var(--dashboard-table-header-active-fg,var(--dashboard-table-body-fg,#344054))]",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
          active && "text-[var(--dashboard-table-header-active-fg,var(--dashboard-table-body-fg,#344054))]",
        )}
        onClick={() => onSort(field)}
        aria-label={`按 ${label} 排序`}
      >
        {content}
      </button>
      {resize}
    </th>
  );
}
