import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ListEmptyHeroPanel,
  ListEmptyPreviewBackdrop,
  type ListEmptyPreviewLayout,
} from "@/components/ui/list-empty-preview";
import { cn } from "@/lib/utils";

type PanelEmptyStateSize = "sm" | "md" | "lg";
type PanelEmptyStateVariant = "plain" | "framed" | "elevated";
type PanelEmptyStateTone = "neutral" | "brand";

const SIZE_CLASS: Record<PanelEmptyStateSize, string> = {
  sm: "min-h-[180px] px-4 py-10",
  md: "min-h-[280px] px-6 py-12",
  lg: "min-h-[420px] px-6 py-14",
};

export type PanelEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  footer?: ReactNode;
  size?: PanelEmptyStateSize;
  variant?: PanelEmptyStateVariant;
  tone?: PanelEmptyStateTone;
  /** centered：区块居中空态；inline：横向紧凑条，适合 Hub 分区底部 */
  layout?: "centered" | "inline";
  headingId?: string;
  className?: string;
};

export function PanelEmptyState({
  icon,
  title,
  description,
  action,
  footer,
  size = "md",
  variant = "plain",
  tone = "brand",
  layout = "centered",
  headingId,
  className,
}: PanelEmptyStateProps) {
  const framedClass =
    variant === "framed"
      ? "rounded-2xl border border-dashed border-gray-300 bg-gradient-to-b from-gray-50/90 to-white dark:border-gray-700 dark:from-white/[0.03] dark:to-white/[0.01]"
      : variant === "elevated"
        ? "rounded-2xl border border-gray-200/90 bg-white/95 shadow-theme-md ring-1 ring-gray-200/60 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95 dark:ring-white/10"
        : undefined;

  const iconShellClass =
    tone === "brand"
      ? "bg-brand-50 text-brand-600 ring-brand-500/10 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/20"
      : "bg-gray-100 text-gray-500 ring-gray-200/80 dark:bg-white/5 dark:text-gray-400 dark:ring-gray-800";

  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-4 px-4 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left",
          framedClass,
          className,
        )}
      >
        <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-theme-xs ring-1",
              iconShellClass,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3
              id={headingId}
              className="text-theme-sm font-semibold text-gray-900 dark:text-white"
            >
              {title}
            </h3>
            <p className="mt-1 max-w-xl text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap justify-center gap-2 sm:justify-end">{action}</div> : null}
        {footer ? <div className="w-full sm:col-span-2">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center text-center",
        SIZE_CLASS[size],
        framedClass,
        className,
      )}
    >
      <div
        className={cn(
          "mb-5 flex size-16 items-center justify-center rounded-2xl shadow-theme-xs ring-1",
          iconShellClass,
        )}
      >
        {icon}
      </div>
      <h3
        id={headingId}
        className="text-theme-lg font-semibold tracking-tight text-gray-900 dark:text-white"
      >
        {title}
      </h3>
      <p className="mt-2 max-w-md text-theme-sm leading-relaxed text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
      {footer ? <div className="mt-8 w-full">{footer}</div> : null}
    </div>
  );
}

type PanelEmptyStateStep = {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PanelEmptyStateSteps({ steps }: { steps: readonly PanelEmptyStateStep[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map(({ step, title, description, icon: Icon }) => (
        <div
          key={step}
          className="rounded-xl border border-gray-200 bg-gray-50/70 p-5 text-left dark:border-gray-800 dark:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white">
              {step}
            </span>
            <span className="flex size-9 items-center justify-center rounded-lg bg-white text-gray-600 shadow-theme-xs dark:bg-gray-900 dark:text-gray-300">
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          <h4 className="mt-4 text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
          <p className="mt-1.5 text-theme-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      ))}
    </div>
  );
}

export type ListGhostEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  headingId?: string;
  rows?: number;
  layout?: ListEmptyPreviewLayout;
  /** compact：Hub 分区内紧凑高度；default：列表页全高空态 */
  density?: "default" | "compact";
  className?: string;
};

/** 列表卡片内的空态：模糊虚拟数据背景 + 居中玻璃态 CTA。 */
export function ListGhostEmptyState({
  icon,
  title,
  description,
  action,
  headingId,
  rows = 5,
  layout = "table",
  density = "default",
  className,
}: ListGhostEmptyStateProps) {
  const isGridLayout = layout === "cards" || layout === "data-screen";
  const isCompact = density === "compact";
  const heightClass = isCompact
    ? "min-h-[260px]"
    : isGridLayout
      ? "min-h-[min(480px,58vh)]"
      : "min-h-[400px]";
  const padClass = isCompact ? "p-4 sm:p-5" : "p-5 sm:p-6 md:p-8";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-gray-200/90 bg-gray-50/60 dark:border-gray-800 dark:bg-white/[0.02]",
        heightClass,
        className,
      )}
      aria-labelledby={headingId}
    >
      <ListEmptyPreviewBackdrop layout={layout} rows={rows} />

      <div className={cn("relative flex h-full flex-col items-center justify-center", padClass, heightClass)}>
        <ListEmptyHeroPanel
          icon={icon}
          title={title}
          description={description}
          action={action}
          headingId={headingId}
        />
      </div>
    </div>
  );
}
