import { cn } from "@/lib/utils";

type DashboardGhostVariant = "ops-board" | "analytics" | "executive";

const DASHBOARD_GHOST_VARIANTS: readonly DashboardGhostVariant[] = [
  "ops-board",
  "analytics",
  "executive",
];

const DASHBOARD_SHELL: Record<DashboardGhostVariant, { tilt: string; footer: [string, string] }> = {
  "ops-board": { tilt: "-rotate-1", footer: ["w-[55%]", "w-1/3"] },
  analytics: { tilt: "rotate-0", footer: ["w-[48%]", "w-2/5"] },
  executive: { tilt: "rotate-1", footer: ["w-[62%]", "w-[28%]"] },
};

function OpsBoardStage() {
  return (
    <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-1.5 p-3">
      <div className="col-span-4 row-span-2 rounded-md bg-brand-400/40 dark:bg-brand-500/30" />
      <div className="col-span-2 row-span-4 rounded-md bg-sky-300/45 dark:bg-sky-400/25" />
      <div className="col-span-2 row-span-2 rounded-md bg-violet-300/40 dark:bg-violet-400/25" />
      <div className="col-span-2 row-span-2 rounded-md bg-emerald-300/40 dark:bg-emerald-400/25" />
    </div>
  );
}

function AnalyticsStage() {
  return (
    <>
      <div className="absolute inset-x-4 top-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((__, index) => (
          <div
            key={index}
            className="rounded-lg border border-brand-200/80 bg-white/80 px-2 py-3 dark:border-brand-500/20 dark:bg-white/5"
          >
            <div className="mx-auto h-2 w-8 rounded-full bg-brand-400/50" />
            <div className="mx-auto mt-2 h-2.5 w-10 rounded-full bg-gray-200 dark:bg-white/10" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-4 bottom-4 top-[4.5rem] rounded-lg border border-gray-200/80 bg-white/70 dark:border-gray-700 dark:bg-white/[0.04]">
        <div className="flex h-full items-end gap-1 px-3 pb-3">
          {[30, 52, 40, 68, 48, 76, 44, 62, 54, 70].map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-t-sm bg-brand-400/45 dark:bg-brand-400/35"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ExecutiveStage() {
  return (
    <>
      <div className="absolute inset-x-4 top-4 h-[38%] rounded-lg bg-gradient-to-r from-brand-200/50 via-sky-200/40 to-violet-200/45 dark:from-brand-500/20 dark:via-sky-500/15 dark:to-violet-500/15" />
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
        {["bg-brand-300/50", "bg-amber-300/50", "bg-emerald-300/50"].map((tone, index) => (
          <div
            key={index}
            className={cn("rounded-lg px-2 py-3 dark:opacity-80", tone)}
          >
            <div className="h-2 w-10 rounded-full bg-white/70 dark:bg-white/25" />
            <div className="mt-2 h-3 w-12 rounded-full bg-white/50 dark:bg-white/15" />
          </div>
        ))}
      </div>
    </>
  );
}

function GhostDashboardStage({ variant }: { variant: DashboardGhostVariant }) {
  if (variant === "ops-board") return <OpsBoardStage />;
  if (variant === "analytics") return <AnalyticsStage />;
  return <ExecutiveStage />;
}

function GhostDashboardCard({ variant }: { variant: DashboardGhostVariant }) {
  const shell = DASHBOARD_SHELL[variant];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.04]",
        shell.tilt,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-50 via-white to-brand-50/50 dark:from-white/[0.03] dark:via-white/[0.02] dark:to-brand-500/10">
        <GhostDashboardStage variant={variant} />
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/85 to-transparent dark:from-gray-950/55" />
      </div>
      <div className="space-y-2.5 border-t border-gray-100 px-4 py-3.5 dark:border-gray-800">
        <div className={cn("h-4 rounded-md bg-gray-200 dark:bg-white/12", shell.footer[0])} />
        <div className={cn("h-3 rounded-md bg-gray-100 dark:bg-white/6", shell.footer[1])} />
      </div>
    </div>
  );
}

export function GhostDashboardGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
      {DASHBOARD_GHOST_VARIANTS.map((variant) => (
        <GhostDashboardCard key={variant} variant={variant} />
      ))}
    </div>
  );
}
