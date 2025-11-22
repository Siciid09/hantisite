"use client";
// -----------------------------------------------------------------------------
// File: app/(main)/finance/page.tsx
// -----------------------------------------------------------------------------
import React, { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";

// --- Icons ---
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, PieChart as RechartsPieChart, Pie, Cell, Bar,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUpRight, ArrowDownRight,
  Banknote, BookOpen, CreditCard, DollarSign, FileText,
  Landmark, LayoutDashboard, RefreshCw, TrendingUp, Wallet,
  Smartphone, Activity, X as XIcon, User, ShoppingBag, List,
  Briefcase, Eye, Calendar, Clock, Hash, MessageSquare, Tag, 
  Printer, Download, ChevronUp
} from "lucide-react";

// --- CONSTANTS ---
const PAYMENT_PROVIDERS: Record<string, { label: string; icon: any }> = {
  CASH: { label: "Cash", icon: Banknote },
  BANK: { label: "Bank Transfer", icon: Landmark },
  ZAAD: { label: "ZAAD", icon: Smartphone },
  EDAHAB: { label: "E-Dahab", icon: Smartphone },
  EVC_PLUS: { label: "EVC Plus", icon: Smartphone },
  SAHAL: { label: "Sahal (Golis)", icon: Smartphone },
  SOMNET: { label: "Somnet", icon: Smartphone },
  E_BIRR: { label: "E-Birr", icon: Smartphone },
  M_PESA: { label: "M-Pesa", icon: Smartphone },
  OTHER: { label: "Other", icon: CreditCard },
  Unknown: { label: "Unknown", icon: CreditCard }
};

const paymentMethodsByCurrency: Record<string, string[]> = {
  USD: ["CASH", "BANK", "ZAAD", "EDAHAB", "SOMNET", "EVC_PLUS", "SAHAL", "OTHER"],
  SOS: ["CASH", "BANK", "OTHER"],
  SLSH: ["CASH", "BANK", "EDAHAB", "ZAAD", "OTHER"],
  BIRR: ["CASH", "BANK", "E_BIRR", "OTHER"],
  KSH: ["BANK", "CASH", "M_PESA", "OTHER"],
  EUR: ["CASH", "BANK", "OTHER"],
};

const TABS = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Income", icon: ArrowUpRight },
  { name: "Expenses", icon: ArrowDownRight },
  { name: "Payments & Currencies", icon: CreditCard },
  { name: "Cash Flow", icon: Activity },
  { name: "Reports", icon: BookOpen },
];

const CURRENCIES = ["USD", "EUR", "SOS", "SLSH", "KSH", "BIRR"];

