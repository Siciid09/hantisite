"use client"

import * as React from "react" // <-- FIX: Changed "*S" to "* as"
// We need 'format' from date-fns for the weekday headers
import { format } from "date-fns" 
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "../../components/ui/Button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  
  // Set a dynamic year range for the dropdowns
  const currentYear = new Date().getFullYear()
  const fromYear = currentYear - 70 // Go back 70 years
  const toYear = currentYear + 10   // Go forward 10 years

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      
      // --- ✨ FEATURES ---
      captionLayout="dropdown-buttons" // This enables the month/year dropdowns
      fromYear={fromYear}
      toYear={toYear}
      showWeekNumber={true} // This shows the week numbers
      formatters={{
        // This makes headers "Sun", "Mon", "Tue"
        formatWeekdayName: (day) => format(day, 'iii'),
      }}
      // --- End Features ---
      
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        
        // --- Header (with Dropdowns) ---
        caption: "flex justify-between items-center pt-1 relative px-1",
        caption_label: "text-base font-semibold", // Default label, hidden by dropdowns
        caption_dropdowns: "flex items-center gap-2", // Style the dropdown container
        
        dropdown: "rdp-dropdown", // Base class for styling in globals.css
        dropdown_month: "rdp-dropdown_month",
        dropdown_year: "rdp-dropdown_year",
        
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 bg-transparent p-0 text-gray-600 dark:text-gray-300 rounded-md",
          "hover:bg-gray-100 dark:hover:bg-gray-700"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        
        // --- Grid ---
        table: "w-full border-collapse space-y-1",
        head_row: "flex mb-1",
        head_cell: // Weekday headers ("Sun", "Mon", etc.)
          "text-gray-500 dark:text-gray-400 rounded-md w-10 font-medium text-sm",
        row: "flex w-full mt-1.5",
        
        // --- Week Numbers ---
        weeknumber: "w-8 text-sm text-center font-medium text-gray-400 dark:text-gray-500 pr-2",
        
        // --- Day Cells (handles backgrounds) ---
        cell: cn(
          "h-10 w-10 text-center text-sm p-0 relative",
          "focus-within:relative focus-within:z-20",
          // ✨ NEW: Use light gray for range background
          "aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800",
          "[&:has([aria-selected].day-range-start)]:rounded-l-md",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected]:not(.day-range-start):not(.day-range-end))]:rounded-md"
        ),
        
        // --- Day Button (the number) ---
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal rounded-md",
          "aria-selected:opacity-100"
        ),
        
        // --- Day States ---
        
        // ✨ FIX: All classes are now in ONE string
        day_selected:
          "bg-gray-900 text-white rounded-md hover:bg-gray-800 hover:text-white focus:bg-gray-900 focus:text-white",
        
        // "Today" is a simple border
        day_today: "bg-transparent border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100",
        
        day_outside: "text-gray-400 dark:text-gray-500 opacity-50 aria-selected:bg-transparent",
        
        day_disabled: "text-gray-300 dark:text-gray-600 opacity-50",
        
        // Make day number transparent so cell bg (light gray) shows
        day_range_middle:
          "aria-selected:bg-transparent aria-selected:text-current dark:aria-selected:bg-transparent",
          
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-5 w-5" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-5 w-5" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }