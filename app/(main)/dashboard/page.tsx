"use client";

// -----------------------------------------------------------------------------
// File: app/(main)/dashboard/page.tsx
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// --- Icons ---
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  CheckCircle,
  ChevronRight,
  DollarSign,
  Info,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  CreditCard,
  Smartphone,
  Landmark,
  FileText,
  UserPlus,
  ShoppingBag,
  List,
  Calendar as CalendarIcon,
  X as XIcon,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";

// --- Chart Imports ---
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { type DashboardSummary } from "../../api/types";
import { QuickActionModal } from "./QuickActionModal";

// --- CONSTANTS (Synced with Finance Page) ---
const PAYMENT_PROVIDERS: Record<string, { label: string; icon: any }> = {
  CASH: { label: "Cash", icon: Box }, // Using Box as generic cash or Banknote
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

// --- (A) API Fetcher ---
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
};

// --- (B) Main Dashboard Component ---
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  // --- State ---
  const [currency, setCurrency] = useState("USD");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState("This Month");
  const [dateRange, setDateRange] = useState(() => {
    const now = dayjs();
    return {
      start: now.startOf("month").format("YYYY-MM-DD"),
      end: now.endOf("month").format("YYYY-MM-DD"),
    };
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // --- Date Handler ---
  const handleDatePresetChange = (preset: string) => {
    setActivePreset(preset);
    let start = dayjs();
    let end = dayjs();
    switch (preset) {
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
    setActivePreset("Custom");
    setIsPickerOpen(false);
  };

  // --- SWR Hook (Auto-Refresh Enabled) ---
  const apiUrl = useMemo(() => {
    return `/api/dashboard?currency=${currency}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
  }, [currency, dateRange]);

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR<DashboardSummary>(
    !authLoading && user && dateRange.start && dateRange.end ? apiUrl : null,
    fetcher,
    { 
      revalidateOnFocus: true, 
      refreshInterval: 0
    }
  );

  const isLoading = authLoading || dataIsLoading;

  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount == null) return "N/A";
    const nonIsoCurrencies = ["SLSH", "SOS", "KSH", "BIRR"];
    if (nonIsoCurrencies.includes(currency)) {
      const numberFormat = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${currency} ${numberFormat.format(amount)}`;
    }
    try {
      const numberFormat = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: (currency === "USD" || currency === "EUR") ? 2 : 0,
        maximumFractionDigits: (currency === "USD" || currency === "EUR") ? 2 : 0,
      });
      return numberFormat.format(amount);
    } catch (e) {
      const numberFormat = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${currency} ${numberFormat.format(amount)}`;
    }
  };

  if (authLoading) return <LoadingSpinner />;
  if (!user) return <div className="p-6">Please log in to view the dashboard.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      
      {/* --- Quick Action Modal --- */}
      {activeModal && (
        <QuickActionModal
          modalType={activeModal}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null);
            mutate();
          }}
        />
      )}

      {/* --- Animated Floating Buttons --- */}
      <AnimatedFloatingButtons onActionClick={setActiveModal} />

      {/* --- Custom Date Picker Modal --- */}
      {isPickerOpen && (
        <CustomDateRangeModal
          initialStartDate={dateRange.start}
          initialEndDate={dateRange.end}
          onApply={handleCustomDateApply}
          onClose={() => setIsPickerOpen(false)}
        />
      )}

      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Welcome back, {user?.name || user?.email}!
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Modern Dark Currency Filter */}
          <CurrencyFilter currency={currency} onCurrencyChange={setCurrency} />

          <DatePresetButtons
            activePreset={activePreset}
            onPresetChange={handleDatePresetChange}
            onCustomClick={() => setIsPickerOpen(true)}
          />
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && <ErrorDisplay error={error} />}

      {/* --- Main Grid Layout --- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* --- KPI SECTION --- */}
        <div className="lg:col-span-3">
          {/* --- Row 1: Revenue & Sales --- */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Today's Revenue"
              value={formatCurrency(apiData?.todaysSales)}
              icon={DollarSign}
              color="text-green-500"
              isLoading={isLoading}
            />
            <KpiCard
              title="Sales Count"
              value={apiData?.totalSalesCount ?? 0}
              icon={Receipt}
              color="text-blue-500"
              isLoading={isLoading}
            />
            {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(apiData?.totalIncomes)}
                icon={TrendingUp}
                color="text-green-500"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}
            
            {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Profit Margin %"
                value={apiData?.profitMargin?.toFixed(1) ?? 0}
                unit="%"
                icon={TrendingUp}
                color="text-teal-500"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}
          </div>

          {/* --- Row 2: Financials & Dynamic Balance --- */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Net Profit"
                value={formatCurrency(apiData?.netProfit)}
                icon={TrendingUp}
                color="text-green-500"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}

            {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Total Expenses"
                value={formatCurrency(apiData?.totalExpenses)}
                icon={ArrowDown}
                color="text-red-500"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}

            {/* --- DYNAMIC ACCOUNT BALANCE CARD (UPDATED) --- */}
            {user && (user.role === "admin" || user.role === "manager") ? (
              <AccountBalanceCard 
                accounts={apiData?.accountBalances || []}
                currency={currency} // Pass currency to filter methods
                isLoading={isLoading}
                formatCurrency={formatCurrency}
              />
            ) : <div className="hidden lg:block"></div>}

            <KpiCard
              title="New Debts (Period)"
              value={formatCurrency(apiData?.newDebtsAmount)}
              icon={Users}
              color="text-orange-500"
              isLoading={isLoading}
            />
          </div>

          {/* --- Row 3: Balance Sheet --- */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
             {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Outstanding Invoices"
                value={formatCurrency(apiData?.outstandingInvoices)}
                icon={FileText}
                color="text-red-500"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}
            
            {user && (user.role === "admin" || user.role === "manager") ? (
              <KpiCard
                title="Total Payables"
                value={formatCurrency(apiData?.totalPayables)}
                icon={ShoppingBag}
                color="text-yellow-600"
                isLoading={isLoading}
              />
            ) : <div className="hidden lg:block"></div>}
            
            <KpiCard
              title="Low Stock"
              value={apiData?.lowStockCount ?? 0}
              unit="Items"
              icon={AlertTriangle}
              color="text-yellow-500"
              isLoading={isLoading}
            />
            <KpiCard
              title="Total Products"
              value={apiData?.totalProducts ?? 0}
              unit="Items"
              icon={Package}
              color="text-purple-500"
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* --- CHARTS & WIDGETS --- */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="h-96">
            <h3 className="text-lg font-semibold">Income vs Expense Trend</h3>
            {user && user.role === "user" ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                This chart is available for admin and manager roles.
              </div>
            ) : (
              <IncomeExpenseChart
                data={apiData?.incomeExpenseTrend}
                isLoading={isLoading}
              />
            )}
          </Card>
          <RecentSales
            data={apiData?.recentSales}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          {user && (user.role === "admin" || user.role === "manager") && (
            <PerformanceWidget
              data={apiData?.performanceComparison}
              isLoading={isLoading}
            />
          )}
          <SmartInsight
            insight={apiData?.smartInsight}
            isLoading={isLoading}
          />
          {user && (user.role === "admin" || user.role === "manager") && (
            <Card className="h-80">
              <h3 className="text-lg font-semibold">Expense Breakdown</h3>
              <ExpenseBreakdownChart
                data={apiData?.expenseBreakdown}
                isLoading={isLoading}
              />
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:col-span-3 lg:grid-cols-3">
          <TopProducts
            data={apiData?.topSellingProducts}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
          <StockOverview data={apiData?.stockOverview} isLoading={isLoading} />
          <Card className="h-80">
            <h3 className="text-lg font-semibold">Sales by Payment Type</h3>
            <PaymentTypeChart
              data={apiData?.salesByPaymentType}
              isLoading={isLoading}
            />
          </Card>
        </div>

        <div className="lg:col-span-3">
          <ActivityFeed data={apiData?.activityFeed} isLoading={isLoading} />
        </div>

        <div className="lg:col-span-3">
          <QuickActions onActionClick={setActiveModal} />
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// (C) SUB-COMPONENTS
// -----------------------------------------------------------------------------

// 1. Dynamic Account Balance Card (Dropdown showing specific methods for currency)
const AccountBalanceCard = ({
  accounts,
  currency,
  isLoading,
  formatCurrency
}: {
  accounts: { name: string; value: number }[];
  currency: string;
  isLoading: boolean;
  formatCurrency: (val: number) => string;
}) => {
  // Get allowed methods for this currency
  const allowedMethods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];
  
  // Set default to first allowed method (e.g. CASH or ZAAD)
  const [selectedMethod, setSelectedMethod] = useState(allowedMethods[0]);
  const [isOpen, setIsOpen] = useState(false);

  // Update selection if currency changes
  useEffect(() => {
    setSelectedMethod(allowedMethods[0]);
  }, [currency]);

  // Find balance for selected method
  // API returns accounts as [{ name: 'ZAAD', value: 100 }, ... ]
  // We need to match selectedMethod to account.name
  const currentAccount = accounts.find(a => a.name === selectedMethod);
  const currentBalance = currentAccount ? currentAccount.value : 0;

  const provider = PAYMENT_PROVIDERS[selectedMethod] || PAYMENT_PROVIDERS["OTHER"];
  const Icon = provider.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 flex flex-col justify-between">
      <div className="relative">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
          >
            {provider.label}
            <ChevronDown className="h-4 w-4" />
          </button>
          <Icon className="h-5 w-5 text-indigo-500" />
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 top-6 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <ul className="py-1">
                {allowedMethods.map((methodKey) => {
                  const prov = PAYMENT_PROVIDERS[methodKey] || PAYMENT_PROVIDERS["OTHER"];
                  return (
                    <li key={methodKey}>
                      <button
                        onClick={() => {
                          setSelectedMethod(methodKey);
                          setIsOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {prov.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-3/4" />
      ) : (
        <p className="mt-1 truncate text-2xl font-semibold">
          {formatCurrency(currentBalance)}
        </p>
      )}
    </div>
  );
};

// 2. Animated Floating Action Button Group (Now includes Add Income)
const AnimatedFloatingButtons = ({ onActionClick }: { onActionClick: (type: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: "New Sale", icon: Plus, href: "/sales/new", color: "bg-blue-600" },
    { label: "Add Product", icon: Package, href: "/products", color: "bg-green-600" },
    { label: "Add Customer", icon: UserPlus, href: "/customers", color: "bg-orange-600" },
    { label: "Add Income", icon: Landmark, action: "Add Income", color: "bg-teal-600" }, // Added Income
    { label: "Add Expense", icon: ArrowDown, action: "Add Expense", color: "bg-red-600" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded Actions */}
      {isOpen && (
        <div className="flex flex-col items-end gap-3 mb-2 transition-all duration-300 ease-out">
          {actions.map((item, index) => (
            <div key={index} className="flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200" style={{ animationDelay: `${index * 50}ms` }}>
              <span className="rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-white shadow-md dark:bg-gray-700">
                {item.label}
              </span>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg hover:scale-110 transition-transform ${item.color}`}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              ) : (
                <button
                  onClick={() => {
                    if(item.action) onActionClick(item.action);
                    setIsOpen(false);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg hover:scale-110 transition-transform ${item.color}`}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 ${isOpen ? 'rotate-45 bg-red-500 hover:bg-red-600' : ''}`}
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
};

// 3. Modern Dark Currency Filter
const CurrencyFilter = ({
  currency,
  onCurrencyChange,
}: {
  currency: string;
  onCurrencyChange: (newCurrency: string) => void;
}) => {
  const currencies = ["USD", "SLSH", "SOS", "EUR", "KSH", "BIRR"];

  return (
    <div className="relative">
      <select
        id="currency"
        name="currency"
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="appearance-none rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-4 pr-8 text-sm font-bold text-white shadow-sm transition-colors hover:bg-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {currencies.map((c) => (
          <option key={c} value={c} className="bg-gray-900 text-white">
            {c}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  );
};

// --- Standard Components ---
const QuickActions = ({ onActionClick }: { onActionClick: (modalType: string) => void; }) => {
  const linkActions = [
    { name: "New Sale", icon: Plus, href: "/sales/new", color: "text-blue-500" },
    { name: "Add Product", icon: Package, href: "/products", color: "text-green-500" },
    { name: "Add Customer", icon: UserPlus, href: "/customers", color: "text-orange-500" },
    { name: "Create Invoice", icon: FileText, href: "/sales", color: "text-purple-500" },
  ];
  const modalActions = [
    { name: "Add Income", icon: Landmark, modal: "Add Income", color: "text-teal-500" },
    { name: "Add Expense", icon: ArrowDown, modal: "Add Expense", color: "text-red-500" },
  ];
  return (
    <Card>
      <h3 className="text-lg font-semibold">Quick Actions</h3>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {linkActions.map((action) => (
          <Link key={action.name} href={action.href}
            className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center transition-all hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <action.icon className={`h-7 w-7 ${action.color}`} />
            <span className="text-sm font-medium">{action.name}</span>
          </Link>
        ))}
        {modalActions.map((action) => (
          <button
            key={action.name}
            type="button"
            onClick={() => onActionClick(action.modal)}
            className="group flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center transition-all hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <action.icon className={`h-7 w-7 ${action.color}`} />
            <span className="text-sm font-medium">{action.name}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string; }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
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
        <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Dashboard</h3>
        <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
      </div>
    </div>
  </Card>
);
const ChartEmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
    <BarChart className="h-12 w-12 opacity-50" />
    <p className="mt-2 text-sm">No data for this period</p>
  </div>
);
const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);
const KpiCard = ({ title, value, unit, icon: Icon, color, isLoading, className = "" }: { title: string; value: string | number; unit?: string; icon: React.ElementType; color: string; isLoading: boolean; className?: string; }) => (
  <Card className={`flex-1 ${className}`}>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
    {isLoading ? (
      <Skeleton className="mt-2 h-8 w-3/4" />
    ) : (
      <p className="mt-1 truncate text-2xl font-semibold">
        {value}
        {unit && <span className="ml-1 text-sm font-medium">{unit}</span>}
      </p>
    )}
  </Card>
);

const IncomeExpenseChart = ({ data, isLoading }: { data?: { date: string; income: number; expense: number }[]; isLoading: boolean; }) => {
  if (isLoading) return <div className="flex h-full items-center justify-center"><Skeleton className="h-full w-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", border: "1px solid #ddd", borderRadius: "8px" }} />
        <Legend />
        <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};
const ExpenseBreakdownChart = ({ data, isLoading }: { data?: { name: string; value: number }[]; isLoading: boolean; }) => {
  const COLORS = ["#0ea5e9", "#f97316", "#10b981", "#eab308", "#8b5cf6", "#ec4899"];
  if (isLoading) return <div className="flex h-full items-center justify-center"><Skeleton className="h-48 w-48 rounded-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} fill="#8884d8" paddingAngle={5} dataKey="value">
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend layout="vertical" align="right" verticalAlign="middle" />
      </PieChart>
    </ResponsiveContainer>
  );
};
const PaymentTypeChart = ({ data, isLoading }: { data?: { name: string; value: number }[]; isLoading: boolean; }) => {
  const COLORS = ["#3b82f6", "#16a34a", "#f59e0b", "#9333ea"];
  if (isLoading) return <div className="flex h-full items-center justify-center"><Skeleton className="h-48 w-48 rounded-full" /></div>;
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={(entry: any) => `${entry.name} (${entry.value})`}>
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};
const TopProducts = ({ data, isLoading, formatCurrency }: { data?: DashboardSummary["topSellingProducts"]; isLoading: boolean; formatCurrency: (val: number) => string; }) => (
  <Card className="lg:col-span-2">
    <h3 className="text-lg font-semibold">Top Performing Products</h3>
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0">Product</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Units Sold</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading && [...Array(3)].map((_, i) => (
                <tr key={i}><td className="py-4 pl-4 pr-3 sm:pl-0"><Skeleton className="h-5 w-3/4" /></td><td className="px-3 py-4"><Skeleton className="h-5 w-1/2" /></td><td className="px-3 py-4"><Skeleton className="h-5 w-1/2" /></td></tr>
              ))}
              {!isLoading && data?.map((product) => (
                <tr key={product.name}>
                  <td className="py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">{product.name}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{product.unitsSold}</td>
                  <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && (!data || data.length === 0) && <TableEmptyState message="No product sales in this period." />}
        </div>
      </div>
    </div>
  </Card>
);
const RecentSales = ({ data, isLoading, formatCurrency }: { data?: DashboardSummary["recentSales"]; isLoading: boolean; formatCurrency: (val: number) => string; }) => {
  const statusColors: Record<string, string> = {
    paid: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
    debit: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
    partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
    default: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Sales</h3>
        <Link href="/sales" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-500">View All</Link>
      </div>
      <div className="mt-4 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0">Customer</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading && [...Array(3)].map((_, i) => (
                  <tr key={i}><td className="py-4 pl-4 pr-3 sm:pl-0"><Skeleton className="h-5 w-3/4" /></td><td className="px-3 py-4"><Skeleton className="h-5 w-1/2" /></td><td className="px-3 py-4"><Skeleton className="h-5 w-1/2" /></td><td className="px-3 py-4"><Skeleton className="h-5 w-1/2" /></td></tr>
                ))}
                {!isLoading && data?.map((sale) => (
                  <tr key={sale.id}>
                    <td className="py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">{sale.customerName}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-3 py-4 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[sale.status.toLowerCase()] || statusColors.default}`}>{sale.status}</span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{dayjs(sale.createdAt).format("MMM D, YYYY")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && (!data || data.length === 0) && <TableEmptyState message="No sales found for this period." />}
          </div>
        </div>
      </div>
    </Card>
  );
};
const StockOverview = ({ data, isLoading }: { data?: DashboardSummary["stockOverview"]; isLoading: boolean; }) => (
  <Card>
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Inventory Overview</h3>
      <Link href="/products" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-500">View Inventory</Link>
    </div>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Items running low or out of stock.</p>
    <ul className="mt-4 space-y-3">
      {isLoading && [...Array(3)].map((_, i) => (<li key={i} className="flex items-center justify-between"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/4" /></li>))}
      {!isLoading && data?.map((item) => (
        <li key={item.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {item.quantity === 0 ? <Box className="h-4 w-4 text-red-500" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <span className="text-sm font-medium">{item.name}</span>
          </div>
          <span className={`text-sm font-semibold ${item.quantity === 0 ? "text-red-500" : "text-orange-500"}`}>{item.quantity} in stock</span>
        </li>
      ))}
      {!isLoading && (!data || data.length === 0) && (
        <li className="text-center text-sm text-gray-500 dark:text-gray-400">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
          Stock levels are healthy!
        </li>
      )}
    </ul>
  </Card>
);
const ActivityFeed = ({ data, isLoading }: { data?: DashboardSummary["activityFeed"]; isLoading: boolean; }) => (
  <Card>
    <h3 className="text-lg font-semibold">Activity Feed</h3>
    <ul className="mt-4 space-y-4">
      {isLoading && [...Array(3)].map((_, i) => (<li key={i} className="flex gap-3"><Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" /><div className="w-full space-y-1.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></li>))}
      {!isLoading && data?.map((activity) => (
        <li key={activity.id} className="flex gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"><List className="h-4 w-4 text-gray-500 dark:text-gray-400" /></div>
          <div>
            <p className="text-sm">{activity.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{activity.userName} &middot; {dayjs(activity.timestamp).fromNow(true)} ago</p>
          </div>
        </li>
      ))}
      {!isLoading && (!data || data.length === 0) && <li className="text-center text-sm text-gray-500 dark:text-gray-400">No recent activity.</li>}
    </ul>
  </Card>
);
const PerformanceWidget = ({ data, isLoading }: { data?: DashboardSummary["performanceComparison"]; isLoading: boolean; }) => (
  <Card>
    <h3 className="text-lg font-semibold">Performance</h3>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Compared to the previous period.</p>
    <div className="mt-4 space-y-3">
      {isLoading ? (<><Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /></>) : (
        <>
          <PerformanceItem title="Sales Growth" value={data?.salesChangePercent ?? 0} />
          <PerformanceItem title="Profit Growth" value={data?.profitChangePercent ?? 0} />
        </>
      )}
    </div>
  </Card>
);
const PerformanceItem = ({ title, value }: { title: string; value: number; }) => {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
      <span className="font-medium">{title}</span>
      <span className={`flex items-center text-base font-semibold ${isPositive ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
        {isPositive ? <ArrowUp className="mr-0.5 h-4 w-4" /> : <ArrowDown className="mr-0.5 h-4 w-4" />}
        {value.toFixed(1)}%
      </span>
    </div>
  );
};
const SmartInsight = ({ insight, isLoading }: { insight?: string; isLoading: boolean; }) => (
  <Card className="bg-blue-50 dark:bg-blue-900/20">
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50"><Info className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
      <div>
        <h3 className="font-semibold text-blue-800 dark:text-blue-300">Smart Insight</h3>
        {isLoading ? <Skeleton className="mt-1.5 h-8 w-full" /> : <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">{insight}</p>}
      </div>
    </div>
  </Card>
);

// --- Date Picker Logic ---
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
function getWeeksForMonth(month: number, year: number, startOfWeek: number = 0) {
  const firstDayOfMonth = dayjs(new Date(year, month, 1));
  let firstDayOfCalendar = firstDayOfMonth.startOf("week");
  if (firstDayOfCalendar.day() !== startOfWeek) {
    firstDayOfCalendar = firstDayOfCalendar.day(startOfWeek);
    if (firstDayOfCalendar.isAfter(firstDayOfMonth)) {
      firstDayOfCalendar = firstDayOfCalendar.subtract(1, "week");
    }
  }
  const weeks: dayjs.Dayjs[][] = [];
  let currentDay = firstDayOfCalendar;
  for (let i = 0; i < 6; i++) {
    const week: dayjs.Dayjs[] = [];
    for (let j = 0; j < 7; j++) {
      week.push(currentDay);
      currentDay = currentDay.add(1, "day");
    }
    weeks.push(week);
    if (currentDay.month() !== month && i > 3) break;
  }
  return weeks;
}

const DatePresetButtons = ({ activePreset, onPresetChange, onCustomClick }: { activePreset: string; onPresetChange: (preset: string) => void; onCustomClick: () => void; }) => {
  const filters = ["Today", "Yesterday", "This Week", "This Month", "This Year"];
  return (
    <div className="flex flex-wrap items-center rounded-lg bg-white p-1 shadow-sm dark:bg-gray-800">
      {filters.map((filter) => (
        <button key={filter} onClick={() => onPresetChange(filter)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activePreset === filter ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}`}>{filter}</button>
      ))}
      <button onClick={onCustomClick} className={`ml-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activePreset === "Custom" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}`}><CalendarIcon className="h-5 w-5" /></button>
    </div>
  );
};

const CustomDateRangeModal = ({ initialStartDate, initialEndDate, onApply, onClose }: { initialStartDate: string; initialEndDate: string; onApply: (startDate: string, endDate: string) => void; onClose: () => void; }) => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [currentMonth, setCurrentMonth] = useState(dayjs(initialStartDate).startOf("month"));
  const handleApplyClick = () => {
    if (!startDate || !endDate || dayjs(startDate).isAfter(dayjs(endDate))) {
      alert("Invalid date range.");
      return;
    }
    onApply(startDate, endDate);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Select Custom Range</h3><button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"><XIcon className="h-5 w-5" /></button></div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full rounded-md border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <CalendarGrid month={currentMonth.month()} year={currentMonth.year()} startDate={startDate} endDate={endDate} onStartDateSelect={setStartDate} onEndDateSelect={setEndDate} nextMonth={() => setCurrentMonth(currentMonth.add(1, "month").startOf("month"))} prevMonth={() => setCurrentMonth(currentMonth.subtract(1, "month").startOf("month"))} />
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
          <button onClick={handleApplyClick} className="rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">OK</button>
        </div>
      </div>
    </div>
  );
};

const CalendarGrid = ({ month, year, startDate, endDate, onStartDateSelect, onEndDateSelect, nextMonth, prevMonth }: any) => (
  <div className="mt-4">
    <CalendarMonth month={month} year={year} nextMonth={nextMonth} prevMonth={prevMonth} />
    <CalendarDays month={month} year={year} startDate={startDate} endDate={endDate} onStartDateSelect={onStartDateSelect} onEndDateSelect={onEndDateSelect} />
  </div>
);
const CalendarMonth = ({ month, year, nextMonth, prevMonth }: any) => (
  <div className="mb-2 flex items-center justify-between">
    <button type="button" onClick={prevMonth} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"><ChevronLeft className="h-5 w-5" /></button>
    <div className="font-semibold">{dayjs(new Date(year, month)).format("MMMM YYYY")}</div>
    <button type="button" onClick={nextMonth} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"><ChevronRight className="h-5 w-5" /></button>
  </div>
);
const CalendarDays = ({ month, year, startDate, endDate, onStartDateSelect, onEndDateSelect }: any) => {
  const weeks = useMemo(() => getWeeksForMonth(month, year), [month, year]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const handleDayClick = (day: any) => {
    const dateStr = day.format("YYYY-MM-DD");
    if (!startDate || day.isBefore(dayjs(startDate), "day") || endDate) { onStartDateSelect(dateStr); onEndDateSelect(""); } else { onEndDateSelect(dateStr); }
  };
  return (
    <div className="grid grid-cols-7 gap-px text-center">
      {dayNames.map((day) => <div key={day} className="py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{day}</div>)}
      {weeks.flat().map((day) => {
        const isCurrentMonth = day.month() === month;
        const isToday = day.isSame(dayjs(), "day");
        const selected = day.format("YYYY-MM-DD") === startDate || day.format("YYYY-MM-DD") === endDate;
        const inRange = startDate && endDate && day.isAfter(dayjs(startDate), "day") && day.isBefore(dayjs(endDate), "day");
        return (
          <button type="button" key={day.format("YYYY-MM-DD")} onClick={() => handleDayClick(day)}
            className={classNames("py-2 text-sm", isCurrentMonth ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500", !selected && !inRange && "hover:bg-gray-100 dark:hover:bg-gray-700", (selected || inRange) && "bg-blue-100 dark:bg-blue-900/50", selected && "font-semibold text-blue-600 dark:text-blue-400", inRange && "text-blue-600 dark:text-blue-400", isToday && !selected && "font-bold text-blue-600", day.format("YYYY-MM-DD") === startDate && "rounded-l-full", day.format("YYYY-MM-DD") === endDate && "rounded-r-full")}
          >
            {day.date()}
          </button>
        );
      })}
    </div>
  );
};