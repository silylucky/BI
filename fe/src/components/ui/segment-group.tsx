import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
};

/** TailAdmin 分段单选：灰底轨道 + 白底选中项（浅/深主题） */
export function SegmentGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
  columns,
  sizing = "fill",
}: {
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  columns?: number;
  sizing?: "fill" | "fit";
}) {
  const cols = columns ?? options.length;
  const fitCell = cols >= 3 ? "minmax(4.5rem, 7rem)" : "minmax(5.5rem, 9rem)";

  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.06]",
        sizing === "fit" ? "inline-grid w-fit max-w-full" : "min-w-0 w-full",
        className,
      )}
      style={{
        gridTemplateColumns:
          sizing === "fit"
            ? `repeat(${cols}, ${fitCell})`
            : `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const isTextLabel = typeof opt.label === "string";
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel ?? (isTextLabel ? String(opt.label) : undefined)}
            disabled={disabled || opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md px-3 text-center text-theme-sm font-medium leading-tight transition-all",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-1",
              selected
                ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-300"
                : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
              (disabled || opt.disabled) && "cursor-not-allowed opacity-40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
