import { Search, X } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label": string;
  className?: string;
  inputClassName?: string;
  onClear?: () => void;
  disabled?: boolean;
  /** 窄栏（~180px）紧凑密度，避免默认 Input 内边距撑出边界 */
  density?: "default" | "compact";
};

export function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className,
  inputClassName,
  onClear,
  disabled = false,
  density = "default",
}: SearchFieldProps) {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  const compact = density === "compact";

  return (
    <div className={cn("relative box-border min-w-0", compact && "w-full max-w-full", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500",
          compact ? "left-1.5 size-3.5" : "left-3 size-4",
        )}
        aria-hidden
      />
      <Input
        type="text"
        role="searchbox"
        enterKeyHint="search"
        disabled={disabled}
        size={compact ? "sm" : "md"}
        className={cn(
          compact
            ? "h-8 min-w-0 px-2 py-1.5 pl-7 text-[11px] shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/20"
            : "h-11 pl-9",
          value ? (compact ? "pr-7" : "pr-10") : compact ? "pr-2" : "pr-4",
          inputClassName,
        )}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      {value ? (
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
            compact ? "right-0 size-6" : "right-1",
          )}
          aria-label="清除搜索"
          onClick={handleClear}
        >
          <X className={compact ? "size-3.5" : "size-4"} />
        </IconButton>
      ) : null}
    </div>
  );
}
