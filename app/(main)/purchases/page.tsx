// File: app/(main)/purchases/page.tsx
//
// --- CHANGELOG (NOV 5, 2025 v2) ---
// 1. (FIX) 'ViewPurchaseModal': Replaced 'Payment Due' (Date) with
//    'Amount Due' (Amount) to solve the "N/A" issue.
// 2. (NEW) Created a new <ReportDownloadPopover /> component.
// 3. (MOVED) 'SupplierFilter' and 'DatePresets' are now *inside* the
//    <ReportDownloadPopover /> instead of on the main page.
// 4. (CLEANUP) Removed 'supplier' from the main 'filters' state and
//    <FilterBar />. The main page no longer filters by supplier.
// 5. (INFO) 'handleReload' (Refresh Button) functionality is confirmed
//    correct and re-fetches data using mutate().
// 6. (INFO) The download buttons in the popover now pass their local state
//    (report date range, report supplier) to a handler function.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useMemo, Fragment, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import {
  DollarSign, Receipt, Users, Plus, Search, ChevronLeft,
  ChevronRight, X, AlertOctagon, CheckCircle, Loader2,
  Phone, MessageSquare, Trash2, Calendar, CreditCard,
  Tag, ChevronsUpDown, ArrowDown, ArrowUp, Eye,
  FileDown, HandCoins, SlidersHorizontal, Package,
  History, Clock, BarChart2, Building, Trash,
  RefreshCw,
  Calendar as CalendarIconLucide,
  Check,
  Warehouse, Info, Download, Printer,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  UserCheck,
} from "lucide-react";

// --- Helpers for Modern UI ---
import { type DateRange } from "react-day-picker";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/Button";
import { 
  add, addDays, format, startOfWeek, startOfMonth, endOfDay,
  eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, isSameMonth,
  isToday, parse, sub, isAfter, isBefore, startOfDay,
  subDays,
} from "date-fns";
import { Listbox, Transition, Dialog, Switch, Combobox } from "@headlessui/react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// --- End Helpers ---


// -----------------------------------------------------------------------------
// 💰 API Fetcher & Utilities
// -----------------------------------------------------------------------------
const fetcher = async (url: string) => {
  // ... (same as before)
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  // ... (same as before)
  if (amount == null) return "N/A";
  const nonDecimalCurrencies = ["SLSH", "SOS", "KSH", "BIRR"];
  const style = (currency === "USD" || currency === "EUR") ? "currency" : "decimal";
  
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: nonDecimalCurrencies.includes(currency) ? 0 : 2,
    maximumFractionDigits: nonDecimalCurrencies.includes(currency) ? 0 : 2,
  };
  if (style === "currency") {
    options.currency = currency;
    options.currencyDisplay = "symbol";
  }
  const formatter = new Intl.NumberFormat("en-US", options);
  let formatted = formatter.format(amount);
  if (style === "decimal") {
    formatted = `${currency} ${formatted}`;
  }
  return formatted;
};

