// src/components/ui/calendar.jsx
"use client";

import * as React from "react";
import { DayPicker, useNavigation } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { cn } from "@/lib/utils";

function BottomNav() {
  const { previousMonth, nextMonth, goToMonth } = useNavigation();

  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="h-7 w-7 rounded-lg border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-40"
        aria-label="Previous month"
      >
        ‹
      </button>

      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="h-7 w-7 rounded-lg border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted disabled:opacity-40"
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <div className={cn("rounded-2xl bg-white p-2", className)}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        footer={<BottomNav />}
        classNames={{
          months: "flex flex-col sm:flex-row gap-4",
          month: "space-y-1",
          caption: "flex items-center justify-center h-7 px-0 py-0 leading-none ",
          caption_label: "text-sm font-semibold leading-none text-admin-text",
          nav: "hidden",
          nav_button: "hidden",
          // nav: "flex items-center gap-2",
          // nav_button:
          //   "h-8 w-8 rounded-lg border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted",
          table: "w-full border-collapse",
          head_row: "flex",
          head_cell:
            "w-9 text-center text-[11px] text-admin-textMuted font-medium",
          row: "flex w-full mt-1",
          cell: "w-9 h-9 text-center text-xs p-0 relative",
          day: "h-9 w-9 rounded-lg hover:bg-admin-surfaceMuted focus:outline-none",
          day_selected: "bg-brand-primary text-white hover:bg-brand-primary/90",
          day_today: "ring-1 ring-brand-primary/50",
          day_outside: "text-admin-textMuted/60 opacity-60",
          day_disabled: "text-admin-textMuted/40 opacity-40",
          day_range_middle: "bg-admin-surfaceMuted rounded-none",
          day_range_start: "bg-brand-primary text-white rounded-l-lg",
          day_range_end: "bg-brand-primary text-white rounded-r-lg",
          ...classNames,
        }}
        {...props}
      />
    </div>
  );
}

export { Calendar };
