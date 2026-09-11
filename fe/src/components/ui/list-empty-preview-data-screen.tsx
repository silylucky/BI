import { cn } from "@/lib/utils";

type DataScreenGhostVariant = "command-center" | "geo-ops" | "ring-analytics";

const DATA_SCREEN_GHOST_VARIANTS: readonly DataScreenGhostVariant[] = [
  "command-center",
  "geo-ops",
  "ring-analytics",
];

const DATA_SCREEN_SHELL: Record<
  DataScreenGhostVariant,
  {
    border: string;
    glow: string;
    shell: string;
    footer: [string, string];
    tilt: string;
  }
> = {
  "command-center": {
    border: "border-sky-400/30",
    glow: "shadow-[0_0_56px_-18px_rgba(56,189,248,0.55)]",
    shell: "bg-slate-950",
    footer: ["w-[58%]", "w-[36%]"],
    tilt: "-rotate-1",
  },
  "geo-ops": {
    border: "border-emerald-400/30",
    glow: "shadow-[0_0_56px_-18px_rgba(52,211,153,0.45)]",
    shell: "bg-gray-950",
    footer: ["w-[42%]", "w-1/4"],
    tilt: "rotate-0",
  },
  "ring-analytics": {
    border: "border-fuchsia-400/25",
    glow: "shadow-[0_0_56px_-18px_rgba(232,121,249,0.4)]",
    shell: "bg-gray-950",
    footer: ["w-[64%]", "w-[30%]"],
    tilt: "rotate-1",
  },
};

function CommandCenterStage() {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.08)_1px,transparent_1px)] bg-[size:18px_18px]" />
      <div className="absolute inset-x-0 top-0 h-9 border-b border-sky-400/20 bg-sky-500/10" />
      <div className="absolute left-4 top-2.5 h-2 w-20 rounded-full bg-sky-300/60" />
      <div className="absolute right-4 top-2.5 flex gap-1.5">
        {[1, 2, 3].map((pill) => (
          <span key={pill} className="h-4 w-8 rounded-full bg-sky-400/25" />
        ))}
      </div>
      <div className="absolute inset-x-4 top-12 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((__, index) => (
          <div
            key={index}
            className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-4"
          >
            <div className="h-2 w-12 rounded-full bg-sky-300/55" />
            <div className="mt-3 h-3 w-16 rounded-full bg-white/25" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-4 bottom-4 flex h-10 items-end gap-1">
        {[36, 58, 44, 72, 52, 66, 48, 80, 56].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-t-sm bg-sky-400/40"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </>
  );
}

function GeoOpsStage() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(52,211,153,0.2),transparent_55%)]" />
      <div className="absolute left-3 top-3 h-2 w-16 rounded-full bg-emerald-300/50" />
      <div className="absolute bottom-3 left-3 top-10 w-[62%] rounded-2xl border border-emerald-400/25 bg-emerald-500/10">
        <div className="absolute inset-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10" />
        <div className="absolute left-[28%] top-[22%] size-3 rounded-full bg-emerald-300/70" />
        <div className="absolute left-[48%] top-[42%] size-2 rounded-full bg-emerald-200/60" />
        <div className="absolute right-[30%] top-[30%] size-2.5 rounded-full bg-emerald-300/55" />
        <div className="absolute bottom-[28%] left-[38%] size-4 rounded-full bg-emerald-400/35 blur-[1px]" />
      </div>
      <div className="absolute bottom-3 right-3 top-10 flex w-[30%] flex-col justify-center gap-2.5">
        {[92, 78, 64, 50, 38].map((width) => (
          <div key={width} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-emerald-300/60" />
            <span className="h-2 rounded-full bg-emerald-300/35" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

function RingAnalyticsStage() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(232,121,249,0.16),transparent_60%)]" />
      <div className="absolute left-4 top-4 h-2 w-24 rounded-full bg-fuchsia-300/50" />
      <div className="absolute right-4 top-3 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-2 py-1">
        <div className="h-1.5 w-10 rounded-full bg-fuchsia-300/60" />
      </div>
      <div className="absolute bottom-6 left-5 top-12 flex w-[38%] flex-col justify-center gap-3">
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className={cn(
              "rounded-full border-2 border-fuchsia-400/35",
              ring === 1 && "size-16",
              ring === 2 && "size-12 self-center",
              ring === 3 && "size-14 self-end",
            )}
          />
        ))}
      </div>
      <div className="absolute bottom-5 right-4 top-11 w-[54%] rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
        <div className="flex h-full items-end gap-1">
          {[24, 40, 34, 56, 48, 68, 42, 74, 52, 62].map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-t bg-fuchsia-400/45"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function GhostDataScreenStage({ variant }: { variant: DataScreenGhostVariant }) {
  if (variant === "command-center") return <CommandCenterStage />;
  if (variant === "geo-ops") return <GeoOpsStage />;
  return <RingAnalyticsStage />;
}

function GhostDataScreenCard({ variant }: { variant: DataScreenGhostVariant }) {
  const shell = DATA_SCREEN_SHELL[variant];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        shell.border,
        shell.glow,
        shell.shell,
        shell.tilt,
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        <GhostDataScreenStage variant={variant} />
      </div>
      <div className="space-y-2 border-t border-white/10 px-4 py-3.5">
        <div className={cn("h-3.5 rounded-md bg-white/18", shell.footer[0])} />
        <div className={cn("h-3 rounded-md bg-white/10", shell.footer[1])} />
      </div>
    </div>
  );
}

export function GhostDataScreenGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
      {DATA_SCREEN_GHOST_VARIANTS.map((variant) => (
        <GhostDataScreenCard key={variant} variant={variant} />
      ))}
    </div>
  );
}
