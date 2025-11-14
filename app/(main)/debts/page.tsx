// File: app/(main)/debts/page.tsx
// Description: Main Debts Management screen for the web.
// --- SUPER-POWERED MODERN VERSION (FINAL & FULLY FIXED) ---
// 1. Replaced all `alert()` and `confirm()` with UI modals.
// 2. Added Global Error and Success Toasts.
// 3. Form validation errors (required, etc.) show in-modal.
// 4. Fixed AddDebtModal (removed payment method).
// 5. Fixed ViewDebtModal (history now loads correctly).
// 6. Fixed PayDebtModal (payment method dropdown is now included).
// --- (USER REQUESTS ADDED & FIXED) ---
// 7. (FIX) "Download Report" modal now has an "Filter by Amount" toggle.
// 8. (NEW) Added "Print" icon to each debt row for single-item reports.
// 9. (NEW) Imports for PDF, Date Pickers, Popovers, and Switch.
// 10. (NEW) useAuth now gets 'subscription' for PDF store info.
// 11. (NEW) Added <DebtReportModal> component for list reports.
// 12. (NEW) Added state and handler for single-debt PDF modal.
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
  Download, 
  Printer, // <-- (NEW) IMPORT
  Calendar as CalendarIconLucide, // <-- (NEW) IMPORT
  ChevronDown, // <-- (NEW) IMPORT
} from "lucide-react";

// --- (NEW) PDF IMPORTS ---
import { PDFDownloadLink } from '@react-pdf/renderer';
import { getTemplateComponent, ReportType } from '@/lib/pdfService';
// --- END NEW IMPORTS ---

// --- (NEW) IMPORTS FOR DATE PICKER & MODAL ---
import { type DateRange } from "react-day-picker";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/Button";
import { 
  add, addDays, format, startOfWeek, startOfMonth, endOfDay,
  eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, isSameMonth,
  isToday, parse, sub, isAfter, isBefore, startOfDay, subDays,
} from "date-fns";
import { Switch } from "@headlessui/react"; // <-- (NEW) IMPORT FOR TOGGLE
// --- END NEW IMPORTS ---


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