// --- API Fetcher ---
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let errorBody;
    try {
      errorBody = await res.json();
    } catch (e) {
      errorBody = { error: `API Error: ${res.status}` };
    }
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// --- Main Finance Page Component ---
export default function FinancePage() {
  const { user, loading: authLoading } = useAuth();
  const [currency, setCurrency] = useState("USD"); 
  const [activeTab, setActiveTab] = useState("Overview");

  // --- Transaction Modal State ---
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  // --- Date Range Selector ---
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [dateRange, setDateRange] = useState(() => {
    const now = dayjs();
    return {
      start: now.startOf("month").format("YYYY-MM-DD"),
      end: now.endOf("month").format("YYYY-MM-DD"),
    };
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFilterChange = (filterName: string) => {
    if (filterName === "Custom") {
      setIsModalOpen(true);
      return;
    }
    setActiveFilter(filterName);
    let start = dayjs();
    let end = dayjs();
    switch (filterName) {
      case "Today": start = start.startOf("day"); end = end.endOf("day"); break;
      case "Yesterday": start = start.subtract(1, "day").startOf("day"); end = end.subtract(1, "day").endOf("day"); break;
      case "This Week": start = start.startOf("week"); end = end.endOf("week"); break;
      case "This Year": start = start.startOf("year"); end = end.endOf("year"); break;
      case "This Month": default: start = start.startOf("month"); end = end.endOf("month"); break;
    }
    setDateRange({ start: start.format("YYYY-MM-DD"), end: end.format("YYYY-MM-DD") });
  };

  const handleCustomDateApply = (newStartDate: string, newEndDate: string) => {
    setDateRange({ start: newStartDate, end: newEndDate });
    setActiveFilter("Custom");
    setIsModalOpen(false);
  };

  const handleViewTransaction = (tx: any, type: 'INCOME' | 'EXPENSE') => {
    setSelectedTransaction({ ...tx, type });
    setIsTxModalOpen(true);
  };

  const apiUrl = `/api/finance?tab=${encodeURIComponent(activeTab)}&currency=${currency}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
  const { data: apiData, error, isLoading: dataIsLoading, mutate } = useSWR(
    !authLoading && user && dateRange.start && dateRange.end ? apiUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = authLoading || dataIsLoading;

  // --- Currency Formatter ---
  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount == null) return "N/A";
    if (["SLSH", "SOS", "KSH", "BIRR"].includes(currency)) {
       const numberFormat = new Intl.NumberFormat("en-US", { style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return `${currency} ${numberFormat.format(amount)}`;
    }
    try {
      const numberFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return numberFormat.format(amount);
    } catch (e) {
      const numberFormat = new Intl.NumberFormat("en-US", { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${currency} ${numberFormat.format(amount)}`;
    }
  };

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <div className="p-6">Please log in to view financial data.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {/* Modals */}
      {isModalOpen && <CustomDateRangeModal initialStartDate={dateRange.start} initialEndDate={dateRange.end} onApply={handleCustomDateApply} onClose={() => setIsModalOpen(false)} />}
      
      <TransactionDetailsModal 
        isOpen={isTxModalOpen} 
        onClose={() => setIsTxModalOpen(false)} 
        transaction={selectedTransaction} 
        formatCurrency={formatCurrency} 
      />

      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold">Income & Finance</h1>
          <p className="text-gray-500 dark:text-gray-400">Track all financial movements in your business.</p>
        </div>
        <DateFilter activeFilter={activeFilter} onFilterChange={handleFilterChange} onRefresh={mutate} isLoading={isLoading} />
      </header>

      <div className="mb-6 flex justify-start">
        <div className="flex flex-wrap items-center rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
          {CURRENCIES.map((curr) => (
            <button key={curr} onClick={() => setCurrency(curr)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${currency === curr ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}`}>
              {curr}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Overview" && <OverviewTab data={apiData?.overview} isLoading={isLoading} formatCurrency={formatCurrency} currency={currency} />}
        {activeTab === "Income" && <IncomeTab data={apiData?.income} isLoading={isLoading} formatCurrency={formatCurrency} onViewTx={(tx: any) => handleViewTransaction(tx, 'INCOME')} />}
        {activeTab === "Expenses" && <ExpensesTab data={apiData?.expenses} isLoading={isLoading} formatCurrency={formatCurrency} onViewTx={(tx: any) => handleViewTransaction(tx, 'EXPENSE')} />}
        {activeTab === "Payments & Currencies" && <PaymentsTab data={apiData?.payments} isLoading={isLoading} formatCurrency={formatCurrency} currency={currency} />}
        {activeTab === "Cash Flow" && <CashFlowTab data={apiData?.cashFlow} isLoading={isLoading} formatCurrency={formatCurrency} />}
        {activeTab === "Reports" && <ReportsTab data={apiData?.reports} isLoading={isLoading} formatCurrency={formatCurrency} />}
      </div>
    </div>
  );
}

// --- Tab Navigation ---
const TabNav = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
      {TABS.map((tab) => (
        <button key={tab.name} onClick={() => onTabChange(tab.name)} className={`group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${activeTab === tab.name ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"}`}>
          <tab.icon className={`h-5 w-5 ${activeTab === tab.name ? "text-blue-500 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-400"}`} />
          {tab.name}
        </button>
      ))}
    </nav>
  </div>
);

// --- Overview Tab ---
const OverviewTab = ({ data, isLoading, formatCurrency, currency }: { data: any; isLoading: boolean; formatCurrency: (val: number) => string; currency: string }) => {
  const topAccounts = data?.kpis?.accounts?.slice(0, 4) || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Income" value={formatCurrency(data?.kpis?.totalIncome)} icon={DollarSign} color="text-green-500" isLoading={isLoading} />
        <KpiCard title="Total Expenses" value={formatCurrency(data?.kpis?.totalExpenses)} icon={ArrowDown} color="text-red-500" isLoading={isLoading} />
        <KpiCard title="Net Profit" value={formatCurrency(data?.kpis?.netProfit)} icon={TrendingUp} color={data?.kpis?.netProfit >= 0 ? "text-green-500" : "text-red-500"} isLoading={isLoading} />
        <KpiCard title="Payables" value={formatCurrency(data?.kpis?.payables)} icon={AlertTriangle} color="text-yellow-500" isLoading={isLoading} tooltip="Amount you owe to suppliers" />
        {!isLoading && topAccounts.map((acc: any, idx: number) => {
           const provider = PAYMENT_PROVIDERS[acc.method] || PAYMENT_PROVIDERS["OTHER"];
           return <KpiCard key={idx} title={`${provider.label} Bal`} value={formatCurrency(acc.amount)} icon={provider.icon} color="text-blue-500" isLoading={isLoading} />;
        })}
        {!isLoading && topAccounts.length === 0 && <KpiCard title="Cash on Hand" value={formatCurrency(0)} icon={Banknote} color="text-teal-500" isLoading={isLoading} />}
      </div>
      <Card className="h-96"><h3 className="text-lg font-semibold">Income vs Expense over time</h3><IncomeExpenseChart data={data?.incomeExpenseTrend} isLoading={isLoading} /></Card>
    </div>
  );
};

// --- Payments Tab ---
const PaymentsTab = ({ data, isLoading, formatCurrency, currency }: { data: any; isLoading: boolean; formatCurrency: (val: number) => string; currency: string }) => {
  const allowedMethods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Payment Method Balances ({currency})</h2><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">{currency} Only</span></div>
      <p className="text-gray-500 dark:text-gray-400">Estimated running balance (All Time Income - Expenses) for {currency} payment channels.</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {allowedMethods.map((methodKey) => {
          const provider = PAYMENT_PROVIDERS[methodKey] || PAYMENT_PROVIDERS["OTHER"];
          const account = data?.accounts?.find((a: any) => a.method === methodKey);
          const amount = account ? account.amount : 0;
          return <KpiCard key={methodKey} title={`${provider.label} Balance`} value={formatCurrency(amount)} icon={provider.icon} color={amount >= 0 ? "text-teal-500" : "text-red-500"} isLoading={isLoading} />;
        })}
      </div>
    </div>
  );
};

