import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarSize = "sm" | "md" | "lg";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  size?: CalendarSize;
};

function Calendar({
  className,
  classNames,
  size = "md",
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const daySize = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  }[size];
  const dayButtonSize = {
    sm: "size-7 text-xs",
    md: "size-9",
    lg: "size-10",
  }[size];
  const navButtonSize = {
    sm: "size-7",
    md: "size-9",
    lg: "size-10",
  }[size];
  const captionRow = {
    sm: "h-7 px-7",
    md: "h-9 px-9",
    lg: "h-10 px-10",
  }[size];

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-2", className)}
      classNames={{
        months: "relative flex flex-col gap-2",
        month: "flex flex-col gap-3",
        month_caption: cn(
          "flex w-full items-center justify-center",
          captionRow,
        ),
        caption_label: "text-sm font-medium text-gray-800 dark:text-white/90",
        nav: "pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "pointer-events-auto bg-transparent p-0 opacity-70 hover:opacity-100",
          navButtonSize,
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "pointer-events-auto bg-transparent p-0 opacity-70 hover:opacity-100",
          navButtonSize,
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: cn(
          daySize,
          "rounded-md text-[0.7rem] font-normal text-gray-500 dark:text-gray-400",
        ),
        week: "mt-1 flex w-full",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-brand-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md dark:[&:has([aria-selected])]:bg-brand-500/12",
          daySize,
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "p-0 font-normal aria-selected:opacity-100",
          dayButtonSize,
        ),
        selected:
          "rounded-md bg-brand-500 text-white hover:bg-brand-500 hover:text-white focus:bg-brand-500 focus:text-white",
        today: "rounded-md bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/12 dark:text-brand-400",
        outside: "text-gray-300 aria-selected:text-gray-300 dark:text-gray-600",
        disabled: "text-gray-300 opacity-50 dark:text-gray-600",
        range_middle:
          "aria-selected:bg-brand-50 aria-selected:text-brand-600 dark:aria-selected:bg-brand-500/12",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", iconClassName)} {...iconProps} />;
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
