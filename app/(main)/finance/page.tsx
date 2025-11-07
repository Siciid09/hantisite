"use client";
// -----------------------------------------------------------------------------
// File: app/(main)/finance/page.tsx
// Description: The main "Income & Finance" page (Corrected).
//
// This version has corrected import paths to resolve build errors.
// It features the 6-part tabbed interface, all dynamic data,
// and the expanded currency selector.
// -----------------------------------------------------------------------------
import React, { useState } from "react";
import useSWR from "swr";
// --- (FIXED PATHS) ---
// Assuming `contexts` and `lib` are at the root of your `app` directory
// and your tsconfig.json `@/*` alias points to `app/`.
// If `@/*` points to the *project root*, these would be:
// import { useAuth } from "@/app/contexts/AuthContext";
// import { auth } from "@/lib/firebaseConfig";
//
// I will use the most common Next.js 13+ setup:
import { useAuth } from "@/app/contexts/AuthContext";// Changed from @/app/contexts
import { auth } from "@/lib/firebaseConfig"; // This path is likely correct

// --- Date Imports ---
import dayjs from "dayjs";

// --- Icons ---
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Bar,
} from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  BookOpen,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Landmark,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Wallet,
  Smartphone,
  Calendar as CalendarIcon,
  X as XIcon,
  ChevronsLeftRight,
  PieChart as PieChartIcon,
  List,
  User,
  ShoppingBag,
  MoreVertical,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

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
    console.error("Fetch error details:", errorBody);
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// --- Constants ---
const TABS = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Income", icon: ArrowUpRight },
  { name: "Expenses", icon: ArrowDownRight },
  { name: "Payments & Currencies", icon: CreditCard },
  { name: "Cash Flow", icon: Activity },
  { name: "Reports", icon: BookOpen },
];

const CURRENCIES = ["USD", "EUR", "SOS", "SLSH", "KSH", "BIRR"];

