import { useState, type ReactNode } from "react";
import { Calendar, GripVertical, Hash, Trash2, Type, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { readFieldDragData } from "@/lib/chartFieldDrag";
import { classifyDatasetField, fieldDisplayKind } from "./datasetFieldClassification";
import type { DeAxisId } from "@/lib/chartDeAxis";

const containerVariants = cva(
  "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20",
  {
    variants: {
      tone: {
        empty:
          "border-dashed border-gray-200 bg-gray-50/30 dark:border-gray-700 dark:bg-white/[0.02]",
        filled: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/50",
        dragOver:
          "border-dashed border-brand-400 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-500/10",
      },
    },
    defaultVariants: { tone: "empty" },
  },
);

const chipVariants = cva(
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-theme-xs font-medium",
  {
    variants: {
      kind: {
        dimension: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
        metric: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
      },
    },
  },
);

type ChartFieldMultiSlotProps = {
  label: string;
  required?: boolean;
  hintIcon?: ReactNode;
  axisId: DeAxisId;
  fields: string[];
  showAggregation?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onClearAll?: () => void;
  onRemoveAt?: (index: number) => void;
  onDropField?: (fieldName: string) => void;
};

function FieldKindIcon({ field }: { field: string }) {
  const kind = fieldDisplayKind(field);
  const className = "size-3 shrink-0";
  if (kind === "date") return <Calendar className={cn(className, "text-brand-500")} aria-hidden />;
  if (kind === "number") return <Hash className={cn(className, "text-success-500")} aria-hidden />;
  return <Type className={cn(className, "text-brand-500")} aria-hidden />;
}

export function ChartFieldMultiSlot({
  label,
  required = false,
  hintIcon,
  fields,
  showAggregation,
  active,
  disabled,
  onClick,
  onClearAll,
  onRemoveAt,
  onDropField,
}: ChartFieldMultiSlotProps) {
  const [dragOver, setDragOver] = useState(false);
  const filled = fields.length > 0;
  const tone = dragOver && !disabled ? "dragOver" : filled ? "filled" : "empty";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex min-w-0 items-center gap-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
          {required ? <span className="text-error-500" aria-hidden>*</span> : null}
          {hintIcon}
        </span>
        {filled && onClearAll ? (
          <button
            type="button"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-black/5 hover:text-error-500 dark:hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              onClearAll();
            }}
            aria-label={`清空${label}`}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (disabled || !onClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        onDragEnter={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (disabled) return;
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(false);
          const field = readFieldDragData(e.dataTransfer);
          if (field) onDropField?.(field);
        }}
        className={cn(
          containerVariants({ tone }),
          active && "ring-2 ring-brand-500/25",
          !disabled && "cursor-pointer",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-label={filled ? `${label}: ${fields.join(", ")}` : `${label}，拖动字段至此处`}
      >
        {filled ? (
          fields.map((field, index) => {
            const isMetric = classifyDatasetField(field) === "metric";
            const suffix = showAggregation && isMetric ? "求和" : undefined;
            return (
              <span
                key={`${field}-${index}`}
                className={chipVariants({ kind: isMetric ? "metric" : "dimension" })}
                onClick={(e) => e.stopPropagation()}
              >
                <FieldKindIcon field={field} />
                <span className="min-w-0 max-w-[8rem] truncate">{field}</span>
                {suffix ? (
                  <span className="shrink-0 font-normal text-gray-500 dark:text-gray-400">
                    ({suffix})
                  </span>
                ) : null}
                {onRemoveAt ? (
                  <button
                    type="button"
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-error-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAt(index);
                    }}
                    aria-label={`移除 ${field}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            );
          })
        ) : (
          <span className="flex w-full items-center justify-center gap-1.5 py-0.5 text-theme-xs text-gray-400 dark:text-gray-500">
            <GripVertical className="size-3.5 shrink-0 opacity-50" aria-hidden />
            <span>{dragOver ? "松开以追加字段" : "拖动字段至此处"}</span>
          </span>
        )}
      </div>
    </div>
  );
}
