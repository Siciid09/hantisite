// File: app/(main)/debts/page.tsx
// Description: Main Debts Management screen for the web.
// --- FINAL VERSION (Refactored to match server-side PDF system) ---
// 1. (REMOVED) All @react-pdf/renderer and file-saver imports.
// 2. (NEW) Added imports for Popover, Button, etc., from purchases/page.tsx.
// 3. (NEW) Added a 'DebtReportPopover' component.
// 4. (NEW) Download button now opens this popover, which calls the /api/debts API.
// 5. (REMOVED) All client-side PDF components (DebtListReport, pdfStyles, etc.).
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useMemo, useEffect, Fragment } from "react";
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
  Tag, ChevronsUpDown, ArrowDown, ArrowUp, Eye,UserPlus,UserCheck,
  FileDown, HandCoins, SlidersHorizontal, AlertCircle, Check,
  // (NEW) Imports from purchases/page.tsx
  Download, ChevronDown, FileSpreadsheet, FileText,
  Calendar as CalendarIconLucide,
} from "lucide-react";

// --- (NEW) Helpers for Modern UI (from purchases/page.tsx) ---
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
  if (amount == null) return "N/A";
  
  const nonDecimalCurrencies = ["SLSH", "SOS", "KSH", "Birr"];
  if (nonDecimalCurrencies.includes(currency)) {
    return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------

export default function DebtsPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DebtsPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📝 Main Debts Page Component
// -----------------------------------------------------------------------------

function DebtsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();

  // --- State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<any | null>(null);
  const [selectedDebts, setSelectedDebts] = useState<string[]>([]);
  
  // --- UI Error & Success State ---
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteModalDebt, setDeleteModalDebt] = useState<any | null>(null);

  // --- (REMOVED) PDF Generation State ---
  // const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // --- Filters ---
  const [filters, setFilters] = useState({
    currency: searchParams.get("currency") || "USD",
    startDate: searchParams.get("startDate") || dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: searchParams.get("endDate") || dayjs().endOf("day").format("YYYY-MM-DD"),
    searchQuery: searchParams.get("searchQuery") || "",
    searchBy: searchParams.get("searchBy") || "clientName",
    statusFilter: searchParams.get("statusFilter") || "unpaid",
    tagFilter: searchParams.get("tagFilter") || "all",
    paymentMethod: searchParams.get("paymentMethod") || "all",
    minAmount: searchParams.get("minAmount") || "",
    maxAmount: searchParams.get("maxAmount") || "",
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortDir: searchParams.get("sortDir") || "desc",
    page: parseInt(searchParams.get("page") || "1"),
  });

  // --- SWR Data Fetching ---
  const buildUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    return `/api/debts?${params.toString()}`;
  };

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(!authLoading && user ? buildUrl() : null, fetcher);

  // --- (NEW) Fetch form data (customers) for the report popover ---
  const {
    data: formData,
    error: formError,
    isLoading: formIsLoading,
  } = useSWR(
    !authLoading && user ? "/api/customers?tab=list" : null,
    fetcher
  );

  const isLoading = authLoading || dataIsLoading || (formIsLoading && !formData);
  const mainError = error || formError;

  // --- Handlers ---
  const handleFilterChange = (key: string, value: string | number) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
      else params.delete(k);
    });
    router.push(`/debts?${params.toString()}`);
  };
  
  const handleSort = (newSortBy: string) => {
    const newSortDir = (filters.sortBy === newSortBy && filters.sortDir === 'desc') ? 'asc' : 'desc';
    handleFilterChange("sortBy", newSortBy);
    handleFilterChange("sortDir", newSortDir);
  };

  const handlePageChange = (newPage: number) => {
    handleFilterChange("page", newPage);
  };
  
  // Unified success handler
  const handleActionSuccess = (message: string) => {
    mutate(); // Re-fetch data
    setIsAddModalOpen(false);
    setIsPayModalOpen(null);
    setIsViewModalOpen(null);
    setDeleteModalDebt(null);
    setSelectedDebts([]);
    setToastMessage(message); // Show success toast!
  };

  // (REMOVED) handleDownloadPdf function
  // const handleDownloadPdf = async () => { ... };

  // --- Bulk Action Handlers ---
  const handleBulkDelete = async () => {
    if (selectedDebts.length === 0) return;
    const confirmed = prompt(`Type DELETE to confirm deleting ${selectedDebts.length} records.`);
    if (confirmed !== "DELETE") {
      return;
    }
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      for (const debtId of selectedDebts) {
        await fetch(`/api/debts/${debtId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      handleActionSuccess(`${selectedDebts.length} debts deleted.`);
    } catch (err: any) {
      setGlobalError(`Error during bulk delete: ${err.message}`);
    }
  };

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 dark:bg-gray-900 md:p-8">
      {/* --- Global Toast & Error Popups --- */}
      <GlobalSuccessToast message={toastMessage} onClose={() => setToastMessage(null)} />
      <GlobalErrorPopup error={globalError} onClose={() => setGlobalError(null)} />

      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Debts Management</h1>
        {/* --- (NEW) Download Button Added (like purchases page) --- */}
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
          <DebtReportPopover
            formData={{ customers: formData }} // Pass customer list
            formIsLoading={formIsLoading}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add New Debt
          </button>
        </div>
      </header>

      {/* --- 🔍 Filters / Search Bar --- */}
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {isLoading && <LoadingSpinner />}
      {mainError && !apiData && <ErrorDisplay error={mainError as Error} />}
      
      {apiData && (
        <div className="space-y-6">
          {/* --- 💰 KPIs --- */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <KpiCard
              title="Total Unpaid Debts"
              value={formatCurrency(apiData.kpis.totalUnpaid, filters.currency)}
              icon={AlertOctagon}
              color="text-orange-500"
            />
            <KpiCard
              title="Total Debts Paid"
              value={formatCurrency(apiData.kpis.totalPaid, filters.currency)}
              icon={CheckCircle}
              color="text-green-500"
            />
          </div>

          {/* --- 💥 Bulk Actions Bar --- */}
          {selectedDebts.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-medium text-gray-900 dark:text-white">{selectedDebts.length} debt(s) selected</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                  <button className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                    <FileDown className="h-4 w-4" /> Export CSV
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* --- 🧠 Smart Alerts --- */}
          <SmartAlerts alerts={apiData.smartAlerts} />

          {/* --- 📈 Charts --- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Paid vs. Unpaid">
              <PaidVsUnpaidPie data={apiData.charts.paidVsUnpaid} />
            </ChartCard>
            <ChartCard title="Top 5 Creditors (Unpaid)">
              <TopCreditorsChart data={apiData.charts.topCreditors} />
            </ChartCard>
            <ChartCard title="Monthly Debt Trend (New vs. Paid)">
              <MonthlyDebtTrend data={apiData.charts.monthlyTrend} />
            </ChartCard>
            <ChartCard title="Total Debt by Currency (Unpaid)">
              <TotalByCurrencyChart data={apiData.charts.byCurrency} />
            </ChartCard>
          </div>
          
          {/* --- 📊 Debts List --- */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Debt Records</h3>
            <DebtList
              debts={apiData.debtRecords}
              currency={filters.currency}
              filters={filters}
              onSort={handleSort}
              onPay={setIsPayModalOpen}
              onDelete={setDeleteModalDebt}
              onView={setIsViewModalOpen}
              selectedDebts={selectedDebts}
              setSelectedDebts={setSelectedDebts}
            />
            <Pagination
              currentPage={apiData.pagination.currentPage}
              totalPages={apiData.pagination.totalPages}
              onPageChange={handlePageChange}
              totalRecords={apiData.pagination.totalRecords}
              totalAmount={apiData.pagination.totalAmountForFilter}
              currency={filters.currency}
            />
          </Card>
        </div>
      )}

      {/* --- Modals --- */}
      {isAddModalOpen && (
        <AddDebtModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleActionSuccess}
          defaultCurrency={filters.currency}
          setGlobalError={setGlobalError}
        />
      )}
      {isPayModalOpen && (
        <PayDebtModal
          debt={isPayModalOpen}
          onClose={() => setIsPayModalOpen(null)}
          onSuccess={handleActionSuccess}
          setGlobalError={setGlobalError}
        />
      )}
      {isViewModalOpen && (
        <ViewDebtModal
          debt={isViewModalOpen}
          onClose={() => setIsViewModalOpen(null)}
          onPay={setIsPayModalOpen}
        />
      )}
      {deleteModalDebt && (
        <ConfirmDeleteModal
          debt={deleteModalDebt}
          onClose={() => setDeleteModalDebt(null)}
          onSuccess={handleActionSuccess}
          setGlobalError={setGlobalError}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

// --- (NEW) DebtReportPopover (Adapted from purchases/page.tsx) ---
const PRESETS = [
  { label: "Last 7 Days", range: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) } },
  { label: "Last 30 Days", range: { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) } },
  { label: "This Month", range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
  { label: "Last Month", range: { from: startOfMonth(sub(new Date(), { months: 1 })), to: endOfMonth(sub(new Date(), { months: 1 })) } },
];
function DebtReportPopover({ formData, formIsLoading }: {
  formData: any,
  formIsLoading: boolean
}) {
  const [reportRange, setReportRange] = useState<DateRange | undefined>(PRESETS[1].range);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerFilterOn, setCustomerFilterOn] = useState(false);
  const [query, setQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Use 'formData.customers' instead of 'formData.suppliers'
  const customers = formData?.customers || [];
  const filteredCustomers =
    query === ''
      ? customers
      : customers.filter((customer: any) =>
          customer.name.toLowerCase().includes(query.toLowerCase())
        );
  
  const handleCustomerToggle = (isOn: boolean) => {
    setCustomerFilterOn(isOn);
    if (!isOn) { setSelectedCustomer(null); }
  };
  
  // This function now calls the /api/debts endpoint
  const handleDownloadReport = async (reportType: 'excel' | 'pdf') => {
    setIsDownloading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const params = new URLSearchParams({
        action: 'download', // Standard action
        format: reportType === 'excel' ? 'csv' : 'pdf',
        startDate: reportRange?.from ? format(reportRange.from, "yyyy-MM-dd") : '',
        endDate: reportRange?.to ? format(reportRange.to, "yyyy-MM-dd") : '',
        // Use 'customerId' instead of 'supplierId'
        customerId: customerFilterOn && selectedCustomer ? selectedCustomer.id : '',
      });
      
      // Call /api/debts
      const reportUrl = `/api/debts?${params.toString()}`;
      
      const res = await fetch(reportUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to download report.");
      }
      
      const blob = await res.blob();
      const filename = `debts_${customerFilterOn && selectedCustomer ? selectedCustomer.name.replace(' ','_') : 'all'}_${dayjs().format('YYYYMMDD')}.${reportType === 'excel' ? 'csv' : 'pdf'}`;
      
      // Use file-saver logic (same as purchases page)
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error("Download failed:", error);
      alert(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex w-full items-center justify-center gap-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700">
          <Download className="h-4 w-4" />
          Download Report
          <ChevronDown className="-mr-1 ml-1 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white p-4 dark:bg-gray-800" align="end">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Report Period
            </label>
           <NewDateRangePicker date={reportRange} onApply={setReportRange} />
          </div>
          
          {/* Filter by Customer */}
          <div className="space-y-3 rounded-lg border p-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Filter by Customer</span>
              <Switch checked={customerFilterOn} onChange={handleCustomerToggle}
                className={`${customerFilterOn ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}>
                <span className="sr-only">Filter by customer</span>
                <span aria-hidden="true"
                  className={`${customerFilterOn ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
            </div>
            {customerFilterOn && (
              <Combobox value={selectedCustomer} onChange={setSelectedCustomer}>
                <div className="relative">
                  <Combobox.Input
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    displayValue={(customer: any) => customer?.name || ""}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search for a customer..."
                    autoComplete="off"
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronsUpDown className="h-5 w-5 text-gray-400" />
                  </Combobox.Button>
                  <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0" afterLeave={() => setQuery('')}>
                    <Combobox.Options className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800">
                      {formIsLoading && <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>}
                      {filteredCustomers.map((customer: any) => (
                        <Combobox.Option key={customer.id} value={customer} as={Fragment}>
                          {({ active, selected }) => (
                            <li className={cn('relative cursor-default select-none py-2 pl-10 pr-4', active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200')}>
                              {selected && <Check className="absolute left-3 top-2.5 h-5 w-5" />}
                              <span className={cn('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                {customer.name}
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
          
          {/* Download Buttons */}
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDownloadReport('excel')} disabled={isDownloading} className="flex items-center justify-center gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download as Excel"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownloadReport('pdf')} disabled={isDownloading} className="flex items-center justify-center gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download as PDF"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


// --- (NEW) Global Error & Success Components ---
const GlobalErrorPopup = ({ error, onClose }: { error: string | null, onClose: () => void }) => {
  if (!error) return null;
  return (
    <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-red-600 p-4 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm font-medium">{error}</span>
        <button onClick={onClose} className="ml-4 rounded-full p-1 hover:bg-red-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const GlobalSuccessToast = ({ message, onClose }: { message: string | null, onClose: () => void }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 3000); // Auto-dismiss after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-green-600 p-4 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <Check className="h-5 w-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

// --- ENHANCED FILTER BAR ---
const FilterBar = ({ filters, onFilterChange }: { filters: any, onFilterChange: (k: string, v: string | number) => void }) => (
  <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
    <div className="flex flex-col gap-2 md:flex-row">
      <div className="flex-shrink-0">
        <select
          value={filters.searchBy}
          onChange={(e) => onFilterChange("searchBy", e.target.value)}
          className="h-full w-full rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="clientName">Name</option>
          <option value="clientPhone">Phone</option>
          <option value="clientWhatsapp">WhatsApp</option>
          <option value="reason">Reason</option>
          <option value="saleId">Sale ID</option>
        </select>
      </div>
      <div className="relative flex-grow">
        <input
          type="search"
          placeholder={`Search by ${filters.searchBy}...`}
          value={filters.searchQuery}
          onChange={(e) => onFilterChange("searchQuery", e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2.5 pl-10 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <select
        value={filters.currency}
        onChange={(e) => onFilterChange("currency", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        <option value="USD">USD</option>
        <option value="SLSH">SLSH</option>
        <option value="SOS">SOS</option>
        <option value="Birr">Birr</option>
        <option value="KSH">KSH</option>
        <option value="Euro">Euro</option>
      </select>
      <select
        value={filters.statusFilter}
        onChange={(e) => onFilterChange("statusFilter", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid</option>
        <option value="partial">Partial</option>
        <option value="all">All</option>
      </select>
      <select
        value={filters.tagFilter}
        onChange={(e) => onFilterChange("tagFilter", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        <option value="all">All Tags</option>
        <option value="Urgent">Urgent</option>
        <option value="Wholesale">Wholesale</option>
        <option value="Repeat Customer">Repeat Customer</option>
      </select>
      <select
        value={filters.paymentMethod}
        onChange={(e) => onFilterChange("paymentMethod", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        <option value="all">All Methods</option>
        <option value="Cash">Cash</option>
        <option value="ZAAD">ZAAD</option>
        <option value="EDAHAB">EDAHAB</option>
        <option value="Bank">Bank</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <input
        type="date"
        value={filters.startDate}
        onChange={(e) => onFilterChange("startDate", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <input
        type="date"
        value={filters.endDate}
        onChange={(e) => onFilterChange("endDate", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <input
        type="number"
        placeholder="Min Amount"
        value={filters.minAmount}
        onChange={(e) => onFilterChange("minAmount", e.target.value)}
        className="w-full flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      <input
        type="number"
        placeholder="Max Amount"
        value={filters.maxAmount}
        onChange={(e) => onFilterChange("maxAmount", e.target.value)}
        className="w-full flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
    </div>
  </div>
);

const KpiCard = ({ title, value, icon: Icon, color }: any) => (
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

const SmartAlerts = ({ alerts }: { alerts: { message: string, type: string }[] }) => {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div key={i} className={`flex items-center gap-3 rounded-lg p-4 ${
          alert.type === 'success'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
            : 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
        }`}>
          {alert.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertOctagon className="h-5 w-5" />}
          <p className="text-sm font-medium">{alert.message}</p>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <Card className="h-80">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    <div className="mt-4 h-[280px] w-full">{children}</div>
  </Card>
);

const PaidVsUnpaidPie = ({ data }: { data: { name: string, value: number }[] }) => {
  const COLORS = { "Unpaid": "#f97316", "Paid (Collected)": "#22c55e", "Partial": "#eab308" };
  if (!data || data.every(d => d.value === 0)) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
          {data.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS] || "#8884d8"} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name, props) => [formatCurrency(value as number, "USD"), name]} /> 
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

const TopCreditorsChart = ({ data }: { data: { name: string, totalDebt: number }[] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 30 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis type="number" fontSize={12} />
        <YAxis dataKey="name" type="category" fontSize={12} width={80} interval={0} tick={{ width: 80, fill: '#9ca3af' }} />
        <Tooltip formatter={(value, name, props) => [formatCurrency(value as number, "USD"), name]} />
        <Bar dataKey="totalDebt" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const MonthlyDebtTrend = ({ data }: { data: { name: string, outstanding: number, collected: number }[] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="name" fontSize={12} tick={{ fill: '#9ca3af' }} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} />
        <Tooltip formatter={(value, name, props) => [formatCurrency(value as number, "USD"), name]} />
        <Legend />
        <Line type="monotone" dataKey="outstanding" stroke="#f97316" name="New Debt" />
        <Line type="monotone" dataKey="collected" stroke="#22c55e" name="Debt Paid" />
      </LineChart>
    </ResponsiveContainer>
  );
};

const TotalByCurrencyChart = ({ data }: { data: { name: string, total: number }[] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="name" fontSize={12} tick={{ fill: '#9ca3af' }} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} />
        <Tooltip formatter={(value, name, props) => [formatCurrency(value as number, props.payload.name), "Total"]} />
        <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// --- ENHANCED DEBT LIST ---
const DebtListHeader = ({ filters, onSort, selectedDebts, onSelectAll }: any) => {
  const SortIcon = ({ name }: { name: string }) => {
    if (filters.sortBy !== name) return <ChevronsUpDown className="h-4 w-4" />;
    return filters.sortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;
  };

  return (
    <thead className="bg-gray-50 dark:bg-gray-700">
      <tr>
        <th scope="col" className="px-4 py-3.5">
          <input
            type="checkbox"
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800"
            checked={selectedDebts.all}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
        </th>
        <th scope="col" className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
          <button onClick={() => onSort('clientName')} className="flex items-center gap-1">
            Customer <SortIcon name="clientName" />
          </button>
        </th>
        <th scope="col" className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
          <button onClick={() => onSort('amountDue')} className="flex items-center gap-1">
            Amount <SortIcon name="amountDue" />
          </button>
        </th>
        <th scope="col" className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
          <button onClick={() => onSort('createdAt')} className="flex items-center gap-1">
            Date <SortIcon name="createdAt" />
          </button>
        </th>
        <th scope="col" className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
          Status
        </th>
        <th scope="col" className="px-6 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
          Actions
        </th>
      </tr>
    </thead>
  );
};

const DebtList = ({ debts, currency, filters, onSort, onPay, onDelete, onView, selectedDebts, setSelectedDebts }: any) => {
  
  const handleSelect = (id: string) => {
    if (selectedDebts.includes(id)) {
      setSelectedDebts(selectedDebts.filter((i: string) => i !== id));
    } else {
      setSelectedDebts([...selectedDebts, id]);
    }
  };

  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedDebts(debts.map((d: any) => d.id));
    } else {
      setSelectedDebts([]);
    }
  };

  if (!debts || debts.length === 0) {
    return <TableEmptyState message="No debt records found for these filters." />;
  }

  return (
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <DebtListHeader
              filters={filters}
              onSort={onSort}
              selectedDebts={{
                all: selectedDebts.length === debts.length && debts.length > 0,
              }}
              onSelectAll={handleSelectAll}
            />
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {debts.map((debt: any) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  currency={currency}
                  onPay={onPay}
                  onDelete={onDelete}
                  onView={onView}
                  isSelected={selectedDebts.includes(debt.id)}
                  onSelect={handleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DebtCard = ({ debt, currency, onPay, onDelete, onView, isSelected, onSelect }: any) => {
  
  const startDelete = () => {
    onDelete(debt); // This now opens the ConfirmDeleteModal
  };
  
  const status = debt.isPaid ? 'paid' : (debt.status === 'partial' ? 'partial' : 'unpaid');
  
  const statusColors: { [key: string]: string } = {
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
    unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  };
  
  const rowColors: { [key: string]: string } = {
    paid: "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20",
    partial: "bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
    unpaid: "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20",
  }

  return (
    <tr className={rowColors[status]}>
      <td className="px-4 py-4">
        <input
          type="checkbox"
          className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800"
          checked={isSelected}
          onChange={() => onSelect(debt.id)}
        />
      </td>
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900 dark:text-white">{debt.clientName}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{debt.clientPhone}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {debt.tags?.map((tag: string) => (
            <span key={tag} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className={`text-lg font-bold ${status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(debt.amountDue, currency)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{debt.reason}</div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {dayjs(debt.createdAt).format("DD MMM YYYY")}
      </td>
      <td className="px-6 py-4">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[status]}`}>
          {status}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onView(debt)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
      {!debt.isPaid && (
            <button
              onClick={() => onPay(debt)}
              className="rounded-lg p-2 text-green-600 hover:bg-green-100 dark:hover:bg-gray-700"
              title="Record Payment"
            >
              <CreditCard className="h-4 w-4" />
            </button>
          )}
          <a
            href={`https://wa.me/${debt.clientWhatsapp || debt.clientPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-green-500 hover:bg-green-100 dark:hover:bg-gray-700"
            title="Send WhatsApp"
          >
            <MessageSquare className="h-4 w-4" />
          </a>
          <a
            href={`tel:${debt.clientPhone}`}
            className="rounded-lg p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-gray-700"
            title="Call Customer"
          >
            <Phone className="h-4 w-4" />
          </a>
          <button
            onClick={startDelete}
            className="rounded-lg p-2 text-red-600 hover:bg-red-100 dark:hover:bg-gray-700"
            title="Delete Debt"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// --- Modals ---

const AddDebtModal = ({ onClose, onSuccess, defaultCurrency, setGlobalError }: any) => {
  const [customerMode, setCustomerMode] = useState<'select' | 'new'>('select');
  
  const { 
    data: customersData, 
    error: customersError 
  } = useSWR('/api/customers?tab=list', fetcher);
  const customers = customersData || [];

  const [formData, setFormData] = useState({
    customerId: "",
    clientName: "",
    clientPhone: "",
    clientWhatsapp: "",
    amountDue: "",
    reason: "",
    currency: defaultCurrency,
    tags: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(""); // Local form validation error

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    if (!customerId) {
      setFormData({
        ...formData,
        customerId: "",
        clientName: "",
        clientPhone: "",
        clientWhatsapp: "",
      });
      return;
    }
    
    const selectedCustomer = customers.find((c: any) => c.id === customerId);
    if (selectedCustomer) {
      setFormData({
        ...formData,
        customerId: selectedCustomer.id,
        clientName: selectedCustomer.name,
        clientPhone: selectedCustomer.phone,
        clientWhatsapp: selectedCustomer.whatsapp || selectedCustomer.phone,
      });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.clientPhone || !formData.amountDue || !formData.reason) {
      setError("Please fill in all required fields: Customer, Phone, Amount, and Reason.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const payload = {
        ...formData,
        customerId: customerMode === 'select' ? formData.customerId : null,
        tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      };
      
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save debt.");
      }
      
      onSuccess("Debt added successfully!");
      
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getOwedAmount = (customer: any) => {
    if (!customer.totalOwed || !customer.totalOwed[formData.currency]) {
      return formatCurrency(0, formData.currency);
    }
    return formatCurrency(customer.totalOwed[formData.currency], formData.currency);
  };

  return (
    <ModalBase title={"Add New Debt"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Customer Details</h3>
              <button
                type="button"
                onClick={() => setCustomerMode(customerMode === 'select' ? 'new' : 'select')}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:opacity-80 dark:text-blue-400"
              >
                {customerMode === 'select' ? (
                  <> <UserPlus className="h-4 w-4" /> Add New Customer </>
                ) : (
                  <> <UserCheck className="h-4 w-4" /> Select Existing </>
                )}
              </button>
          </div>
          
          {customerMode === 'select' ? (
            <FormSelect
              label="Select Existing Customer"
              name="customerId"
              onChange={handleCustomerSelect}
              value={formData.customerId}
            >
              <option value="">-- Select a customer --</option>
              {customersError && <option disabled>Error loading customers</option>}
              {!customersError && customers.length === 0 && <option disabled>No customers found</option>}
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - (Owes: {getOwedAmount(customer)})
                </option>
              ))}
            </FormSelect>
          ) : (
             <p className="text-sm text-gray-500 mb-2">
              Enter new customer details:
             </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
            <FormInput
              label="Customer Name"
              name="clientName"
              value={formData.clientName}
             onChange={handleChange}
              disabled={customerMode === 'select'}
              required
            />
            <FormInput
              label="Customer Phone"
              name="clientPhone"
              value={formData.clientPhone}
            onChange={handleChange}
              disabled={customerMode === 'select'}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Customer WhatsApp (Optional)" name="clientWhatsapp" value={formData.clientWhatsapp} onChange={handleChange} />
          <FormInput label="Reason for Debt" name="reason" value={formData.reason}onChange={handleChange} required />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Amount Due" name="amountDue" type="number" value={formData.amountDue} onChange={handleChange} required />
          <FormSelect label="Currency" name="currency" value={formData.currency} onChange={handleChange}>
            <option value="USD">USD</option>
            <option value="SLSH">SLSH</option>
            <option value="SOS">SOS</option>
            <option value="Birr">Birr</option>
            <option value="KSH">KSH</option>
            <option value="Euro">Euro</option>
          </FormSelect>
        </div>
                
        <div className="grid grid-cols-1">
           <FormInput label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange}placeholder="Urgent, Wholesale..." />
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

const ViewDebtModal = ({ debt, onClose, onPay }: any) => {
  const history = debt.paymentHistory || [];
  const isLoading = false;
  const error = null;

  return (
    <ModalBase title="Debt Details" onClose={onClose}>
      <div className="space-y-4">
        {/* Customer Info */}
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Customer</h4>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{debt.clientName}</p>
          <p className="text-gray-600 dark:text-gray-400">{debt.clientPhone}</p>
          <p className="text-gray-600 dark:text-gray-400">{debt.clientWhatsapp}</p>
        </div>
        
        {/* Debt Info */}
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Debt Info</h4>
          <p className={`text-3xl font-bold ${debt.isPaid ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(debt.amountDue, debt.currency)}
          </p>
          <p className="text-gray-600 dark:text-gray-400">Reason: {debt.reason}</p>
          <p className="text-gray-600 dark:text-gray-400">Date: {dayjs(debt.createdAt).format("DD MMM YYYY")}</p>
          <p className="text-gray-600 dark:text-gray-400">Sale ID: {debt.relatedSaleId || 'N/A'}</p>
        </div>

        {/* Payment History Section */}
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Payment History</h4>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3 dark:border-gray-700">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {error && <p className="text-sm text-red-500">Could not load history.</p>}
            
            {!isLoading && !error && history.length === 0 && (
              <p className="text-sm text-gray-500">No payment history found.</p>
            )}

            {!isLoading && !error && history.length > 0 && (
              <table className="min-w-full text-sm">
                <tbody>
                  {history.map((payment: any, index: number) => (
                    <tr key={index} className="border-b last:border-b-0 dark:border-gray-700">
                      <td className="py-2">
                        <p className="font-medium">{formatCurrency(payment.amount, debt.currency)}</p>
                        <p className="text-xs text-gray-500">{payment.method || 'N/A'}</p>
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {dayjs(payment.date.toDate ? payment.date.toDate() : payment.date).format("DD MMM YYYY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Close</button>
          {!debt.isPaid && (
            <button
              onClick={() => {
                onClose(); // Close this modal
                onPay(debt); // Open the pay modal
              }}
              className="flex min-w-[80px] items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <CreditCard className="h-4 w-4" /> &nbsp; Record Payment
            </button>
          )}
        </div>
      </div>
    </ModalBase>
  );
};

const PayDebtModal = ({ debt, onClose, onSuccess, setGlobalError }: any) => {
  const [formData, setFormData] = useState({
    amountPaid: "",
    paymentMethod: "Cash",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paidAmount = parseFloat(formData.amountPaid);
    if (!paidAmount || paidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmount > debt.amountDue + 0.01) {
      setError("Payment cannot be more than the remaining amount due.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          amountPaid: paidAmount,
          paymentMethod: formData.paymentMethod 
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment.");
      }
      
      onSuccess("Payment recorded successfully!");
      
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title={`Pay Debt for ${debt.clientName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Remaining Amount Due:</p>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
            {formatCurrency(debt.amountDue, debt.currency)}
          </p>
        </div>
        
        <FormInput
          label="Amount to Pay"
          name="amountPaid"
          type="number"
          value={formData.amountPaid}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e)}
        />
        
        <FormSelect 
          label="Payment Method" 
          name="paymentMethod" 
          value={formData.paymentMethod} 
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange(e)}
        >
          <option value="Cash">Cash</option>
          <option value="Mobile">Mobile (Zaad, eDahab)</option>
          <option value="Bank">Bank</option>
          <option value="Other">Other</option>
        </FormSelect>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

const ConfirmDeleteModal = ({ debt, onClose, onSuccess, setGlobalError }: any) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete debt.");
      }
      
      onSuccess("Debt record deleted successfully!");
      
    } catch (err: any) {
      setGlobalError(err.message);
      onClose(); // Close this modal even on error
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalBase title="Confirm Deletion" onClose={onClose}>
      <div className="space-y-4">
        <p>
          Are you sure you want to delete the debt for{" "}
          <strong className="font-semibold">{debt.clientName}</strong>?
        </p>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">Amount:</p>
          <p className="text-2xl font-bold text-red-900 dark:text-red-200">
            {formatCurrency(debt.amountDue, debt.currency)}
          </p>
          <p className="text-sm text-red-800 dark:text-red-300">Reason: {debt.reason}</p>
        </div>
        <p className="text-sm text-gray-500">This action cannot be undone.</p>
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex min-w-[80px] items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </button>
        </div>
      </div>
    </ModalBase>
  );
};


// -----------------------------------------------------------------------------
// 🛠️ Reusable Helper Components
// -----------------------------------------------------------------------------

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Data</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

const ChartEmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
    <PieChart className="h-12 w-12 opacity-50" />
    <p className="mt-2 text-sm">No data for this period</p>
  </div>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);

const Pagination = ({ currentPage, totalPages, onPageChange, totalRecords, totalAmount, currency }: any) => (
  <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t pt-4 dark:border-gray-700 md:flex-row">
    <div className="text-sm text-gray-600 dark:text-gray-400">
      <span className="font-medium">
        Total Unpaid (Filtered): {formatCurrency(totalAmount, currency)}
      </span>
      <span className="ml-2">({totalRecords} records)</span>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// --- (NEW) Reusable DateRangePicker (from purchases/page.tsx) ---
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
    const { from, to } = selectedDate || {};
    if (!from) {
      setSelectedDate({ from: day, to: undefined });
    } else if (from && !to) {
      if (isAfter(day, from)) {
        setSelectedDate({ from, to: day });
      } else {
        setSelectedDate({ from: day, to: from });
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

// --- Other Reusable Components ---
const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
      <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-6 max-h-[70vh] overflow-y-auto pr-2">{children}</div>
    </div>
  </div>
);

const FormInput = ({ label, name, ...props }: any) => (
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    />
  </div>
);

const FormSelect = ({ label, name, children, ...props }: any) => (
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
    >
      {props.value ? null : <option value="" disabled>-- Select --</option>}
      {children}
    </select>
  </div>
);