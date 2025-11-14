// File: app/(main)/purchases/page.tsx
//
// --- FINAL PRODUCTION VERSION (Refactored with new PDF System) ---
// 1. (NEW) Imports for @react-pdf/renderer and useAuth.
// 2. (NEW) Added state for the PDF Modal.
// 3. (FIX) Removed old jsPDF/autoTable code from ViewPurchaseModal.
// 4. (FIX) ViewPurchaseModal "Download PDF" button now opens the new modal.
// 5. (FIX) Added the missing 'AddSupplierModal' component.
// 6. (NOTE) The 'ReportDownloadPopover' still uses the old server-side PDF
//    API, as per the request to only change the single purchase order download.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useMemo, Fragment, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext"; // <-- (NEW) IMPORT
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import { jsPDF } from "jspdf"; // (Still needed for server-side report)
import autoTable from "jspdf-autotable";
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
  FileText, // <-- (NEW) IMPORT
  FileSpreadsheet,
  UserCheck,
} from "lucide-react";

// --- (NEW) IMPORTS FOR PDF ---
import { PDFDownloadLink } from '@react-pdf/renderer';
import { getTemplateComponent, ReportType } from '@/lib/pdfService';
// --- END NEW IMPORTS ---


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
// 腸 API Fetcher & Utilities
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
// 氏 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function PurchasesPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PurchasesPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 統 Main Purchases Page Component
// -----------------------------------------------------------------------------
function PurchasesPage() {
  // --- (NEW) Get subscription from useAuth ---
  const { user, loading: authLoading, subscription } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();

  // --- State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);
  
  // --- (NEW) PDF Modal State ---
  const [pdfData, setPdfData] = useState<any | null>(null);
  const [PdfComponent, setPdfComponent] = useState<React.ElementType | null>(null);
  
  const [filters, setFilters] = useState({
    currency: searchParams.get("currency") || "USD",
    startDate: searchParams.get("startDate") || dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: searchParams.get("endDate") || dayjs().endOf("day").format("YYYY-MM-DD"),
    searchQuery: searchParams.get("searchQuery") || "",
    status: searchParams.get("status") || "",
  });

  // --- SWR Data Fetching (Optimized) ---
  const buildUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
    return `/api/purchases?${params.toString()}`;
  };
  
  const swrKey = !authLoading && user ? buildUrl() : null;
  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(swrKey, fetcher);

  // 2. Fetch form data (suppliers, products, warehouses, categories)
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
    mutate();
  };

  const handleOpenViewModal = (purchase: any) => {
    setViewingPurchase(purchase);
    setIsViewModalOpen(true);
  };
  
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewingPurchase(null);
  };

  // --- (NEW) PDF Modal Handler ---
  const handlePrintPurchaseOrder = (purchase: any) => {
    const storeInfo = {
      name: subscription?.storeName || "My Store",
      address: subscription?.storeAddress || "123 Main St",
      phone: subscription?.storePhone || "555-1234",
      logoUrl: subscription?.logoUrl,
      planId: subscription?.planId,
    };
    
    // Use the 'purchase' template
    const Template = getTemplateComponent('purchase' as ReportType, subscription);
    
    setPdfData({ data: purchase, store: storeInfo });
    setPdfComponent(() => Template);
    
    // Close the view modal
    handleCloseViewModal();
  };
  
  // ---------------------------------
  // 耳 Main Render
  // ---------------------------------
  return (
    <div className="min-h-screen bg-white p-4 pt-6 dark:bg-gray-900 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Purchases</h1>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row">
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

      {/* --- Filter Bar --- */}
      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        onDateChange={handleDateChange}
      />
      
      {isLoading && <LoadingSpinner />}
      {mainError && <ErrorDisplay error={mainError} />}
      
      {apiData && (
        <div className="space-y-6">
          {/* --- KPIs --- */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Purchases"
              value={formatCurrency(apiData.kpis.totalPurchases, filters.currency)}
              icon={DollarSign} color="text-green-500"
            />
            <KpiCard
              title="Total Pending"
              value={formatCurrency(apiData.kpis.totalPending, filters.currency)}
              icon={Clock} color="text-orange-500"
            />
            <KpiCard
              title="Total Paid"
              value={formatCurrency(apiData.kpis.totalPaid, filters.currency)}
              icon={CheckCircle} color="text-blue-500"
            />
            <KpiCard
              title="Average Purchase"
              value={formatCurrency(apiData.kpis.avgPurchase, filters.currency)}
              icon={BarChart2} color="text-purple-500"
            />
          </div>

          {/* --- Charts --- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Purchase Trend Over Time">
              <PurchaseTrendChart data={apiData.charts.monthlyTrend} currency={filters.currency} />
            </ChartCard>
            <ChartCard title="Top Suppliers by Spend">
              <TopSuppliersChart data={apiData.charts.topSuppliers} currency={filters.currency} />
            </ChartCard>
          </div>
          
          {/* --- Purchases List --- */}
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
          formData={formData} // Pass ALL form data
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
          onPrint={handlePrintPurchaseOrder} // <-- (NEW) Pass the new handler
        />
      )}
      
      {/* --- (NEW) PDF Download Modal --- */}
      {pdfData && PdfComponent && (
        <ModalBase title="PDF Ready for Download" onClose={() => setPdfData(null)} size="md">
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your Purchase Order ({pdfData.data.id.substring(0, 6)}...) is ready.
            </p>
            
            <PDFDownloadLink
              document={<PdfComponent data={pdfData.data} store={pdfData.store} />}
              fileName={`PO_${pdfData.data.supplierName.replace(' ','-')}_${pdfData.data.id.substring(0, 6)}.pdf`}
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
              onClick={() => setPdfData(null)}
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
// ｧｩ Sub-Components
// -----------------------------------------------------------------------------
 
// --- Report Download Popover Component ---
// (Unchanged, as requested)
const PRESETS = [
  { label: "Last 7 Days", range: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) } },
  { label: "Last 30 Days", range: { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) } },
  { label: "This Month", range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
  { label: "Last Month", range: { from: startOfMonth(sub(new Date(), { months: 1 })), to: endOfMonth(sub(new Date(), { months: 1 })) } },
];
// --- (NEW) IMPORTS NEEDED AT THE TOP of _main__purchases_page.tsx ---
// (Ensure these are present)
// import { PDFDownloadLink } from '@react-pdf/renderer';
// import { getTemplateComponent, ReportType } from '@/lib/pdfService';
// import { useAuth } from "@/app/contexts/AuthContext";
// ---

// --- Report Download Popover Component (UPGRADED) ---
function ReportDownloadPopover({ formData, formIsLoading }: {
  formData: any,
  formIsLoading: boolean
}) {
  // --- (NEW) Get subscription ---
  const { subscription } = useAuth(); 
  
  const [reportRange, setReportRange] = useState<DateRange | undefined>(PRESETS[1].range);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [supplierFilterOn, setSupplierFilterOn] = useState(false);
  const [query, setQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false); // For Excel
  const [isPreparing, setIsPreparing] = useState(false); // For PDF
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- (NEW) PDF State ---
  const [pdfData, setPdfData] = useState<any | null>(null);
  const [PdfComponent, setPdfComponent] = useState<React.ElementType | null>(null);

  const suppliers = formData?.suppliers || [];
  const filteredSuppliers =
    query === ''
      ? suppliers
      : suppliers.filter((supplier: any) =>
          supplier.name.toLowerCase().includes(query.toLowerCase())
        );
  
  const handleSupplierToggle = (isOn: boolean) => {
    setSupplierFilterOn(isOn);
    if (!isOn) { setSelectedSupplier(null); }
  };
  
  // (MODIFIED) This now *only* handles Excel/CSV
  const handleDownloadExcel = async () => {
    setIsDownloading(true);
    setErrorMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        action: 'download',
        format: 'csv', // Only CSV
        startDate: reportRange?.from ? format(reportRange.from, "yyyy-MM-dd") : '',
        endDate: reportRange?.to ? format(reportRange.to, "yyyy-MM-dd") : '',
        supplierId: supplierFilterOn && selectedSupplier ? selectedSupplier.id : '',
      });
      const reportUrl = `/api/purchases?${params.toString()}`;
      const res = await fetch(reportUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to download report.");
      }
      const blob = await res.blob();
      const filename = `purchases_${supplierFilterOn && selectedSupplier ? selectedSupplier.name.replace(' ','_') : 'all'}_${dayjs().format('YYYYMMDD')}.csv`;
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
      setErrorMessage(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- (NEW) This handles preparing the PDF data ---
  const handlePreparePdf = async () => {
    setIsPreparing(true);
    setErrorMessage(null);
    setPdfData(null);
    setPdfComponent(null);
    
    try {
      // 1. Fetch the *data* (not a PDF)
      const params = new URLSearchParams({
        // These params match the main page's API call
        startDate: reportRange?.from ? format(reportRange.from, "yyyy-MM-dd") : '',
        endDate: reportRange?.to ? format(reportRange.to, "yyyy-MM-dd") : '',
        supplierId: supplierFilterOn && selectedSupplier ? selectedSupplier.id : '',
        // Add currency filter from main page if needed, e.g.:
        // currency: filters.currency, 
      });
      
      // We fetch from the main API endpoint, not the 'download' action
      const reportData = await fetcher(`/api/purchases?${params.toString()}`);
      
      if (!reportData || !reportData.purchases || reportData.purchases.length === 0) {
        throw new Error("No purchase data found for these filters.");
      }

      // 2. Get Store Info
      const storeInfo = {
        name: subscription?.storeName || "My Store",
        address: subscription?.storeAddress || "123 Main St",
        phone: subscription?.storePhone || "555-1234",
        logoUrl: subscription?.logoUrl,
        planId: subscription?.planId,
      };

      // 3. Get the Template Component
      // We use the new 'purchase_report' type
      const Template = getTemplateComponent('purchase_report' as ReportType, subscription);

      // 4. Set state to show the download button
      setPdfData({ data: reportData, store: storeInfo });
      setPdfComponent(() => Template); // Store the component itself

    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsPreparing(false);
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
          <div className="space-y-3 rounded-lg border p-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-300">Filter by Supplier</span>
              <Switch checked={supplierFilterOn} onChange={handleSupplierToggle}
                className={`${supplierFilterOn ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}>
                <span className="sr-only">Filter by supplier</span>
                <span aria-hidden="true"
                  className={`${supplierFilterOn ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
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
          
          {/* --- (NEW) Error Message Display --- */}
          {errorMessage && (
            <p className="text-xs text-red-600">{errorMessage}</p>
          )}

          {/* --- (MODIFIED) Download Buttons --- */}
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={isDownloading || isPreparing} className="flex items-center justify-center gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download as Excel"}
            </Button>
            
            <Button variant="outline" size="sm" onClick={handlePreparePdf} disabled={isPreparing || !!pdfData || isDownloading} className="flex items-center justify-center gap-2">
              {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isPreparing ? "Preparing..." : (pdfData ? "Data Ready" : "1. Prepare PDF")}
            </Button>
            
            {pdfData && PdfComponent && (
              <PDFDownloadLink
                document={<PdfComponent data={pdfData.data} store={pdfData.store} />}
                fileName={`purchases_report_${dayjs().format("YYYYMMDD")}.pdf`}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
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
      </PopoverContent>
    </Popover>
  );
}

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
        date={{ from: dayjs(filters.startDate).toDate(), to: dayjs(filters.endDate).toDate() }}
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
const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <Card className="h-80">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    <div className="mt-4 h-[280px] w-full">{children}</div>
  </Card>
);
const PurchaseTrendChart = ({ data, currency }: { data: any[], currency: string }) => {
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = async (purchaseId: string) => {
    if (deletingId) return;
    if (window.confirm("Are you sure you want to delete this purchase? This will reverse any stock added. This action cannot be undone.")) {
      setDeletingId(purchaseId);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated.");
        const token = await user.getIdToken();
        const res = await fetch(`/api/purchases?id=${purchaseId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Delete failed");
        }
        onDelete();
      } catch (error: any) {
        alert(`Error: ${error.message}`);
      } finally {
        setDeletingId(null);
      }
    }
  };
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
                        <button onClick={() => onPay(po)} className="rounded-lg p-2 text-green-600 hover:bg-green-100 dark:hover:bg-gray-700" title="Log Payment">
                          <HandCoins className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => onView(po)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="View Details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(po.id)} disabled={deletingId === po.id} className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:hover:bg-gray-700" title="Delete Purchase">
                        {deletingId === po.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

// -----------------------------------------------------------------------------
//  modals
// -----------------------------------------------------------------------------

// (Define the PriceField type)
type PriceField = { id: number, currency: string, sale: string, cost: string };

// --- (FIX) 'AddSupplierModal' is now included in this file ---
const AddSupplierModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: (supplier: any) => void }) => {
  const [formData, setFormData] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear old errors
    if (!formData.name || !formData.phone) {
      setError("Supplier Name and Phone are required.");
      return;
    }
    setIsSaving(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/suppliers", { // (Assuming /api/suppliers exists)
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save supplier.");
      }
      
      const newSupplier = await res.json();
      onSuccess(newSupplier); // Pass new supplier back

    } catch (err: any) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title="Add New Supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorDisplay error={{name: "Save Error", message: error}} />}
        <FormInput label="Supplier Name" name="name" value={formData.name} onChange={(val: string) => setFormData(prev => ({...prev, name: val}))} required error={error && !formData.name ? " " : ""} />
        <FormInput label="Contact Person (Optional)" name="contactPerson" value={formData.contactPerson} onChange={(val: string) => setFormData(prev => ({...prev, contactPerson: val}))} />
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={(val: string) => setFormData(prev => ({...prev, phone: val}))} required error={error && !formData.phone ? " " : ""} />
        <FormInput label="Email (Optional)" name="email" type="email" value={formData.email} onChange={(val: string) => setFormData(prev => ({...prev, email: val}))} />
        <FormInput label="Address (Optional)" name="address" value={formData.address} onChange={(val: string) => setFormData(prev => ({...prev, address: val}))} />
        
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


const AddPurchaseModal = ({ onClose, onSuccess, defaultCurrency, formData, formIsLoading, formError }: {
  onClose: () => void,
  onSuccess: () => void,
  defaultCurrency: string,
  formData: any,
  formIsLoading: boolean,
  formError: Error | null
}) => {
  const { mutate: globalMutate } = useSWRConfig();
  const [isSaving, setIsSaving] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [warehouse, setWarehouse] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paidAmount, setPaidAmount] = useState("0");
  const [purchaseDate, setPurchaseDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<any>({});
  
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [currentQty, setCurrentQty] = useState("1");
  const [currentCost, setCurrentCost] = useState("0");

  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
  const [warehouseError, setWarehouseError] = useState("");
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [priceFields, setPriceFields] = useState<PriceField[]>([
    { id: 1, currency: "USD", sale: "", cost: "" }
  ]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [productError, setProductError] = useState("");
  const [categoryError, setCategoryError] = useState("");

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
    setErrors({});
    if (!currentProduct || Number(currentQty) <= 0 || Number(currentCost) < 0) {
      setErrors({ cart: "Please select a product, quantity, and valid cost." });
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
    setCart(cart.filter(item => item.productId !== productId));
  };
  
  const handleSaveNewWarehouse = async () => {
    if (!newWarehouseName) {
      setWarehouseError("Warehouse Name is required.");
      return;
    }
    setIsSavingWarehouse(true);
    setWarehouseError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          type: "warehouse",
          name: newWarehouseName, 
          address: newWarehouseAddress 
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save warehouse.");
      }
      
      const newWarehouse = await res.json(); 
      
      globalMutate(
        "/api/purchases?tab=form_data",
        (currentData: any) => ({
          ...currentData,
          warehouses: [...(currentData?.warehouses || []), newWarehouse],
        }),
        false
      );
      
      setNewWarehouseName("");
      setNewWarehouseAddress("");
      setIsAddingWarehouse(false);
      setWarehouse(newWarehouse);
      
    } catch (err: any) {
      setWarehouseError((err as Error).message);
    } finally {
      setIsSavingWarehouse(false);
    }
  };
  
  const handleSupplierAdded = (newSupplier: any) => {
    globalMutate(
      "/api/purchases?tab=form_data",
      (currentData: any) => ({
        ...currentData,
        suppliers: [...(currentData?.suppliers || []), newSupplier],
      }),
      false
    );
    setIsAddSupplierModalOpen(false);
    setSupplier(newSupplier);
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
  
  const handleAddInline = async (type: "category") => {
    if (!newCategoryName) {
      setCategoryError("Category name cannot be empty.");
      return;
    }
    setIsSavingInline(true);
    setCategoryError("");
    const user = auth.currentUser;
    if (!user) {
      setCategoryError("Authentication error.");
      setIsSavingInline(false);
      return;
    }
    
    const body = { type: "category", name: newCategoryName };

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
      
      const newCategory = await res.json(); 

      globalMutate(
        "/api/purchases?tab=form_data",
        (currentData: any) => ({
          ...currentData,
          categories: [...(currentData?.categories || []), newCategory],
        }),
        false
      );
      
      setNewProductCategory(newCategory.name);
      setNewCategoryName("");
      setShowAddCategory(false);
      
    } catch (error: any) {
      setCategoryError((error as Error).message);
    } finally {
      setIsSavingInline(false);
    }
  };
  
  const handleSaveNewProduct = async () => {
    setProductError("");
    if (!newProductName) {
      setProductError("Product Name is required.");
      return;
    }
    if (!newProductCategory) {
      setProductError("Category is required.");
      return;
    }
    if (!warehouse) {
      setProductError("Please select a main warehouse for the purchase before adding a new product.");
      return;
    }
    
    setIsSavingProduct(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const salePrices: Record<string, number> = {};
      for (const field of priceFields) {
        if (field.currency && field.sale) {
          salePrices[field.currency] = parseFloat(field.sale);
        }
      }
      
      const costPrices: Record<string, number> = {};
      for (const field of priceFields) {
        if (field.currency && field.cost) {
          costPrices[field.currency] = parseFloat(field.cost);
        }
      }

      const payload = {
        type: "product",
        name: newProductName,
        category: newProductCategory,
        salePrices: salePrices,
        costPrices: costPrices,
        quantity: 0,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save product.");
      }
      
      const newProduct = await res.json(); 

      globalMutate(
        "/api/purchases?tab=form_data",
        (currentData: any) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            products: [...(currentData?.products || []), newProduct],
          };
        },
        false 
      );

      handleSelectProduct(newProduct.id);
      
      setIsAddingProduct(false);
      setNewProductName("");
      setNewProductCategory("");
      setPriceFields([{ id: 1, currency: "USD", sale: "", cost: "" }]);
      
    } catch (err: any) {
      setProductError((err as Error).message);
    } finally {
      setIsSavingProduct(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const newErrors: any = {};
    if (!supplier) newErrors.supplier = "Supplier is required.";
    if (!warehouse) newErrors.warehouse = "Warehouse is required.";
    if (cart.length === 0) newErrors.cart = "You must add at least one item to the purchase.";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const paid = Number(paidAmount);
    if (paid === 0 && totalAmount > 0) {
      const confirmSave = window.confirm(
        "Are you sure you want to save this with 0 payment? This will be saved as a pending payable."
      );
      if (!confirmSave) {
        return; 
      }
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
        dueDate: dueDate || null,
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
      setErrors({ form: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ModalBase title="Add New Purchase Order" onClose={onClose} size="xl">
        {formIsLoading && <LoadingSpinner />}
        {formError && <ErrorDisplay error={formError} />}
        {formData && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {errors.form && <ErrorDisplay error={errors.form} />}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex-1">
                <label htmlFor="supplier" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Supplier
                </label>
                <div className="flex gap-2">
                  <StyledSelect id="supplier" name="supplier" value={supplier?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplier(formData.suppliers.find((s:any) => s.id === e.target.value))} required
                    className={cn(errors.supplier ? "border-red-500" : "")}
                  >
                    <option value="" disabled>-- Select --</option>
                    {formData.suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </StyledSelect>
                  <button type="button" onClick={() => setIsAddSupplierModalOpen(true)} className="flex-shrink-0 rounded-lg bg-blue-100 px-3 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                {errors.supplier && <p className="mt-1 text-xs text-red-600">{errors.supplier}</p>}
              </div>
              
              <div className="flex-1">
                <label htmlFor="warehouse" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add Stock to Warehouse
                </label>
                <div className="flex gap-2">
                  <StyledSelect id="warehouse" name="warehouse" value={warehouse?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWarehouse(formData.warehouses.find((w:any) => w.id === e.target.value))} required
                    className={cn(errors.warehouse ? "border-red-500" : "")}
                  >
                    <option value="" disabled>-- Select --</option>
                    {formData.warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </StyledSelect>
                  <button type="button" onClick={() => setIsAddingWarehouse(prev => !prev)} className="flex-shrink-0 rounded-lg bg-blue-100 px-3 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                    {isAddingWarehouse ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </button>
                </div>
                {errors.warehouse && <p className="mt-1 text-xs text-red-600">{errors.warehouse}</p>}
              </div>
            </div>

            {isAddingWarehouse && (
              <div className="space-y-3 rounded-lg border border-gray-300 p-4 dark:border-gray-600">
                <h4 className="font-medium text-gray-900 dark:text-white">Add New Warehouse</h4>
                {warehouseError && <ErrorDisplay error={{ name: "Error", message: warehouseError }} />}
                <FormInput label="New Warehouse Name" name="newWarehouseName" value={newWarehouseName} onChange={(val: string) => setNewWarehouseName(val)} error={warehouseError} />
                <FormInput label="Address (Optional)" name="newWarehouseAddress" value={newWarehouseAddress} onChange={(val: string) => setNewWarehouseAddress(val)} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddingWarehouse(false)} className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
                  <button type="button" onClick={handleSaveNewWarehouse} disabled={isSavingWarehouse} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {isSavingWarehouse ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </button>
                </div>
              </div>
            )}
            
            <div className="rounded-lg border p-3 dark:border-gray-700">
              <h4 className="font-medium dark:text-white">Add Items</h4>
              {errors.cart && <p className="mt-1 text-xs text-red-600">{errors.cart}</p>}
              <div className="mt-2 grid grid-cols-1 items-end gap-2 md:grid-cols-4">
                
                <div className="md:col-span-2">
                  <label htmlFor="product" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Product
                  </label>
                  <div className="flex gap-2">
                    <StyledSelect id="product" name="product" value={currentProduct?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSelectProduct(e.target.value)}>
                      <option value="" disabled>-- Select Product --</option>
                      {formData.products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </StyledSelect>
                    <button 
                      type="button" 
                      onClick={() => setIsAddingProduct(prev => !prev)} 
                      className="flex-shrink-0 rounded-lg bg-blue-100 px-3 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
                    >
                      {isAddingProduct ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                
                <FormInput label="Quantity" name="quantity" type="number" value={currentQty} onChange={(val: string) => setCurrentQty(val)} />
                <FormInput label="Cost Price" name="costPrice" type="number" value={currentCost} onChange={(val: string) => setCurrentCost(val)} />
              </div>
              
              {isAddingProduct && (
                <div className="mt-4 space-y-4 rounded-lg border border-gray-300 p-4 dark:border-gray-600">
                  <h4 className="font-medium text-gray-900 dark:text-white">Add New Product</h4>
                  {productError && <ErrorDisplay error={{ name: "Error", message: productError }} />}
                  <FormInput label="New Product Name" name="newProductName" value={newProductName} onChange={(val: string) => setNewProductName(val)} required />
                  
                  <div className="flex items-end gap-2">
                    <FormSelect label="Category" name="newProductCategory" value={newProductCategory} onChange={(val:string) => setNewProductCategory(val)} className="flex-1">
                      <option value="">-- Select Category --</option>
                      {formData.categories?.map((c: any) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </FormSelect>
                    <button type="button" title="Add new category" onClick={() => setShowAddCategory(!showAddCategory)} className="flex-shrink-0 rounded-lg border p-2.5 dark:border-gray-600">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  {showAddCategory && (
                    <div className="flex items-end gap-2 rounded-lg border p-3 dark:border-gray-600">
                      {categoryError && <ErrorDisplay error={{ name: "Error", message: categoryError }} />}
                      <FormInput label="New Category Name" name="newCategoryName" value={newCategoryName} onChange={(val:string) => setNewCategoryName(val)} placeholder="e.g., Electronics" className="flex-1" error={categoryError} />
                      <button type="button" onClick={() => handleAddInline("category")} disabled={isSavingInline} className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
                        {isSavingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-semibold dark:text-white">Prices (Optional)</h4>
                    {priceFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <FormSelect label={index === 0 ? "Currency" : ""} name={`price_currency_${index}`} value={field.currency} onChange={(val: string) => handlePriceChange(field.id, "currency", val)}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </FormSelect>
                        </div>
                        <div className="col-span-3">
                          <FormInput label={index === 0 ? "Sale Price" : ""} name={`price_sale_${index}`} type="number" placeholder="e.g., 10" value={field.sale} onChange={(val: string) => handlePriceChange(field.id, "sale", val)} />
                        </div>
                        <div className="col-span-3">
                          <FormInput label={index === 0 ? "Cost Price" : ""} name={`price_cost_${index}`} type="number" placeholder="e.g., 5" value={field.cost} onChange={(val: string) => handlePriceChange(field.id, "cost", val)} />
                        </div>
                        <div className="col-span-2 flex items-end pb-2">
                          {priceFields.length > 1 && (
                            <button type="button" onClick={() => removePriceField(field.id)} className="text-red-500">
                              <Trash className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addPriceField} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                      <Plus className="h-4 w-4" /> Add another currency
                    </button>
                  </div>

                  <button type="button" onClick={handleSaveNewProduct} disabled={isSavingProduct} className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {isSavingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Product"}
                  </button>
                </div>
              )}

              <button type="button" onClick={handleAddItemToCart} className="mt-2 w-full rounded-lg bg-blue-100 p-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
                Add Item to Purchase
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
              <FormInput label="Purchase Date" name="purchaseDate" type="date" value={purchaseDate} onChange={(val: string) => setPurchaseDate(val)} required />
              <FormInput label="Payment Due Date (Optional)" name="dueDate" type="date" value={dueDate} onChange={(val: string) => setDueDate(val)} />
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormSelect label="Currency" name="currency" value={currency} onChange={(val: string) => setCurrency(val)} required>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
              <FormInput label="Total Amount" name="totalAmount" type="number" value={totalAmount} onChange={() => {}} readOnly />
              <FormInput label="Amount Paid Now" name="paidAmount" type="number" value={paidAmount} onChange={(val: string) => setPaidAmount(val)} />
            </div>
            
            <FormInput label="Notes (Optional)" name="notes" value={notes} onChange={(val: string) => setNotes(val)} />
            
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" disabled={isSaving} className="flex min-w-[120px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Purchase"}
              </button>
            </div>
          </form>
        )}
      </ModalBase>
      
      {isAddSupplierModalOpen && (
        <AddSupplierModal
          onClose={() => setIsAddSupplierModalOpen(false)}
          onSuccess={handleSupplierAdded}
        />
      )}
    </>
  );
};

// --- PayPurchaseModal ---
const PayPurchaseModal = ({ purchase, onClose, onSuccess }: any) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const remaining = purchase.remainingAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const paidAmountNum = parseFloat(amountPaid);
    if (isNaN(paidAmountNum) || paidAmountNum <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmountNum > remaining) {
      setError("Payment cannot be more than the remaining amount due.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/purchases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purchaseId: purchase.id, paymentAmount: paidAmountNum }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment.");
      }
      onSuccess();
      
    } catch (err: any) { 
      setError((err as Error).message);
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
          onChange={(val: string) => setAmountPaid(val)}
          placeholder="0.00"
          required
          error={error}
        />
        
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


// --- (MODIFIED) ViewPurchaseModal ---
const ViewPurchaseModal = ({ purchase, onClose, onPrint }: { 
  purchase: any, 
  onClose: () => void,
  onPrint: (purchase: any) => void // <-- (NEW) Accept the new handler
}) => {
  const currency = purchase.currency;

  // --- (REMOVED) Old jsPDF function ---
  // const handleDownloadSingleReport = () => { ... };

  return (
    <ModalBase title={`Purchase Order: ${purchase.id.substring(0, 6)}...`} onClose={onClose} size="xl">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <InfoItem icon={Building} label="Supplier" value={purchase.supplierName} />
          <InfoItem icon={Calendar} label="Purchase Date" value={dayjs(purchase.purchaseDate).format("DD MMM YYYY")} />
          <InfoItem icon={Warehouse} label="Warehouse" value={purchase.warehouseName} />
        </div>
        <div>
          <h4 className="text-lg font-semibold dark:text-white">Items Purchased</h4>
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
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Close</button>
          
          {/* --- (MODIFIED) This button now calls the new handler --- */}
          <button 
            type="button" 
            onClick={() => onPrint(purchase)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

// -----------------------------------------------------------------------------
// 屏ｸReusable Helper Components
// -----------------------------------------------------------------------------
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);
const TotalRow = ({ label, value, isDebt = false, isBold = false }: { label: string, value: string, isDebt?: boolean, isBold?: boolean }) => (
  <div className={`flex justify-between text-sm ${isBold ? 'font-semibold' : ''} ${isDebt ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
    <span className="text-gray-600 dark:text-gray-300">{label}:</span>
    <span className={isBold ? 'text-lg' : ''}>{value}</span>
  </div>
);
const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);
const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);
const ChartEmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
    <BarChart2 className="h-12 w-12 opacity-50" />
    <p className="mt-2 text-sm">No data for this period</p>
  </div>
);
const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);
const ModalBase = ({ title, onClose, children, size = 'lg' }: { 
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
const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) => (
  <div>
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <p className="mt-1 text-gray-900 dark:text-white">{value || 'N/A'}</p>
  </div>
);
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
function ModernSelect({ label, value, onChange, options }: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  options: any[];
}) {
  const [selected, setSelected] = useState(options.find(o => (o.id || o) === (value?.id || value)) || options[0]);
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
          <Listbox.Options className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800">
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
const StyledInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input
    {...props}
    ref={ref}
    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
  />
));
StyledInput.displayName = "StyledInput";
const StyledSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ children, ...props }, ref) => (
  <select
    {...props}
    ref={ref}
    className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
  >
    {children}
  </select>
));
StyledSelect.displayName = "StyledSelect";
const FormInput = ({ label, name, value, onChange, error, ...props }: {
  label: string,
  name: string,
  value: string | number,
  onChange: (val: string) => void,
  error?: string,
  [key: string]: any
}) => (
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <StyledInput
      id={name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(error ? "border-red-500" : "border-gray-300 dark:border-gray-600")}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);
const FormSelect = ({ label, name, value, onChange, children, error, ...props }: {
  label: string,
  name: string,
  value: string | number,
  onChange: (val: string) => void,
  children: React.ReactNode,
  error?: string,
  [key: string]: any
}) => (
  <div className="flex-1">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <StyledSelect
      id={name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(error ? "border-red-500" : "border-gray-300 dark:border-gray-600")}
      {...props}
    >
      {children}
    </StyledSelect>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);