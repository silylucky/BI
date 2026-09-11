import { useState, type ReactNode } from "react";
import { Calendar, GripVertical, Hash, Type, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { readFieldDragData } from "@/lib/chartFieldDrag";
import { fieldDisplayKind } from "./datasetFieldClassification";

const slotVariants = cva(
  "flex min-h-9 w-full items-center rounded-lg border px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20",
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
    defaultVariants: {
      tone: "empty",
    },
  },
);

const chipVariants = cva(
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-theme-xs font-medium",
  {
    variants: {
      kind: {
        dimension: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
        metric: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
        neutral: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
      },
    },
    defaultVariants: {
      kind: "neutral",
    },
  },
);

type ChartFieldSlotProps = {
  label: string;
  /** 对标 DE 必填红星 */
  required?: boolean;
  optional?: boolean;
  /** 标签旁说明图标（如钻取） */
  hintIcon?: ReactNode;
  /** 嵌套在组合槽内时不重复渲染标签 */
  hideLabel?: boolean;
  fieldName?: string;
  /** 聚合等后缀，如「求和」；展示为次要文案 */
  fieldSuffix?: string;
  /** 维度槽用 brand chip，指标槽用 success chip */
  slotKind?: "dimension" | "metric";
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onClear?: () => void;
  onDropField?: (fieldName: string) => void;
  className?: string;
};

function FieldKindIcon({ field }: { field: string }) {
  const kind = fieldDisplayKind(field);
  const className = "size-3 shrink-0";
  if (kind === "date") {
    return <Calendar className={cn(className, "text-brand-500")} aria-hidden />;
  }
  if (kind === "number") {
    return <Hash className={cn(className, "text-success-500")} aria-hidden />;
  }
  return <Type className={cn(className, "text-brand-500")} aria-hidden />;
}

export function ChartFieldSlot({
  label,
  required = false,
  optional = false,
  hintIcon,
  hideLabel = false,
  fieldName,
  fieldSuffix,
  slotKind = "neutral",
  active,
  disabled,
  onClick,
  onClear,
  onDropField,
  className,
}: ChartFieldSlotProps) {
  const [dragOver, setDragOver] = useState(false);
  const filled = Boolean(fieldName);
  const tone = dragOver && !disabled ? "dragOver" : filled ? "filled" : "empty";
  const chipKind = slotKind === "neutral" ? "neutral" : slotKind;

  return (
    <div className={cn("space-y-1", className)}>
      {hideLabel ? null : (
        <span className="inline-flex items-center gap-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
          {required ? <span className="text-error-500" aria-hidden>*</span> : null}
          {hintIcon}
          {optional ? (
            <span className="font-normal text-gray-400 dark:text-gray-500">（可选）</span>
          ) : null}
        </span>
      )}
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
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
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
          slotVariants({ tone }),
          active && "ring-2 ring-brand-500/25",
          !disabled && "cursor-pointer",
          !disabled && !filled && !dragOver && "hover:border-gray-300 dark:hover:border-gray-600",
          !disabled &&
            filled &&
            "hover:border-gray-300 dark:hover:border-gray-700",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-label={fieldName ? `${label}: ${fieldName}` : `${label}，拖动字段至此处`}
      >
        {filled ? (
          <span className={cn(chipVariants({ kind: chipKind }), "w-full")}>
            {fieldName ? <FieldKindIcon field={fieldName} /> : null}
            <span className="min-w-0 flex-1 truncate">{fieldName}</span>
            {fieldSuffix ? (
              <span className="shrink-0 font-normal text-gray-500 dark:text-gray-400">
                ({fieldSuffix})
              </span>
            ) : null}
            {onClear ? (
              <button
                type="button"
                className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-black/5 hover:text-error-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                aria-label={`清空${label}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </span>
        ) : (
          <span className="flex w-full items-center justify-center gap-1.5 text-theme-xs text-gray-400 dark:text-gray-500">
            <GripVertical className="size-3.5 shrink-0 opacity-50" aria-hidden />
            <span>{dragOver ? "松开以绑定字段" : "拖动字段至此处"}</span>
          </span>
        )}
      </div>
    </div>
  );
}
