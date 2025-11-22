// File: app/(main)/products/page.tsx
//
// --- LATEST UPDATES (PDF REPORTING & ERROR FIX) ---
// 1. (CRITICAL FIX) Re-ordered file to define all helper components
//    (ModalBase, FormSelect, Card, etc.) BEFORE they are used.
//    This fixes the 102 cascading 'Cannot find name' errors.
// 2. (REFACTOR) Lifted 'selectedProducts' state up to 'ProductsModulePage'.
// 3. (NEW) 'ProductReportModal' now has filters for Date and Report Scope.
// 4. (FIX) "Download PDF" button now fetches REAL data and calls 'generatePdf'.
// -----------------------------------------------------------------------------

"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { 
  // --- Existing Icons ---
  UploadCloud, TrendingUp, History, DollarSign, BarChart3,
  ArrowRightLeft, AlertCircle, Box, Package, Tag, GitCompare, 
  BookOpen, Plus, Trash, Edit, Search, AlertTriangle, Wallet, 
  X, PackageCheck, PackageX, Warehouse, Loader2, List, Pencil, 
  Camera, Download, Calendar as CalendarIconLucide, ChevronDown, 
  Eye, ChevronLeft, ChevronRight, Layers, Image as ImageIcon,
  
  // --- NEWLY ADDED ICONS (For Modals/Forms) ---
  Save, Building2, User, Phone, MessageCircle, Mail, MapPin,
  CreditCard, Receipt, CheckCircle2, FileText
} from 'lucide-react';

import React, { useState, useEffect, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { useAuth } from "@/app/contexts/AuthContext"; 
import { auth, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import dayjs from "dayjs";
import Image from "next/image";
import Link from "next/link"; 

// --- PDF Generation ---
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { getTemplateComponent, ReportType } from '@/lib/pdfService';

// --- Excel/PDF Legacy ---
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { Button } from "../../components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  add, addDays, format, startOfWeek, startOfMonth, endOfDay,
  eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, isSameMonth,
  isToday, parse, sub, isAfter, isBefore
} from "date-fns";
import { type DateRange } from "react-day-picker";
// (A) Helpers
// ... (All helpers: useDebounce, formatCurrency, etc. are unchanged) ...
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};
function useDebounce(value: any, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  };
  if (["USD", "EUR", "KES"].includes(currency)) {
    options.maximumFractionDigits = 2;
  }
  try {
    return new Intl.NumberFormat("en-US", options).format(amount);
  } catch (e) {
    return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
  }
};
const AVAILABLE_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KES", "ETB"];

