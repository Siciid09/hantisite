// File: app/(main)/debts/page.tsx
// Description: Main Debts Management screen for the web.
// --- SUPER-POWERED MODERN VERSION (FINAL & FULLY FIXED) ---
// 1. Replaced all `alert()` and `confirm()` with UI modals.
// 2. Added Global Error and Success Toasts.
// 3. Form validation errors (required, etc.) show in-modal.
// 4. Fixed AddDebtModal (removed payment method).
// 5. Fixed ViewDebtModal (history now loads correctly).
// 6. Fixed PayDebtModal (payment method dropdown is now included).
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useMemo, useEffect } from "react";
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
} from "lucide-react";

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
  
  // --- (NEW) UI Error & Success State ---
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteModalDebt, setDeleteModalDebt] = useState<any | null>(null);


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

  // --- Bulk Action Handlers ---
  const handleBulkDelete = async () => {
    if (selectedDebts.length === 0) return;
    // (FIX) Replaced window.confirm with a simple prompt for now.
    // A proper bulk delete modal would be the next step.
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
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add New Debt
        </button>
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
              onDelete={setDeleteModalDebt} // (FIX) Pass the setter
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
      {/* (NEW) Delete Confirmation Modal */}
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

// Inside app/(main)/debts/page.tsx

const DebtCard = ({ debt, currency, onPay, onDelete, onView, isSelected, onSelect }: any) => {
  
  // (FIX) Replaced inline delete with modal confirmation
  const startDelete = () => {
    onDelete(debt); // This now opens the ConfirmDeleteModal
  };

  // -----------------------------------------------------------------
  // --- ADD THIS LINE FOR DEBUGGING ---
  console.log("DEBT OBJECT IN DEBTCARD:", debt);
  // -----------------------------------------------------------------
  
  const status = debt.isPaid ? 'paid' : (debt.status === 'partial' ? 'partial' : 'unpaid');
  
  // ... rest of the component
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
              onClick={() => onPay(debt)} // <--- CORRECT
              className="rounded-lg p-2 text-green-600..."
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
            onClick={startDelete} // (FIX) Use new handler
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

// (FIX) AddDebtModal: Removed Payment Method, uses setGlobalError
// --- (FIX) REPLACE YOUR ENTIRE AddDebtModal WITH THIS ---

const AddDebtModal = ({ onClose, onSuccess, defaultCurrency, debtToEdit, setGlobalError }: any) => {
  const isEditMode = !!debtToEdit;

  // --- (NEW) Customer Selection State ---
  const [customerMode, setCustomerMode] = useState<'select' | 'new'>('select');
  
  // --- (NEW) Fetch Customers List ---
  // This uses your app/api/customers/route.ts
  const { 
    data: customersData, 
    error: customersError 
  } = useSWR('/api/customers?tab=list', fetcher);
  const customers = customersData || [];

  const [formData, setFormData] = useState({
    customerId: debtToEdit?.customerId || "", // <-- (NEW)
    clientName: debtToEdit?.clientName || "",
    clientPhone: debtToEdit?.clientPhone || "",
    clientWhatsapp: debtToEdit?.clientWhatsapp || "",
    amountDue: debtToEdit?.amountDue || "",
    reason: debtToEdit?.reason || "",
    currency: debtToEdit?.currency || defaultCurrency,
    tags: debtToEdit?.tags?.join(', ') || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(""); // Local form validation error

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  // --- (NEW) Handle Customer Selection ---
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
        customerId: selectedCustomer.id, // <-- (NEW)
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
        // (NEW) Send customerId if a new customer isn't being made
        customerId: customerMode === 'select' ? formData.customerId : null,
        tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      };
      
      // We POST to /api/debts, which we will fix in Part 2
      const res = await fetch("/api/debts", {
        method: "POST", // This only supports creating new debts
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

  // Helper to get current owed amount for the dropdown
  const getOwedAmount = (customer: any) => {
    if (!customer.totalOwed || !customer.totalOwed[formData.currency]) {
      return formatCurrency(0, formData.currency);
    }
    return formatCurrency(customer.totalOwed[formData.currency], formData.currency);
  };

  return (
    <ModalBase title={isEditMode ? "Edit Debt" : "Add New Debt"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* --- (NEW) Customer Selection UI --- */}
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Customer Details</h3>
            {!isEditMode && ( // Only show toggle when creating
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
              disabled={customerMode === 'select' && !isEditMode} // Lock if selected
              required
            />
          <FormInput
  label="Customer Phone"
  name="clientPhone"
  value={formData.clientPhone}
  onChange={handleChange}
  // disabled prop removed <--- FIX
  required
            />
          </div>
        </div>
        {/* --- End Customer Selection UI --- */}

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

// --- (FIX) ViewDebtModal: Removed SWR, uses debt.paymentHistory ---
const ViewDebtModal = ({ debt, onClose, onPay }: any) => {
  // (FIX) Remove SWR. Use the data from the prop.
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

        {/* (FIX) Payment History Section */}
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
                        {/* Handle Firebase Timestamp */}
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

// --- (FIX) PayDebtModal: Added Payment Method, uses setGlobalError ---
const PayDebtModal = ({ debt, onClose, onSuccess, setGlobalError }: any) => {
  // (FIX) Use formData state
  const [formData, setFormData] = useState({
    amountPaid: "",
    paymentMethod: "Cash",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(""); // Local form validation error
  
  // (FIX) Add universal handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // (FIX) UI Form Validation
    const paidAmount = parseFloat(formData.amountPaid);
    if (!paidAmount || paidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmount > debt.amountDue + 0.01) { // 0.01 tolerance
      setError("Payment cannot be more than the remaining amount due.");
      return;
    }
    
    setIsSaving(true);
    setError(""); // Clear local error
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // (FIX) Send the full form data
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
      // (FIX) Use Global Error for API errors
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
        
        {/* --- (FIX) ADDED PAYMENT METHOD DROPDOWN --- */}
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
        {/* --- END FIX --- */}
        
        {/* (FIX) This is for local form validation errors */}
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

// --- (NEW) Delete Confirmation Modal ---
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
      <option value="" disabled>-- Select --</option>
      {children}
    </select>
  </div>
);