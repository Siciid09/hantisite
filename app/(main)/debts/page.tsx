// File: app/(main)/debts/page.tsx
// Description: Main Debts Management screen for the web.
// --- SUPER-POWERED MODERN VERSION (FINAL) ---
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useMemo } from "react";
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
  FileDown, HandCoins, SlidersHorizontal,
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

// Use the same currency formatter from your other pages
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  
  // Handle specific currencies as requested
  const nonDecimalCurrencies = ["SLSH", "SOS", "KSH", "Birr"];
  if (nonDecimalCurrencies.includes(currency)) {
    return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  
  // Default to USD / Euro style
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

  // --- Filters ---
  const [filters, setFilters] = useState({
    currency: searchParams.get("currency") || "USD",
    startDate: searchParams.get("startDate") || dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: searchParams.get("endDate") || dayjs().endOf("day").format("YYYY-MM-DD"),
    searchQuery: searchParams.get("searchQuery") || "",
    searchBy: searchParams.get("searchBy") || "clientName", // NEW
    statusFilter: searchParams.get("statusFilter") || "unpaid",
    tagFilter: searchParams.get("tagFilter") || "all", // NEW
    paymentMethod: searchParams.get("paymentMethod") || "all", // NEW
    minAmount: searchParams.get("minAmount") || "", // NEW
    maxAmount: searchParams.get("maxAmount") || "", // NEW
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortDir: searchParams.get("sortDir") || "desc",
    page: parseInt(searchParams.get("page") || "1"),
  });

  // --- SWR Data Fetching ---
  const buildUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value)); // Only append non-empty filters
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
    
    // Update URL
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
  
  const handleActionSuccess = () => {
    mutate(); // Re-fetch data
    setIsAddModalOpen(false);
    setIsPayModalOpen(null);
    setIsViewModalOpen(null);
    setSelectedDebts([]);
  };

  // --- Bulk Action Handlers ---
  const handleBulkDelete = async () => {
    if (selectedDebts.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedDebts.length} selected debt records?`)) return;
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      // This should be one API call, but we simulate for now
      for (const debtId of selectedDebts) {
        await fetch(`/api/debts/${debtId}`, { // Assuming your API supports DELETE /api/debts/[id]
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      handleActionSuccess();
    } catch (err) {
      alert(`Error during bulk delete: ${err}`);
    }
  };

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 dark:bg-gray-900 md:p-8">
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

      {/* --- 🔍 Filters / Search Bar (ENHANCED) --- */}
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {isLoading && <LoadingSpinner />}
      {error && <ErrorDisplay error={error} />}
      
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

          {/* --- 💥 Bulk Actions Bar (NEW) --- */}
          {selectedDebts.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-medium text-gray-900 dark:text-white">{selectedDebts.length} debt(s) selected</span>
                <div className="flex flex-wrap gap-2">
                  <button className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">
                    <HandCoins className="h-4 w-4" /> Mark as Paid
                  </button>
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

          {/* --- 📈 Charts (ENHANCED) --- */}
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
          
          {/* --- 📊 Debts List (ENHANCED) --- */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Debt Records</h3>
            <DebtList
              debts={apiData.debtRecords}
              currency={filters.currency}
              filters={filters}
              onSort={handleSort}
              onPay={setIsPayModalOpen}
              onDelete={mutate}
              onView={setIsViewModalOpen}
              selectedDebts={selectedDebts}
              setSelectedDebts={setSelectedDebts}
            />
            <Pagination
              currentPage={apiData.pagination.currentPage}
              hasMore={apiData.pagination.hasMore}
              onPageChange={handlePageChange}
              footerData={apiData.pagination.footerData}
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
        />
      )}
      {isPayModalOpen && (
        <PayDebtModal
          debt={isPayModalOpen}
          onClose={() => setIsPayModalOpen(null)}
          onSuccess={handleActionSuccess}
        />
      )}
      {isViewModalOpen && (
        <ViewDebtModal
          debt={isViewModalOpen}
          onClose={() => setIsViewModalOpen(null)}
          onPay={setIsPayModalOpen}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

// --- ENHANCED FILTER BAR ---
// This uses placeholder <select> and <input> tags.
// For a modern feel, you would replace these with Shadcn/UI's <Select> and <Input> components.
const FilterBar = ({ filters, onFilterChange }: { filters: any, onFilterChange: (k: string, v: string | number) => void }) => (
  <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
    {/* Row 1: Search */}
    <div className="flex flex-col gap-2 md:flex-row">
      <div className="flex-shrink-0">
        {/* Modern Dropdown */}
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
        {/* Modern Search Input */}
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
    {/* Row 2: Filters */}
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {/* Modern Dropdown */}
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
      {/* Modern Dropdown */}
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
      {/* Modern Dropdown */}
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
      {/* Modern Dropdown */}
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
    {/* Row 3: Date & Amount Range */}
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {/* Modern Date Picker */}
      <input
        type="date"
        value={filters.startDate}
        onChange={(e) => onFilterChange("startDate", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      {/* Modern Date Picker */}
      <input
        type="date"
        value={filters.endDate}
        onChange={(e) => onFilterChange("endDate", e.target.value)}
        className="flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      {/* Modern Number Input */}
      <input
        type="number"
        placeholder="Min Amount"
        value={filters.minAmount}
        onChange={(e) => onFilterChange("minAmount", e.target.value)}
        className="w-full flex-grow rounded-lg border border-gray-300 p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      {/* Modern Number Input */}
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
  const COLORS = { "Unpaid": "#f97316", "Paid": "#22c55e", "Partial": "#eab308" };
  if (!data || data.every(d => d.value === 0)) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
          {data.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS] || "#8884d8"} />
          ))}
        </Pie>
        <Tooltip /> <Legend />
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
        <Tooltip />
        <Bar dataKey="totalDebt" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const MonthlyDebtTrend = ({ data }: { data: { date: string, newDebt: number, paidDebt: number }[] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tick={{ fill: '#9ca3af' }} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="newDebt" stroke="#f97316" name="New Debt" />
        <Line type="monotone" dataKey="paidDebt" stroke="#22c55e" name="Debt Paid" />
      </LineChart>
    </ResponsiveContainer>
  );
};

const TotalByCurrencyChart = ({ data }: { data: { currency: string, amount: number }[] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="currency" fontSize={12} tick={{ fill: '#9ca3af' }} />
        <YAxis fontSize={12} tick={{ fill: '#9ca3af' }} />
        <Tooltip />
        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
  
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this debt record?")) return;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      await fetch(`/api/debts/${debt.id}`, { // Assumes API route is /api/debts/[id]
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      onDelete(); // Trigger SWR mutate
    } catch (err) {
      alert(`Error deleting debt: ${err}`);
    }
  };
  
  // NEW Row Color Coding
  let rowClass = "hover:bg-gray-50 dark:hover:bg-gray-800/50";
  if (debt.isPaid) {
    rowClass = "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20";
  } else if (debt.status === 'Partial') { // Assumes API provides 'Partial' status
    rowClass = "bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20";
  } else {
    rowClass = "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20";
  }

  return (
    <tr className={rowClass}>
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
          {/* NEW: Tags display */}
          {debt.tags?.map((tag: string) => (
            <span key={tag} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className={`text-lg font-bold ${debt.isPaid ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(debt.amountDue, currency)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{debt.reason}</div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {dayjs(debt.createdAt).format("DD MMM YYYY")}
      </td>
      <td className="px-6 py-4">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          debt.isPaid
            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
            : (debt.status === 'Partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400')
        }`}>
          {debt.isPaid ? "Paid" : (debt.status === 'Partial' ? "Partial" : "Unpaid")}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-1">
          {/* NEW: View Button */}
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
            onClick={handleDelete}
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

const AddDebtModal = ({ onClose, onSuccess, defaultCurrency, debtToEdit }: any) => {
  const isEditMode = !!debtToEdit;
  const [formData, setFormData] = useState({
    clientName: debtToEdit?.clientName || "",
    clientPhone: debtToEdit?.clientPhone || "",
    clientWhatsapp: debtToEdit?.clientWhatsapp || "",
    amountDue: debtToEdit?.amountDue || "",
    reason: debtToEdit?.reason || "",
    currency: debtToEdit?.currency || defaultCurrency,
    tags: debtToEdit?.tags?.join(', ') || "", // NEW: Simple comma-separated tags
    paymentMethod: debtToEdit?.paymentMethod || "Cash", // NEW
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.clientPhone || !formData.amountDue) {
      setError("Please fill in all required fields.");
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
        tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean), // Convert string to array
      };
      
      const res = await fetch("/api/debts", { // Assumes API route is /api/debts
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(isEditMode ? { ...payload, id: debtToEdit.id } : payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save debt.");
      }
      
      onSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title={isEditMode ? "Edit Debt" : "Add New Debt"} onClose={onClose}>
      {/* NEW: 2-column layout for shorter form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Customer Name" name="clientName" value={formData.clientName} onChange={handleChange} required />
          <FormInput label="Customer Phone" name="clientPhone" value={formData.clientPhone} onChange={handleChange} required />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Customer WhatsApp (Optional)" name="clientWhatsapp" value={formData.clientWhatsapp} onChange={handleChange} />
          <FormInput label="Reason" name="reason" value={formData.reason} onChange={handleChange} required />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormSelect label="Original Payment Method" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
            <option value="Cash">Cash</option>
            <option value="ZAAD">ZAAD</option>
            <option value="EDAHAB">EDAHAB</option>
            <option value="Bank">Bank</option>
            <option value="Other">Other</option>
          </FormSelect>
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

// --- NEW: View Debt Modal ---
const ViewDebtModal = ({ debt, onClose, onPay }: any) => {
  // This is a *simulated* SWR call.
  // You would need a new API endpoint: /api/debts/[id]/history
  const { data: history, error, isLoading } = useSWR(
    `/api/debts/${debt.id}/history`, 
    fetcher, 
    { revalidateOnFocus: false }
  );

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
          <p className="text-gray-600 dark:text-gray-400">Sale ID: {debt.saleId || 'N/A'}</p>
        </div>

        {/* Payment History */}
        <div>
          <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">Payment History</h4>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3 dark:border-gray-700">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {error && <p className="text-sm text-red-500">Could not load history.</p>}
            {/* This is simulated. You would loop over `history` */}
            {debt.isPaid && (
              <div className="flex justify-between">
                <p>Paid in full</p>
                <p className="font-medium text-green-600">{formatCurrency(debt.amountDue, debt.currency)}</p>
              </div>
            )}
            {!debt.isPaid && <p className="text-sm text-gray-500">No payment history found.</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {/* FIX: Corrected closing tag from </KpiCard> to </button> */}
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


const PayDebtModal = ({ debt, onClose, onSuccess }: any) => {
  const [amountPaid, setAmountPaid] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmount = parseFloat(amountPaid);
    if (!paidAmount || paidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmount > debt.amountDue) {
      setError("Payment cannot be more than the amount due.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/debts/${debt.id}`, { // Assumes API route is /api/debts/[id]
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountPaid: paidAmount }), // This API logic is from your provided code
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
    <ModalBase title={`Pay Debt for ${debt.clientName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Amount Due:</p>
          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
            {formatCurrency(debt.amountDue, debt.currency)}
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
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
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

const Pagination = ({ currentPage, hasMore, onPageChange, footerData }: any) => (
  <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t pt-4 dark:border-gray-700 md:flex-row">
    {/* NEW: Footer Totals */}
    <div className="text-sm text-gray-600 dark:text-gray-400">
      {footerData && (
        <span className="font-medium">
          Total Unpaid (Current Filter): {footerData.totalUnpaid}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasMore}
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