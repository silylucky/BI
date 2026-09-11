import type { ReactNode } from "react";
import { estimateWidgetBodyHeight } from "@/components/dashboard/gridLayoutAdapter";
import { dwState } from "@/components/dashboard/dashboardWidgetTypography";
import { cn } from "@/lib/utils";

type EmbeddedChartSurfaceOptions = {  clip?: boolean;
};

export function embeddedChartSurface(children: ReactNode, options?: EmbeddedChartSurfaceOptions) {
  const clip = options?.clip !== false;
  return (
    <div
      className={cn(
        "embedded-chart-live-surface absolute inset-0 min-h-0",
        clip ? "overflow-hidden" : "overflow-visible",
      )}
    >
      {children}
    </div>
  );
}

export function embeddedStateMessage(className: string, children: ReactNode) {
  return (
    <p
      className={cn(
        "flex h-full min-h-0 items-center justify-center px-4 text-center",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function embeddedBodyHeight(
  bodySize: { width: number; height: number },
  pixelSize: { width: number; height: number } | undefined,
  contentChromePx: number,
  gridSpan: { w: number; h: number } | undefined,
): number {
  const measured = bodySize.height > 0 ? bodySize.height : 0;
  const pixelHeight =
    measured <= 0 && pixelSize ? Math.max(48, pixelSize.height - contentChromePx) : 0;
  const fallbackHeight = gridSpan?.h ? estimateWidgetBodyHeight(gridSpan.h) : 120;
  return Math.max(64, measured || pixelHeight || fallbackHeight);
}

export function embeddedEmptyMessage() {
  return embeddedStateMessage(dwState, "暂无数据");
}

export function embeddedErrorMessage(message: string) {
  return embeddedStateMessage(dwState, message);
}
