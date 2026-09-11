import { List } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DASHBOARD_EDIT_RAIL_SHELL_CHROME_CLASS } from "./dashboardEditRailLayout";

export function RailFoldIcon({ className }: { className?: string }) {
  return <List className={cn("size-4 text-gray-400 dark:text-gray-500", className)} aria-hidden />;
}

/** DataEase 收回：收起后的右侧竖条（汉堡 + 竖排标签） */
export function CollapsedRailTab({
  label,
  onExpand,
  className,
}: {
  label: string;
  onExpand: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-full min-h-0 w-8 shrink-0 flex-col items-center overflow-hidden py-2.5 transition-colors",
        DASHBOARD_EDIT_RAIL_SHELL_CHROME_CLASS,
        "hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/30",
        "dark:hover:bg-white/[0.05]",
        className,
      )}
      aria-label={`展开${label}`}
      onClick={onExpand}
    >
      <RailFoldIcon />
      <span
        className="mt-3 max-h-[min(12rem,calc(100%-2.5rem))] truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {label}
      </span>
    </button>
  );
}

export function RailFoldHeader({
  label,
  onCollapse,
  className,
  subtitle,
}: {
  label: string;
  onCollapse?: () => void;
  className?: string;
  subtitle?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-gray-200 px-3 py-2.5 dark:border-gray-800",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-theme-xs font-semibold text-gray-800 dark:text-white/90">
            {label}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        {onCollapse ? (
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
            aria-label={`收起${label}`}
            onClick={onCollapse}
          >
            <RailFoldIcon />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}