const CURRENCIES = ["USD", "SLSH", "SOS", "BIRR", "KSH", "EUR"];
const STATUS_OPTIONS = [
  { id: "", label: "All Statuses" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "partially_paid", label: "Partially Paid" },
];

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function PurchasesPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PurchasesPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📝 Main Purchases Page Component
// -----------------------------------------------------------------------------
function PurchasesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();

  // --- State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  
  // --- (MODIFIED) Filters (Removed 'supplier') ---
  const [filters, setFilters] = useState({
    currency: searchParams.get("currency") || "USD",
    startDate: searchParams.get("startDate") || dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: searchParams.get("endDate") || dayjs().endOf("day").format("YYYY-MM-DD"),
    searchQuery: searchParams.get("searchQuery") || "",
    status: searchParams.get("status") || "",
  });

  // --- SWR Data Fetching (Optimized) ---
  
  // 1. Fetch main purchases data based on filters
  const buildUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    // Note: 'supplier' is no longer in 'filters', so it's not added here.
    return `/api/purchases?${params.toString()}`;
  };
  
  const swrKey = !authLoading && user ? buildUrl() : null;
  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(swrKey, fetcher);

  // 2. Fetch form data (suppliers, etc.) at the page level
  const {
    data: formData,
    error: formError,
    isLoading: formIsLoading,
  } = useSWR(
    !authLoading && user ? "/api/purchases?tab=form_data" : null,
    fetcher
  );

  const isLoading = authLoading || dataIsLoading || (formIsLoading && !formData);
  const mainError = error || formError;

  // --- Handlers ---
  const handleFilterChange = (key: string, value: string | number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    const newFilters = {
      ...filters,
      startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "",
      endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "",
    };
    setFilters(newFilters);
  };
  
  const handleActionSuccess = () => {
    mutate(); // Re-fetch data
    setIsAddModalOpen(false);
    setIsPayModalOpen(null);
  };
  
  const handleReload = () => {
    mutate(); // This is the correct way to refresh data
  };

  const handleOpenViewModal = (purchase: any) => {
    setViewingPurchase(purchase);
    setIsViewModalOpen(true);
  };
  
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewingPurchase(null);
  };

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="min-h-screen bg-white p-4 pt-6 dark:bg-gray-900 md:p-8">
      {/* --- (MODIFIED) Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchases</h1>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
          {/* --- (NEW) Report Download Popover --- */}
          <ReportDownloadPopover
            formData={formData}
            formIsLoading={formIsLoading}
          />
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleReload}
              className="flex flex-grow items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:flex-grow-0"
              title="Refresh Data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex flex-grow items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 sm:flex-grow-0"
            >
              <Plus className="h-4 w-4" />
              Add New Purchase
            </button>
          </div>
        </div>
      </header>

      {/* --- 🔍 (MODIFIED) Filter Bar (SupplierFilter removed) --- */}
      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onDateChange={handleDateChange}
      />
      
      {isLoading && <LoadingSpinner />}
      {mainError && <ErrorDisplay error={mainError} />}
      
      {apiData && (
        <div className="space-y-6">
          {/* --- 💰 KPIs --- */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Purchases"
              value={formatCurrency(apiData.kpis.totalPurchases, filters.currency)}
              icon={DollarSign}
              color="text-green-500"
            />
            <KpiCard
              title="Total Pending"
              value={formatCurrency(apiData.kpis.totalPending, filters.currency)}
              icon={Clock}
              color="text-orange-500"
            />
            <KpiCard
              title="Total Paid"
              value={formatCurrency(apiData.kpis.totalPaid, filters.currency)}
              icon={CheckCircle}
              color="text-blue-500"
            />
            <KpiCard
              title="Average Purchase"
              value={formatCurrency(apiData.kpis.avgPurchase, filters.currency)}
              icon={BarChart2}
              color="text-purple-500"
            />
          </div>

          {/* --- 📈 Charts --- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Purchase Trend Over Time">
              <PurchaseTrendChart data={apiData.charts.monthlyTrend} currency={filters.currency} />
            </ChartCard>
            <ChartCard title="Top Suppliers by Spend">
              <TopSuppliersChart data={apiData.charts.topSuppliers} currency={filters.currency} />
            </ChartCard>
          </div>
          
          {/* --- 📊 Purchases List --- */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Purchase History</h3>
            <PurchaseList
              purchases={apiData.purchases}
              currency={filters.currency}
              onPay={setIsPayModalOpen}
              onView={handleOpenViewModal}
              onDelete={mutate}
            />
          </Card>
        </div>
      )}

      {/* --- Modals --- */}
      {isAddModalOpen && (
        <AddPurchaseModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleActionSuccess}
          defaultCurrency={filters.currency}
          formData={formData}
          formIsLoading={formIsLoading}
          formError={formError}
        />
      )}
      {isPayModalOpen && (
        <PayPurchaseModal
          purchase={isPayModalOpen}
          onClose={() => setIsPayModalOpen(null)}
          onSuccess={handleActionSuccess}
        />
      )}
      {isViewModalOpen && (
        <ViewPurchaseModal
          purchase={viewingPurchase}
          onClose={handleCloseViewModal}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------
 
// --- (NEW) Report Download Popover Component ---
// File: app/(main)/purchases/page.tsx
// ... (dhammaan code-kaaga kale ee kore ha taaban)

// =============================================================================
// 🧩 Sub-Components
// =============================================================================

// --- (NEW) Report Download Popover Component (FIXED) ---
const PRESETS = [
  { label: "Last 7 Days", range: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) } },
  { label: "Last 30 Days", range: { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) } },
  { label: "This Month", range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
  { label: "Last Month", range: { from: startOfMonth(sub(new Date(), { months: 1 })), to: endOfMonth(sub(new Date(), { months: 1 })) } },
];

function ReportDownloadPopover({ formData, formIsLoading }: {
  formData: any,
  formIsLoading: boolean
}) {
  const [reportRange, setReportRange] = useState<DateRange | undefined>(PRESETS[1].range); // Default to Last 30 Days
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [supplierFilterOn, setSupplierFilterOn] = useState(false);
  const [query, setQuery] = useState('');

  const suppliers = formData?.suppliers || [];
  const filteredSuppliers =
    query === ''
      ? suppliers
      : suppliers.filter((supplier: any) =>
          supplier.name.toLowerCase().includes(query.toLowerCase())
        );
        
  const handleSupplierToggle = (isOn: boolean) => {
    setSupplierFilterOn(isOn);
    if (!isOn) {
      setSelectedSupplier(null); // Clear supplier if toggled off
    }
  };

  // --- (FIXED) This function now calls the correct API endpoint ---
  const handleDownloadReport = (reportType: 'excel' | 'pdf') => {
    
    // 1. Build the query parameters
    const params = new URLSearchParams({
      action: 'download', // <-- This triggers the download logic in your API
      format: reportType === 'excel' ? 'csv' : 'pdf', // API-gaagu wuxuu aqbalayaa 'csv'
      startDate: reportRange?.from ? format(reportRange.from, "yyyy-MM-dd") : '',
      endDate: reportRange?.to ? format(reportRange.to, "yyyy-MM-dd") : '',
      supplierId: supplierFilterOn && selectedSupplier ? selectedSupplier.id : '',
    });

    // 2. (FIX) Create the correct URL
    // Wuxuu ahaa /api/reports/purchases, hadda waa /api/purchases
    const reportUrl = `/api/purchases?${params.toString()}`;

    // 3. Trigger the download by opening the URL in a new tab
    window.open(reportUrl, '_blank');
  };

  return (
    <Popover className="relative inline-block w-full text-left sm:w-auto">
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="flex w-full items-center justify-center gap-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700"
        >
          <Download className="h-4 w-4" />
          Download Report
          <ChevronDown className="-mr-1 ml-1 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white p-4 dark:bg-gray-800" align="end">
        <div className="flex flex-col gap-4">
          
          {/* --- (FIX) Replaced Listbox with NewDateRangePicker --- */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Report Period
            </label>
            {/* Kani waa component-ka casriga ah ee aad rabtay */}
            <NewDateRangePicker
              date={reportRange ? { from: reportRange.from, to: reportRange.to } : undefined}
              onApply={setReportRange} // Wuxuu si toos ah u cusbooneysiinayaa 'reportRange' state
            />
          </div>
          
          {/* 2. Supplier Filter (Unchanged) */}
          <div className="space-y-3 rounded-lg border p-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Filter by Supplier</span>
              <Switch
                checked={supplierFilterOn}
                onChange={handleSupplierToggle}
                className={`${supplierFilterOn ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span className="sr-only">Filter by supplier</span>
                <span
                  aria-hidden="true"
                  className={`${supplierFilterOn ? 'translate-x-5' : 'translate-x-0'}
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
            </div>
            
            {supplierFilterOn && (
              <Combobox value={selectedSupplier} onChange={setSelectedSupplier}>
                <div className="relative">
                  <Combobox.Input
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    displayValue={(supplier: any) => supplier?.name || ""}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for a supplier..."
                    autoComplete="off"
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronsUpDown className="h-5 w-5 text-gray-400" />
                  </Combobox.Button>
                  <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0" afterLeave={() => setQuery('')}>
                    <Combobox.Options className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800">
                      {formIsLoading && <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>}
                      {filteredSuppliers.map((supplier: any) => (
                        <Combobox.Option key={supplier.id} value={supplier} as={Fragment}>
                          {({ active, selected }) => (
                            <li className={cn('relative cursor-default select-none py-2 pl-10 pr-4', active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200')}>
                              {selected && <Check className="absolute left-3 top-2.5 h-5 w-5" />}
                              <span className={cn('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                {supplier.name}
                              </span>
                            </li>
                          )}
                        </Combobox.Option>
                      ))}
                    </Combobox.Options>
                  </Transition>
                </div>
              </Combobox>
            )}
          </div>

          {/* 3. Download Buttons (Unchanged) */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadReport('excel')}
              className="flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download as Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadReport('pdf')}
              className="flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Download as PDF
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ... (inta kale ee faylkaaga 'page.tsx' waa sidii hore)

// --- (MODIFIED) Filter Bar (Simpler) ---
const FilterBar = ({ filters, onFilterChange, onDateChange }: { 
  filters: any, 
  onFilterChange: (k: string, v: string | number) => void,
  onDateChange: (date: DateRange | undefined) => void,
}) => (
  <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
    <div className="relative flex-grow">
      <input
        type="search"
        placeholder="Search by supplier name or PO notes..."
        value={filters.searchQuery}
        onChange={(e) => onFilterChange("searchQuery", e.target.value)}
        className="w-full rounded-lg border border-gray-300 p-2.5 pl-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
    </div>
    
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <NewDateRangePicker
        date={{ 
          from: dayjs(filters.startDate).toDate(), 
          to: dayjs(filters.endDate).toDate() 
        }}
        onApply={onDateChange}
      />
      <ModernSelect
        label="Currency"
        value={CURRENCIES.find(c => c === filters.currency) || CURRENCIES[0]}
        onChange={(val: string) => onFilterChange("currency", val)}
        options={CURRENCIES}
      />
      <ModernSelect
        label="Status"
        value={STATUS_OPTIONS.find(s => s.id === filters.status) || STATUS_OPTIONS[0]}
        onChange={(val: string) => onFilterChange("status", val)}
        options={STATUS_OPTIONS}
      />
    </div>
    {/* --- Supplier Filter was removed from here --- */}
  </div>
);

const KpiCard = ({ title, value, icon: Icon, color }: any) => (
  // ... (same as before)
  <Card className="flex items-center gap-4">
    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${color.replace('text-', 'bg-')} bg-opacity-10`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <p className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  </Card>
);

const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  // ... (same as before)
  <Card className="h-80">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    <div className="mt-4 h-[280px] w-full">{children}</div>
  </Card>
);

const PurchaseTrendChart = ({ data, currency }: { data: any[], currency: string }) => {
  // ... (same as before)
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tick={{ fill: '#6b7280' }} />
        <YAxis fontSize={12} tickFormatter={(val) => formatCurrency(val, currency).replace(/\.00$/, '')} tick={{ fill: '#6b7280' }} />
        <Tooltip formatter={(value: number) => [formatCurrency(value, currency), "Purchases"]} />
        <Line type="monotone" dataKey="purchases" stroke="#8884d8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const TopSuppliersChart = ({ data, currency }: { data: { name: string, total: number }[], currency: string }) => {
  // ... (same as before)
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 30 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis type="number" fontSize={12} tick={{ fill: '#6b7280' }} />
        <YAxis dataKey="name" type="category" fontSize={12} width={80} interval={0} tick={{ width: 80, fill: '#6b7280' }} />
        <Tooltip formatter={(value: number) => [formatCurrency(value, currency), "Total Spend"]} />
        <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const PurchaseList = ({ purchases, currency, onPay, onView, onDelete }: any) => {
  // ... (same as before)
  if (!purchases || purchases.length === 0) {
    return <TableEmptyState message="No purchase orders found for these filters." />;
  }
  
  const getStatusChip = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">Paid</span>;
      case 'partially_paid':
        return <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400">Partial</span>;
      case 'pending':
      default:
        return <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/50 dark:text-orange-400">Pending</span>;
    }
  };

  return (
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-0">Supplier</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Remaining</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-0"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {purchases.map((po: any) => (
                <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-0">{po.supplierName}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{dayjs(po.purchaseDate).format("DD MMM YYYY")}</td>
                  <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(po.totalAmount, po.currency)}</td>
                  <td className="px-3 py-4 text-sm font-medium text-red-600">{formatCurrency(po.remainingAmount, po.currency)}</td>
                  <td className="px-3 py-4 text-sm">{getStatusChip(po.status)}</td>
                  <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <div className="flex justify-end gap-1">
                      {po.status !== 'paid' && (
                        <button
                          onClick={() => onPay(po)}
                          className="rounded-lg p-2 text-green-600 hover:bg-green-100 dark:hover:bg-gray-700"
                          title="Log Payment"
                        >
                          <HandCoins className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onView(po)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg p-2 text-red-600 hover:bg-red-100 dark:hover:bg-gray-700"
                        title="Delete Purchase"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Modals ---

const AddPurchaseModal = ({ onClose, onSuccess, defaultCurrency, formData, formIsLoading, formError }: {
  // ... (same as before)
  onClose: () => void,
  onSuccess: () => void,
  defaultCurrency: string,
  formData: any,
  formIsLoading: boolean,
  formError: Error | null
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [warehouse, setWarehouse] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paidAmount, setPaidAmount] = useState("0");
  const [purchaseDate, setPurchaseDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [currentQty, setCurrentQty] = useState("1");
  const [currentCost, setCurrentCost] = useState("0");
  
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const handleSelectProduct = (productId: string) => {
    if (!formData?.products) return;
    const product = formData.products.find((p: any) => p.id === productId);
    if (product) {
      setCurrentProduct(product);
      setCurrentCost(product.costPrices?.[currency] || "0");
    }
  };

  useEffect(() => {
    if (currentProduct) {
      setCurrentCost(currentProduct.costPrices?.[currency] || "0");
    }
  }, [currency, currentProduct]);
  
  const handleAddItemToCart = () => {
    // ... (same as before)
    if (!currentProduct || Number(currentQty) <= 0 || Number(currentCost) < 0) {
      alert("Invalid item details");
      return;
    }
    setCart([
      ...cart,
      {
        productId: currentProduct.id,
        productName: currentProduct.name,
        quantity: Number(currentQty),
        costPrice: Number(currentCost),
        subtotal: Number(currentQty) * Number(currentCost),
      },
    ]);
    setCurrentProduct(null);
    setCurrentQty("1");
    setCurrentCost("0");
  };
  
  const handleDeleteItem = (productId: string) => {
    // ... (same as before)
    setCart(cart.filter(item => item.productId !== productId));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    // ... (same as before)
    e.preventDefault();
    if (!supplier || !warehouse || cart.length === 0) {
      alert("Please select supplier, warehouse, and add at least one item.");
      return;
    }
    setIsSaving(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const payload = {
        supplier: { id: supplier.id, name: supplier.name },
        warehouse: { id: warehouse.id, name: warehouse.name },
        items: cart,
        currency,
        totalAmount,
        paidAmount: Number(paidAmount),
        purchaseDate,
        dueDate,
        notes,
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save purchase.");
      }
      onSuccess();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title="Add New Purchase Order" onClose={onClose}>
      {formIsLoading && <LoadingSpinner />}
      {formError && <ErrorDisplay error={formError} />}
      {formData && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormSelect label="Supplier" value={supplier?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplier(formData.suppliers.find((s:any) => s.id === e.target.value))} required>
              {formData.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FormSelect>
            <FormSelect label="Add Stock to Warehouse" value={warehouse?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWarehouse(formData.warehouses.find((w:any) => w.id === e.target.value))} required>
              {formData.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </FormSelect>
          </div>
          
          <div className="rounded-lg border p-3 dark:border-gray-700">
            <h4 className="font-medium dark:text-white">Add Items</h4>
            <div className="mt-2 grid grid-cols-1 items-end gap-2 md:grid-cols-4">
              <FormSelect label="Product" value={currentProduct?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSelectProduct(e.target.value)} className="md:col-span-2">
                {formData.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FormSelect>
              <FormInput label="Quantity" type="number" value={currentQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentQty(e.target.value)} />
              <FormInput label="Cost Price" type="number" value={currentCost} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentCost(e.target.value)} />
            </div>
            <button type="button" onClick={handleAddItemToCart} className="mt-2 w-full rounded-lg bg-blue-100 p-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
              Add Item
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto space-y-2">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-gray-700">
                <div>
                  <p className="font-medium dark:text-white">{item.productName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.quantity} x {formatCurrency(item.costPrice, currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-medium dark:text-white">{formatCurrency(item.subtotal, currency)}</p>
                  <button type="button" onClick={() => handleDeleteItem(item.productId)} className="text-red-500">
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput label="Purchase Date" type="date" value={purchaseDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPurchaseDate(e.target.value)} required />
            <FormInput label="Payment Due Date (Optional)" type="date" value={dueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormSelect label="Currency" value={currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value)} required>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </FormSelect>
            <FormInput label="Total Amount" type="number" value={totalAmount} onChange={() => {}} readOnly />
            <FormInput label="Amount Paid Now" type="number" value={paidAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaidAmount(e.target.value)} />
          </div>
          
          <FormInput label="Notes (Optional)" name="notes" value={notes} onChange={(e:any) => setNotes(e.target.value)} />
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex min-w-[120px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Purchase"}
            </button>
          </div>
        </form>
      )}
    </ModalBase>
  );
};

const PayPurchaseModal = ({ purchase, onClose, onSuccess }: any) => {
  // ... (same as before)
  const [amountPaid, setAmountPaid] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const remaining = purchase.remainingAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmount = parseFloat(amountPaid);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmount > remaining) {
      setError("Payment cannot be more than the remaining amount due.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/purchases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purchaseId: purchase.id, paymentAmount: paidAmount }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment.");
      }
      onSuccess();
      
    } catch (err: any) { 
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title={`Log Payment for PO ${purchase.id.substring(0, 6)}...`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Remaining Amount Due:</p>
          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
            {formatCurrency(remaining, purchase.currency)}
          </p>
        </div>
        
        <FormInput
          label="Amount to Pay"
          name="amountPaid"
          type="number"
          value={amountPaid}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountPaid(e.target.value)}
          required
        />
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Payment"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};


// -----------------------------------------------------------------------------
// 🛠️ Reusable Helper Components
// -----------------------------------------------------------------------------

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  // ... (same as before)
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const TotalRow = ({ label, value, isDebt = false, isBold = false }: { label: string, value: string, isDebt?: boolean, isBold?: boolean }) => (
  // ... (same as before)
  <div className={`flex justify-between text-sm ${isBold ? 'font-semibold' : ''} ${isDebt ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
    <span className="text-gray-600 dark:text-gray-300">{label}:</span>
    <span className={isBold ? 'text-lg' : ''}>{value}</span>
  </div>
);


const LoadingSpinner = () => (
  // ... (same as before)
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  // ... (same as before)
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Data</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

const ChartEmptyState = () => (
  // ... (same as before)
  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
    <BarChart2 className="h-12 w-12 opacity-50" />
    <p className="mt-2 text-sm">No data for this period</p>
  </div>
);

const TableEmptyState = ({ message }: { message: string }) => (
  // ... (same as before)
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);

const ModalBase = ({ title, onClose, children, size = 'lg' }: { 
  // ... (same as before)
  title: string, 
  onClose: () => void, 
  children: React.ReactNode,
  size?: 'lg' | 'md' | 'xl'
}) => {
  const sizeClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };
  
  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800`}>
                <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </Dialog.Title>
                  <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-6 max-h-[70vh] overflow-y-auto pr-2">{children}</div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// --- (MODIFIED) View Purchase Modal ---
const ViewPurchaseModal = ({ purchase, onClose }: { purchase: any, onClose: () => void }) => {
  const currency = purchase.currency;
  
  return (
    <ModalBase title={`Purchase Order: ${purchase.id.substring(0, 6)}...`} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <InfoItem icon={Building} label="Supplier" value={purchase.supplierName} />
          <InfoItem icon={Calendar} label="Purchase Date" value={dayjs(purchase.purchaseDate).format("DD MMM YYYY")} />
          <InfoItem icon={Warehouse} label="Warehouse" value={purchase.warehouseName} />
        </div>
        
        {/* Items Table */}
        <div>
          <h4 className="text-lg font-semibold dark:text-white">Items Purchased</h4>
          {/* ... (table is same as before) ... */}
          <div className="mt-2 flow-root">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="py-2 pl-4 text-left text-xs font-medium uppercase text-gray-500">Product</th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500">Qty</th>
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500">Cost</th>
                  <th className="py-2 pr-4 text-right text-xs font-medium uppercase text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {purchase.items.map((item: any) => (
                  <tr key={item.productId}>
                    <td className="py-2 pl-4 text-sm font-medium dark:text-white">{item.productName}</td>
                    <td className="px-2 py-2 text-sm dark:text-gray-300">{item.quantity}</td>
                    <td className="px-2 py-2 text-sm dark:text-gray-300">{formatCurrency(item.costPrice, currency)}</td>
                    <td className="py-2 pr-4 text-right text-sm font-medium dark:text-white">{formatCurrency(item.subtotal, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2 rounded-lg border p-4 dark:border-gray-700">
            <h4 className="font-semibold dark:text-white">Financial Summary</h4>
            <TotalRow label="Total Amount" value={formatCurrency(purchase.totalAmount, currency)} isBold={true} />
            <TotalRow label="Amount Paid" value={formatCurrency(purchase.paidAmount, currency)} />
            <TotalRow 
              label="Remaining Due" 
              value={formatCurrency(purchase.remainingAmount, currency)} 
              isDebt={purchase.remainingAmount > 0}
              isBold={true} 
            />
          </div>
          <div className="space-y-2 rounded-lg border p-4 dark:border-gray-700">
            <h4 className="font-semibold dark:text-white">Details</h4>
            <InfoItem icon={Info} label="Status" value={purchase.status} />
            <InfoItem icon={CreditCard} label="Currency" value={purchase.currency} />
            {/* --- (FIX) Replaced Payment Due (Date) with Amount Due (Amount) --- */}
            <InfoItem 
              icon={HandCoins} 
              label="Amount Due" 
              value={formatCurrency(purchase.remainingAmount, currency)} 
            />
          </div>
        </div>
        
        {purchase.notes && (
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <h4 className="font-semibold dark:text-white">Notes</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">{purchase.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Close</button>
          <button 
            type="button" 
            onClick={() => alert("Download PDF/Excel (coming soon)")}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

// Helper for ViewPurchaseModal
const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) => (
  // ... (same as before)
  <div>
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <p className="mt-1 text-gray-900 dark:text-white">{value || 'N/A'}</p>
  </div>
);


// --- Modern, Styled Form Components ---
const StyledInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  // ... (same as before)
  <input
    {...props}
    ref={ref}
    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
  />
));
StyledInput.displayName = "StyledInput";

const StyledSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ children, ...props }, ref) => (
  // ... (same as before)
  <select
    {...props}
    ref={ref}
    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
  >
    {children}
  </select>
));
StyledSelect.displayName = "StyledSelect";

const FormInput = ({ label, name, ...props }: any) => (
  // ... (same as before)
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <StyledInput id={name} name={name} {...props} />
  </div>
);

const FormSelect = ({ label, name, children, ...props }: any) => (
  // ... (same as before)
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <StyledSelect id={name} name={name} {...props}>
      <option value="" disabled>-- Select --</option>
      {children}
    </StyledSelect>
  </div>
);


// --- Modern Date Range Picker (with Presets moved) ---
function NewDateRangePicker({
  date,
  onApply,
  className,
}: {
  date: { from: Date, to: Date };
  onApply: (date: DateRange | undefined) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(date?.from || new Date());
  const [selectedDate, setSelectedDate] = useState<DateRange | undefined>(date);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);

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
    if (!open) handleCancel(); 
    setIsOpen(open);
  };
  
  const handleDayClick = (day: Date) => {
    // ... (same as before)
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

  const handlePresetSelect = (range: DateRange) => {
    setSelectedDate(range);
    setCurrentMonth(range.from || new Date());
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
              (displayedDate.to) ? (
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
        <PopoverContent className="flex w-auto p-0 bg-white dark:bg-gray-800 border dark:border-gray-700" align="start">
          {/* --- Date Presets Component --- */}
          <DatePresets onSelect={handlePresetSelect} />
          <div className="border-l dark:border-gray-700">
            <CalendarGrid
              month={currentMonth}
              selectedDate={selectedDate}
              onDayClick={handleDayClick}
              hoveredDate={hoveredDate}
              setHoveredDate={setHoveredDate}
              onMonthChange={setCurrentMonth}
            />
            <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-600">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// --- (Date Presets Component - Unchanged) ---
function DatePresets({ onSelect }: { onSelect: (range: DateRange) => void }) {
  return (
    <div className="flex flex-col gap-1 p-3">
      {PRESETS.map(({ label, range }) => (
        <Button
          key={label}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => onSelect(range)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}


function CalendarGrid({
  month,
  selectedDate,
  onDayClick,
  hoveredDate,
  setHoveredDate,
  onMonthChange,
}: {
  // ... (same as before)
  month: Date;
  selectedDate: DateRange | undefined;
  onDayClick: (date: Date) => void;
  hoveredDate: Date | undefined;
  setHoveredDate: (date: Date | undefined) => void;
  onMonthChange: (date: Date) => void;
}) {
  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const startDate = startOfWeek(firstDay);
  const endDate = endOfWeek(lastDay);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  
  const nextMonth = () => onMonthChange(add(month, { months: 1 }));
  const prevMonth = () => onMonthChange(sub(month, { months: 1 }));

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-semibold dark:text-white">
          {format(month, "MMMM yyyy")}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
              onClick={() => onDayClick(day)}
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

// --- Modern Select/Dropdown Component (Unchanged) ---
function ModernSelect({ label, value, onChange, options }: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  options: any[];
}) {
  const [selected, setSelected] = useState(options.find(o => (o.id || o) === (value?.id || value)) || options[0]);

  // (FIX) Handle external value changes
  useEffect(() => {
    setSelected(options.find(o => (o.id || o) === (value?.id || value)) || options[0]);
  }, [value, options]);

  const handleChange = (newValue: any) => {
    setSelected(newValue);
    onChange(newValue.id || newValue);
  };
  
  const displayValue = (val: any) => val.label || val;

  return (
    <Listbox value={selected} onChange={handleChange}>
      <div className="relative">
        <Listbox.Label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Listbox.Label>
        <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-left text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <span className="block truncate">{displayValue(selected)}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronsUpDown
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800">
            {options.map((option, idx) => (
              <Listbox.Option
                key={idx}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-blue-100 text-blue-900 dark:bg-blue-700 dark:text-blue-100' : 'text-gray-900 dark:text-gray-200'
                  }`
                }
                value={option}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? 'font-medium' : 'font-normal'
                      }`}
                    >
                      {displayValue(option)}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-300">
                        <Check className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}