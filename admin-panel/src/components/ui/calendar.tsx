"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex items-center justify-between px-1",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md",
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        ),
        button_next: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md",
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-8 font-medium text-[0.8rem] text-center",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-md",
        day_button: cn(
          "inline-flex items-center justify-center h-8 w-8 p-0 font-normal rounded-md",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        range_start: "day-range-start rounded-l-md",
        range_end: "day-range-end rounded-r-md",
        selected: cn(
          "bg-primary text-primary-foreground font-medium",
          "hover:bg-primary hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground"
        ),
        today: "bg-accent text-accent-foreground font-semibold",
        outside: "day-outside text-muted-foreground/40 aria-selected:bg-primary/50 aria-selected:text-primary-foreground/80",
        disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
