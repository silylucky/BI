import type { ReactNode } from "react";
import { GhostDashboardGrid } from "@/components/ui/list-empty-preview-dashboard";
import { GhostDataScreenGrid } from "@/components/ui/list-empty-preview-data-screen";
import { cn } from "@/lib/utils";

export type ListEmptyPreviewLayout = "table" | "cards" | "data-screen";

function GhostTableRows({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-gray-200/80 dark:divide-white/[0.08]">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-center gap-4 px-6 py-4">
          <div className="size-11 shrink-0 rounded-xl bg-gray-200 dark:bg-white/12" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div
              className="h-4 rounded-md bg-gray-200 dark:bg-white/12"
              style={{ width: `${46 + (index % 3) * 10}%`, maxWidth: 300 }}
            />
            <div
              className="h-3 rounded-md bg-gray-100 dark:bg-white/6"
              style={{ width: `${24 + (index % 2) * 12}%`, maxWidth: 200 }}
            />
          </div>
          <div className="hidden h-9 w-24 shrink-0 rounded-lg bg-brand-100 dark:bg-brand-500/20 sm:block" />
          <div className="hidden h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-lg border border-gray-200/80 bg-white dark:border-white/10 dark:bg-white/[0.04] md:block">
            <div className="flex h-full items-end gap-0.5 px-2 pb-2">
              {[38, 62, 48, 78, 52, 68].map((height, barIndex) => (
                <span
                  key={barIndex}
                  className="flex-1 rounded-sm bg-brand-400/55 dark:bg-brand-400/45"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

type ListEmptyPreviewBackdropProps = {
  layout?: ListEmptyPreviewLayout;
  rows?: number;
  className?: string;
};

/** ??????????????????? / ???? / ?????? */
export function ListEmptyPreviewBackdrop({
  layout = "table",
  rows = 5,
  className,
}: ListEmptyPreviewBackdropProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/15 blur-3xl dark:bg-brand-400/12" />
      <div className="absolute -bottom-24 -left-16 size-64 rounded-full bg-sky-400/12 blur-3xl dark:bg-sky-500/10" />
      <div className="absolute inset-0 translate-y-2 scale-[1.04] opacity-95 saturate-125 blur-[2px]">
        {layout === "cards" ? (
          <GhostDashboardGrid />
        ) : layout === "data-screen" ? (
          <GhostDataScreenGrid />
        ) : (
          <GhostTableRows rows={rows} />
        )}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_50%,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.52)_48%,rgba(255,255,255,0.9)_100%)] dark:bg-[radial-gradient(ellipse_80%_65%_at_50%_50%,rgba(3,7,18,0.06)_0%,rgba(3,7,18,0.52)_48%,rgba(3,7,18,0.94)_100%)]" />
    </div>
  );
}

export type ListEmptyHeroPanelProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  headingId?: string;
};

/** ???????????? CTA ??? */
export function ListEmptyHeroPanel({
  icon,
  title,
  description,
  action,
  headingId,
}: ListEmptyHeroPanelProps) {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200/80 bg-white/92 p-5 shadow-theme-lg ring-1 ring-gray-200/50 backdrop-blur-md sm:p-6 dark:border-gray-700/80 dark:bg-gray-900/92 dark:ring-white/10">
      <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:gap-6 md:text-left">
        <div className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 ring-4 ring-brand-500/10 dark:shadow-brand-500/20 dark:ring-brand-400/15 [&_svg]:size-8">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3
            id={headingId}
            className="text-theme-xl font-semibold tracking-tight text-gray-900 dark:text-white"
          >
            {title}
          </h3>
          <p className="text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap justify-center gap-2 md:justify-end">{action}</div> : null}
      </div>
    </div>
  );
}
