import { useEffect, useState } from "react";
import { formatScreenClockDisplayParts } from "@/lib/screenClockFormat";
import type { ScreenClockStyleConfig } from "@/lib/screenVisualStyle";
import { normalizeScreenClockStyle } from "@/lib/screenVisualStyle";
import { screenTokens } from "@/lib/screenTokens";
import { cn } from "@/lib/utils";

export type ScreenClockDisplayProps = {
  className?: string;
  /** 预览顶栏紧凑模式 */
  compact?: boolean;
  showWeekday?: boolean;
  styleConfig?: ScreenClockStyleConfig;
};

function alignClass(align: ScreenClockStyleConfig["align"]): string {
  switch (align) {
    case "left":
      return "items-start text-left";
    case "right":
      return "items-end text-right";
    default:
      return "items-center text-center";
  }
}

function typographyStyle(
  style: ReturnType<typeof normalizeScreenClockStyle>,
): {
  fontFamily?: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  letterSpacing?: string;
} {
  return {
    fontFamily: style.fontFamily || undefined,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
  };
}

export function ScreenClockDisplay({
  className,
  compact = false,
  showWeekday,
  styleConfig,
}: ScreenClockDisplayProps) {
  const style = normalizeScreenClockStyle(styleConfig);
  const resolvedShowWeekday = showWeekday ?? style.showWeekday;
  const [parts, setParts] = useState(() =>
    formatScreenClockDisplayParts(new Date(), style),
  );

  useEffect(() => {
    const intervalMs = style.showSeconds ? 1000 : 60_000;
    const tick = () => setParts(formatScreenClockDisplayParts(new Date(), style));
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    style.showDate,
    style.dateFormat,
    style.showSeconds,
    style.use12Hour,
  ]);

  const timeStyle = {
    color: style.color,
    fontSize: style.fontSize,
    ...typographyStyle(style),
  };
  const weekdayStyle = {
    color: style.weekdayColor,
    fontSize: style.weekdayFontSize,
    ...typographyStyle(style),
  };
  const timeLine = parts.period ? `${parts.timeLine} ${parts.period}` : parts.timeLine;
  const layoutInline = style.layout === "inline";

  if (compact) {
    return (
      <div
        className={cn("text-right leading-tight tabular-nums", className)}
        data-screen-clock
        style={{ color: style.color, ...typographyStyle(style) }}
      >
        <div className={screenTokens.clock} style={{ fontSize: style.fontSize }} data-testid="screen-clock-time">
          {parts.timeLine}
        </div>
        {resolvedShowWeekday ? (
          <div className={screenTokens.weekday} data-testid="screen-clock-weekday">
            {parts.weekday}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col justify-center gap-1 px-2 tabular-nums",
        alignClass(style.align),
        layoutInline && resolvedShowWeekday && "flex-row items-center gap-2",
        className,
      )}
      data-screen-clock
    >
      {parts.dateLine ? (
        <div style={timeStyle} data-testid="screen-clock-date">
          {parts.dateLine}
        </div>
      ) : null}
      <div
        className={cn(screenTokens.clockLarge, layoutInline && "shrink-0")}
        style={timeStyle}
        data-testid="screen-clock-time"
      >
        {timeLine}
      </div>
      {resolvedShowWeekday ? (
        <div
          className={cn(screenTokens.weekday, layoutInline && "shrink-0")}
          style={weekdayStyle}
          data-testid="screen-clock-weekday"
        >
          {parts.weekday}
        </div>
      ) : null}
    </div>
  );
}
