import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";

type EmbedToolShellProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
};

export function EmbedToolShell({
  title,
  description,
  backHref = "/admin/dashboards",
  backLabel = "取消",
  children,
  className,
}: EmbedToolShellProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10", className)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <h1 className="truncate text-title-sm font-semibold text-gray-900 dark:text-white">{title}</h1>
          {description ? (
            <TruncateHint
              title={description}
              as="p"
              className="text-theme-sm text-gray-500 dark:text-gray-400"
            >
              {description}
            </TruncateHint>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to={backHref}>
            <ArrowLeft className="size-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      </header>
      {children}
    </div>
  );
}

export function EmbedToolCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm",
        "dark:border-gray-800 dark:bg-white/[0.03]",
        className,
      )}
    >
      {title ? (
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</h2>
          {description ? (
            <TruncateHint
              title={description}
              as="p"
              className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400"
            >
              {description}
            </TruncateHint>
          ) : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
}
