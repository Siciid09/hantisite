// File: app/(main)/sales/components.tsx
//
// --- FINAL VERSION (FIXED + REFUND PDF + AUTO-FILTER + PRINT ICON) ---
// 1. (FIX) `SalesTable` status badge logic is corrected.
// 2. (FIX) `NewReturnModal` validation for 'reason' is added.
// 3. (PDF) `NewReturnModal` now shows a PDF download link after
//    a refund is successfully processed.
// 4. (AUTO-FILTER) `AdvancedFilterBar` now auto-applies filters.
// 5. (NEW) Added an `onPrint` handler to `ReturnsTable`.
// 6. (NEW) Added a "Print" icon button to each row in `ReturnsTable`.
//    (NOTE: This currently calls `onView` as a placeholder).
// -----------------------------------------------------------------------------

"use client";

// --- (NEW) Added useEffect and useState for useDebounce ---
import React, { Fragment, useState, useMemo, useEffect } from "react";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import useSWR from "swr"; 
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, SlidersHorizontal, ChevronLeft, ChevronRight,
  MoreVertical, X, AlertTriangle, FileText, CheckCircle, Clock, 
  XCircle, Info, TrendingUp, Send, Undo, FileWarning, Printer,
  Loader2, DollarSign, Receipt, CreditCard, Plus, Trash2,
  Download, User, Phone, Package,
  ArrowUpRight,

  CheckCircle2,
 
  AlertCircle,
  MoreHorizontal, Calendar // <-- (NEW) IMPORT
} from "lucide-react"; 
import { Dialog, Transition, Popover } from "@headlessui/react";

// --- (NEW) IMPORTS FOR PDF ---
import { useAuth } from "@/app/contexts/AuthContext";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { getTemplateComponent, ReportType } from "@/lib/pdfService";
// --- END NEW IMPORTS ---


// =============================================================================
// 💰 API Fetcher (Shared)
// =============================================================================
export const fetcher = async (url: string) => {
  // ... (unchanged)
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("User is not authenticated.");
  
  const token = await firebaseUser.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// =============================================================================
// 🛠️ Utility Functions & Constants (Shared)
// =============================================================================

// --- (NEW) useDebounce Hook ---
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
// --- END NEW HOOK ---

export const CURRENCIES = ["USD", "SLSH", "SOS", "KSH", "BIRR", "EUR"];
// ... (PAYMENT_PROVIDERS unchanged)
export const PAYMENT_PROVIDERS = {
  CASH: { label: "Cash" },
  BANK: { label: "Bank Transfer" },
  ZAAD: { label: "ZAAD" },
  EDAHAB: { label: "E-Dahab" },
  EVC_PLUS: { label: "EVC Plus" },
  SAHAL: { label: "Sahal (Golis)" },
  SOMNET: { label: "Somnet" },
  E_BIRR: { label: "E-Birr" },
  M_PESA: { label: "M-Pesa" },
  OTHER: { label: "Other" },
};

// ... (SALE_STATUSES, RETURN_STATUSES, formatCurrency unchanged)
export const SALE_STATUSES = [
  { id: "paid", label: "Paid", color: "text-green-500" },
  { id: "partial", label: "Partial", color: "text-orange-500" },
  { id: "unpaid", label: "Unpaid", color: "text-red-500" },
  { id: "overdue", label: "Overdue", color: "text-red-700" },
  { id: "refunded", label: "Refunded", color: "text-purple-500" },
  { id: "voided", label: "Voided", color: "text-gray-500" },
];
export const RETURN_STATUSES = [
  { id: "pending", label: "Pending", color: "text-yellow-500" },
  { id: "approved", label: "Approved", color: "text-blue-500" },
  { id: "processed", label: "Processed", color: "text-green-500" },
  { id: "rejected", label: "Rejected", color: "text-red-500" },
];

export const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null || amount === 0) {
     amount = 0;
  }
  const style = (currency === "USD" || currency === "EUR") ? "currency" : "decimal";
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: (currency === "SLSH" || currency === "SOS") ? 0 : 2,
    maximumFractionDigits: (currency === "SLSH" || currency === "SOS") ? 0 : 2,
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

// =============================================================================
// 🧩 Reusable Child Components
// =============================================================================