// --- Income Tab ---
const IncomeTab = ({ data, isLoading, formatCurrency, onViewTx }: any) => (
  <div className="space-y-6">
    <KpiCard title="Total Income" value={formatCurrency(data?.totalIncome)} icon={DollarSign} color="text-green-500" isLoading={isLoading} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="h-96"><h3 className="text-lg font-semibold">Income by Category</h3><BreakdownChart data={data?.incomeByCategory} isLoading={isLoading} /></Card>
      <Card className="h-96"><h3 className="text-lg font-semibold">Income by Payment Method</h3><BreakdownChart data={data?.incomeByMethod} isLoading={isLoading} /></Card>
    </div>
    <Card>
      <h3 className="text-lg font-semibold">Recent Income</h3>
      <RecentTransactionsTable data={data?.recentIncomes} isLoading={isLoading} formatCurrency={formatCurrency} onView={onViewTx} />
    </Card>
  </div>
);

// --- Expenses Tab ---
const ExpensesTab = ({ data, isLoading, formatCurrency, onViewTx }: any) => (
  <div className="space-y-6">
    <KpiCard title="Total Expenses" value={formatCurrency(data?.totalExpenses)} icon={ArrowDown} color="text-red-500" isLoading={isLoading} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="h-96"><h3 className="text-lg font-semibold">Expenses by Category</h3><BreakdownChart data={data?.expensesByCategory} isLoading={isLoading} /></Card>
      <Card className="h-96"><h3 className="text-lg font-semibold">Expenses by Payment Method</h3><BreakdownChart data={data?.expensesByMethod} isLoading={isLoading} /></Card>
    </div>
    <Card>
      <h3 className="text-lg font-semibold">Recent Expenses</h3>
      <RecentTransactionsTable data={data?.recentExpenses} isLoading={isLoading} formatCurrency={formatCurrency} onView={onViewTx} />
    </Card>
  </div>
);

const CashFlowTab = ({ data, isLoading }: any) => (
  <Card className="h-[500px]"><h3 className="text-lg font-semibold">Daily Cash Flow</h3><CashFlowChart data={data?.cashFlowTrend} isLoading={isLoading} /></Card>
);