// --- (A) Main Finance Page Component ---
export default function FinancePage() {
  const { user, loading: authLoading } = useAuth();
  const [currency, setCurrency] = useState("USD"); // Default currency
  const [activeTab, setActiveTab] = useState("Overview");

  // --- Date Range Selector (Logic) ---
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
      case "Today":
        start = start.startOf("day");
        end = end.endOf("day");
        break;
      case "Yesterday":
        start = start.subtract(1, "day").startOf("day");
        end = end.subtract(1, "day").endOf("day");
        break;
      case "This Week":
        start = start.startOf("week");
        end = end.endOf("week");
        break;
      case "This Year":
        start = start.startOf("year");
        end = end.endOf("year");
        break;
      case "This Month":
      default:
        start = start.startOf("month");
        end = end.endOf("month");
        break;
    }
    setDateRange({
      start: start.format("YYYY-MM-DD"),
      end: end.format("YYYY-MM-DD"),
    });
  };

  const handleCustomDateApply = (newStartDate: string, newEndDate: string) => {
    setDateRange({ start: newStartDate, end: newEndDate });
    setActiveFilter("Custom");
    setIsModalOpen(false);
  };

  // --- SWR Hook for data fetching ---
  const apiUrl = `/api/finance?tab=${activeTab}&currency=${currency}&startDate=${dateRange.start}&endDate=${dateRange.end}`;

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(
    !authLoading && user && dateRange.start && dateRange.end ? apiUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = authLoading || dataIsLoading;

  // --- NEW Currency Formatter ---
  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount == null) return "N/A";

    if (currency === "SLSH" || currency === "SOS" || currency === "KSH" || currency === "BIRR") {
       const numberFormat = new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${currency} ${numberFormat.format(amount)}`;
    }

    try {
      const numberFormat = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return numberFormat.format(amount);
    } catch (e) {
      const numberFormat = new Intl.NumberFormat("en-US", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${currency} ${numberFormat.format(amount)}`;
    }
  };

  // --- Currency Toggle ---
  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
  };

  // --- Loading & Auth States ---
  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return <div className="p-6">Please log in to view financial data.</div>;
  }

  // --- Render UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {isModalOpen && (
        <CustomDateRangeModal
          initialStartDate={dateRange.start}
          initialEndDate={dateRange.end}
          onApply={handleCustomDateApply}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold">Income & Finance</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track all financial movements in your business.
          </p>
        </div>
        <DateFilter
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onRefresh={mutate}
          isLoading={isLoading}
        />
      </header>

      <div className="mb-6 flex justify-start">
        <div className="flex flex-wrap items-center rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
          {CURRENCIES.map((curr) => (
            <button
              key={curr}
              onClick={() => handleCurrencyChange(curr)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currency === curr
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Overview" && (
          <OverviewTab
            data={apiData?.overview}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "Income" && (
          <IncomeTab
            data={apiData?.income}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "Expenses" && (
          <ExpensesTab
            data={apiData?.expenses}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "Payments & Currencies" && (
          <PaymentsTab
            data={apiData?.payments}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "Cash Flow" && (
          <CashFlowTab
            data={apiData?.cashFlow}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === "Reports" && (
          <ReportsTab
            data={apiData?.reports}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        )}
      </div>
    </div>
  );
}

// --- (B) Tab Navigation Component ---

const TabNav = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          onClick={() => onTabChange(tab.name)}
          className={`
            group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            ${
              activeTab === tab.name
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
            }
          `}
        >
          <tab.icon
            className={`h-5 w-5 ${
              activeTab === tab.name
                ? "text-blue-500 dark:text-blue-400"
                : "text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-400"
            }`}
          />
          {tab.name}
        </button>
      ))}
    </nav>
  </div>
);

// --- (C) Tab Content Components (ALL DYNAMIC) ---

// --- 1. Overview Tab (Existing, Dynamic) ---
const OverviewTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinanceOverviewData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Total Income"
        value={formatCurrency(data?.kpis?.totalIncome)}
        icon={DollarSign}
        color="text-green-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Total Expenses"
        value={formatCurrency(data?.kpis?.totalExpenses)}
        icon={ArrowDown}
        color="text-red-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Net Profit"
        value={formatCurrency(data?.kpis?.netProfit)}
        icon={TrendingUp}
        color={
          data?.kpis?.netProfit >= 0 ? "text-green-500" : "text-red-500"
        }
        isLoading={isLoading}
      />
      <KpiCard
        title="Outstanding Invoices"
        value={formatCurrency(data?.kpis?.outstandingInvoices)}
        icon={FileText}
        color="text-orange-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Cash on Hand"
        value={formatCurrency(data?.kpis?.cashOnHand)}
        icon={Banknote}
        color="text-teal-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Digital Wallets (Zaad+eDahab)"
        value={formatCurrency(data?.kpis?.digitalWallets)}
        icon={Smartphone}
        color="text-blue-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Bank Balance"
        value={formatCurrency(data?.kpis?.bankBalance)}
        icon={Landmark}
        color="text-purple-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Payables"
        value={formatCurrency(data?.kpis?.payables)}
        icon={AlertTriangle}
        color="text-yellow-500"
        isLoading={isLoading}
        tooltip="Amount you owe to suppliers (Not yet tracked)"
      />
    </div>
    <Card className="h-96">
      <h3 className="text-lg font-semibold">Income vs Expense over time</h3>
      <IncomeExpenseChart
        data={data?.incomeExpenseTrend}
        isLoading={isLoading}
      />
    </Card>
  </div>
);

// --- 2. Income Tab (NEW, Dynamic) ---
const IncomeTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinanceIncomeData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <div className="space-y-6">
    <KpiCard
      title="Total Income"
      value={formatCurrency(data?.totalIncome)}
      icon={DollarSign}
      color="text-green-500"
      isLoading={isLoading}
    />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="h-96">
        <h3 className="text-lg font-semibold">Income by Category</h3>
        <BreakdownChart data={data?.incomeByCategory} isLoading={isLoading} />
      </Card>
      <Card className="h-96">
        <h3 className="text-lg font-semibold">Income by Payment Method</h3>
        <BreakdownChart data={data?.incomeByMethod} isLoading={isLoading} />
      </Card>
    </div>
    <Card>
      <h3 className="text-lg font-semibold">Recent Income</h3>
      <RecentTransactionsTable
        data={data?.recentIncomes}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />
    </Card>
  </div>
);

