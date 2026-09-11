import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConnectorCategoryCardProps = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  variant?: "category" | "type";
  selected?: boolean;
  description?: string;
  count?: number;
  subtitle?: string;
  typeId?: string;
};

function shouldShowTypeBadge(label: string, typeId?: string): typeId is string {
  if (!typeId) return false;
  const norm = (value: string) => value.toLowerCase().replace(/[\s_./-]/g, "");
  const a = norm(label);
  const b = norm(typeId);
  return a !== b && !a.includes(b) && !b.includes(a);
}

export function ConnectorCategoryCard({
  label,
  icon: Icon,
  onSelect,
  variant = "category",
  selected,
  description = "",
  count = 0,
  subtitle,
  typeId,
}: ConnectorCategoryCardProps) {
  const ariaLabel = variant === "category" && count > 0 ? `${label}，${count} 种连接器` : label;
  const showTypeBadge = variant === "type" && shouldShowTypeBadge(label, typeId);

  const baseButtonClass = cn(
    "group w-full rounded-2xl border border-gray-200 bg-white text-left shadow-theme-xs transition-all",
    "hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-theme-sm",
    "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
    "dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5",
    selected && "border-brand-300 ring-2 ring-brand-500/20 dark:border-brand-500/40",
  );

  const iconBoxClass = cn(
    "flex shrink-0 items-center justify-center rounded-xl transition-colors",
    "bg-gray-100 text-gray-600 group-hover:bg-brand-500 group-hover:text-white",
    "dark:bg-white/5 dark:text-gray-400 dark:group-hover:bg-brand-500 dark:group-hover:text-white",
    variant === "category" ? "size-11" : "size-10",
  );

  if (variant === "type") {
    return (
      <button type="button" aria-label={ariaLabel} onClick={onSelect} className={cn(baseButtonClass, "flex items-center gap-4 p-4")}>
        <span className={iconBoxClass}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
            {showTypeBadge ? (
              <Badge variant="light" color="light" size="sm" className="font-mono">
                {typeId}
              </Badge>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400 dark:text-gray-600"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(baseButtonClass, "flex h-full flex-col p-5")}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <span className={iconBoxClass}>
          <Icon className="size-5" aria-hidden />
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400 dark:text-gray-600"
          aria-hidden
        />
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
        {description ? (
          <p className="mt-1.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        ) : null}
      </div>

      {count > 0 ? (
        <Badge variant="light" color="light" size="sm" className="mt-4 self-start">
          {count} 种连接器
        </Badge>
      ) : null}
    </button>
  );
}
