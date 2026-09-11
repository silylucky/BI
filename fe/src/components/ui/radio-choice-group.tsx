import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RadioChoiceOption<T extends string> = {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
};

function RadioIndicator({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border shadow-theme-xs transition-colors",
        checked
          ? "border-brand-500 bg-transparent"
          : "border-gray-300 bg-transparent dark:border-gray-700",
        disabled && "opacity-60",
      )}
    >
      {checked ? <span className="size-2.5 rounded-full bg-brand-500" /> : null}
    </span>
  );
}

/** 纵向单选列表（带说明文案），样式对齐 Checkbox 组件 */
export function RadioChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
  name,
}: {
  value: T;
  options: ReadonlyArray<RadioChoiceOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("space-y-2", className)}>
      {options.map((opt) => {
        const selected = value === opt.value;
        const isTextLabel = typeof opt.label === "string";
        const itemDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel ?? (isTextLabel ? String(opt.label) : undefined)}
            disabled={itemDisabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-2 rounded-lg text-left text-theme-sm transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
              itemDisabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioIndicator checked={selected} disabled={itemDisabled} />
            <span className="min-w-0 flex-1">
              {opt.label}
              {opt.hint ? (
                <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                  {opt.hint}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