// (B) (Req 1) NEW: Built-in Date Range Picker
// ... (NewDateRangePicker and CalendarGrid components are unchanged) ...
function NewDateRangePicker({
  date,
  onApply,
  className,
}: {
  date: DateRange | undefined;
  onApply: (date: DateRange | undefined) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(date?.from || new Date());
  const [selectedDate, setSelectedDate] = useState<DateRange | undefined>(date);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const checkScreenSize = () => {
      if (typeof window !== "undefined") {
        setIsSmallScreen(window.innerWidth < 768);
      }
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  const numberOfMonths = isSmallScreen ? 1 : 2;
  useEffect(() => {
    setSelectedDate(date);
    setCurrentMonth(date?.from || new Date());
  }, [date]);
  const handleApply = () => {
    onApply(selectedDate);
    setIsOpen(false);
  };
  const handleCancel = () => {
    setSelectedDate(date); 
    setCurrentMonth(date?.from || new Date()); 
    setIsOpen(false);
  };
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel(); 
    }
    setIsOpen(open);
  };
  const displayedDate = date; 
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal shadow-sm bg-white dark:bg-gray-700",
              !displayedDate && "text-muted-foreground"
            )}
          >
            <CalendarIconLucide className="mr-2 h-4 w-4" />
            {displayedDate?.from ? (
              displayedDate.to ? (
                <>
                  {format(displayedDate.from, "LLL dd, y")} -{" "}
                  {format(displayedDate.to, "LLL dd, y")}
                </>
              ) : (
                format(displayedDate.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border dark:border-gray-700" align="start">
          <div className="flex">
            {Array.from({ length: numberOfMonths }).map((_, i) => (
              <CalendarGrid
                key={i}
                month={add(currentMonth, { months: i })}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                hoveredDate={hoveredDate}
                setHoveredDate={setHoveredDate}
                onMonthChange={setCurrentMonth}
                showMonthNav={i === 0} 
                showMonthName={numberOfMonths === 1} 
              />
            ))}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-600">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
function CalendarGrid({
  month,
  selectedDate,
  setSelectedDate,
  hoveredDate,
  setHoveredDate,
  onMonthChange,
  showMonthNav,
  showMonthName,
}: {
  month: Date;
  selectedDate: DateRange | undefined;
  setSelectedDate: (date: DateRange | undefined) => void;
  hoveredDate: Date | undefined;
  setHoveredDate: (date: Date | undefined) => void;
  onMonthChange: (date: Date) => void;
  showMonthNav: boolean;
  showMonthName: boolean;
}) {
  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const startDate = startOfWeek(firstDay);
  const endDate = endOfWeek(lastDay);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const nextMonth = () => onMonthChange(add(month, { months: 1 }));
  const prevMonth = () => onMonthChange(sub(month, { months: 1 }));
  const handleDateClick = (day: Date) => {
    const { from, to } = selectedDate || {};
    if (!from) {
      setSelectedDate({ from: day, to: undefined });
    } else if (from && !to) {
      if (isAfter(day, from)) {
        setSelectedDate({ from, to: day });
      } else {
        setSelectedDate({ from: day, to: from }); // Swap
      }
    } else if (from && to) {
      setSelectedDate({ from: day, to: undefined });
    }
  };
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-semibold dark:text-white">
          {format(month, "MMMM yyyy")}
        </span>
        {showMonthNav && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
      <div 
        className="grid grid-cols-7 gap-1 mt-2"
        onMouseLeave={() => setHoveredDate(undefined)}
      >
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, month);
          const isSelectedStart = !!selectedDate?.from && isSameDay(day, selectedDate.from);
          const isSelectedEnd = !!selectedDate?.to && isSameDay(day, selectedDate.to);
          const isInRange = !!(selectedDate?.from && selectedDate?.to) && 
                            isAfter(day, selectedDate.from) && 
                            isBefore(day, selectedDate.to);
          const isHovering = !!(selectedDate?.from && !selectedDate.to && hoveredDate);
          const isHoverStart = isHovering && hoveredDate && selectedDate.from && isBefore(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from;
           const isHoverEnd = isHovering && hoveredDate && selectedDate.from && isAfter(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from;
          const isInHoverRange = isHovering && isHoverStart && isHoverEnd && isAfter(day, isHoverStart) && isBefore(day, isHoverEnd);
          return (
            <button
              key={day.toString()}
              type="button"
              onClick={() => handleDateClick(day)}
              onMouseEnter={() => setHoveredDate(day)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-lg text-sm",
                !isCurrentMonth && "text-gray-400 dark:text-gray-600",
                isCurrentMonth && "text-gray-800 dark:text-gray-200",
                isToday(day) && "font-bold text-blue-600",
                (isSelectedStart || isSelectedEnd) && "bg-blue-600 text-white hover:bg-blue-700",
                isInRange && "bg-blue-100 dark:bg-blue-900/50 rounded-none",
                isSelectedStart && "rounded-l-lg",
                isSelectedEnd && "rounded-r-lg",
                isHovering && (isSameDay(day, isHoverStart!) || isSameDay(day, isHoverEnd!)) && "bg-blue-600/50 text-white",
                isInHoverRange && "bg-blue-100/50 dark:bg-blue-900/20",
                !isSelectedStart && !isSelectedEnd && !isInRange && isCurrentMonth && "hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// (C) Reusable Date Preset Buttons
// ... (DatePresetButtons unchanged) ...
type DatePreset = "today" | "this_week" | "this_month" | "custom";
function DatePresetButtons({
  activePreset,
  onPresetSelect,
}: {
  activePreset: DatePreset;
  onPresetSelect: (preset: DatePreset, date: DateRange | undefined) => void;
}) {
  const setDatePreset = (preset: DatePreset) => {
    const today = new Date();
    let newDate: DateRange | undefined;
    if (preset === "today") {
      newDate = { from: today, to: today };
    } else if (preset === "this_week") {
      newDate = { from: startOfWeek(today), to: endOfDay(today) };
    } else if (preset === "this_month") {
      newDate = { from: startOfMonth(today), to: endOfDay(today) };
    }
    onPresetSelect(preset, newDate);
  };
  const PresetButton = ({ preset, label }: { preset: DatePreset, label: string }) => (
    <button
      type="button"
      onClick={() => setDatePreset(preset)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium",
        activePreset === preset
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      <PresetButton preset="today" label="Today" />
      <PresetButton preset="this_week" label="This Week" />
      <PresetButton preset="this_month" label="This Month" />
    </div>
  );
}

// (D) Global Filters Component
// ... (GlobalFilters unchanged) ...
function GlobalFilters({
  date,
  onDateApply,
  currency,
  setCurrency
}: {
  date: DateRange | undefined;
  onDateApply: (date: DateRange | undefined) => void;
  currency: string;
  setCurrency: (currency: string) => void;
}) {
  const [activePreset, setActivePreset] = useState<DatePreset>("this_month");
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
              Date Range
            </label>
            <DatePresetButtons
              activePreset={activePreset}
              onPresetSelect={(preset, newDate) => {
                setActivePreset(preset);
                onDateApply(newDate);
              }}
            />
          </div>
          <div className="w-full md:w-[280px]">
            <NewDateRangePicker
              date={date}
              onApply={(newDate) => {
                onDateApply(newDate);
                setActivePreset("custom");
              }}
            />
          </div>
        </div>
        <div className="w-full pt-4 md:w-auto md:pt-0">
          <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
            Display Currency
          </label>
          <FormSelect
            value={currency}
            onChange={setCurrency}
            className="w-full md:w-[150px]"
          >
            {AVAILABLE_CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FormSelect>
        </div>
      </div>
    </Card>
  );
}


// -----------------------------------------------------------------------------
// (H) HELPER COMPONENTS (MOVED TO TOP)
// -----------------------------------------------------------------------------
// --- (MOVED UP) Helper components are now defined *before* they are used ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800", className)}>
    {children}
  </div>
);

const KpiCard = ({ title, value, icon: Icon, color = "text-gray-500" }: {
  title: string,
  value: string | number,
  icon: React.ElementType,
  color?: string
}) => (
  <Card>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <Icon className={cn("h-5 w-5", color)} />
    </div>
    <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
  </Card>
);

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const TableLoader = () => (
  <div className="flex w-full justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error | string }) => (
  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5" />
      <div>
        <h3 className="font-semibold">Error</h3>
        <p className="text-sm">{typeof error === 'string' ? error : error.message}</p>
      </div>
    </div>
  </div>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
    <List className="mx-auto mb-2 h-12 w-12 opacity-50" />
    {message}
  </div>
);

const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    onClick={onClose}
  >
    <div 
      className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()} 
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormInput = ({ label, value, onChange, error, ...props }: {
  label: string,
  value: string | number,
  onChange: (val: string) => void,
  error?: string,
  [key: string]: any
}) => (
  <div className="w-full">
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600"
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const FormTextArea = ({ label, value, onChange, error, ...props }: {
  label: string,
  value: string,
  onChange: (val: string) => void,
  error?: string,
  [key: string]: any
}) => (
  <div>
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600"
      )}
      rows={3}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const FormSelect = ({ label, value, onChange, children, error, className, ...props }: {
  label?: string,
  value: string | number,
  onChange: (val: string) => void,
  children: React.ReactNode,
  error?: string,
  className?: string
  [key: string]: any
}) => (
  <div className="w-full">
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600",
        className
      )}
      {...props}
    >
      {children}
    </select>
  </div>
);

const SalesHistoryTable = ({ sales }: { sales: any[] }) => {
  if (!sales || sales.length === 0) {
    return <TableEmptyState message="No sales history found for this product." />;
  }
  return (
    <div className="flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Qty</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="py-4 text-sm font-medium">
                <Link href={`/sales/${sale.id}`} className="text-blue-600 hover:underline">
                  {sale.invoiceId}
                </Link>
              </td>
              <td className="py-4 text-sm">{dayjs(sale.createdAt).format("DD MMM YYYY")}</td>
              <td className="py-4 text-sm font-bold">{sale.quantitySold}</td>
              <td className="py-4 text-sm">
                {formatCurrency(sale.salePrice, sale.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AdjustmentsHistoryTable = ({ adjustments }: { adjustments: any[] }) => {
  if (!adjustments || adjustments.length === 0) {
    return <TableEmptyState message="No stock adjustments found." />;
  }
  return (
    <div className="flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Reason</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Change</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Warehouse</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {adjustments.map((adj) => (
            <tr key={adj.id}>
              <td className="py-4 text-sm font-medium">{adj.reason}</td>
              <td className="py-4 text-sm">{dayjs(adj.timestamp).format("DD MMM YYYY")}</td>
              <td className={`py-4 text-sm font-bold ${adj.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {adj.change > 0 ? `+${adj.change}` : adj.change}
              </td>
              <td className="py-4 text-sm">{adj.warehouseName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function CategoryList({ title, type, items, onAdd, onDelete }: {
  title: string,
  type: "category" | "brand",
  items: any[],
  onAdd: (type: "category" | "brand", name: string) => Promise<void>,
  onDelete: (type: "category" | "brand", id: string) => void
}) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError(`New ${type} name cannot be empty.`);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onAdd(type, name);
      setName("");
    } catch (err: any) {
      setError(err.message || `Failed to add ${type}.`);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Card>
      <h3 className="text-lg font-semibold">{title}</h3>
      <form onSubmit={handleSubmit} className="my-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`New ${type} name...`}
            className={cn(
              "flex-1 rounded-lg border p-2 dark:bg-gray-700",
              error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            )}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="flex w-[80px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <Plus className="h-4 w-4" /> Add
              </>
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
      <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
            <p>{item.name}</p>
            <button onClick={() => onDelete(type, item.id)} className="text-red-500 hover:text-red-700">
              <Trash className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">No {type}s added yet.</p>}
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// (E) Main Products Page Component
// -----------------------------------------------------------------------------
export default function ProductsModulePage() {
  const { user, loading: authLoading, storeId, subscription } = useAuth();
  const { mutate } = useSWRConfig();
  const [activeTab, setActiveTab] = useState("Products");
  
  // --- (MODAL STATE) ---
  const [productForm, setProductForm] = useState<{ open: boolean; product: any | null; }>({ open: false, product: null });
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<any | null>(null);
  
  // --- (GLOBAL FILTER STATE) ---
  const [date, setDate] = React.useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfDay(new Date()), });
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  
  // --- (LIFTED STATE) 'selectedProducts' now lives here ---
  const [selectedProducts, setSelectedProducts] = useState(new Set<string>());

  const handleDeleteProduct = async (product: any) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/products?type=product&id=${product.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete product document.");
      }
      if (product.imageUrl) {
        try {
          const imageRef = ref(storage, product.imageUrl);
          await deleteObject(imageRef);
        } catch (storageError: any) {
          console.warn(`Failed to delete image from storage: ${storageError.message}`);
        }
      }
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products?tab=products'), undefined, { revalidate: true });
      mutate("/api/products?tab=stock");
    } catch (error: any) {
      console.error(`Error deleting product: ${error.message}`);
    }
  };

  // --- (NEW) Bulk delete function, moved from ProductListTab ---
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} products? This cannot be undone.`)) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      console.error("Authentication error.");
      return;
    }
    let successes = 0;
    let failures = 0;
    // We need to fetch the full product data for image deletion
    // This is a simplified version. A real-world app would fetch data first.
    for (const productId of selectedProducts) {
      try {
        const res = await fetch(`/api/products?type=product&id=${productId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to delete");
        successes++;
      } catch (error) {
        failures++;
      }
    }
    console.log(`Deleted ${successes} products. ${failures > 0 ? `Failed to delete ${failures}.` : ""}`);
    mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products?tab=products'), undefined, { revalidate: true });
    mutate("/api/products?tab=stock");
    setSelectedProducts(new Set());
  };

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <div className="p-6">Please log in to view products.</div>;
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {productForm.open && (
        <ProductFormModal
          productToEdit={productForm.product}
          onClose={() => setProductForm({ open: false, product: null })}
          storeId={storeId || ""}
        />
      )}
      {viewProduct && (
        <ProductViewModal
          product={viewProduct}
          onClose={() => setViewProduct(null)}
          displayCurrency={displayCurrency}
        />
      )}
      
      {/* --- (MODIFIED) Pass subscription and selectedProducts to the modal --- */}
      {reportModalOpen && (
        <ProductReportModal
          onClose={() => setReportModalOpen(false)}
          subscription={subscription}
          selectedProducts={selectedProducts}
        />
      )}
      
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold">Products & Inventory</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage all products, stock, and reports.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <button
            onClick={() => setProductForm({ open: true, product: null })}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        </div>
      </header>
      
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="mt-6">
        {activeTab === "Products" && (
          <ProductListTab
            date={date}
            onDateApply={setDate}
            displayCurrency={displayCurrency}
            setDisplayCurrency={setDisplayCurrency}
            onEditProduct={(product) => setProductForm({ open: true, product })}
            onDeleteProduct={handleDeleteProduct}
            onViewProduct={setViewProduct}
            // --- (NEW) Pass state and handler down ---
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
          />
        )}
        {activeTab === "Categories" && <CategoriesBrandsTab />}
        {activeTab === "Stock" && (
          <StockDashboardTab
            date={date}
            onDateApply={setDate}
            displayCurrency={displayCurrency}
            setDisplayCurrency={setDisplayCurrency}
          />
        )}
        {activeTab === "Adjustments" && <StockAdjustmentsTab />}
        {activeTab === "Reports" && <InventoryReportsTab />}
      </div>

      {/* --- (NEW) Bulk Action Bar, moved up from ProductListTab --- */}
      {selectedProducts.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:bg-gray-800">
          <div className="container mx-auto flex max-w-7xl items-center justify-between">
            <span className="text-sm font-semibold">
              {selectedProducts.size} {selectedProducts.size === 1 ? "product" : "products"} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedProducts(new Set())}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                <Trash className="h-4 w-4" />
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// (F) Tab Navigation Component
// ... (TabNav unchanged) ...
const TABS = [
  { name: "Products", icon: Package },
  { name: "Categories", icon: Tag },
  { name: "Stock", icon: Warehouse },
  { name: "Adjustments", icon: GitCompare },
  { name: "Reports", icon: BookOpen },
];
const TabNav = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void; }) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          onClick={() => onTabChange(tab.name)}
          className={cn(
            "group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium",
            activeTab === tab.name
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
          )}
        >
          <tab.icon
            className={cn(
              "h-5 w-5",
              activeTab === tab.name
                ? "text-blue-500 dark:text-blue-400"
                : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-400"
            )}
          />
          {tab.name}
        </button>
      ))}
    </nav>
  </div>
);

// (G) Tab Content Components

// --- TAB 1: Products List ---
// ... (formatPriceMap unchanged) ...
const formatPriceMap = (
  prices: Record<string, number> | null | undefined,
  currency: string
): string | React.ReactElement => {
  if (!prices || Object.keys(prices).length === 0) {
    return <span className="text-gray-400">N/A</span>;
  }
  const price = prices[currency];
  if (price == null) {
    const fallbackCurrency = Object.keys(prices)[0];
    if (fallbackCurrency) {
      return <span className="text-gray-400" title={`Missing ${currency}`}>{formatCurrency(prices[fallbackCurrency], fallbackCurrency)}</span>;
    }
    return <span className="text-gray-400">N/A</span>;
  }
  return formatCurrency(price, currency);
};

// --- (REFACTORED) ProductListTab ---
function ProductListTab({ 
  date, onDateApply, displayCurrency, setDisplayCurrency,
  onEditProduct, 
  onDeleteProduct,
  onViewProduct,
  selectedProducts,    // <-- (NEW) Accept state as prop
  setSelectedProducts  // <-- (NEW) Accept handler as prop
}: { 
  date: DateRange | undefined;
  onDateApply: (date: DateRange | undefined) => void;
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
  onViewProduct: (product: any) => void;
  selectedProducts: Set<string>; // <-- (NEW)
  setSelectedProducts: React.Dispatch<React.SetStateAction<Set<string>>>; // <-- (NEW)
}) {
  const [stockModalProductId, setStockModalProductId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState("");
  // const [selectedProducts, setSelectedProducts] = useState(new Set<string>()); // <-- (REMOVED) State is lifted
  const { data: kpiData, mutate: mutateKPIs } = useSWR("/api/products?tab=stock", fetcher);
  const { data: categoriesData } = useSWR("/api/products?tab=categories", fetcher);
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, size, setSize, mutate: mutateProducts } = useSWRInfinite(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.lastDocId) return null;
      const params = new URLSearchParams({ tab: "products", limit: "10" });
      if (pageIndex > 0 && previousPageData.lastDocId) {
        params.set("startAfter", previousPageData.lastDocId);
      }
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter) params.set("category", categoryFilter);
      if (date?.from) params.set("startDate", format(date.from, "yyyy-MM-dd"));
      if (date?.to) params.set("endDate", format(date.to, "yyyy-MM-dd"));
      return `/api/products?${params.toString()}`;
    },
    fetcher
  );
  const products = data ? data.map(page => page.products).flat() : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.products.length === 0;
  const hasMore = !error && data && data[data.length - 1]?.lastDocId;
  const pageProductIds = useMemo(() => products.map(p => p.id), [products]);
  const isAllOnPageSelected = pageProductIds.length > 0 && pageProductIds.every(id => selectedProducts.has(id));
  
  // --- (MODIFIED) This now uses the prop ---
  useEffect(() => {
    setSize(1);
    setSelectedProducts(new Set());
  }, [debouncedSearch, categoryFilter, date, setSize, setSelectedProducts]);
  
  useEffect(() => {
    mutateKPIs();
  }, [displayCurrency, mutateKPIs]);

  // --- (MODIFIED) All handlers now use props ---
  const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProducts(prev => new Set([...prev, ...pageProductIds]));
    } else {
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        pageProductIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };
  const handleSelectProduct = (productId: string, isSelected: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      <GlobalFilters 
        date={date}
        onDateApply={onDateApply} 
        currency={displayCurrency}
        setCurrency={setDisplayCurrency}
      />
      
      {kpiData && (
        <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Total Products" value={kpiData.kpis.totalProducts} icon={Package} />
          <KpiCard title="Low Stock Items" value={kpiData.kpis.lowStock} icon={AlertTriangle} color="text-orange-500" />
          <KpiCard title="Out of Stock Items" value={kpiData.kpis.outOfStock} icon={PackageX} color="text-red-500" />
          <KpiCard 
            title={`Total Stock Value (${displayCurrency})`}
            value={formatCurrency(kpiData.kpis.stockValueMap?.[displayCurrency], displayCurrency)} 
            icon={Wallet} 
          />
        </div>
      )}

      <Card className="relative z-20">
        <div className="my-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="relative md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
          </div>
          <FormSelect
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
          >
            <option value="">All Categories</option>
            {categoriesData?.categories?.map((c: any) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </FormSelect>
        </div>
        
        {stockModalProductId && (
          <StockLevelsModal 
            productId={stockModalProductId} 
            onClose={() => setStockModalProductId(null)}
          />
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="w-4 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={isAllOnPageSelected}
                    onChange={handleSelectAllOnPage}
                  />
                </th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Image</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Product</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Total Stock</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Sale Price</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Cost Price</th>
                <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading && products.length === 0 && <tr><td colSpan={8}><TableLoader /></td></tr>}
              {error && <tr><td colSpan={8}><ErrorDisplay error={error} /></td></tr>}
              {products.map((product: any) => {
                const isSelected = selectedProducts.has(product.id);
                return (
                  <tr key={product.id} className={cn(isSelected ? "bg-blue-50 dark:bg-blue-900/10" : "")}>
                    <td className="w-4 px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        checked={isSelected}
                        onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                      />
                    </td>
                    <td className="py-2">
                      {product.imageUrl ? (
                        <Image 
                          src={product.imageUrl} 
                          alt={product.name}
                          width={40}
                          height={40}
                          className="rounded-md object-cover w-10 h-10"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-400 dark:bg-gray-700">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 font-medium">
                      <Link href={`/products/${product.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {product.name}
                      </Link>
                    </td>
                    
                    <td className="py-4 text-sm text-gray-500">{product.category || "N/A"}</td>
                    <td className="py-4 font-semibold">{product.quantity}</td>
                    <td className="py-4 text-sm">{formatPriceMap(product.salePrices, displayCurrency)}</td>
                    <td className="py-4 text-sm">{formatPriceMap(product.costPrices, displayCurrency)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => onViewProduct(product)}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100" title="View Product">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setStockModalProductId(product.id)}
                          className="rounded p-1 text-blue-600 hover:bg-blue-100" title="View Stock Levels">
                          <Warehouse className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onEditProduct(product)}
                          className="rounded p-1 text-green-600 hover:bg-green-100" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteProduct(product)}
                          className="rounded p-1 text-red-600 hover:bg-red-100" title="Delete">
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isEmpty && <TableEmptyState message="No products found." />}
        </div>

        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setSize(size + 1)}
              disabled={isLoadingMore}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// --- TAB 2: Categories & Brands ---
// ... (CategoriesBrandsTab unchanged) ...
function CategoriesBrandsTab() {
  const { data, error, isLoading, mutate } = useSWR("/api/products?tab=categories", fetcher);
  const handleAdd = async (type: "category" | "brand", name: string) => {
    if (!name) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, name }),
      });
      mutate("/api/products?tab=categories");
      mutate("/api/products?tab=stock"); 
    } catch (error: any) {
      console.error(`Failed to add ${type}:`, error);
      throw error; 
    }
  };
  const handleDelete = async (type: "category" | "brand", id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    await fetch(`/api/products?type=${type}&id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
    });
    mutate();
  };
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
 return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CategoryList
        title="Categories"
        type="category"
        items={data?.categories || []}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
      <CategoryList
        title="Brands"
        type="brand"
        items={data?.brands || []}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
    </div>
  );
}

// --- TAB 3: Stock Dashboard ---
// ... (StockDashboardTab unchanged) ...
function StockDashboardTab({
  date, onDateApply, displayCurrency, setDisplayCurrency
}: {
  date: DateRange | undefined;
  onDateApply: (date: DateRange | undefined) => void;
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
}) {
  const { data, error, isLoading, mutate } = useSWR("/api/products?tab=stock", fetcher);
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseAddress, setWarehouseAddress] = useState("");
  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !warehouseName) return;
    const token = await user.getIdToken();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "warehouse", name: warehouseName, address: warehouseAddress }),
    });
    setWarehouseName("");
    setWarehouseAddress("");
    mutate();
  };
  const handleDeleteWarehouse = async (warehouseId: string, warehouseName: string) => {
    if (!confirm(`Are you sure you want to delete the warehouse "${warehouseName}"? This cannot be undone.`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/products?type=warehouse&id=${warehouseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete warehouse.");
      }
      mutate();
    } catch (error: any) {
      console.error(error.message);
      alert(`Error: ${error.message}`);
    }
  };
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  const kpis = data.kpis;
  return (
    <div className="space-y-6">
      <GlobalFilters 
        date={date}
        onDateApply={onDateApply}
        currency={displayCurrency}
        setCurrency={setDisplayCurrency}
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Products" value={kpis.totalProducts} icon={Package} />
        <KpiCard 
          title={`Total Stock Value (${displayCurrency})`}
          value={formatCurrency(kpis.stockValueMap?.[displayCurrency], displayCurrency)} 
          icon={Wallet} 
        />
        <KpiCard title="Low Stock Items" value={kpis.lowStock} icon={AlertTriangle} color="text-orange-500" />
        <KpiCard title="Out of Stock Items" value={kpis.outOfStock} icon={PackageX} color="text-red-500" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold">Warehouses / Branches</h3>
          <div className="mt-4 space-y-3">
            {data.warehouses.map((wh: any) => (
              <div key={wh.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
                <div>
                  <p className="font-semibold">{wh.name}</p>
                  <p className="text-sm text-gray-500">{wh.address || "No address"}</p>
                </div>
                <button 
                  onClick={() => handleDeleteWarehouse(wh.id, wh.name)}
                  className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50" 
                  title="Delete Warehouse"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
            {data.warehouses.length === 0 && <TableEmptyState message="No warehouses added yet." />}
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">Add New Warehouse</h3>
          <form onSubmit={handleAddWarehouse} className="mt-4 space-y-4">
            <FormInput label="Warehouse Name" value={warehouseName} onChange={setWarehouseName} />
            <FormInput label="Address (Optional)" value={warehouseAddress} onChange={setWarehouseAddress} />
            <button type="submit" className="w-full rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700">
              Add Warehouse
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// --- TAB 4: Stock Adjustments ---
// ... (StockAdjustmentsTab unchanged) ...
function StockAdjustmentsTab() {
  const { data, error, isLoading } = useSWR("/api/products?tab=adjustments", fetcher);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const { data: productsData } = useSWR("/api/products?tab=products&noLimit=true", fetcher);
  const { data: stockData } = useSWR("/api/products?tab=stock", fetcher);
  return (
    <Card>
      {adjustmentModalOpen && (
        <AdjustmentModal 
          products={productsData?.products || []} 
          warehouses={stockData?.warehouses || []} 
          onClose={() => setAdjustmentModalOpen(false)}
        />
      )}
      {transferModalOpen && (
        <TransferModal
          products={productsData?.products || []} 
          warehouses={stockData?.warehouses || []} 
          onClose={() => setTransferModalOpen(false)}
        />
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stock Adjustment History</h3>
        <div className="flex gap-2">
          <button onClick={() => setAdjustmentModalOpen(true)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
            New Adjustment
          </button>
          <button onClick={() => setTransferModalOpen(true)} className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/50">
            New Transfer
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((adj: any) => {
          const isAddition = adj.change > 0;
          return (
            <div key={adj.id} className="flex items-center gap-3 rounded-lg border p-3 dark:border-gray-700">
              <span className={`rounded-full p-2 ${isAddition ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                {isAddition ? <PackageCheck className="h-5 w-5" /> : <PackageX className="h-5 w-5" />}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{adj.reason}</p>
                <p className="text-sm text-gray-500">
                  {adj.warehouseName} &bull; {adj.userName} &bull; {dayjs(adj.timestamp).format("MMM D, YYYY h:mm A")}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${isAddition ? "text-green-600" : "text-red-600"}`}>
                  {isAddition ? "+" : ""}{adj.change}
                </p>
                <p className="text-sm text-gray-500">New Total: {adj.newQuantity}</p>
              </div>
            </div>
          );
        })}
        {!isLoading && data?.length === 0 && <TableEmptyState message="No adjustments found." />}
      </div>
    </Card>
  );
}

// --- TAB 5: Inventory Reports ---
// ... (InventoryReportsTab unchanged) ...
function InventoryReportsTab() {
  const [reportType, setReportType] = useState("low_stock");
  const [reportCurrency, setReportCurrency] = useState("USD");
  const { data, error, isLoading } = useSWR(
    `/api/products?tab=reports&report=${reportType}&currency=${reportCurrency}`, 
    fetcher
  );
  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold">Inventory Reports</h3>
        <p className="text-sm text-gray-500">Visual analytics and charts can be built using this data.</p>
      </div>
      <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect label="Report Type" value={reportType} onChange={setReportType}>
          <option value="low_stock">Low Stock Report</option>
          <option value="fast_moving">Fast-Moving Products</option>
          <option value="slow_moving">Slow-Moving Products</option>
        </FormSelect>
        <FormSelect label="Currency for Values" value={reportCurrency} onChange={setReportCurrency}>
          {AVAILABLE_CURRENCIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </FormSelect>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Product</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Total Stock</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Sales Count</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Cost Price ({reportCurrency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading && <tr><td colSpan={4}><TableLoader /></td></tr>}
            {error && <tr><td colSpan={4}><ErrorDisplay error={error} /></td></tr>}
            {data?.map((product: any) => (
              <tr key={product.id}>
                <td className="py-4 font-medium">{product.name}</td>
                <td className="py-4">{product.quantity}</td>
                <td className="py-4">{product.salesCount || 0}</td>
                <td className="py-4">{formatCurrency(product.costPrice, reportCurrency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.length === 0 && <TableEmptyState message="No products found for this report." />}
      </div>
    </Card>
  );
}

// --- (MODIFIED) PRODUCT REPORT MODAL ---
// Now accepts 'selectedProducts' and has 'Report Scope' UI
// --- (REPLACED) PRODUCT REPORT MODAL ---
// This modal now works with @react-pdf/renderer for high-quality, real-text PDFs
function ProductReportModal({ onClose, subscription, selectedProducts }: { 
  onClose: () => void,
  subscription: any,
  selectedProducts: Set<string>
}) {
  const { data: categoriesData } = useSWR("/api/products?tab=categories", fetcher);
  
  // State for filters
  const [category, setCategory] = useState("");
  const [reportCurrency, setReportCurrency] = useState(subscription?.currency || "USD");
  const [date, setDate] = React.useState<DateRange | undefined>();
  const [activePreset, setActivePreset] = useState<DatePreset>("custom");
  const [reportScope, setReportScope] = useState<'all' | 'selected'>('all');
  
  // State for UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- (NEW) State to hold the prepared data for the PDF ---
  const [pdfData, setPdfData] = useState<any | null>(null);
  // --- (NEW) State to hold the selected template component ---
  const [PdfDocument, setPdfDocument] = useState<React.ElementType | null>(null);

  // This function prepares the data and enables the download button
  const handlePrepareDownload = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setPdfData(null); // Clear old data
    setPdfDocument(null);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated.");

      // 1. Build query params for the API
      const params = new URLSearchParams({
        currency: reportCurrency,
        tab: "products",
        noLimit: "true", // Get ALL products
      });
      
      if (reportScope === 'selected' && selectedProducts.size > 0) {
        params.set('productIds', Array.from(selectedProducts).join(','));
      } else {
        if (category) params.set("category", category);
        if (date?.from) params.set("startDate", format(date.from, "yyyy-MM-dd"));
        if (date?.to) params.set("endDate", format(date.to, "yyyy-MM-dd"));
      }
      
      // 2. Fetch the REAL data
      const apiData = await fetcher(`/api/products?${params.toString()}`);
      if (!apiData.products || apiData.products.length === 0) {
        throw new Error("No products found for these filters.");
      }

      // 3. Format data for the PDF
      const formattedProducts = apiData.products.map((p: any) => ({
        id: p.id,
        Name: p.name,
        Category: p.category || "N/A",
        Quantity: p.quantity,
        Price: formatCurrency(p.salePrices?.[reportCurrency], reportCurrency)
      }));
      
      const reportData = {
        products: formattedProducts,
        // (We can add KPIs here later)
        kpis: {
          totalProducts: formattedProducts.length,
          outOfStock: formattedProducts.filter((p: any) => p.Quantity <= 0).length
        }
      };
      
      // 4. Get Store Info from subscription (for the header)
      const storeInfo = {
        name: subscription?.storeName || "My Store",
        address: subscription?.storeAddress || "123 Main St",
        phone: subscription?.storePhone || "555-1234",
        logoUrl: subscription?.logoUrl, // Pass logo URL
        planId: subscription?.planId, // Pass planId
      };

      // 5. GET THE TEMPLATE COMPONENT from the "brain"
      // We cast 'product_report' to ReportType
      const TemplateComponent = getTemplateComponent('product_report' as ReportType, subscription);
      
      // 6. Set state to render the download button
      setPdfData({ data: reportData, store: storeInfo });
      setPdfDocument(() => TemplateComponent); // Store the component itself in state
      
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // This function handles the Excel download (server-side)
  const handleDownloadExcel = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated.");

      const params = new URLSearchParams({
        format: 'excel',
        currency: reportCurrency,
      });
      
      if (reportScope === 'selected' && selectedProducts.size > 0) {
        params.set('productIds', Array.from(selectedProducts).join(','));
      } else {
        if (category) params.set("category", category);
        if (date?.from) params.set("startDate", format(date.from, "yyyy-MM-dd"));
        if (date?.to) params.set("endDate", format(date.to, "yyyy-MM-dd"));
      }

      const res = await fetch(`/api/products/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate report.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_report_${reportCurrency}_${dayjs().format("YYYYMMDD")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      onClose();

    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalBase title="Download Product Report" onClose={onClose}>
      <div className="mt-4 space-y-4">
        
        {/* --- Report Scope --- */}
        {selectedProducts.size > 0 && (
          <div className="space-y-2 rounded-lg border border-blue-500 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Report Scope</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input 
                  type="radio" name="reportScope" value="all"
                  checked={reportScope === 'all'} onChange={() => setReportScope('all')}
                  className="h-4 w-4 text-blue-600"
                />
                All products (using filters)
              </label>
              <label className="flex items-center gap-2">
                <input 
                  type="radio" name="reportScope" value="selected"
                  checked={reportScope === 'selected'} onChange={() => setReportScope('selected')}
                  className="h-4 w-4 text-blue-600"
                />
                Only {selectedProducts.size} selected products
              </label>
            </div>
          </div>
        )}
        
        {/* --- Filter Inputs (Disabled if scope is 'selected') --- */}
        <fieldset disabled={reportScope === 'selected' || !!pdfData} className="disabled:opacity-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect label="Category" value={category} onChange={setCategory}>
              <option value="">All Categories</option>
              {categoriesData?.categories?.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </FormSelect>
            <FormSelect label="Currency for Report" value={reportCurrency} onChange={setReportCurrency}>
              {AVAILABLE_CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </FormSelect>
          </div>
          <div className="space-y-3 mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
              Date Range (Optional)
            </label>
            <DatePresetButtons
              activePreset={activePreset}
              onPresetSelect={(preset, newDate) => {
                setActivePreset(preset);
                setDate(newDate);
              }}
            />
            <NewDateRangePicker
              date={date}
              onApply={(newDate) => {
                setDate(newDate);
                setActivePreset("custom");
              }}
            />
          </div>
        </fieldset>
        
        {/* --- Buttons --- */}
        <div className="pt-4">
          {errorMessage && (
            <div className="w-full text-center rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300 mb-3">
              {errorMessage}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleDownloadExcel} 
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Excel
            </button>
            
            {/* --- MODIFIED PDF BUTTONS --- */}
            <button 
              onClick={handlePrepareDownload} 
              disabled={isLoading || !!pdfData}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfData ? "Data Ready" : "1. Prepare PDF Data"}
            </button>
            
            {/* This button only appears after data is prepared */}
            {pdfData && PdfDocument && (
              <PDFDownloadLink
                document={React.createElement(PdfDocument, { data: pdfData.data, store: pdfData.store })}
                fileName="product_report.pdf"
                className="w-full flex justify-center items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {({ loading }) => 
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      2. Download PDF Now
                    </>
                  )
                }
              </PDFDownloadLink>
            )}
          </div>
        </div>
      </div>
    </ModalBase>
  );
}
// --- (FIX 3) PRODUCT VIEW MODAL (UPDATED) ---
// ... (ProductViewModal unchanged from original file) ...
function ProductViewModal({ product, onClose, displayCurrency }: {
  product: any,
  onClose: () => void,
  displayCurrency: string
}) {
  const { data: stockLevels, error: stockError } = useSWR(
    `/api/products?tab=stock&productId=${product.id}`, 
    fetcher
  );
  const { data: hubData, error: hubError, isLoading: hubLoading } = useSWR(
    `/api/products/${product.id}`, 
    fetcher
  );
  const allPrices = useMemo(() => {
    const salePrices = product.salePrices || {};
    const costPrices = product.costPrices || {};
    const allCurrencies = new Set([...Object.keys(salePrices), ...Object.keys(costPrices)]);
    return Array.from(allCurrencies);
  }, [product]);

return (
  <ModalBase title="Product Overview" onClose={onClose}>
    <div className="mt-2 max-h-[85vh] overflow-y-auto px-1 pb-8 scrollbar-hide">
      
      {/* ==========================================
          1. HERO SECTION: Image & Key Info
      ========================================== */}
      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Product Image */}
        <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {product.imageUrl ? (
            <Image 
              src={product.imageUrl} 
              alt={product.name} 
              fill 
              className="object-cover" 
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-gray-300 dark:text-gray-600">
              <Package className="h-10 w-10 stroke-[1.5]" />
              <span className="mt-2 text-[10px] font-medium uppercase tracking-widest">No Image</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Tag className="h-3 w-3" />
              {product.category || 'Uncategorized'}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${product.quantity > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
              <Box className="h-3 w-3" />
              {product.quantity > 0 ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
          
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {product.name}
          </h2>
          
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {product.description || "No description provided."}
          </p>
          {/* --- VARIANT DISPLAY --- */}
{product.options && product.options.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-2">
    {product.options.map((opt: any, idx: number) => (
      <span key={idx} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300">
        {opt.name}: {Array.isArray(opt.values) ? opt.values.join(", ") : opt.values}
      </span>
    ))}
  </div>
)}
{/* ----------------------- */}
        </div>
      </div>

      {/* ==========================================
          2. KEY METRICS ROW
      ========================================== */}
      <div className="mt-8 grid grid-cols-1 gap-4 border-y border-gray-100 py-6 dark:border-gray-700 sm:grid-cols-3">
        <div className="px-2">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Inventory</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{product.quantity}</p>
        </div>
        <div className="border-l border-gray-100 px-4 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Base Price ({displayCurrency})</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(product.salePrices?.[displayCurrency] || 0, displayCurrency)}
          </p>
        </div>
        <div className="border-l border-gray-100 px-4 dark:border-gray-700">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Warehouses</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stockLevels?.length || 0}</p>
        </div>
      </div>

      {/* ==========================================
          3. DATA TABLES (Pricing & Stock)
      ========================================== */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        
        {/* Pricing Table */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pricing Structure</h3>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Currency</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {allPrices.length > 0 ? allPrices.map(curr => (
                  <tr key={curr}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{curr}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 font-mono">{formatCurrency(product.costPrices?.[curr], curr)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white font-mono">{formatCurrency(product.salePrices?.[curr], curr)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="p-4 text-center text-sm text-gray-400">No prices configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Table */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <Warehouse className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Stock Distribution</h3>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
            {stockError ? (
               <div className="p-4 text-center text-sm text-red-500">Failed to load stock levels</div>
            ) : !stockLevels ? (
               <div className="p-4"><TableLoader /></div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Location</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {stockLevels.length > 0 ? stockLevels.map((stock: any) => (
                    <tr key={stock.id}>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{stock.warehouseName}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">{stock.quantity}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={2} className="p-4 text-center text-sm text-gray-400">No stock recorded</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          4. HISTORY SECTION
      ========================================== */}
      <div className="mt-10">
        <h3 className="mb-6 text-lg font-bold text-gray-900 dark:text-white">Activity History</h3>
        
        {hubLoading && <TableLoader />}
        {hubError && <div className="text-sm text-red-500">Error loading history data.</div>}
        
        {hubData && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            
            {/* Recent Sales */}
            <div className="rounded-xl border border-gray-100 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                  <BarChart3 className="h-3.5 w-3.5" /> Recent Sales
                </h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {/* INLINED TABLE TO PREVENT HYDRATION ERRORS */}
                {hubData.salesHistory?.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-800">
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {hubData.salesHistory.map((sale: any) => (
                        <tr key={sale.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                            #{sale.invoiceId?.slice(-6) || '---'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                            {sale.quantity} items
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-400">
                            {dayjs(sale.createdAt).format("DD MMM")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-4 text-center text-sm text-gray-400 italic">No recent sales found.</p>
                )}
              </div>
            </div>

            {/* Stock Adjustments */}
            <div className="rounded-xl border border-gray-100 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Stock Movement
                </h4>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {/* INLINED TABLE TO PREVENT HYDRATION ERRORS */}
                {hubData.adjustmentHistory?.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-50 dark:divide-gray-800">
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {hubData.adjustmentHistory.map((adj: any) => (
                        <tr key={adj.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white capitalize">
                            {adj.reason}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${adj.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {adj.quantityChange > 0 ? '+' : ''}{adj.quantityChange}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-400">
                            {dayjs(adj.createdAt).format("DD MMM")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-4 text-center text-sm text-gray-400 italic">No stock adjustments found.</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  </ModalBase>
);
}
type ProductFormErrors = {
  name?: string;
  category?: string;
  warehouseId?: string;
  quantity?: string;
};

// ... (ProductFormModal unchanged from original file) ...
const ProductFormModal = React.memo(function ProductFormModal({ productToEdit, onClose, storeId }: { 
  productToEdit: any | null, 
  onClose: () => void, 
  storeId: string 
}) {
  const isEditMode = !!productToEdit;
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(productToEdit?.name || "");
  const [description, setDescription] = useState(productToEdit?.description || "");
  const [category, setCategory] = useState(productToEdit?.category || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(isEditMode ? "" : "0");
  const [warehouseId, setWarehouseId] = useState("");
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(productToEdit?.imageUrl || null);
  const [imagePreview, setImagePreview] = useState(productToEdit?.imageUrl || null);
  type PriceField = { id: number, currency: string, sale: string, cost: string };
  const [priceFields, setPriceFields] = useState<PriceField[]>([]);
  useEffect(() => {
    if (isEditMode) {
      const salePrices = productToEdit.salePrices || {};
      const costPrices = productToEdit.costPrices || {};
      const allCurrencies = new Set([...Object.keys(salePrices), ...Object.keys(costPrices)]);
      if (allCurrencies.size === 0) {
        setPriceFields([{ id: 1, currency: "USD", sale: "", cost: "" }]);
      } else {
        setPriceFields(
          Array.from(allCurrencies).map((currency, index) => ({
            id: index + 1,
            currency,
            sale: salePrices[currency]?.toString() || "",
            cost: costPrices[currency]?.toString() || "",
          }))
        );
      }
    } else {
      setPriceFields([{ id: 1, currency: "USD", sale: "", cost: "" }]);
    }
  }, [productToEdit, isEditMode]);
  const { data: categoriesData, mutate: mutateCategories } = useSWR("/api/products?tab=categories", fetcher);
  const { data: stockData, mutate: mutateStock } = useSWR("/api/products?tab=stock", fetcher);
  const handleAddInline = async (type: "category" | "warehouse") => {
    setIsSavingInline(true);
    const user = auth.currentUser;
    if (!user) {
      alert("Authentication error.");
      setIsSavingInline(false);
      return;
    }
    let body: any;
    let newName = "";
    if (type === "category") {
      if (!newCategoryName) {
        alert("Category name cannot be empty.");
        setIsSavingInline(false);
        return;
      }
      body = { type: "category", name: newCategoryName };
      newName = newCategoryName;
    } else {
      if (!newWarehouseName) {
        alert("Warehouse name cannot be empty.");
        setIsSavingInline(false);
        return;
      }
      body = { type: "warehouse", name: newWarehouseName, address: newWarehouseAddress };
      newName = newWarehouseName;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to add ${type}.`);
      }
      if (type === "category") {
        await mutateCategories();
        setCategory(newName);
        setNewCategoryName("");
        setShowAddCategory(false);
      } else {
        const newWarehouse = await res.json();
        await mutateStock();
        setWarehouseId(newWarehouse.id);
        setNewWarehouseName("");
        setNewWarehouseAddress("");
        setShowAddWarehouse(false);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSavingInline(false);
    }
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setExistingImageUrl(null);
    }
  };
  const handlePriceChange = (id: number, key: "currency" | "sale" | "cost", value: string) => {
    setPriceFields(prevFields =>
      prevFields.map(field =>
        field.id === id ? { ...field, [key]: value } : field
      )
    );
  };
  const addPriceField = () => setPriceFields(prev => [...prev, { id: Date.now(), currency: "SLSH", sale: "", cost: "" }]);
  const removePriceField = (id: number) => setPriceFields(prev => prev.filter(field => field.id !== id));
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormErrors({});
    const errors: ProductFormErrors = {};
    if (!name) {
      errors.name = "Product name is required.";
    }
    if (!category) {
      errors.category = "Please select a category.";
    }
    if (!isEditMode && !warehouseId) {
      errors.warehouseId = "Please select a warehouse for the initial stock.";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }
    const user = auth.currentUser;
    if (!user || !storeId) {
      setFormErrors({ name: "Authentication error. Please log in again." });
      setIsSubmitting(false);
      return;
    }
    try {
      let uploadedImageUrl: string | null = existingImageUrl;
      if (imageFile) {
        const imageRef = ref(storage, `product_images/${storeId}/${Date.now()}_${imageFile.name}`);
        const uploadTask = await uploadBytes(imageRef, imageFile);
        uploadedImageUrl = await getDownloadURL(uploadTask.ref);
      }
      if (!imageFile && !existingImageUrl) {
        uploadedImageUrl = null;
      }
      const salePrices: Record<string, number> = {};
      const costPrices: Record<string, number> = {};
      for (const field of priceFields) {
        if (field.currency) {
          if (field.sale) salePrices[field.currency] = parseFloat(field.sale);
          if (field.cost) costPrices[field.currency] = parseFloat(field.cost);
        }
      }
      let body: any;
      let url = "/api/products";
      let method = "POST";
      if (isEditMode) {
        method = "PUT";
        url = `/api/products?id=${productToEdit.id}`;
        body = {
          name, description, category, salePrices, costPrices,
          imageUrl: uploadedImageUrl,
        };
      } else {
        const warehouse = stockData?.warehouses.find((w: any) => w.id === warehouseId);
        body = {
          type: "product",
          name, description, category,
          quantity: Number(quantity) || 0,
          warehouseId: warehouse?.id,
          warehouseName: warehouse?.name,
          salePrices, costPrices,
          imageUrl: uploadedImageUrl,
        };
      }
      const token = await user.getIdToken();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save product.");
      }
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products?tab=products'), undefined, { revalidate: true });
      mutate("/api/products?tab=stock");
      if (!isEditMode) mutate("/api/products?tab=adjustments");
      onClose();
    } catch (error: any) {
      setFormErrors({ name: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };// --- START: New Logic for Variants ---
  const [options, setOptions] = useState<{ name: string; values: string }[]>([]);

  const addOptionRow = () => {
    setOptions([...options, { name: "", values: "" }]);
  };

  const removeOptionRow = (idx: number) => {
    const newOptions = [...options];
    newOptions.splice(idx, 1);
    setOptions(newOptions);
  };

  const handleOptionChange = (idx: number, field: 'name' | 'values', val: string) => {
    const newOptions = [...options];
    newOptions[idx][field] = val;
    setOptions(newOptions);
  };
  // --- END: New Logic for Variants ---
return (
    <ModalBase title={isEditMode ? "Edit Product" : "New Product Catalog"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-1 pb-4">
        
        {/* Global Error Banner */}
        {formErrors.name && !formErrors.category && !formErrors.warehouseId && (
          <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{formErrors.name}</p>
          </div>
        )}

        <div className="max-h-[70vh] space-y-8 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
          
          {/* --- SECTION 1: HERO (Image + Basics) --- */}
         {/* --- SECTION 1: HERO (Clear, Big, Readable) --- */}
<div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
  
  <div className="flex flex-col gap-8 md:flex-row">
    
    {/* LEFT: Image Upload (Big & Obvious) */}
    <div className="flex flex-col gap-3">
      <label className="text-sm font-bold text-gray-900 dark:text-white">
        Product Image
      </label>
      
      <div className="group relative h-48 w-48 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900">
        
        {imagePreview ? (
          <>
            <Image 
              src={imagePreview} 
              alt="Preview" 
              fill 
              className="object-cover" 
            />
            {/* Permanent Remove Button - No Hover Tricks */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImageFile(null); 
                setExistingImageUrl(null); 
                setImagePreview(null); 
              }}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md hover:bg-red-50 hover:text-red-600"
              title="Delete Image"
            >
              <Trash className="h-5 w-5 text-gray-600 hover:text-red-600" />
            </button>
            
            <div className="absolute bottom-0 w-full bg-black/50 py-2 text-center">
              <span className="text-xs font-medium text-white">Click to Change</span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center p-4 text-gray-500">
            <Camera className="mb-2 h-10 w-10 text-gray-400" />
            <span className="text-sm font-bold text-blue-600">Click to Upload</span>
            <span className="mt-1 text-xs">JPG or PNG</span>
          </div>
        )}

        {/* The actual input is invisible but covers the whole box */}
        <input 
          type="file" 
          accept="image/*" 
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" 
          onChange={handleImageSelect} 
        />
      </div>
    </div>


    {/* RIGHT: Form Fields (High Contrast, Boxed Inputs) */}
    <div className="flex-1 space-y-6">
      
      {/* 1. Product Name - Big Input */}
      <div>
        <label className="mb-2 block text-sm font-bold text-gray-900 dark:text-white">
          Product Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pepsi 500ml"
          className="block w-full rounded-lg border-gray-300 px-4 py-3 text-lg font-medium text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        
        {/* 2. Category Selection */}
        <div>
          <div className="mb-2 flex items-center justify-between">
             <label className="text-sm font-bold text-gray-900 dark:text-white">
               Category <span className="text-red-500">*</span>
             </label>
             {/* Clear Text Button for Add New */}
             <button 
                type="button"
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="text-sm font-medium text-blue-600 hover:underline"
             >
               {showAddCategory ? "Cancel" : "+ Add New"}
             </button>
          </div>

          {showAddCategory ? (
            <div className="flex gap-2">
              <input 
                className="w-full rounded-lg border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="New Category Name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => handleAddInline("category")}
                disabled={isSavingInline}
                className="rounded-lg bg-blue-600 px-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full appearance-none rounded-lg border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select a Category...</option>
                {categoriesData?.categories?.map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              {/* Dropdown Arrow Icon */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <ChevronDown className="h-5 w-5" />
              </div>
            </div>
          )}
        </div>

        {/* 3. Description */}
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-900 dark:text-white">
            Short Note / Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any details..."
            className="block w-full rounded-lg border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

      </div>
    </div>
  </div>
</div>

          {/* --- SECTION 2: VARIANTS --- */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-gray-900 dark:text-white">
                <Layers className="h-4 w-4 text-purple-500" /> Variants
              </h4>
              <button type="button" onClick={addOptionRow} className="flex items-center gap-1 text-xs font-bold uppercase text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <Plus className="h-3 w-3" /> Add Variant
              </button>
            </div>
            
            {options.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm text-gray-500">Does this product have options like Size or Color?</p>
                <button type="button" onClick={addOptionRow} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
                  + Add Options
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="group flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                    <div className="w-1/3">
                      <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Option Name</label>
                      <input
                        placeholder="e.g. Size"
                        value={opt.name}
                        onChange={(e) => handleOptionChange(idx, 'name', e.target.value)}
                        className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Values (Comma Separated)</label>
                      <input
                        placeholder="e.g. Small, Medium, Large"
                        value={opt.values}
                        onChange={(e) => handleOptionChange(idx, 'values', e.target.value)}
                        className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      />
                    </div>
                    <button type="button" onClick={() => removeOptionRow(idx)} className="mt-5 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- SECTION 3: INVENTORY --- */}
          {!isEditMode && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-gray-900 dark:text-white">
                <Package className="h-4 w-4 text-orange-500" /> Initial Stock
              </h4>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput 
                  label="Starting Quantity" 
                  type="number" 
                  value={quantity} 
                  onChange={setQuantity} 
                  error={formErrors.quantity} 
                  min="0"
                  placeholder="0" 
                />
                
                <div className="space-y-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                       <FormSelect label="Warehouse" value={warehouseId} onChange={setWarehouseId} error={formErrors.warehouseId}>
                        <option value="">Select Location</option>
                        {stockData?.warehouses?.map((w: any) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </FormSelect>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowAddWarehouse(!showAddWarehouse)} 
                      className={`mb-[2px] flex h-[42px] w-[42px] items-center justify-center rounded-lg border transition-colors ${showAddWarehouse ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600'}`}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Inline Add Warehouse Form */}
                  {showAddWarehouse && (
                    <div className="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                      <div className="mb-2 grid grid-cols-2 gap-2">
                         <input 
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                          placeholder="Name"
                          value={newWarehouseName}
                          onChange={(e) => setNewWarehouseName(e.target.value)}
                        />
                         <input 
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                          placeholder="Address"
                          value={newWarehouseAddress}
                          onChange={(e) => setNewWarehouseAddress(e.target.value)}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleAddInline("warehouse")} 
                        disabled={isSavingInline} 
                        className="w-full rounded bg-blue-600 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        {isSavingInline ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Save Location"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- SECTION 4: PRICING --- */}
        {/* --- SECTION 4: PRICING --- */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-5 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-gray-900 dark:text-white">
                <DollarSign className="h-4 w-4 text-green-500" /> Pricing Strategy
              </h4>
              <button type="button" onClick={addPriceField} className="flex items-center gap-1 text-xs font-bold uppercase text-blue-600 hover:text-blue-700 dark:text-blue-400">
                <Plus className="h-3 w-3" /> Add Currency
              </button>
            </div>

            <div className="space-y-4">
              {priceFields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/50 sm:flex-row sm:items-start">
                   
                   {/* Currency Selector */}
                   <div className="w-full sm:w-[140px]">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Currency</label>
                      <FormSelect 
                        label="" // Hide default label to avoid duplication
                        value={field.currency} 
                        onChange={(val: string) => handlePriceChange(field.id, "currency", val)}
                        className="h-11 bg-white font-medium shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800"
                      >
                        {AVAILABLE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </FormSelect>
                   </div>

                   {/* Sale Price Input */}
                   <div className="flex-1">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-400">Sale Price</label>
                      <div className="relative">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                           <span className="text-gray-400 font-bold">$</span>
                         </div>
                         <FormInput 
                          label="" // Hide default label
                          type="number" 
                          placeholder="0.00" 
                          value={field.sale} 
                          onChange={(val: string) => handlePriceChange(field.id, "sale", val)} 
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-7 text-lg font-bold text-gray-900 placeholder-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                   </div>

                   {/* Cost Price Input */}
                   <div className="flex-1">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-orange-600/80 dark:text-orange-400">Cost Price</label>
                      <div className="relative">
                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                           <span className="text-gray-400 font-bold">$</span>
                         </div>
                         <FormInput 
                          label="" // Hide default label
                          type="number" 
                          placeholder="0.00" 
                          value={field.cost} 
                          onChange={(val: string) => handlePriceChange(field.id, "cost", val)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-7 text-lg font-bold text-gray-900 placeholder-gray-300 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                   </div>
                   
                   {/* Remove Button */}
                   <div className="flex h-[74px] items-end sm:h-auto sm:pt-7">
                     {priceFields.length > 1 && (
                       <button 
                         type="button" 
                         onClick={() => removePriceField(field.id)} 
                         className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-red-900/20"
                         title="Remove Currency"
                       >
                         <Trash className="h-5 w-5" />
                       </button>
                     )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- FOOTER ACTIONS --- */}
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="flex min-w-[140px] items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditMode ? "Save Changes" : "Create Product")}
          </button>
        </div>
      </form>
    </ModalBase>
  );
});

// ... (SalesHistoryTable and AdjustmentsHistoryTable unchanged from original file) ...



// ... (StockLevelsModal unchanged from original file) ...
function StockLevelsModal({ productId, onClose }: { productId: string, onClose: () => void }) {
  const { data, error, isLoading } = useSWR(`/api/products?tab=stock&productId=${productId}`, fetcher);
  return (
    <ModalBase title="Stock Levels by Warehouse" onClose={onClose}>
      <div className="mt-4 space-y-3">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((stock: any) => (
          <div key={stock.id} className="flex justify-between rounded-lg border p-3 dark:border-gray-700">
            <span className="font-semibold">{stock.warehouseName}</span>
            <span className="font-bold">{stock.quantity}</span>
          </div>
        ))}
        {!isLoading && data?.length === 0 && <TableEmptyState message="No stock levels recorded for this product." />}
      </div>
    </ModalBase>
  );
}

// ... (AdjustmentModal unchanged from original file) ...
function AdjustmentModal({ products, warehouses, onClose }: { products: any[], warehouses: any[], onClose: () => void }) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate } = useSWRConfig();
  const [errors, setErrors] = useState<any>({});
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!selectedProduct) { setErrors({ product: "Please select a product." }); return; }
    if (!selectedWarehouse) { setErrors({ warehouse: "Please select a warehouse." }); return; }
    if (!quantity || Number(quantity) <= 0) { 
      setErrors({ quantity: "Please enter a valid, positive quantity." }); 
      return; 
    }
    if (!reason) { setErrors({ reason: "Please provide a reason." }); return; }
    setIsSubmitting(true);
    const changeAmount = adjustmentType === 'add' ? Number(quantity) : -Number(quantity);
    const warehouse = warehouses.find(w => w.id === selectedWarehouse);
    const user = auth.currentUser;
    if (!user || !warehouse) { setIsSubmitting(false); return; }
    const token = await user.getIdToken();
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "adjustment",
          productId: selectedProduct,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          change: changeAmount,
          reason,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save adjustment.");
      }
      mutate("/api/products?tab=adjustments");
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products?tab=products'), undefined, { revalidate: true });
      mutate("/api/products?tab=stock");
      mutate(`/api/products?tab=stock&productId=${selectedProduct}`);
      setIsSubmitting(false);
      onClose();
    } catch (error: any) {
      console.error(error.message);
      setErrors({ general: error.message || "An unknown error occurred." });
      setIsSubmitting(false);
    }
  };
  return (
    <ModalBase title="New Stock Adjustment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {errors.general && <ErrorDisplay error={errors.general} />}
        <FormSelect label="Product" value={selectedProduct} onChange={setSelectedProduct} error={errors.product}>
          <option value="">-- Select Product --</option>
          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FormSelect>
        <FormSelect label="Warehouse" value={selectedWarehouse} onChange={setSelectedWarehouse} error={errors.warehouse}>
          <option value="">-- Select Warehouse --</option>
          {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </FormSelect>
        <div>
          <label className="mb-1 block text-sm font-medium">Adjustment Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input 
                type="radio"
                name="adjustmentType"
                value="add"
                checked={adjustmentType === 'add'}
                onChange={() => setAdjustmentType('add')}
                className="h-4 w-4 text-blue-600"
              />
              Add to Stock (+)
            </label>
            <label className="flex items-center gap-2">
              <input 
                type="radio"
                name="adjustmentType"
                value="deduct"
                checked={adjustmentType === 'deduct'}
                onChange={() => setAdjustmentType('deduct')}
                className="h-4 w-4 text-blue-600"
              />
              Deduct from Stock (-)
            </label>
          </div>
        </div>
        <FormInput 
          label="Quantity (Positive Number)" 
          type="number" 
          value={quantity} 
          onChange={setQuantity} 
          error={errors.quantity}
          min="0"
          placeholder="e.g., 10"
        />
        <FormInput 
          label="Reason (e.g., 'Initial Stock', 'Damaged')" 
          value={reason} 
          onChange={setReason} 
          error={errors.reason} 
        />
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Adjustment"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

// ... (TransferModal unchanged from original file) ...
function TransferModal({ products, warehouses, onClose }: { products: any[], warehouses: any[], onClose: () => void }) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const { mutate } = useSWRConfig();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!selectedProduct) { setErrors({ product: "Please select a product." }); return; }
    if (!fromWarehouse) { setErrors({ from: "Please select a source warehouse." }); return; }
    if (!toWarehouse) { setErrors({ to: "Please select a destination warehouse." }); return; }
    if (fromWarehouse === toWarehouse) { setErrors({ to: "Cannot transfer to and from the same warehouse." }); return; }
    if (!quantity || Number(quantity) <= 0) { setErrors({ quantity: "Please enter a valid quantity." }); return; }
    setIsSubmitting(true);
    const fromWH = warehouses.find(w => w.id === fromWarehouse);
    const toWH = warehouses.find(w => w.id === toWarehouse);
    const user = auth.currentUser;
    if (!user || !fromWH || !toWH) { setIsSubmitting(false); return; }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "transfer",
          productId: selectedProduct,
          fromWarehouse: { id: fromWH.id, name: fromWH.name },
          toWarehouse: { id: toWH.id, name: toWH.name },
          quantity: Number(quantity),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to complete transfer.");
      }
      mutate("/api/products?tab=adjustments");
      mutate(`/api/products?tab=stock&productId=${selectedProduct}`);
      setIsSubmitting(false);
      onClose();
    } catch (error: any) {
      console.error(error.message);
      setErrors({ general: error.message || "An unknown error occurred." });
      setIsSubmitting(false);
    }
  };
  return (
    <ModalBase title="New Stock Transfer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {errors.general && <ErrorDisplay error={errors.general} />}
        <FormSelect label="Product" value={selectedProduct} onChange={setSelectedProduct} error={errors.product}>
          <option value="">-- Select Product --</option>
          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FormSelect>
        <FormSelect label="From Warehouse" value={fromWarehouse} onChange={setFromWarehouse} error={errors.from}>
          <option value="">-- Select Warehouse --</option>
          {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </FormSelect>
        <FormSelect label="To Warehouse" value={toWarehouse} onChange={setToWarehouse} error={errors.to}>
          <option value="">-- Select Warehouse --</option>
          {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </FormSelect>
        <FormInput 
          label="Quantity to Transfer" 
          type="number" 
          value={quantity} 
          onChange={setQuantity} 
          error={errors.quantity}
          min="0"
        />
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Complete Transfer"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}