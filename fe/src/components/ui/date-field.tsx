import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { zhCN as dayPickerZhCN } from "react-day-picker/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function parseDateValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

type DateFieldProps = {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  dense?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
};

/** Popover + Calendar 日期选择，输出 yyyy-MM-dd 字符串 */
export function DateField({
  value,
  onChange,
  placeholder = "选择日期",
  disabled = false,
  dense = false,
  id,
  "aria-label": ariaLabel,
  className,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const display = selected
    ? format(selected, "yyyy年M月d日", { locale: zhCN })
    : placeholder;

  const pick = (next: Date | undefined) => {
    onChange(next ? toIsoDate(next) : undefined);
    if (next) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "w-full justify-start gap-1.5 px-2 font-normal shadow-theme-xs",
            dense ? "h-8 text-theme-xs [&_svg]:size-3.5" : "h-11 text-sm [&_svg]:size-4",
            !selected && "text-gray-400 dark:text-white/30",
            className,
          )}
        >
          <CalendarIcon className="shrink-0 text-gray-400 dark:text-gray-500" aria-hidden />
          <span className="truncate">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
        <Calendar
          mode="single"
          locale={dayPickerZhCN}
          selected={selected}
          onSelect={pick}
          defaultMonth={selected}
          size="sm"
        />
        <div className="flex items-center justify-between border-t border-gray-100 px-2 py-1.5 dark:border-gray-800">
          <Button
            type="button"
            variant="plain"
            size="xs"
            className="h-7 px-2 text-theme-xs"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            清除
          </Button>
          <Button
            type="button"
            variant="plain"
            size="xs"
            className="h-7 px-2 text-theme-xs"
            onClick={() => pick(new Date())}
          >
            今天
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