// --- (NEW) Helper function for modal ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- (NEW) Date preset type ---
type DatePreset = "today" | "this_week" | "this_month" | "custom";


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
  // --- (MODIFIED) Get subscription from useAuth ---
  const { user, loading: authLoading, subscription } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();

  // --- State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<any | null>(null);
  const [selectedDebts, setSelectedDebts] = useState<string[]>([]);
  
  // --- (NEW) UI Error & Success State ---
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteModalDebt, setDeleteModalDebt] = useState<any | null>(null);
  
  // --- (NEW) PDF Modal State (for list report) ---
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // --- (NEW) PDF Modal State (for SINGLE item print) ---
  const [isSinglePdfModalOpen, setIsSinglePdfModalOpen] = useState(false);
  const [singlePdfData, setSinglePdfData] = useState<any | null>(null);
  const [SinglePdfComponent, setSinglePdfComponent] = useState<React.ElementType | null>(null);


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

  const isLoading = authLoading || dataIsLoading;

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
  
  // (NEW) Unified success handler
  const handleActionSuccess = (message: string) => {
    mutate(); // Re-fetch data
    setIsAddModalOpen(false);
    setIsPayModalOpen(null);
    setIsViewModalOpen(null);
    setDeleteModalDebt(null);
    setSelectedDebts([]);
    setToastMessage(message); // Show success toast!
  };

  // --- (NEW) SINGLE DEBT PDF MODAL HANDLER ---
  const handlePrintSingleDebt = (debt: any) => {
    // 1. Get store info
    const storeInfo = {
      name: subscription?.storeName || "My Store",
      address: subscription?.storeAddress || "123 Main St",
      phone: subscription?.storePhone || "555-1234",
      logoUrl: subscription?.logoUrl,
      planId: subscription?.planId,
    };

    // 2. Format the single debt to match the 'debts_credits' template
    const formattedData = {
      tables: {
        topDebtors: [{
          name: debt.clientName,
          total: formatCurrency(debt.amountDue, debt.currency),
          count: debt.isPaid ? 'Paid' : (debt.status === 'partial' ? 'Partial' : 'Unpaid'),
        }]
      },
      kpis: { // Add some relevant KPIs
        totalUnpaid: debt.amountDue,
        totalPaid: 0,
        totalDebtors: 1,
      }
    };

    // 3. Get the template component
    const Template = getTemplateComponent('debts_credits' as ReportType, subscription);

    // 4. Set state to open the modal
    setSinglePdfData({ data: formattedData, store: storeInfo });
    setSinglePdfComponent(() => Template);
    setIsSinglePdfModalOpen(true);
  };

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
      {/* --- (NEW) Global Toast & Error Popups --- */}
      <GlobalSuccessToast message={toastMessage} onClose={() => setToastMessage(null)} />
      <GlobalErrorPopup error={globalError} onClose={() => setGlobalError(null)} />

      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Debts Management</h1>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
          {/* --- (MODIFIED) PDF Download Button --- */}
          <button
            onClick={() => setIsReportModalOpen(true)} // <-- (NEW) Opens filter modal
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
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
      {error && !apiData && <ErrorDisplay error={error} />}
      
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
              onPrint={handlePrintSingleDebt} // <-- (NEW) Pass handler
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
      
      {/* --- (NEW) Report Filter Modal --- */}
      {isReportModalOpen && (
        <DebtReportModal
          onClose={() => setIsReportModalOpen(false)}
          subscription={subscription} // Pass subscription
          currentFilters={filters} // Pass main filters as default
        />
      )}
      
      {/* --- (NEW) Single PDF Download Modal --- */}
      {isSinglePdfModalOpen && singlePdfData && SinglePdfComponent && (
        <ModalBase title="PDF Ready for Download" onClose={() => setIsSinglePdfModalOpen(false)}>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your PDF report for this debt is ready.
            </p>
            <PDFDownloadLink
              document={<SinglePdfComponent data={singlePdfData.data} store={singlePdfData.store} />}
              fileName={`debt_report_${singlePdfData.data.tables.topDebtors[0].name.replace(' ','_')}.pdf`}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {({ loading }) => 
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Now
                  </>
                )
              }
            </PDFDownloadLink>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
              onClick={() => setIsSinglePdfModalOpen(false)}
            >
              Close
            </button>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

// ... (GlobalErrorPopup, GlobalSuccessToast, FilterBar, KpiCard, SmartAlerts, All Charts) ...
// (These components are unchanged)
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

// --- (MODIFIED) DebtListHeader ---
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

// --- (MODIFIED) DebtList ---
const DebtList = ({ debts, currency, filters, onSort, onPay, onDelete, onView, onPrint, selectedDebts, setSelectedDebts }: any) => {
  
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
                  onPrint={onPrint} // <-- (NEW) Pass prop
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

// --- (MODIFIED) DebtCard ---
const DebtCard = ({ debt, currency, onPay, onDelete, onView, onPrint, isSelected, onSelect }: any) => {
  
  const startDelete = () => {
    onDelete(debt); 
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
          {/* --- (NEW) Print Button --- */}
          <button
            onClick={() => onPrint(debt)}
            className="rounded-lg p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-gray-700"
            title="Print Debt Report"
          >
            <Printer className="h-4 w-4" />
          </button>
          
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

// ... (AddDebtModal, ViewDebtModal, PayDebtModal, ConfirmDeleteModal) ...
// (These components are unchanged)
const AddDebtModal = ({ onClose, onSuccess, defaultCurrency, debtToEdit, setGlobalError }: any) => {
  const isEditMode = !!debtToEdit;
  const [customerMode, setCustomerMode] = useState<'select' | 'new'>('select');
  const { 
    data: customersData, 
    error: customersError 
  } = useSWR('/api/customers?tab=list', fetcher);
  const customers = customersData || [];
  const [formData, setFormData] = useState({
    customerId: debtToEdit?.customerId || "",
    clientName: debtToEdit?.clientName || "",
    clientPhone: debtToEdit?.clientPhone || "",
    clientWhatsapp: debtToEdit?.clientWhatsapp || "",
    amountDue: debtToEdit?.amountDue || "",
    reason: debtToEdit?.reason || "",
    currency: debtToEdit?.currency || defaultCurrency,
    tags: debtToEdit?.tags?.join(', ') || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(""); 
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    if (!customerId) {
      setFormData({ ...formData, customerId: "", clientName: "", clientPhone: "", clientWhatsapp: "", });
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
    <ModalBase title={isEditMode ? "Edit Debt" : "Add New Debt"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Customer Details</h3>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setCustomerMode(customerMode === 'select' ? 'new' : 'select')}
                className="flex items-center gap-1.5 text-sm text-white hover:opacity-80"
              >
                {customerMode === 'select' ? (
                  <> <UserPlus className="h-4 w-4" /> Add New Customer </>
                ) : (
                  <> <UserCheck className="h-4 w-4" /> Select Existing </>
                )}
              </button>
            )}
          </div>
          {customerMode === 'select' && !isEditMode ? (
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
              {isEditMode ? "Editing customer details:" : "Enter new customer details:"}
             </p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
            <FormInput
              label="Customer Name"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              disabled={customerMode === 'select' && !isEditMode}
              required
            />
          <FormInput
              label="Customer Phone"
              name="clientPhone"
              value={formData.clientPhone}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Customer WhatsApp (Optional)" name="clientWhatsapp" value={formData.clientWhatsapp} onChange={handleChange} />
          <FormInput label="Reason for Debt" name="reason" value={formData.reason} onChange={handleChange} required />
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
           <FormInput label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} placeholder="Urgent, Wholesale..." />
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
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Customer</h4>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{debt.clientName}</p>
          <p className="text-gray-600 dark:text-gray-400">{debt.clientPhone}</p>
          <p className="text-gray-600 dark:text-gray-400">{debt.clientWhatsapp}</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Debt Info</h4>
          <p className={`text-3xl font-bold ${debt.isPaid ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(debt.amountDue, debt.currency)}
          </p>
          <p className="text-gray-600 dark:text-gray-400">Reason: {debt.reason}</p>
          <p className="text-gray-600 dark:text-gray-400">Date: {dayjs(debt.createdAt).format("DD MMM YYYY")}</p>
          <p className="text-gray-600 dark:text-gray-400">Sale ID: {debt.relatedSaleId || 'N/A'}</p>
        </div>
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
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Close</button>
          {!debt.isPaid && (
            <button
              onClick={() => {
                onClose(); 
                onPay(debt); 
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
          onChange={handleChange}
        />
        <FormSelect 
          label="Payment Method" 
          name="paymentMethod" 
          value={formData.paymentMethod} 
          onChange={handleChange}
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
      onClose(); 
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


// --- (NEW) DEBT REPORT MODAL ---
// This is the new modal for the "Download Report" button
const DebtReportModal = ({ onClose, subscription, currentFilters }: {
  onClose: () => void;
  subscription: any;
  currentFilters: any;
}) => {
  
  // --- Filter State ---
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: dayjs(currentFilters.startDate).toDate(),
    to: dayjs(currentFilters.endDate).toDate(),
  });
  const [activePreset, setActivePreset] = useState<DatePreset>("custom");
  const [statusFilter, setStatusFilter] = useState(currentFilters.statusFilter);
  // --- (FIX) Add state for the new toggle ---
  const [useAmountFilter, setUseAmountFilter] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  
  // --- PDF State ---
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<any | null>(null);
  const [PdfComponent, setPdfComponent] = useState<React.ElementType | null>(null);

  const handlePrepareDownload = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setPdfData(null);
    setPdfComponent(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated.");
      const token = await user.getIdToken();

      // 1. Build query params for the API
      const params = new URLSearchParams({
        currency: currentFilters.currency, // Use the page's main currency
        noLimit: "true", // Get ALL debts for the report
        statusFilter: statusFilter,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      if (date?.from) params.set("startDate", format(date.from, "yyyy-MM-dd"));
      if (date?.to) params.set("endDate", format(date.to, "yyyy-MM-dd"));
      
      // --- (FIX) Only add amount filters if the toggle is on ---
      if (useAmountFilter && minAmount) params.set("minAmount", minAmount);
      if (useAmountFilter && maxAmount) params.set("maxAmount", maxAmount);
      
      // 2. Fetch the REAL data
      const apiData = await fetcher(`/api/debts?${params.toString()}`);
      if (!apiData.debtRecords || apiData.debtRecords.length === 0) {
        throw new Error("No debts found for these filters.");
      }

      // 3. Format data for the PDF
      const formattedData = {
        tables: {
          topDebtors: apiData.debtRecords.map((debt: any) => ({
            name: debt.clientName,
            total: formatCurrency(debt.amountDue, debt.currency),
            count: debt.isPaid ? 'Paid' : (debt.status === 'partial' ? 'Partial' : 'Unpaid'),
          }))
        },
        kpis: {
          totalUnpaid: apiData.kpis.totalUnpaid,
          totalPaid: apiData.kpis.totalPaid,
          totalDebtors: apiData.pagination.totalRecords,
        }
      };
      
      // 4. Get Store Info
      const storeInfo = {
        name: subscription?.storeName || "My Store",
        address: subscription?.storeAddress || "123 Main St",
        phone: subscription?.storePhone || "555-1234",
        logoUrl: subscription?.logoUrl,
        planId: subscription?.planId,
      };

      // 5. Get the template component
      const TemplateComponent = getTemplateComponent('debts_credits' as ReportType, subscription);
      
      // 6. Set state to render the download button
      setPdfData({ data: formattedData, store: storeInfo });
      setPdfComponent(() => TemplateComponent);
      
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalBase title="Download Debt Report" onClose={onClose}>
      <div className="mt-4 space-y-4">
        
        {/* --- Filter Inputs --- */}
        <fieldset disabled={!!pdfData || isLoading} className="space-y-4 disabled:opacity-50">
          <div className="space-y-3">
            <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
              Date Range
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
          
          <FormSelect 
            label="Status" 
            name="statusFilter" 
            value={statusFilter} 
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="all">All Statuses</option>
          </FormSelect>
          
          {/* --- (NEW) Amount Toggle --- */}
          <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-600">
            <span className="font-medium text-gray-700 dark:text-gray-300">Filter by Amount</span>
            <Switch
              checked={useAmountFilter}
              onChange={setUseAmountFilter}
              className={`${useAmountFilter ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'}
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
            >
              <span className="sr-only">Filter by Amount</span>
              <span
                aria-hidden="true"
                className={`${useAmountFilter ? 'translate-x-5' : 'translate-x-0'}
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </Switch>
          </div>
          
          {/* --- (NEW) Disabled Fieldset for Amount --- */}
          <fieldset disabled={!useAmountFilter} className="grid grid-cols-2 gap-4 disabled:opacity-50">
            <FormInput
              label="Min Amount (Optional)"
              name="minAmount"
              type="number"
              value={minAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinAmount(e.target.value)}
            />
            <FormInput
              label="Max Amount (Optional)"
              name="maxAmount"
              type="number"
              value={maxAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxAmount(e.target.value)}
            />
          </fieldset>
        </fieldset>
        
        {/* --- Buttons --- */}
        <div className="pt-4">
          {errorMessage && (
            <div className="w-full text-center rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300 mb-3">
              {errorMessage}
            </div>
          )}
          
          {!pdfData && (
            <button 
              onClick={handlePrepareDownload} 
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isLoading ? "Generating..." : "Generate Report"}
            </button>
          )}
          
          {pdfData && PdfComponent && (
            <PDFDownloadLink
              document={<PdfComponent data={pdfData.data} store={pdfData.store} />}
              fileName={`debts_report_${statusFilter}_${dayjs().format("YYYYMMDD")}.pdf`}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {({ loading }) => 
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Now
                  </>
                )
              }
            </PDFDownloadLink>
          )}
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
      {/* (NEW) Allow "no selection" for status */}
      {name === 'statusFilter' ? null : <option value="" disabled>-- Select --</option>}
      {children}
    </select>
  </div>
);


// --- (NEW) Date Picker Components (Copied from products/page.tsx) ---

const PRESETS = [
  { label: "Today", range: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
  { label: "Last 7 Days", range: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) } },
  { label: "This Month", range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
];

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
            title="Select a date range"
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
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Previous month" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Next month" onClick={nextMonth}>
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
                "h-9 w-9 flex items-center justify-center rounded-lg text-sm transition-colors duration-150",
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
      newDate = { from: startOfDay(today), to: endOfDay(today) };
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
      title={`Set range to ${label}`}
      onClick={() => setDatePreset(preset)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
        activePreset === preset
          ? "bg-blue-600 text-white shadow-sm"
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