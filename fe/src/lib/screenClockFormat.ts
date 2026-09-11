import type { ScreenClockDateFormat } from "@/lib/screenVisualStyle";
import { formatScreenWeekday } from "@/lib/screenTokens";

export type ScreenClockDisplayParts = {
  dateLine?: string;
  timeLine: string;
  period?: string;
  weekday: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatScreenClockDateLine(
  date: Date,
  format: ScreenClockDateFormat,
): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  switch (format) {
    case "YYYY/MM/DD":
      return `${year}/${month}/${day}`;
    case "YYYY年MM月DD日":
      return `${year}年${month}月${day}日`;
    case "MM-DD":
      return `${month}-${day}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

export function formatScreenClockTimeLine(
  date: Date,
  showSeconds: boolean,
  use12Hour: boolean,
): { timeLine: string; period?: string } {
  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  if (use12Hour) {
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hourText = pad(hours);
    const timeLine = showSeconds
      ? `${hourText}:${minutes}:${seconds}`
      : `${hourText}:${minutes}`;
    return { timeLine, period };
  }

  const hourText = pad(hours);
  const timeLine = showSeconds
    ? `${hourText}:${minutes}:${seconds}`
    : `${hourText}:${minutes}`;
  return { timeLine };
}

export function formatScreenClockDisplayParts(
  date: Date,
  options: {
    showDate: boolean;
    dateFormat: ScreenClockDateFormat;
    showSeconds: boolean;
    use12Hour: boolean;
  },
): ScreenClockDisplayParts {
  const { timeLine, period } = formatScreenClockTimeLine(
    date,
    options.showSeconds,
    options.use12Hour,
  );
  return {
    dateLine: options.showDate
      ? formatScreenClockDateLine(date, options.dateFormat)
      : undefined,
    timeLine,
    period,
    weekday: formatScreenWeekday(date),
  };
}
