import { useEffect, useState } from "react";
import type { ScreenDateTimeStyleConfig } from "@/lib/screenVisualStyle";
import { normalizeScreenDateTimeStyle } from "@/lib/screenVisualStyle";
import { formatScreenWeekday } from "@/lib/screenTokens";
import { cn } from "@/lib/utils";

export type ScreenDateTimeDisplayProps = {
  className?: string;
  styleConfig?: ScreenDateTimeStyleConfig;
};

function formatDateParts(date: Date, showSeconds: boolean) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const dateLine = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeLine = showSeconds
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { dateLine, timeLine, weekday: formatScreenWeekday(date) };
}

export function ScreenDateTimeDisplay({
  className,
  styleConfig,
}: ScreenDateTimeDisplayProps) {
  const style = normalizeScreenDateTimeStyle(styleConfig);
  const [parts, setParts] = useState(() =>
    formatDateParts(new Date(), style.showSeconds),
  );

  useEffect(() => {
    const tick = () => setParts(formatDateParts(new Date(), style.showSeconds));
    tick();
    const timer = window.setInterval(tick, style.showSeconds ? 1000 : 60_000);
    return () => window.clearInterval(timer);
  }, [style.showSeconds]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center gap-0.5 px-2 text-center tabular-nums",
        className,
      )}
      data-screen-datetime
      style={{ color: style.color }}
    >
      <div style={{ fontSize: style.dateFontSize }}>{parts.dateLine}</div>
      <div
        className="font-medium tracking-[0.12em]"
        style={{ fontSize: style.timeFontSize }}
        data-testid="screen-datetime-time"
      >
        {parts.timeLine}
      </div>
      {style.showWeekday ? (
        <div className="opacity-70" style={{ fontSize: Math.max(10, style.dateFontSize - 2) }}>
          {parts.weekday}
        </div>
      ) : null}
    </div>
  );
}