// --- 3. Expenses Tab (NEW, Dynamic) ---
const ExpensesTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinanceExpensesData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <div className="space-y-6">
    <KpiCard
      title="Total Expenses"
      value={formatCurrency(data?.totalExpenses)}
      icon={ArrowDown}
      color="text-red-500"
      isLoading={isLoading}
    />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="h-96">
        <h3 className="text-lg font-semibold">Expenses by Category</h3>
        <BreakdownChart data={data?.expensesByCategory} isLoading={isLoading} />
      </Card>
      <Card className="h-96">
        <h3 className="text-lg font-semibold">Expenses by Payment Method</h3>
        <BreakdownChart data={data?.expensesByMethod} isLoading={isLoading} />
      </Card>
    </div>
    <Card>
      <h3 className="text-lg font-semibold">Recent Expenses</h3>
      <RecentTransactionsTable
        data={data?.recentExpenses}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />
    </Card>
  </div>
);

// --- 4. Payments Tab (NEW, Dynamic) ---
const PaymentsTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinancePaymentsData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Payment Method Balances</h2>
    <p className="text-gray-500 dark:text-gray-400">
      Estimated balance (Income - Expenses) for each method in this period.
    </p>
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Cash Balance"
        value={formatCurrency(data?.cashBalance)}
        icon={Banknote}
        color={data?.cashBalance >= 0 ? "text-teal-500" : "text-red-500"}
        isLoading={isLoading}
      />
      <KpiCard
        title="Zaad Balance"
        value={formatCurrency(data?.zaadBalance)}
        icon={Smartphone}
        color={data?.zaadBalance >= 0 ? "text-blue-500" : "text-red-500"}
        isLoading={isLoading}
      />
      <KpiCard
        title="eDahab Balance"
        value={formatCurrency(data?.edahabBalance)}
        icon={Smartphone}
        color={data?.edahabBalance >= 0 ? "text-yellow-500" : "text-red-500"}
        isLoading={isLoading}
      />
      <KpiCard
        title="Bank Balance"
        value={formatCurrency(data?.bankBalance)}
        icon={Landmark}
        color={data?.bankBalance >= 0 ? "text-purple-500" : "text-red-500"}
        isLoading={isLoading}
      />
    </div>
  </div>
);

// --- 5. Cash Flow Tab (NEW, Dynamic) ---
const CashFlowTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinanceCashFlowData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <Card className="h-[500px]">
    <h3 className="text-lg font-semibold">Daily Cash Flow</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Shows daily Income, Expenses, and Net Flow (Income - Expense).
    </p>
    <CashFlowChart data={data?.cashFlowTrend} isLoading={isLoading} />
  </Card>
);