const ReportsTab = ({ data, isLoading, formatCurrency }: any) => (
  <div className="space-y-6">
    <Card>
      <h3 className="text-lg font-semibold">Profit & Loss Summary</h3>
      {isLoading ? <div className="space-y-2 pt-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-6 w-1/2" /></div> : (
        <div className="mt-4 space-y-3">
          <div className="flex justify-between"><span className="text-gray-500">Total Income</span><span className="font-medium text-green-600">{formatCurrency(data?.pnl?.totalIncome)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total Expenses</span><span className="font-medium text-red-600">{formatCurrency(data?.pnl?.totalExpenses)}</span></div>
          <div className="flex justify-between border-t pt-3 dark:border-gray-700"><span className="font-bold">Net Profit</span><span className={`font-bold ${data?.pnl?.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(data?.pnl?.netProfit)}</span></div>
        </div>
      )}
    </Card>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <ReportListCard title="Top Debtors" icon={User} data={data?.topDebtors} isLoading={isLoading} formatCurrency={formatCurrency} />
      <ReportListCard title="Top Income Sources" icon={ShoppingBag} data={data?.topIncomeSources} isLoading={isLoading} formatCurrency={formatCurrency} />
      <ReportListCard title="Top Expense Categories" icon={Wallet} data={data?.topExpenseCategories} isLoading={isLoading} formatCurrency={formatCurrency} />
    </div>
  </div>
);

// --- SHARED & UTILITY COMPONENTS ---
const Card = ({ children, className = "" }: any) => <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>{children}</div>;
const Skeleton = ({ className = "" }: any) => <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
const LoadingSpinner = () => <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;
const ErrorDisplay = ({ error }: { error: Error }) => (<Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-red-500" /><div><h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Financial Data</h3><p className="text-sm text-red-600 dark:text-red-500">{error.message}</p></div></div></Card>);
const ChartEmptyState = () => (<div className="flex h-full w-full flex-col items-center justify-center text-gray-400"><Briefcase className="h-12 w-12 opacity-50" /><p className="mt-2 text-sm">No data for this period</p></div>);

const KpiCard = ({ title, value, icon: Icon, color, isLoading, tooltip }: any) => (
  <Card>
    <div className="flex items-center justify-between" title={tooltip}>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
    {isLoading ? <Skeleton className="mt-2 h-8 w-3/4" /> : <p className="mt-1 truncate text-2xl font-semibold">{value}</p>}
  </Card>
);

const DateFilter = ({ activeFilter, onFilterChange, onRefresh, isLoading }: any) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <div className="flex flex-wrap items-center rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
      {["Today", "Yesterday", "This Week", "This Month", "This Year", "Custom"].map(f => (
        <button key={f} onClick={() => onFilterChange(f)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeFilter === f ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}`}>{f}</button>
      ))}
    </div>
    <button onClick={onRefresh} disabled={isLoading} className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"><RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} /></button>
  </div>
);

const CustomDateRangeModal = ({ initialStartDate, initialEndDate, onApply, onClose }: any) => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Select Custom Range</h3><button onClick={onClose}><XIcon className="h-5 w-5" /></button></div>
        <div className="mt-6 space-y-4">
          <div><label className="text-sm font-medium">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full rounded-md border-gray-300 p-2 shadow-sm dark:bg-gray-700" /></div>
          <div><label className="text-sm font-medium">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block w-full rounded-md border-gray-300 p-2 shadow-sm dark:bg-gray-700" /></div>
        </div>
        <div className="mt-8 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 border rounded-md">Cancel</button><button onClick={() => onApply(startDate, endDate)} className="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button></div>
      </div>
    </div>
  );
};

// --- CHARTS ---
const IncomeExpenseChart = ({ data, isLoading }: any) => {
  if (isLoading) return <div className="flex h-full items-center justify-center p-4"><Skeleton className="h-full w-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: "8px", border: "1px solid #ddd" }} />
        <Legend />
        <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const BreakdownChart = ({ data, isLoading }: any) => {
  if (isLoading) return <div className="flex h-full items-center justify-center p-4"><Skeleton className="h-48 w-48 rounded-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  const COLORS = ["#0ea5e9", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#f59e0b", "#6366f1", "#14b8a6"];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}>
          {data.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: "8px", border: "1px solid #ddd" }} />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

const CashFlowChart = ({ data, isLoading }: any) => {
  if (isLoading) return <div className="flex h-full items-center justify-center p-4"><Skeleton className="h-full w-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", borderRadius: "8px", border: "1px solid #ddd" }} />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" />
        <Bar dataKey="expense" fill="#ef4444" />
        <Bar dataKey="netFlow" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const ReportListCard = ({ title, icon: Icon, data, isLoading, formatCurrency }: any) => (
  <Card>
    <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-gray-500" /><h3 className="text-lg font-semibold">{title}</h3></div>
    <div className="mt-4 space-y-3">{isLoading ? <Skeleton className="h-6 w-full" /> : !data || data.length === 0 ? <p className="text-sm text-gray-400">No data</p> : data.slice(0, 5).map((item: any) => (<div key={item.name} className="flex justify-between text-sm"><span className="truncate text-gray-600 dark:text-gray-300">{item.name}</span><span className="font-medium">{formatCurrency(item.value)}</span></div>))}</div>
  </Card>
);

