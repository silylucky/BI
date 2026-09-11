import { cn } from "@/lib/utils";
import {
  resolvePreviewWidgetVisual,
  seedFromId,
  seededUnit,
  type PreviewWidgetVisual,
} from "./previewWidgetVisual";

type DashboardPreviewWidgetMockProps = {
  id: string;
  widgetType?: string;
  chartType?: string;
  title?: string;
  isDataScreen?: boolean;
  className?: string;
};

function MockChartBody({
  visual,
  seed,
  isDataScreen,
}: {
  visual: PreviewWidgetVisual;
  seed: number;
  isDataScreen?: boolean;
}) {
  const stroke = isDataScreen ? "#38bdf8" : "#465fff";
  const fill = isDataScreen ? "#0ea5e9" : "#465fff";
  const muted = isDataScreen ? "#1e293b" : "#e4e7ec";

  if (visual === "kpi") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1">
        <div className={cn("h-2 w-8 rounded-sm", isDataScreen ? "bg-cyan-400/80" : "bg-brand-500")} />
        <div className={cn("h-1 w-5 rounded-sm opacity-60", isDataScreen ? "bg-slate-600" : "bg-gray-300")} />
      </div>
    );
  }

  if (visual === "filter") {
    return (
      <div className="flex h-full items-center px-1.5">
        <div
          className={cn(
            "h-2 w-full rounded-sm border",
            isDataScreen ? "border-slate-600 bg-slate-900/80" : "border-gray-200 bg-gray-50",
          )}
        />
      </div>
    );
  }

  if (visual === "text") {
    return (
      <div className="flex h-full flex-col justify-center gap-0.5 px-1.5 py-1">
        {[0.9, 0.7, 0.5].map((w, i) => (
          <div
            key={i}
            className={cn("h-0.5 rounded-full", isDataScreen ? "bg-slate-600" : "bg-gray-200")}
            style={{ width: `${w * 100}%` }}
          />
        ))}
      </div>
    );
  }

  if (visual === "media") {
    return (
      <div
        className={cn(
          "m-1 flex h-[calc(100%-0.5rem)] items-center justify-center rounded-sm",
          isDataScreen ? "bg-gradient-to-br from-slate-800 to-slate-950" : "bg-gradient-to-br from-gray-100 to-gray-200",
        )}
      >
        <div className={cn("size-3 rounded-full", isDataScreen ? "bg-slate-600" : "bg-gray-300")} />
      </div>
    );
  }

  if (visual === "tabs") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex gap-0.5 border-b border-gray-200/40 px-1 pt-0.5 dark:border-white/10">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-3 rounded-t-sm",
                i === 0
                  ? isDataScreen
                    ? "bg-cyan-500/50"
                    : "bg-brand-200"
                  : isDataScreen
                    ? "bg-slate-700"
                    : "bg-gray-100",
              )}
            />
          ))}
        </div>
        <div className="flex-1 p-1">
          <MockChartBody visual="bar" seed={seed} isDataScreen={isDataScreen} />
        </div>
      </div>
    );
  }

  if (visual === "table") {
    return (
      <div className="grid h-full grid-cols-4 gap-px p-1">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={cn("rounded-[1px]", i < 4 ? (isDataScreen ? "bg-slate-700" : "bg-gray-200") : muted)}
            style={{ opacity: i < 4 ? 1 : 0.35 + seededUnit(seed, i) * 0.45 }}
          />
        ))}
      </div>
    );
  }

  if (visual === "map") {
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full p-1" aria-hidden>
        <path
          d="M18 38 L32 22 L48 28 L62 18 L78 32 L70 48 L52 58 L34 52 Z"
          fill={isDataScreen ? "#0c4a6e" : "#dbeafe"}
          stroke={stroke}
          strokeWidth="1.2"
        />
        <path d="M40 30 L55 36 L48 46 L36 42 Z" fill={fill} opacity="0.55" />
      </svg>
    );
  }

  if (visual === "pie") {
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full p-2" aria-hidden>
        <circle cx="50" cy="35" r="22" fill={muted} />
        <path d="M50 35 L50 13 A22 22 0 0 1 68 42 Z" fill={fill} />
        <path d="M50 35 L68 42 A22 22 0 0 1 38 52 Z" fill={stroke} opacity="0.65" />
      </svg>
    );
  }

  if (visual === "line") {
    const points = Array.from({ length: 6 }, (_, i) => {
      const x = 8 + i * 16;
      const y = 55 - seededUnit(seed, i) * 35;
      return `${x},${y}`;
    }).join(" ");
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full p-1" aria-hidden>
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <polyline
          points={`8,58 ${points} 88,58`}
          fill={fill}
          opacity="0.12"
          stroke="none"
        />
      </svg>
    );
  }

  if (visual === "radar") {
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full p-2" aria-hidden>
        <polygon
          points="50,12 72,28 64,54 36,54 28,28"
          fill="none"
          stroke={muted}
          strokeWidth="1"
        />
        <polygon
          points="50,20 66,32 60,48 40,48 34,32"
          fill={fill}
          opacity="0.35"
          stroke={stroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  if (visual === "gauge") {
    return (
      <svg viewBox="0 0 100 70" className="h-full w-full p-2" aria-hidden>
        <path d="M18 50 A32 32 0 0 1 82 50" fill="none" stroke={muted} strokeWidth="6" />
        <path d="M18 50 A32 32 0 0 1 62 26" fill="none" stroke={fill} strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  if (visual === "heatmap") {
    return (
      <div className="grid h-full grid-cols-5 grid-rows-4 gap-px p-1">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              backgroundColor: fill,
              opacity: 0.2 + seededUnit(seed, i) * 0.75,
            }}
          />
        ))}
      </div>
    );
  }

  const bars = Array.from({ length: 5 }, (_, i) => 18 + seededUnit(seed, i) * 42);
  return (
    <svg viewBox="0 0 100 70" className="h-full w-full p-1.5" aria-hidden>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={10 + i * 17}
          y={62 - h}
          width="10"
          height={h}
          rx="1.5"
          fill={i % 2 === 0 ? fill : stroke}
          opacity={0.55 + (i % 3) * 0.12}
        />
      ))}
    </svg>
  );
}

export function DashboardPreviewWidgetMock({
  id,
  widgetType,
  chartType,
  title,
  isDataScreen,
  className,
}: DashboardPreviewWidgetMockProps) {
  const visual = resolvePreviewWidgetVisual(widgetType, chartType);
  const seed = seedFromId(id);
  const label = title?.trim() || (widgetType === "chart" ? "图表" : "组件");

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[3px] border shadow-sm",
        isDataScreen
          ? "border-cyan-500/20 bg-slate-900/90"
          : "border-gray-200/90 bg-white dark:border-gray-700/80 dark:bg-gray-900/95",
        className,
      )}
    >
      <div
        className={cn(
          "truncate px-1 py-px text-[5px] font-medium leading-none",
          isDataScreen ? "text-cyan-100/70" : "text-gray-500 dark:text-gray-400",
        )}
      >
        {label}
      </div>
      <div className="min-h-0 flex-1">
        <MockChartBody visual={visual} seed={seed} isDataScreen={isDataScreen} />
      </div>
    </div>
  );
}