// --- (MODIFIED) AdvancedFilterBar with Auto-Apply ---
export const AdvancedFilterBar = ({ initialFilters, onApplyFilters }: any) => {
  const [filters, setFilters] = React.useState(initialFilters);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  
  // --- (NEW) Debounce filters and apply automatically ---
  const debouncedFilters = useDebounce(filters, 500); // 500ms delay
  
  useEffect(() => {
    onApplyFilters(debouncedFilters);
  }, [debouncedFilters, onApplyFilters]);
  // --- END NEW ---
  
  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev: any) => ({ ...prev, [field]: value }));
  };
  
  // --- (REMOVED) handleApply function is no longer needed ---
  // const handleApply = () => { onApplyFilters(filters); setShowAdvanced(false); };
  
  const handleClear = () => {
    const clearedFilters = {
      currency: initialFilters.currency,
      startDate: dayjs().startOf("month").format("YYYY-MM-DD"),
      endDate: dayjs().endOf("month").format("YYYY-MM-DD"),
      searchQuery: "", status: "", paymentMethod: "", salespersonId: "",
      tag: "", amountMin: "", amountMax: "", customerId: "", productId: "", branch: "",
    };
    setFilters(clearedFilters);
    // onApplyFilters(clearedFilters); // (MODIFIED) This will be triggered by the useEffect
    setShowAdvanced(false);
  };
  
  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-grow">
          <input
            type="search" name="search" placeholder="Search by invoice or customer name..."
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            // --- (REMOVED) onKeyDown is no longer needed ---
            // onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
        <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        <select value={filters.currency} onChange={(e) => handleFilterChange('currency', e.target.value)} className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button title="Show advanced filters" onClick={() => setShowAdvanced(!showAdvanced)} className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <SlidersHorizontal className="h-5 w-5" />
        </button>
        {/* --- (REMOVED) The manual apply button ---
        <button title="Apply filters" onClick={handleApply} className="rounded-lg bg-blue-600 p-2.5 text-white shadow-sm hover:bg-blue-700">
          <Search className="h-5 w-5" />
        </button>
        */}
      </div>
      
      {showAdvanced && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 dark:border-gray-700 sm:grid-cols-2 md:grid-cols-4">
          <FormSelect label="Status" value={filters.status} onChange={(val: string) => handleFilterChange('status', val)}>
            <option value="">All Statuses</option>
            {SALE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </FormSelect>
          <FormSelect label="Payment Method" value={filters.paymentMethod} onChange={(val: string) => handleFilterChange('paymentMethod', val)}>
            <option value="">All Methods</option>
            {Object.entries(PAYMENT_PROVIDERS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </FormSelect>
          <FormInput label="Tag" value={filters.tag} onChange={(val: string) => handleFilterChange('tag', val)} placeholder="e.g., Wholesale" />
          <FormInput label="Min Amount" type="number" value={filters.amountMin} onChange={(val: string) => handleFilterChange('amountMin', val)} />
          <FormInput label="Max Amount" type="number" value={filters.amountMax} onChange={(val: string) => handleFilterChange('amountMax', val)} />
          <FormInput label="Salesperson ID" value={filters.salespersonId} onChange={(val: string) => handleFilterChange('salespersonId', val)} placeholder="User ID" />
          <div className="col-span-1 flex items-end justify-end gap-2 sm:col-span-2 md:col-span-4">
            <button onClick={handleClear} className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
              Clear Filters
            </button>
            {/* --- (REMOVED) The advanced apply button ---
            <button onClick={handleApply} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Apply Filters
            </button>
            */}
          </div>
        </div>
      )}
    </Card>
  );
};


export const KpiCard = ({ title, value, icon: Icon, color, isLoading }: any) => (
  <Card>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
    {isLoading ? <Skeleton className="mt-2 h-8 w-3/4" /> : <p className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>}
  </Card>
);