// --- 6. Reports Tab (NEW, Dynamic) ---
const ReportsTab = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data: any; // FinanceReportsData
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <div className="space-y-6">
    <Card>
      <h3 className="text-lg font-semibold">Profit & Loss Summary</h3>
      {isLoading ? (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Income</span>
            <span className="font-medium text-green-600">
              {formatCurrency(data?.pnl?.totalIncome)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Expenses</span>
            <span className="font-medium text-red-600">
              {formatCurrency(data?.pnl?.totalExpenses)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-3 dark:border-gray-700">
            <span className="font-bold">Net Profit</span>
            <span
              className={`font-bold ${
                data?.pnl?.netProfit >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(data?.pnl?.netProfit)}
            </span>
          </div>
        </div>
      )}
    </Card>

    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <ReportListCard
        title="Top Debtors"
        icon={User}
        data={data?.topDebtors}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />
      <ReportListCard
        title="Top Income Sources"
        icon={ShoppingBag}
        data={data?.topIncomeSources}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />
      <ReportListCard
        title="Top Expense Categories"
        icon={Wallet}
        data={data?.topExpenseCategories}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
      />
    </div>
  </div>
);

// --- (D) Reusable Child Components ---

const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
  >
    {children}
  </div>
);

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-red-500" />
      <div>
        <h3 className="font-semibold text-red-700 dark:text-red-400">
          Error Loading Financial Data
        </h3>
        <p className="text-sm text-red-600 dark:text-red-500">
          {error.message}
        </p>
      </div>
    </div>
  </Card>
);

const ChartEmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
    <PieChartIcon className="h-12 w-12 opacity-50" />
    <p className="mt-2 text-sm">No data for this period</p>
  </div>
);

const DateFilter = ({
  activeFilter,
  onFilterChange,
  onRefresh,
  isLoading,
}: {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}) => {
  const filters = [
    "Today",
    "Yesterday",
    "This Week",
    "This Month",
    "This Year",
    "Custom",
  ];
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap items-center rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === filter
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
      <button
        onClick={() => onRefresh()}
        disabled={isLoading}
        className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
};

const CustomDateRangeModal = ({
  initialStartDate,
  initialEndDate,
  onApply,
  onClose,
}: {
  initialStartDate: string;
  initialEndDate: string;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
}) => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const handleApplyClick = () => {
    onApply(startDate, endDate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select Custom Range</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="startDate"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="endDate"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyClick}
            className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
  className = "",
  tooltip,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  isLoading: boolean;
  className?: string;
  tooltip?: string;
}) => (
  <Card className={`flex-1 ${className}`}>
  {/* Move the 'title' attribute here for the tooltip */}
  <div className="flex items-center justify-between" title={tooltip}>
    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
      {title}
    </span>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
    {isLoading ? (
      <Skeleton className="mt-2 h-8 w-3/4" />
    ) : (
      <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
    )}
  </Card>
);

const IncomeExpenseChart = ({
  data,
  isLoading,
}: {
  data?: { date: string; income: number; expense: number }[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <ChartEmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: "1px solid #ddd",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          labelStyle={{ color: "#333", fontWeight: "bold" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="income"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="expense"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const PIE_COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#6366f1",
  "#14b8a6",
];

const BreakdownChart = ({
  data,
  isLoading,
}: {
  data?: { name: string; value: number }[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Skeleton className="h-48 w-48 rounded-full" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <ChartEmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          fill="#8884d8"
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} (${(percent * 100).toFixed(0)}%)`
          }
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: "1px solid #ddd",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

const RecentTransactionsTable = ({
  data,
  isLoading,
  formatCurrency,
}: {
  data?: {
    id: string;
    date: string;
    category: string;
    amount: number;
    paymentMethod: string;
  }[];
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center text-gray-400">
        <List className="h-12 w-12 opacity-50" />
        <p className="mt-2 text-sm">No transactions for this period</p>
      </div>
    );
  }
  return (
    <div className="flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Category
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Payment Method
                </th>
                <th
                  scope="col"
                  className="px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.map((tx) => (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                    {dayjs(tx.date).format("MMM D, YYYY")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {tx.category}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {tx.paymentMethod}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                    {formatCurrency(tx.amount)}
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

const CashFlowChart = ({
  data,
  isLoading,
}: {
  data?: { date: string; income: number; expense: number; netFlow: number }[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <ChartEmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            border: "1px solid #ddd",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          labelStyle={{ color: "#333", fontWeight: "bold" }}
        />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" />
        <Bar dataKey="expense" fill="#ef4444" />
        <Bar dataKey="netFlow" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const ReportListCard = ({
  title,
  icon: Icon,
  data,
  isLoading,
  formatCurrency,
}: {
  title: string;
  icon: React.ElementType;
  data?: { name: string; value: number }[];
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => (
  <Card>
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-gray-500" />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    <div className="mt-4 space-y-3">
      {isLoading ? (
        <>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-full" />
        </>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-gray-400">No data for this report.</p>
      ) : (
        data
          .slice(0, 5)
          .map((item) => (
            <div key={item.name} className="flex justify-between text-sm">
              <span className="truncate text-gray-600 dark:text-gray-300">
                {item.name}
              </span>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))
      )}
    </div>
  </Card>
);