// --- RECENT TRANSACTIONS TABLE ---
const RecentTransactionsTable = ({ data, isLoading, formatCurrency, onView }: any) => {
  if (isLoading) return <div className="space-y-2 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (!data || data.length === 0) return <div className="flex h-40 flex-col items-center justify-center text-gray-400"><List className="h-12 w-12 opacity-50" /><p className="mt-2 text-sm">No transactions</p></div>;
  
  return (
    <div className="flow-root overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 pl-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Category</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Method</th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Amount</th>
            <th className="px-3 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((tx: any) => (
            <tr key={tx.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="py-4 pl-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                {dayjs(tx.date).format("MMM D, YYYY")}
              </td>
              <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {tx.category}
                </span>
              </td>
              <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{tx.paymentMethod}</td>
              <td className="px-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(tx.amount)}
              </td>
              <td className="px-3 py-4 text-right">
                <button 
                  onClick={() => onView && onView(tx)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400 transition-all"
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- NEW TRANSACTION DETAILS MODAL (Scrollable + PDF Popup) ---
const TransactionDetailsModal = ({ transaction, isOpen, onClose, formatCurrency }: any) => {
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false);
      }
    };
    if (showPrintMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPrintMenu]);

  if (!isOpen || !transaction) return null;

  const isExpense = transaction.type === 'EXPENSE' || transaction.amount < 0 || (transaction.category && ['Rent', 'Salaries', 'Utilities'].includes(transaction.category)); 
  
  const colorClass = isExpense ? "bg-rose-700" : "bg-emerald-700";
  const lightColorClass = isExpense ? "bg-rose-50 dark:bg-rose-900/20" : "bg-emerald-50 dark:bg-emerald-900/20";
  const textColorClass = isExpense ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";

  // --- Print / PDF Handler ---
  const handleAction = (action: 'print' | 'download') => {
    setShowPrintMenu(false);
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const formattedAmount = formatCurrency(transaction.amount);
    const date = dayjs(transaction.date).format("MMMM D, YYYY");
    const time = dayjs(transaction.createdAt || transaction.date).format("h:mm A");
    const typeLabel = isExpense ? "PAYMENT RECEIPT" : "INCOME RECEIPT";
    const themeColor = isExpense ? "#be123c" : "#047857"; // Rose-700 / Emerald-700
    
    // If download, we try to title the window specifically for 'Save as PDF'
    const docTitle = action === 'download' ? `Receipt-${transaction.id || 'doc'}.pdf` : `Receipt - ${transaction.id}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>${docTitle}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937; background: #fff; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 40px; border-radius: 8px; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 30px; }
            .title { font-size: 14px; letter-spacing: 2px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; }
            .amount { font-size: 48px; font-weight: 700; color: ${themeColor}; margin: 0; }
            .date { font-size: 14px; color: #9ca3af; margin-top: 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px; }
            .box { padding: 15px; background: #f9fafb; border-radius: 6px; }
            .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; display: block; }
            .value { font-size: 16px; font-weight: 600; color: #111; }
            .details-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f3f4f6; padding: 12px 0; font-size: 14px; }
            .details-row:last-child { border-bottom: none; }
            .details-label { color: #6b7280; }
            .details-val { font-weight: 500; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; line-height: 1.5; }
            @media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">${typeLabel}</div>
              <h1 class="amount">${formattedAmount}</h1>
              <div class="date">${date} &bull; ${time}</div>
            </div>
            <div class="grid">
              <div class="box">
                <span class="label">Category</span>
                <div class="value">${transaction.category || "Uncategorized"}</div>
              </div>
              <div class="box">
                <span class="label">Payment Method</span>
                <div class="value">${transaction.paymentMethod || "N/A"}</div>
              </div>
            </div>
            <div class="details">
               <div class="details-row"><span class="details-label">Reference ID</span><span class="details-val" style="font-family: monospace;">${transaction.id || transaction._id || "—"}</span></div>
               <div class="details-row"><span class="details-label">Processed By</span><span class="details-val">${transaction.user || "System"}</span></div>
               <div class="details-row" style="display: block; padding-top: 20px;">
                 <span class="details-label" style="display: block; margin-bottom: 5px;">Description / Notes</span>
                 <span class="details-val" style="color: #4b5563;">${transaction.description || transaction.notes || "No additional notes."}</span>
               </div>
            </div>
            <div class="footer">Thank you for your business.<br/>Generated by Hantikaab Finance</div>
          </div>
          <script>
             window.onload = function() { 
               document.title = "${docTitle}";
               window.print(); 
               // Optional: Close after a delay if it was a simple print
               // setTimeout(function(){ window.close(); }, 500); 
             }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        
        {/* Header (Fixed) */}
        <div className={`relative p-6 shrink-0 ${colorClass}`}>
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40 transition-colors z-10">
            <XIcon className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center justify-center text-white pt-4">
            <div className="mb-2 rounded-full bg-white/20 p-3">
              {isExpense ? <ArrowDown className="h-8 w-8" /> : <ArrowUpRight className="h-8 w-8" />}
            </div>
            <h2 className="text-sm font-medium opacity-90 uppercase tracking-wider">
              {isExpense ? "Expense Details" : "Income Details"}
            </h2>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">
              {formatCurrency(transaction.amount)}
            </h1>
            <p className="mt-2 text-sm opacity-80">
              {dayjs(transaction.date).format("dddd, MMMM D, YYYY")}
            </p>
          </div>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 ${lightColorClass}`}>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Tag className="h-4 w-4" />
                <span>Category</span>
              </div>
              <p className={`font-semibold text-lg ${textColorClass}`}>
                {transaction.category || "Uncategorized"}
              </p>
            </div>
            <div className={`rounded-xl p-4 bg-gray-50 dark:bg-gray-800`}>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <CreditCard className="h-4 w-4" />
                <span>Method</span>
              </div>
              <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                {transaction.paymentMethod || "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800"><Hash className="h-4 w-4 text-gray-500" /></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Reference ID</span>
              </div>
              <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">{transaction.id || transaction._id || "—"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-800"><Clock className="h-4 w-4 text-gray-500" /></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Created At</span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{dayjs(transaction.createdAt || transaction.date).format("h:mm A")}</span>
            </div>
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500"><MessageSquare className="h-4 w-4" /><span>Description / Notes</span></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {transaction.description || transaction.notes || "No description provided for this transaction."}
              </div>
            </div>
            {transaction.user && (
               <div className="flex items-center justify-end gap-2 text-xs text-gray-400 mt-4"><User className="h-3 w-3" /><span>Processed by: {transaction.user}</span></div>
            )}
          </div>
        </div>

        {/* Footer with POPUP MENU */}
        <div className="relative bg-gray-50 p-4 shrink-0 dark:bg-gray-800/50 flex justify-end gap-3 border-t dark:border-gray-700">
           <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors dark:text-gray-300 dark:hover:bg-gray-700">
             Close
           </button>

           <div className="relative" ref={menuRef}>
             <button 
               onClick={() => setShowPrintMenu(!showPrintMenu)}
               className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2"
             >
               <Printer className="h-4 w-4" /> 
               Print / PDF 
               <ChevronUp className={`h-3 w-3 transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
             </button>

             {/* Popup Menu */}
             {showPrintMenu && (
               <div className="absolute bottom-full right-0 mb-2 w-56 origin-bottom-right rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 transition-all dark:bg-gray-800 dark:ring-gray-700 z-50 overflow-hidden">
                 <div className="py-1">
                   <button
                     onClick={() => handleAction('download')}
                     className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                   >
                     <div className="mr-3 rounded-lg bg-gray-100 p-1.5 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-gray-600 dark:group-hover:text-blue-400">
                       <Download className="h-4 w-4" />
                     </div>
                     <div className="flex flex-col items-start">
                       <span className="font-medium">Download PDF</span>
                       <span className="text-xs text-gray-400 font-normal">Save as .pdf file</span>
                     </div>
                   </button>
                   
                   <button
                     onClick={() => handleAction('print')}
                     className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                   >
                     <div className="mr-3 rounded-lg bg-gray-100 p-1.5 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-gray-600 dark:group-hover:text-blue-400">
                       <Printer className="h-4 w-4" />
                     </div>
                     <div className="flex flex-col items-start">
                       <span className="font-medium">Print Receipt</span>
                       <span className="text-xs text-gray-400 font-normal">Send to printer</span>
                     </div>
                   </button>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};