export const ChartCard = ({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
  <Card className={`h-80 ${className}`}>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    <div className="mt-4 h-full w-full">{children}</div>
  </Card>
);

export const SalesTrendChart = ({ data, currency }: { data: any[], currency: string }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="90%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#6b7280' }} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val, currency).replace(/\.00$/, '')} tick={{ fill: '#6b7280' }} />
        <Tooltip formatter={(value: number) => [formatCurrency(value, currency), "Sales"]} />
        <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const PaymentPieChart = ({ data, currency }: { data: any[], currency: string }) => {
  const COLORS = ["#3b82f6", "#16a34a", "#f59e0b", "#9333ea", "#e11d48"];
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="90%">
      <PieChart>
        <Pie 
          data={data} 
          cx="50%" 
          cy="50%" 
          outerRadius={80} 
          fill="#8884d8" 
          dataKey="value" 
          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(value: number, name: string) => [formatCurrency(value, currency), name]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};


// --- Tables ---
const getProductSummary = (items: any[]) => {
// ... (unchanged)
  if (!items || items.length === 0) return "N/A";
  const firstItem = items[0].productName;
  const moreItems = items.length > 1 ? ` + ${items.length - 1} more` : "";
  return `${firstItem}${moreItems}`;
};
const getPaymentSummary = (methods: any[]) => {
// ... (unchanged)
  if (!methods || methods.length === 0) return "N/A";
  return methods.map(m => m.method.toUpperCase()).join(', ');
};

export const SalesTable = ({ sales, isLoading, currency, onView, onPrint, onRefund, onCancel }: any) => {
  if (isLoading) return <TableLoadingSkeleton />;
  if (!sales || sales.length === 0) return <TableEmptyState message="No sales found matching your filters." />;
  
  return (
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-0">Invoice #</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Product(s)</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Amount</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Payment</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Salesperson</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Tags</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-0"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sales.map((sale: any) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-0">{sale.invoiceId || sale.id.slice(0, 6)}</td>
                  <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">{sale.customerName}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400" title={sale.items?.map((i:any) => i.productName).join(', ')}>{getProductSummary(sale.items)}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{dayjs(sale.createdAt).format("DD MMM YYYY")}</td>
                  <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(sale.totalAmount, sale.invoiceCurrency)}</td>
                  
                  {/* --- FIX: Use status first, then fallback to paymentStatus --- */}
                  <td className="px-3 py-4 text-sm">
                    <StatusBadge 
                      status={
                        (sale.status === 'refunded' || sale.status === 'voided') 
                        ? sale.status 
                        : sale.paymentStatus
                      } 
                      options={SALE_STATUSES} 
                    />
                  </td>
                  
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{getPaymentSummary(sale.paymentLines)}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{sale.salespersonName || sale.salesperson}</td>
                  <td className="px-3 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {sale.tags?.map((tag: string) => <TagBadge key={tag} tag={tag} />)}
                    </div>
                  </td>
                  <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <ActionsMenu 
                      sale={sale}
                      onView={() => onView(sale)} 
                      onPrint={() => onPrint(sale)}
                      onRefund={() => onRefund(sale)}
                      onCancel={() => onCancel(sale)}
                    />
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

// --- (MODIFIED) ReturnsTable ---
// Added onPrint prop
export const ReturnsTable = ({ returns, isLoading, currency, onView, onPrint }: { 
  returns: any[], 
  isLoading: boolean, 
  currency: string, 
  onView: (ret: any) => void,
  onPrint: (ret: any) => void // <-- (NEW) Add onPrint prop
}) => {
  if (isLoading) return <TableLoadingSkeleton />;
  if (!returns || returns.length === 0) return <TableEmptyState message="No returns found matching your filters." />;
  
  return (
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-0">Return ID</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Original Sale ID</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Refund Amount</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Reason</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Processed By</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-0"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {returns.map((ret: any) => (
                <tr key={ret.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-0">{ret.id.slice(0, 8)}...</td>
                  <td className="px-3 py-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                    <a href={`/sales?view=history&searchQuery=${ret.invoiceId || ret.originalSaleId}`}>{ret.invoiceId || ret.originalSaleId.slice(0, 8)}...</a>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{dayjs(ret.createdAt).format("DD MMM YYYY")}</td>
                  <td className="px-3 py-4 text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(ret.refundAmount, ret.refundCurrency)}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{ret.reason}</td>
                  <td className="px-3 py-4 text-sm"><StatusBadge status={ret.status} options={RETURN_STATUSES} /></td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{ret.processedByUserName}</td>
                  <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    {/* --- (NEW) Add Print button --- */}
                    <button 
                      onClick={() => onPrint(ret)} 
                      title="Print Credit Note"
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {/* --- End New Button --- */}
                    <button 
                      onClick={() => onView(ret)} 
                      title="View Details"
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                    >
                      <Info className="h-4 w-4" />
                    </button>
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


export const ActionsMenu = ({ sale, onView, onPrint, onRefund, onCancel }: { 
  sale: any, 
  onView: () => void, 
  onPrint: () => void,
  onRefund: () => void,
  onCancel: () => void
}) => {
  
  const isRefunded = sale.status === 'refunded';
  const isVoided = sale.status === 'voided';
  const isUnpaid = sale.paymentStatus === 'unpaid';
  
  return (
    <Popover className="relative">
      <Popover.Button title="More actions" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
        <MoreVertical className="h-5 w-5" />
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Popover.Panel className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-700">
          <div className="py-1">
            <button
              onClick={onView}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              View
            </button>
            
            <button
              onClick={onPrint}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Print
            </button>
            
            {(isRefunded || isVoided) && (
              <span className="block w-full px-4 py-2 text-left text-sm text-gray-400 dark:text-gray-500">
                {isRefunded ? "Refunded" : "Voided"}
              </span>
            )}

            {!isRefunded && !isVoided && (sale.paymentStatus === 'paid' || sale.paymentStatus === 'partial') && (
              <button
                onClick={onRefund}
                className="block w-full px-4 py-2 text-left text-sm text-yellow-700 hover:bg-gray-100 dark:text-yellow-400 dark:hover:bg-gray-700"
              >
                Refund
              </button>
            )}
            
            {!isRefunded && !isVoided && isUnpaid && (
              <button
                onClick={onCancel}
                className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
              >
                Cancel Sale
              </button>
            )}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}

export const StatusBadge = ({ status, options }: { status: string, options: { id: string, label: string, color: string }[] }) => {
  const statusInfo = options.find(o => o.id === status);
  const color = statusInfo?.color || "text-gray-500";
  const label = statusInfo?.label || status;
  const icons: Record<string, React.ElementType> = {
    paid: CheckCircle, partial: Clock, unpaid: XCircle, overdue: FileWarning,
    pending: Clock, approved: CheckCircle, processed: CheckCircle, rejected: XCircle,
    draft: FileText, sent: Send, accepted: CheckCircle, refunded: Undo, voided: XCircle
  };
  const Icon = icons[status] || Info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${color.replace('text-', 'bg-').replace('-500', '-100').replace('-700', '-100')} ${color} dark:bg-opacity-20`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

export const TagBadge = ({ tag, onRemove }: { tag: string, onRemove?: () => void }) => (
  <span className="mr-1 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
    {tag}
    {onRemove && <button type="button" onClick={onRemove} className="ml-1 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
  </span>
);

export const Pagination = ({ pagination, onPageChange }: any) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { currentPage, totalPages } = pagination;
  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>{children}</div>;
export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
export const LoadingSpinner = () => <div className="flex h-screen w-full items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;
export const ChartEmptyState = () => <div className="flex h-full w-full flex-col items-center justify-center text-gray-400"><TrendingUp className="h-12 w-12 opacity-50" /><p className="mt-2 text-sm">No data for this period</p></div>;
export const TableEmptyState = ({ message }: { message: string }) => <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>;
export const TableLoadingSkeleton = () => <div className="mt-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
export const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-red-500" />
      <div>
        <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Data</h3>
        <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
      </div>
    </div>
  </Card>
);

export const FormInput = React.forwardRef(({ label, type = "text", className = "", onChange, ...props }: any, ref) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <input 
      type={type} 
      ref={ref} 
      {...props} 
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-700/50" 
    />
  </div>
));
FormInput.displayName = "FormInput";

export const FormTextarea = ({ label, value, onChange, placeholder = "", className = "" }: any) => (
  <div className={className}>
    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-5g-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
  </div>
);

export const FormSelect = ({ label, value, onChange, children, className = "" }: any) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
      {children}
    </select>
  </div>
);

export const TotalRow = ({ label, value, isDebt = false, isBold = false }: { label: string, value: string, isDebt?: boolean, isBold?: boolean }) => (
  <div className={`flex justify-between text-sm ${isBold ? 'font-semibold' : ''} ${isDebt ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
    <span className="text-gray-600 dark:text-gray-300">{label}:</span>
    <span className={isBold ? 'text-lg' : ''}>{value}</span>
  </div>
);

export const TransitionedModal = ({
  isOpen,
  onClose,
  children,
  size = 'md' 
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl'; 
}) => {
  const sizeClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
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
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// ... (ViewSaleModal unchanged)
export const ViewSaleModal = ({ 
  isOpen, 
  onClose, 
  sale, 
  onPrint 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  sale: any | null, 
  onPrint: (sale: any) => void 
}) => {
  if (!sale) return null;

  const currency = sale.invoiceCurrency || 'USD';

  return (
    <TransitionedModal isOpen={isOpen} onClose={onClose} size="lg">
      
      {/* --- TOP BAR: Close Button Only (Clean look) --- */}
      <div className="absolute right-4 top-4 z-10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-gray-100 p-1 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* --- HEADER SECTION --- */}
      <div className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Invoice <span className="text-gray-400">#</span>{sale.invoiceId || sale.id.slice(0, 6)}
            </h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {dayjs(sale.createdAt).format("DD MMM YYYY")}
              </span>
              <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {dayjs(sale.createdAt).format("h:mm A")}
              </span>
            </div>
          </div>
          
          <div className="mt-2 sm:mt-0">
             <StatusBadge 
              status={
                (sale.status === 'refunded' || sale.status === 'voided') 
                ? sale.status 
                : sale.paymentStatus
              } 
              options={SALE_STATUSES} 
            />
          </div>
        </div>
      </div>

      {/* --- INFO CARDS GRID --- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        
        {/* Card 1: Customer Details */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <User className="h-4 w-4 text-blue-500" />
            Billed To
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {sale.customerName || 'Guest Customer'}
              </p>
              {sale.customerPhone ? (
                 <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                   <Phone className="h-3.5 w-3.5 text-gray-400" />
                   {sale.customerPhone}
                 </p>
              ) : (
                <p className="text-sm italic text-gray-400">No contact info</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Sales Metadata */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Processed By
          </div>
          <div>
             <p className="text-base font-bold text-gray-900 dark:text-white">
                {sale.salespersonName || 'System Admin'}
              </p>
             <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
               Sales Staff
             </p>
          </div>
        </div>
      </div>

      {/* --- ITEMS TABLE --- */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/80 backdrop-blur dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Item</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {sale.items?.map((item: any, idx: number) => (
                <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{item.productName}</div>
                    {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                         {Object.values(item.selectedVariants).filter(Boolean).map((val: any, vIdx) => (
                           <span key={vIdx} className="inline-flex items-center rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                             {val}
                           </span>
                         ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(item.pricePerUnit, currency)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.quantity * item.pricePerUnit, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FINANCIALS FOOTER --- */}
      <div className="rounded-2xl bg-gray-900 p-6 text-white dark:bg-black/40 dark:ring-1 dark:ring-white/10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          
          {/* Left: Payment Methods */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-medium text-gray-400">
              <CreditCard className="h-4 w-4" />
              Payment History
            </h4>
            <div className="space-y-2">
              {sale.paymentLines?.length > 0 ? (
                sale.paymentLines.map((pm: any, index: number) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                      <span className="capitalize text-gray-300">{pm.method}</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(pm.amount, pm.currency || currency)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm italic text-gray-500">No payments recorded.</p>
              )}
            </div>
          </div>

          {/* Right: Big Totals */}
          <div className="flex flex-col justify-center space-y-3 border-t border-gray-800 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
             <div className="flex justify-between text-sm text-gray-400">
               <span>Subtotal</span>
               <span>{formatCurrency(sale.totalAmount, currency)}</span>
             </div>
             
             <div className="flex items-baseline justify-between">
               <span className="text-lg font-medium text-gray-200">Total Due</span>
               <span className="text-3xl font-bold tracking-tight">{formatCurrency(sale.totalAmount, currency)}</span>
             </div>

             {sale.debtAmount > 0 && (
               <div className="mt-2 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-red-400">
                 <span className="text-sm font-medium">Outstanding Balance</span>
                 <span className="font-bold">{formatCurrency(sale.debtAmount, currency)}</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* --- ACTIONS --- */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => onPrint(sale)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <Printer className="h-4 w-4" />
          Print Invoice
        </button>
      </div>

    </TransitionedModal>
  );
};
// --- (MODIFIED) NewReturnModal (with PDF) ---
export const NewReturnModal = ({ isOpen, onClose, onSuccess, saleToReturn }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSuccess: () => void,
  saleToReturn: any | null 
}) => {
  // --- (NEW) Get subscription info ---
  const { subscription } = useAuth(); 
  
  const [step, setStep] = useState(1); // 1: Search, 2: Details
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- (NEW) PDF State ---
  const [pdfData, setPdfData] = useState<any | null>(null);
  const [PdfComponent, setPdfComponent] = useState<React.ElementType | null>(null);
  
  // --- Step 1: Search State ---
  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  
  // --- Step 2: Details State ---
  const [saleData, setSaleData] = useState<any>(null);
  const [itemsToReturn, setItemsToReturn] = useState<any>({}); // { [productId]: quantity }
  const [refundAmount, setRefundAmount] = useState("");
  const [refundCurrency, setRefundCurrency] = useState("USD");
  const [refundMethod, setRefundMethod] = useState<keyof typeof PAYMENT_PROVIDERS>("CASH");
  const [reason, setReason] = useState("");

  const queryString = useMemo(() => {
    // ... (unchanged)
    const params = new URLSearchParams();
    params.set('view', 'history'); 
    params.set('currency', 'USD'); // Default search currency
    
    if (filter === 'today') {
      params.set('startDate', dayjs().startOf('day').format('YYYY-MM-DD'));
      params.set('endDate', dayjs().endOf('day').format('YYYY-MM-DD'));
    } else if (filter === 'week') {
      params.set('startDate', dayjs().startOf('week').format('YYYY-MM-DD'));
      params.set('endDate', dayjs().endOf('week').format('YYYY-MM-DD'));
    }
    
    if (search) params.set('searchQuery', search);
    return params.toString();
  }, [filter, search]);

  const { data: searchData, error: searchError, isLoading: isSearching } = useSWR(
    (isOpen && step === 1 && !saleToReturn) ? `/api/sales?${queryString}` : null, 
    fetcher
  );

  useEffect(() => {
    // ... (unchanged)
    if (isOpen && saleToReturn) {
      setSaleData(saleToReturn);
      setRefundAmount(saleToReturn.totalPaid.toString());
      setRefundCurrency(saleToReturn.invoiceCurrency); 
      setStep(2); 
    } else if (isOpen) {
      resetModal();
    }
  }, [isOpen, saleToReturn]);


  const resetModal = () => {
    // ... (unchanged)
    setStep(1);
    setIsBusy(false);
    setError(null);
    setSearch('');
    setFilter('today');
    setSaleData(null);
    setItemsToReturn({});
    setRefundAmount("");
    setRefundCurrency("USD");
    setRefundMethod("CASH");
    setReason("");
    // --- (NEW) Reset PDF state ---
    setPdfData(null);
    setPdfComponent(null);
  };

  const handleClose = () => {
    // (MODIFIED)
    resetModal(); 
    onClose();    
  };

  const handleSelectSale = (sale: any) => {
    // ... (unchanged)
    setSaleData(sale);
    setRefundAmount(sale.totalPaid.toString());
    setRefundCurrency(sale.invoiceCurrency); 
    setStep(2); 
  };

  const handleItemQuantityChange = (productId: string, quantity: number, maxQuantity: number) => {
    // ... (unchanged)
    if (quantity > maxQuantity) quantity = maxQuantity;
    if (quantity < 0) quantity = 0;
    setItemsToReturn((prev: any) => ({ ...prev, [productId]: quantity }));
  };

  const handleSubmitReturn = async () => {
    setError(null);
    setIsBusy(true);

    // --- FIX: Add validation for Reason ---
    if (!reason || reason.trim().length < 3) {
      setError("Please provide a reason (at least 3 characters).");
      setIsBusy(false);
      return;
    }
    // -------------------------------------

    const finalItemsToReturn = saleData.items
      .filter((item: any) => (itemsToReturn[item.productId] || 0) > 0)
      .map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: itemsToReturn[item.productId],
        pricePerUnit: item.pricePerUnit,
      }));

    if (finalItemsToReturn.length === 0) {
      setError("Please select at least one item to return.");
      setIsBusy(false);
      return;
    }
    
    const numericRefundAmount = Number(refundAmount);
    if (isNaN(numericRefundAmount) || numericRefundAmount < 0) {
         setError("Invalid refund amount.");
         setIsBusy(false);
         return;
    }
    
    if (numericRefundAmount > saleData.totalPaid) {
         setError(`Refund amount cannot exceed total paid: ${formatCurrency(saleData.totalPaid, saleData.invoiceCurrency)}`);
         setIsBusy(false);
         return;
    }

    try {
      // ... (API call)
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("User is not authenticated.");
      const token = await firebaseUser.getIdToken();
      
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          originalSaleId: saleData.id,
          itemsToReturn: finalItemsToReturn,
          reason,
          refundAmount: numericRefundAmount,
          refundCurrency,
          refundMethod,
          status: 'processed' // Auto-process
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit return.");
      }

      // --- (NEW) PDF Generation on Success ---
      const savedReturn = await res.json();
      
      // 1. Get store info
      const storeInfo = {
        name: subscription?.storeName || "My Store",
        address: subscription?.storeAddress || "123 Main St",
        phone: subscription?.storePhone || "555-1234",
        logoUrl: subscription?.logoUrl,
        planId: subscription?.planId,
      };

      // 2. Get the 'refund' template
      const Template = getTemplateComponent('refund' as ReportType, subscription);

      // 3. Set PDF state to show the download view
      setPdfData({ data: savedReturn.data, store: storeInfo });
      setPdfComponent(() => Template);
      
      onSuccess(); // Mutate background data

    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <TransitionedModal isOpen={isOpen} onClose={handleClose} size="lg">
      
      {/* --- (NEW) PDF Download View --- */}
      {pdfData && PdfComponent ? (
        <>
          <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Refund Processed
          </Dialog.Title>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The refund has been successfully processed. You can now download the PDF credit note.
            </p>
            <PDFDownloadLink
              document={<PdfComponent data={pdfData.data} store={pdfData.store} />}
              fileName={`CreditNote_${pdfData.data.id.slice(0, 6)}.pdf`}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {({ loading }) => 
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download Credit Note
                  </>
                )
              }
            </PDFDownloadLink>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={handleClose} // This will reset all state
            >
              Close
            </button>
          </div>
        </>
      ) : (
        
        // --- Original Form View ---
        <>
          <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
            Create New Return
          </Dialog.Title>
          {error && (
            <div className="my-2 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
          
          {step === 1 && (
            // ... (unchanged Step 1 JSX)
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Find the original sale to begin the return process.
              </p>
              <div className="my-4 flex gap-2">
                <FormInput
                  label="Search"
                  placeholder="Search by customer or invoice..."
                  value={search}
                  onChange={setSearch}
                  className="flex-grow"
                />
                <FormSelect label="Date" value={filter} onChange={setFilter}>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="custom">Custom</option>
                </FormSelect>
              </div>
              <div className="mt-4 h-64 overflow-y-auto rounded-lg border dark:border-gray-700">
                {isSearching && <p className="p-4 text-center text-gray-500">Loading...</p>}
                {searchError && <p className="p-4 text-center text-red-500">{searchError.message}</p>}
                {searchData && searchData.salesList?.length === 0 && <p className="p-4 text-center text-gray-500">No sales found.</p>}
                
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchData?.salesList?.map((sale: any) => (
                      <tr 
                        key={sale.id} 
                        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${sale.paymentStatus === 'unpaid' || sale.status === 'refunded' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (sale.paymentStatus !== 'unpaid' && sale.status !== 'refunded') {
                            handleSelectSale(sale);
                          }
                        }}
                        title={sale.paymentStatus === 'unpaid' ? 'Cannot refund an unpaid sale' : (sale.status === 'refunded' ? 'Sale already refunded' : 'Select this sale')}
                      >
                        <td className="p-3 text-sm">
                          <div className="font-medium dark:text-white">{sale.customerName}</div>
                          <div className="text-gray-500">{sale.invoiceId}</div>
                        </td>
                        <td className="p-3 text-right text-sm">
                          <div className="font-medium dark:text-white">{formatCurrency(sale.totalAmount, sale.invoiceCurrency)}</div>
                          <div className="text-gray-500">{dayjs(sale.createdAt).format('DD MMM YYYY')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 2 && saleData && (
            // ... (unchanged Step 2 JSX)
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-semibold dark:text-white">Sale: {saleData.invoiceId}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customer: {saleData.customerName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total Paid: <strong>{formatCurrency(saleData.totalPaid, saleData.invoiceCurrency)}</strong>
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Items to Return</label>
                {saleData.items.map((item: any) => (
                  <div key={item.productId} className="flex items-center justify-between gap-2 rounded border p-2 dark:border-gray-700">
                    <div>
                      <p className="font-medium dark:text-white">{item.productName}</p>
                      <p className="text-sm text-gray-500">Sold: {item.quantity} @ {formatCurrency(item.pricePerUnit, saleData.invoiceCurrency)}</p>
                    </div>
                    <FormInput
                      label="Return Qty"
                      type="number"
                      max={item.quantity}
                      min={0}
                      value={itemsToReturn[item.productId] || 0}
                      onChange={(val: string) => handleItemQuantityChange(item.productId, Number(val), item.quantity)}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormInput
                  label="Refund Amount"
                  type="number"
                  value={refundAmount}
                  onChange={setRefundAmount}
                  max={saleData.totalPaid}
                />
                <FormSelect label="Currency" value={refundCurrency} onChange={setRefundCurrency}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </FormSelect>
                <FormSelect label="Refund Method" value={refundMethod} onChange={setRefundMethod}>
                  {Object.entries(PAYMENT_PROVIDERS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </FormSelect>
              </div>
              <FormTextarea
                label="Reason for Return"
                placeholder="e.g., Damaged item, wrong size..."
                value={reason}
                onChange={setReason}
              />
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            {/* ... (unchanged modal buttons) */}
            {step === 2 && !saleToReturn && ( 
              <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm" onClick={() => setStep(1)}>Back to Search</button>
            )}
            <div className="flex-grow" /> 
            <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm" onClick={handleClose}>Cancel</button>
            {step === 2 && (
              <button 
                type="button" 
                onClick={handleSubmitReturn}
                disabled={isBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Process Return"}
              </button>
            )}
          </div>
        </>
      )}
    </TransitionedModal>
  );
};


// ... (CreateInvoiceModal, CancelSaleModal, SalesDashboard, SalesHistory, SalesInvoices, SalesDataContainer, SalesReturns unchanged)
export const CreateInvoiceModal = ({ isOpen, onClose, onPrint, globalFilters }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onPrint: (sale: any) => void,
  globalFilters: any 
}) => {
  
  const [filters, setFilters] = useState({
    search: '',
    currency: globalFilters.currency,
    startDate: globalFilters.startDate,
    endDate: globalFilters.endDate,
  });

  useEffect(() => {
    if (isOpen) {
      setFilters({
        search: '',
        currency: globalFilters.currency,
        startDate: globalFilters.startDate,
        endDate: globalFilters.endDate,
      });
    }
  }, [isOpen, globalFilters]);
  
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('view', 'history'); 
    params.set('currency', filters.currency); 
    params.set('startDate', filters.startDate); 
    params.set('endDate', filters.endDate); 
    if (filters.search) {
      params.set('searchQuery', filters.search);
    }
    return params.toString();
  }, [filters]);

  const { data, error, isLoading } = useSWR(
    isOpen ? `/api/sales?${queryString}` : null, 
    fetcher
  );

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <TransitionedModal isOpen={isOpen} onClose={onClose} size="lg">
      <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
        Create Invoice from Existing Sale
      </Dialog.Title>
      <p className="text-sm text-gray-500">Select a sale to generate an invoice for.</p>
      
      <div className="my-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <FormInput
          label="Search"
          placeholder="Search by customer..."
          value={filters.search}
          onChange={(val: string) => handleFilterChange('search', val)}
          className="sm:col-span-3"
        />
        <FormSelect 
          label="Currency" 
          value={filters.currency} 
          onChange={(val: string) => handleFilterChange('currency', val)}
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect>
        <FormInput
          label="Start Date"
          type="date"
          value={filters.startDate}
          onChange={(val: string) => handleFilterChange('startDate', val)}
        />
        <FormInput
          label="End Date"
          type="date"
          value={filters.endDate}
          onChange={(val: string) => handleFilterChange('endDate', val)}
        />
      </div>
      
      <div className="mt-4 h-64 overflow-y-auto rounded-lg border dark:border-gray-700">
        {isLoading && <p className="p-4 text-center text-gray-500">Loading...</p>}
        {error && <p className="p-4 text-center text-red-500">{error.message}</p>}
        {data && data.salesList?.length === 0 && <p className="p-4 text-center text-gray-500">No sales found.</p>}
        
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data?.salesList?.map((sale: any) => (
              <tr 
                key={sale.id} 
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  onPrint(sale); 
                  onClose();     
                }}
              >
                <td className="p-3 text-sm">
                  <div className="font-medium dark:text-white">{sale.customerName}</div>
                  <div className="text-gray-500">{sale.invoiceId}</div>
                </td>
                <td className="p-3 text-right text-sm">
                  <div className="font-medium dark:text-white">{formatCurrency(sale.totalAmount, sale.invoiceCurrency)}</div>
                  <div className="text-gray-500">{dayjs(sale.createdAt).format('DD MMM YYYY')}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
      </div>
    </TransitionedModal>
  );
};

export const CancelSaleModal = ({ isOpen, onClose, onConfirm, isBusy, sale }: {
  isOpen: boolean,
  onClose: () => void,
  onConfirm: () => void,
  isBusy: boolean,
  sale: any | null
}) => {
  if (!sale) return null;
  
  return (
    <TransitionedModal isOpen={isOpen} onClose={onClose} size="md">
      <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
        Cancel Sale
      </Dialog.Title>
      <div className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Are you sure you want to cancel this unpaid sale?
        </p>
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="font-semibold text-gray-900 dark:text-white">{sale.customerName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Invoice: {sale.invoiceId}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: {formatCurrency(sale.totalAmount, sale.invoiceCurrency)} (Unpaid)
          </p>
        </div>
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          This action will void the sale and delete any associated debt. This cannot be undone.
        </p>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={onClose}
          disabled={isBusy}
        >
          Close
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          onClick={onConfirm}
          disabled={isBusy}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Confirm Cancel
        </button>
      </div>
    </TransitionedModal>
  );
};

export const SalesDashboard = ({ filters, onViewSale, onPrintSale, onRefund, onCancel }: any) => {
  const [page, setPage] = useState(1);
  
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]: any) => {
      if (value) params.set(key, value);
    });
    params.set("page", page.toString());
    params.set("view", "dashboard"); 
    return params.toString();
  }, [filters, page]);

  const {
    data,
    error,
    isLoading,
  } = useSWR(`/api/sales?${queryString}`, fetcher);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0) setPage(newPage);
  };
  
  if (error) return <ErrorDisplay error={error} />

  const kpis = data?.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Total Sales" value={formatCurrency(kpis?.totalSales, filters.currency)} icon={DollarSign} color="text-green-500" isLoading={isLoading} />
        <KpiCard title="Transactions" value={kpis?.totalTransactions ?? 0} icon={Receipt} color="text-blue-500" isLoading={isLoading} />
        <KpiCard title="Average Sale" value={formatCurrency(kpis?.avgSale, filters.currency)} icon={TrendingUp} color="text-purple-500" isLoading={isLoading} />
        <KpiCard title="Total Debts" value={formatCurrency(kpis?.totalDebts, filters.currency)} icon={CreditCard} color="text-orange-500" isLoading={isLoading} />
        <KpiCard title="Paid %" value={`${(kpis?.paidPercent ?? 0).toFixed(0)}%`} icon={CheckCircle} color="text-teal-500" isLoading={isLoading} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <ChartCard title="Sales Trend Over Time" className="lg:col-span-3">
          <SalesTrendChart data={data?.charts.salesTrend} currency={filters.currency} />
        </ChartCard>
        <ChartCard title="Payment Method Breakdown" className="lg:col-span-2">
          <PaymentPieChart data={data?.charts.paymentBreakdown} currency={filters.currency} />
        </ChartCard>
      </div>
      <Card>
        <h3 className="text-lg font-semibold dark:text-white">Recent Sales</h3>
        <SalesTable 
          sales={data?.salesList} 
          isLoading={isLoading} 
          currency={filters.currency} 
          onView={onViewSale}
          onPrint={onPrintSale}
          onRefund={onRefund} 
          onCancel={onCancel}
        />
        <Pagination pagination={data?.pagination} onPageChange={handlePageChange} />
      </Card>
    </div>
  );
};

const SalesHistory = ({ data, isLoading, currency, onPageChange, onViewSale, onPrintSale, onRefund, onCancel }: any) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold dark:text-white">Sales History</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {`Showing ${data?.salesList?.length || 0} of ${data?.pagination?.totalResults || 0} matching sales.`}
      </p>
      <SalesTable 
        sales={data?.salesList} 
        isLoading={isLoading} 
        currency={currency} 
        onView={onViewSale}
        onPrint={onPrintSale}
        onRefund={onRefund}
        onCancel={onCancel}
      />
      <Pagination pagination={data?.pagination} onPageChange={onPageChange} />
    </Card>
  );
};

const SalesInvoices = ({ data, isLoading, currency, onPageChange, onViewSale, onPrintSale, onCreateInvoice, onRefund, onCancel }: any) => {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold dark:text-white">Invoices</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {`Showing ${data?.salesList?.length || 0} of ${data?.pagination?.totalResults || 0} matching invoices.`}
            </p>
          </div>
          <button 
            onClick={onCreateInvoice}
            className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </button>
        </div>
        <SalesTable 
          sales={data?.salesList} 
          isLoading={isLoading} 
          currency={currency} 
          onView={onViewSale}
          onPrint={onPrintSale}
          onRefund={onRefund}
          onCancel={onCancel}
        />
        <Pagination pagination={data?.pagination} onPageChange={onPageChange} />
      </Card>
    </div>
  );
};

export const SalesDataContainer = ({ filters, view, onViewSale, onPrintSale, onRefund, onCancel, onCreateInvoice }: any) => {
  const [page, setPage] = useState(1);
  
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]: any) => {
      if (value) params.set(key, value);
    });
    params.set("page", page.toString());
    params.set("view", view);
    return params.toString();
  }, [filters, page, view]);

  const {
    data,
    error,
    isLoading,
  } = useSWR(`/api/sales?${queryString}`, fetcher);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0) setPage(newPage);
  };
  
  if (error) return <ErrorDisplay error={error} />
  
  if (view === 'history') {
    return (
      <SalesHistory
        data={data}
        isLoading={isLoading}
        currency={filters.currency}
        onPageChange={handlePageChange}
        onViewSale={onViewSale}
        onPrintSale={onPrintSale}
        onRefund={onRefund}
        onCancel={onCancel}
      />
    );
  }
  
  if (view === 'invoices') {
    return (
      <SalesInvoices
        data={data}
        isLoading={isLoading}
        currency={filters.currency}
        onPageChange={handlePageChange}
        onViewSale={onViewSale}
        onPrintSale={onPrintSale}
        onCreateInvoice={onCreateInvoice}
        onRefund={onRefund}
        onCancel={onCancel}
      />
    );
  }
  
  return null;
};

// --- (MODIFIED) SalesReturns ---
// Added onPrintReturn prop
export const SalesReturns = ({ data, isLoading, currency, onPageChange, onNewReturn, onViewReturn, onPrintReturn }: { 
  data: any, 
  isLoading: boolean, 
  currency: string, 
  onPageChange: (page: number) => void, 
  onNewReturn: () => void, 
  onViewReturn: (ret: any) => void,
  onPrintReturn: (ret: any) => void // <-- (NEW) Add prop
}) => {
  const kpis = data?.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Returns" value={kpis?.totalReturns ?? 0} icon={Undo} color="text-red-500" isLoading={isLoading} />
        <KpiCard title="Refunds Issued" value={
          kpis?.totalRefunds && Object.keys(kpis.totalRefunds).length > 0 ? (
            Object.entries(kpis.totalRefunds).map(([cur, val]: any) => (
              <span key={cur} className="block text-xl font-semibold">{formatCurrency(val, cur)}</span>
            ))
          ) : formatCurrency(0, currency)
        } icon={DollarSign} color="text-red-600" isLoading={isLoading} />
        <KpiCard title="Pending Requests" value={kpis?.pendingRequests ?? 0} icon={Clock} color="text-yellow-500" isLoading={isLoading} />
        <KpiCard title="Avg. Refund" value={"N/A"} icon={TrendingUp} color="text-purple-500" isLoading={isLoading} />
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold dark:text-white">Returns & Refunds</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {`Showing ${data?.returnsList?.length || 0} of ${data?.pagination?.totalResults || 0} returns.`}
            </p>
          </div>
          <button 
            onClick={onNewReturn}
            className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300"
          >
            <Plus className="h-4 w-4" />
            New Return
          </button>
        </div>
        <ReturnsTable 
          returns={data?.returnsList} 
          isLoading={isLoading} 
          currency={currency}
          onView={onViewReturn}
          onPrint={onPrintReturn} // <-- (NEW) Pass prop down
        />
        <Pagination pagination={data?.pagination} onPageChange={onPageChange} />
      </Card>
    </div>
  );
};