// File: app/(main)/reports/page.tsx
// Description: Main Reports & Analytics page.
//
// --- MODERN UI UPGRADE ---
// 1. (NEW) KPI Cards are now colorful, modern, and include icons.
// 2. (NEW) ReportTable is now responsive (horizontal scroll) and color-codes
//    positive (green) and negative (red) financial numbers.
// 3. (NEW) All Cards and Table Rows have modern hover:shadow and transition
//    effects for a smoother feel.
// 4. (NEW) Added a "Refresh" button to the header (like on your dashboard).
// 5. (NEW) Added "title" tooltips to all buttons for better user guidance.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useEffect, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { auth } from "../../../lib/firebaseConfig";
import dayjs from "dayjs";
import {
  LineChart, Line, BarChart as ReBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, ShoppingCart, Package, DollarSign, Users, Briefcase,
  FileText, Loader2, X, ChevronLeft, Calendar as CalendarIconLucide, 
  Download, AlertTriangle, Banknote, CreditCard, UserCheck,
  ChevronDown, ChevronRight, RefreshCw, // Added RefreshCw
  PackageX, AlertOctagon, List, BarChart2, CheckCircle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// --- Imports for New Date Picker ---
import { Button } from "../../components/ui/Button"; // Assuming path
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover"; // Assuming path
import { cn } from "../../../lib/utils"; // Assuming path
import { 
  add, addDays, format, startOfWeek, startOfMonth, endOfDay,
  eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, isSameMonth,
  isToday, parse, sub,
  isAfter, isBefore
} from "date-fns";
import { type DateRange } from "react-day-picker"; // We still use the *type*

// --- Imports for New Download Modal ---
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// -----------------------------------------------------------------------------
// 💰 API Fetcher
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

// Global currency formatter
const formatCurrency = (amount: number | null | undefined, currency: string): string => {
  if (amount == null) return "N/A";
  
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  };

  if (["USD", "EUR", "KES"].includes(currency)) {
    options.maximumFractionDigits = 2;
  }
  
  // Add negative sign manually for non-currency formats
  let prefix = amount < 0 ? "-" : "";
  if (options.style === 'currency') prefix = ''; // Let Intl handle it

  try {
    return new Intl.NumberFormat("en-US", options).format(amount);
  } catch (e) {
    // Fallback for non-ISO codes
    return `${prefix}${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(amount))}`;
  }
};

const AVAILABLE_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KES", "ETB"];

// Colors for charts
const CHART_COLORS = ["#3b82f6", "#16a34a", "#f59e0b", "#9333ea", "#e11d48", "#14b8a6"];

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function ReportsPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ReportsPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📊 Report Definitions (For Tab UI)
// -----------------------------------------------------------------------------
const reportNavLinks = [
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "finance", label: "Finance (P&L)", icon: DollarSign },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "debts", label: "Debts & Credit", icon: CreditCard },
  { id: "customers", label: "Customers & Suppliers", icon: Briefcase },
  { id: "hr", label: "HR & Staff", icon: Users },
  { id: "custom", label: "Custom Reports", icon: FileText },
];

// -----------------------------------------------------------------------------
// 📝 Main Reports Page Component
// -----------------------------------------------------------------------------

// Helper function to get params from URL
const getURLParams = () => {
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
};

// Helper function to update URL
const updateURL = (params: URLSearchParams) => {
  if (typeof window !== "undefined") {
    // Clean up empty params
    const entries = Array.from(params.entries());
    const cleanedParams = new URLSearchParams();
    entries.forEach(([key, value]) => {
      if (value) {
        cleanedParams.set(key, value);
      }
    });
    const newPath = `${window.location.pathname}?${cleanedParams.toString()}`;
    window.history.pushState(null, '', newPath);
  }
};

type DatePreset = "today" | "this_week" | "this_month" | "custom";

function ReportsPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const [view, setView] = useState("sales");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: dayjs().startOf("month").toDate(),
    to: dayjs().endOf("day").toDate(),
  });
  const [activePreset, setActivePreset] = useState<DatePreset>("this_month");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const params = getURLParams();
    setView(params.get("view") || "sales");
    
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    
    setDate({
      from: startDate ? dayjs(startDate).toDate() : dayjs().startOf("month").toDate(),
      to: endDate ? dayjs(endDate).toDate() : dayjs().endOf("day").toDate(),
    });
    setCurrency(params.get("currency") || "USD");
    
    if (startDate || endDate) {
      setActivePreset("custom");
    } else {
      setActivePreset("this_month");
    }
  }, []);

  const handleDateApply = (newDate: DateRange | undefined) => {
    setDate(newDate);
    setActivePreset("custom");
    const params = getURLParams();
    params.set("startDate", newDate?.from ? dayjs(newDate.from).format("YYYY-MM-DD") : "");
    params.set("endDate", newDate?.to ? dayjs(newDate.to).format("YYYY-MM-DD") : "");
    updateURL(params);
  };
  
  const handlePresetApply = (preset: DatePreset, newDate: DateRange | undefined) => {
    setActivePreset(preset);
    setDate(newDate);
    const params = getURLParams();
    params.set("startDate", newDate?.from ? dayjs(newDate.from).format("YYYY-MM-DD") : "");
    params.set("endDate", newDate?.to ? dayjs(newDate.to).format("YYYY-MM-DD") : "");
    updateURL(params);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    const params = getURLParams();
    params.set("currency", newCurrency);
    updateURL(params);
  };

  const handleTabChange = (newView: string) => {
    setView(newView);
    const params = getURLParams();
    params.set("view", newView);
    updateURL(params);
  };
  
  useEffect(() => {
    const handlePopState = () => {
      const params = getURLParams();
      setView(params.get("view") || "sales");
      
      const startDate = params.get("startDate");
      const endDate = params.get("endDate");
      setDate({
        from: startDate ? dayjs(startDate).toDate() : dayjs().startOf("month").toDate(),
        to: endDate ? dayjs(endDate).toDate() : dayjs().endOf("day").toDate(),
      });
      setCurrency(params.get("currency") || "USD");
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const params = new URLSearchParams({
    view,
    currency,
    startDate: date?.from ? dayjs(date.from).format("YYYY-MM-DD") : "",
    endDate: date?.to ? dayjs(date.to).format("YYYY-MM-DD") : "",
  });
  const apiUrl = `/api/reports?${params.toString()}`;

  const {
    data: apiData,
    error,
    isLoading,
    mutate, // <-- Get mutate function
  } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
    
      {reportModalOpen && (
        <ReportsDownloadModal 
          onClose={() => setReportModalOpen(false)}
          defaultView={view}
          defaultCurrency={currency}
          defaultDate={date}
        />
      )}

      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">View all reports for your business</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button 
            title="Download Report"
            onClick={() => setReportModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <button 
            title="Refresh Data"
            onClick={() => mutate()} // <-- NEW: Refresh button
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* --- 📑 Tab Navigation --- */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {reportNavLinks.map((link) => (
          <button
            key={link.id}
            title={`View ${link.label} reports`}
            onClick={() => handleTabChange(link.id)}
            className={`group flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200
              ${
                view === link.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            <link.icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${view === link.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'}`} />
            {link.label}
          </button>
        ))}
      </div>
      
      {/* --- Filters --- */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
                Date Range
              </label>
              <DatePresetButtons
                activePreset={activePreset}
                onPresetSelect={handlePresetApply}
              />
            </div>
            <div className="w-full md:w-[280px]">
              <NewDateRangePicker
                date={date}
                onApply={handleDateApply}
              />
            </div>
          </div>
          
          <div className="w-full pt-4 md:w-auto md:pt-0">
            <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-300">
              Display Currency
            </label>
            <FormSelect
              value={currency}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCurrencyChange(e.target.value)}
              className="w-full md:w-[150px]"
            >
              {AVAILABLE_CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </FormSelect>
          </div>
        </div>
      </Card>

      {/* --- 🚦 Content Switcher --- */}
      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <RenderReportTab 
            view={view} 
            data={apiData} 
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🎨 RenderReportTab Component (The "Big Page" Switcher)
// -----------------------------------------------------------------------------
const RenderReportTab = ({ view, data, currency }: { view: string, data: any, currency: string }) => {
  if (data.notImplemented) {
    const link = reportNavLinks.find(l => l.id === view);
    const title = link?.label || "Reports";
    const icon = link?.icon || AlertTriangle;
    
    let message = `Reports for the "${view}" module are in development.`;
    if (view === 'custom') {
      message = "The custom report builder is a feature in development. Soon, you'll be able to build and export your own reports here."
    }

    return <PlaceholderComponent title={title} icon={icon} message={message} />;
  }

  switch (view) {
    case 'sales':
      return <SalesReportsTab data={data} currency={currency} />;
    case 'finance':
      return <FinanceReportsTab data={data} currency={currency} />;
    case 'inventory':
      return <InventoryReportsTab data={data} currency={currency} />;
    case 'purchases':
      return <PurchasesReportsTab data={data} currency={currency} />;
    case 'debts':
      return <DebtsReportsTab data={data} currency={currency} />;
    case 'customers':
      return <CustomersReportsTab data={data} currency={currency} />;
    case 'hr':
      return <HrReportsTab data={data} currency={currency} />;
    case 'custom':
      return <PlaceholderComponent 
        title="Custom Report Builder" 
        icon={FileText}
        message="The custom report builder is in development. Soon, you'll be able to build and export your own reports here." 
      />;
    default:
      return <PlaceholderComponent 
        title="Under Construction" 
        icon={AlertTriangle}
        message={`Reports for the "${view}" module are in development.`}
      />;
  }
};

// -----------------------------------------------------------------------------
// 1. Sales Reports "Big Page"
// -----------------------------------------------------------------------------
const SalesReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Total Sales" 
          value={formatCurrency(data.kpis[0]?.value, currency)}
          icon={TrendingUp}
          color="text-green-500"
        />
        <KpiCard 
          title="Net Sales" 
          value={formatCurrency(data.kpis[1]?.value, currency)}
          icon={CheckCircle}
          color="text-blue-500"
        />
        <KpiCard 
          title="Transactions" 
          value={data.kpis[2]?.value}
          icon={List}
          color="text-purple-500"
        />
        <KpiCard 
          title="Avg. Sale Value" 
          value={formatCurrency(data.kpis[3]?.value, currency)}
          icon={BarChart2}
          color="text-sky-500"
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Sales Trend">
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data.charts?.salesTrend || []}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(val) => formatCurrency(val, currency)} />
              <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
              <Line type="monotone" dataKey="amount" name="Sales" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Sales by Payment Method">
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={data.charts?.paymentMethods || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                {(data.charts?.paymentMethods || []).map((_: any, i: number) => <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(val: number) => formatCurrency(val, currency)} /> <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Top-Selling Products</h3>
          <ReportTable
            headers={["Product Name", "Units Sold", "Total Revenue"]}
            rows={(data.tables?.topProducts || []).map((p: any) => [
              p.name,
              p.units,
              formatCurrency(p.revenue, currency)
            ])}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Sales by Product Category</h3>
          <ReportTable
            headers={["Category", "Units Sold", "Total Revenue"]}
            rows={(data.tables?.salesByCategory || []).map((p: any) => [
              p.name,
              p.units,
              formatCurrency(p.revenue, currency)
            ])}
          />
        </Card>
      </div>
      
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Sales by Customer</h3>
        <ReportTable
          headers={["Customer Name", "Total Purchased", "Transactions"]}
          rows={(data.tables?.salesByCustomer || []).map((c: any) => [
            c.name,
            formatCurrency(c.total, currency),
            c.count
          ])}
        />
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. Finance Reports "Big Page"
// -----------------------------------------------------------------------------
const FinanceReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  const netProfit = data.kpis[2]?.value || 0;
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard 
          title="Total Income" 
          value={formatCurrency(data.kpis[0]?.value, currency)}
          icon={ArrowUpRight}
          color="text-green-500"
        />
        <KpiCard 
          title="Total Expenses" 
          value={formatCurrency(data.kpis[1]?.value, currency)}
          icon={ArrowDownRight}
          color="text-red-500"
        />
        <KpiCard 
          title="Net Profit" 
          value={formatCurrency(netProfit, currency)}
          icon={DollarSign}
          color={netProfit >= 0 ? "text-green-500" : "text-red-500"}
        />
      </div>

      <ChartCard title="Income vs. Expense Trend">
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data.charts?.incomeExpenseTrend || []}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(val) => formatCurrency(val, currency)} />
            <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
            <Legend />
            <Line type="monotone" dataKey="income" name="Income" stroke="#16a34a" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke="#e11d48" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      
      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Profit & Loss Statement</h3>
          <ReportTable
            headers={["Item", "Amount"]}
            rows={(data.tables?.profitAndLoss || []).map((row: any) => [
              row.item,
              formatCurrency(row.amount, currency)
            ])}
            boldRows={(data.tables?.profitAndLoss || []).map((row: any) => !!row.isBold)}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Expense Breakdown</h3>
          <ReportTable
            headers={["Category", "Amount"]}
            rows={(data.tables?.expenseBreakdown || []).map((row: any) => [
              row.name,
              formatCurrency(row.value, currency)
            ])}
          />
        </Card>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. Inventory Reports "Big Page"
// -----------------------------------------------------------------------------
const InventoryReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Total Products" 
          value={data.kpis[0]?.value}
          icon={Package}
          color="text-purple-500"
        />
        <KpiCard 
          title="Total Stock Value (USD)" 
          value={formatCurrency(data.kpis[1]?.value, "USD")}
          icon={Banknote}
          color="text-blue-500"
        />
        <KpiCard 
          title="Low Stock Items" 
          value={data.kpis[2]?.value}
          icon={AlertTriangle}
          color="text-orange-500"
        />
        <KpiCard 
          title="Out of Stock Items" 
          value={data.kpis[3]?.value}
          icon={PackageX}
          color="text-red-500"
        />
      </div>
      
      <ChartCard title="Stock Value by Category (USD)">
        <ResponsiveContainer width="100%" height="90%">
          <ReBarChart data={data.charts?.stockValueByCategory || []} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis type="number" fontSize={12} tickFormatter={(val) => formatCurrency(val, "USD")} />
            <YAxis type="category" dataKey="name" fontSize={12} width={100} />
            <Tooltip formatter={(val: number) => formatCurrency(val, "USD")} />
            <Bar dataKey="value" name="Stock Value" fill="#3b82f6" />
          </ReBarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Top 10 Fast-Moving Products</h3>
          <ReportTable
            headers={["Product Name", "Units Sold", "Current Qty"]}
            rows={(data.tables?.fastMoving || []).map((row: any) => [row.name, row.unitsSold, row.qty])}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Top 10 Slow-Moving Products</h3>
          <ReportTable
            headers={["Product Name", "Units Sold", "Current Qty"]}
            rows={(data.tables?.slowMoving || []).map((row: any) => [row.name, row.unitsSold, row.qty])}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Low Stock Items</h3>
          <ReportTable
            headers={["Product Name", "Current Qty", "Threshold"]}
            rows={(data.tables?.lowStock || []).map((row: any) => [row.name, row.qty, row.threshold])}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Stock Valuation (USD)</h3>
          <ReportTable
            headers={["Product Name", "Qty", "Cost", "Total Value"]}
            rows={(data.tables?.stockValuation || []).map((row: any) => [
              row.name,
              row.qty,
              formatCurrency(row.cost, "USD"), // Valuation is USD
              formatCurrency(row.value, "USD")
            ])}
          />
        </Card>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4. Purchases Reports "Big Page"
// -----------------------------------------------------------------------------
const PurchasesReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard 
          title="Total Purchases" 
          value={formatCurrency(data.kpis[0]?.value, currency)}
          icon={ShoppingCart}
          color="text-purple-500"
        />
        <KpiCard 
          title="Pending Payables" 
          value={formatCurrency(data.kpis[1]?.value, currency)}
          icon={AlertOctagon}
          color="text-orange-500"
        />
        <KpiCard 
          title="Total Orders" 
          value={data.kpis[2]?.value}
          icon={List}
          color="text-blue-500"
        />
      </div>
      
      <ChartCard title="Purchase Trend">
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data.charts?.purchaseTrend || []}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(val) => formatCurrency(val, currency)} />
            <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
            <Line type="monotone" dataKey="amount" name="Purchases" stroke="#9333ea" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <h3 className="mb-4 text-lg font-semibold">Top Suppliers by Purchase Amount</h3>
        <ReportTable
          headers={["Supplier Name", "Total Purchased", "Orders"]}
          rows={(data.tables?.topSuppliers || []).map((s: any) => [
            s.name,
            formatCurrency(s.total, currency),
            s.count
          ])}
        />
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 5. Debts & Credit Reports "Big Page"
// -----------------------------------------------------------------------------
const DebtsReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard 
          title="Total Outstanding Debts" 
          value={formatCurrency(data.kpis[0]?.value, currency)}
          icon={AlertOctagon}
          color="text-red-500"
        />
        <KpiCard 
          title="Total Collected" 
          value={formatCurrency(data.kpis[1]?.value, currency)}
          icon={CheckCircle}
          color="text-green-500"
        />
        <KpiCard 
          title="Total Debtors" 
          value={data.kpis[2]?.value}
          icon={Users}
          color="text-orange-500"
        />
      </div>
      
      <ChartCard title="Collected vs. Outstanding Debts">
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={data.charts?.debtStatus || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
              <Cell key="cell-0" fill="#16a34a" /> {/* Collected */}
              <Cell key="cell-1" fill="#e11d48" /> {/* Outstanding */}
            </Pie>
            <Tooltip formatter={(val: number) => formatCurrency(val, currency)} /> <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <h3 className="mb-4 text-lg font-semibold">Top Customers by Outstanding Debt</h3>
        <ReportTable
          headers={["Customer Name", "Amount Due", "Debts"]}
          rows={(data.tables?.topDebtors || []).map((d: any) => [
            d.name,
            formatCurrency(d.total, currency),
            d.count
          ])}
        />
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 6. Customers & Suppliers Reports "Big Page"
// -----------------------------------------------------------------------------
const CustomersReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <KpiCard 
          title="Total Customers" 
          value={data.kpis[0]?.value}
          icon={Users}
          color="text-blue-500"
        />
        <KpiCard 
          title="Total Suppliers" 
          value={data.kpis[1]?.value}
          icon={Briefcase}
          color="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Top 10 Customers by Purchase Amount</h3>
          <ReportTable
            headers={["Customer Name", "Total Spent", "Sales", "Avg. Sale", "Last Seen"]}
            rows={(data.tables?.topCustomers || []).map((c: any) => [
              c.name,
              formatCurrency(c.total, currency),
              c.count,
              formatCurrency(c.avg, currency),
              c.lastPurchase ? dayjs(c.lastPurchase).format("YYYY-MM-DD") : "N/A"
            ])}
          />
        </Card>
        
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Top 10 Suppliers by Purchase Amount</h3>
          <ReportTable
            headers={["Supplier Name", "Total Supplied", "Purchases", "Amount Owed"]}
            rows={(data.tables?.topSuppliers || []).map((s: any) => [
              s.name,
              formatCurrency(s.total, currency),
              s.count,
              formatCurrency(s.owed, currency)
            ])}
          />
        </Card>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 7. HR & Staff Reports "Big Page"
// -----------------------------------------------------------------------------
const HrReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <KpiCard 
          title="Total Staff" 
          value={data.kpis[0]?.value}
          icon={Users}
          color="text-blue-500"
        />
        <KpiCard 
          title="Total Payroll (Est.)" 
          value={formatCurrency(data.kpis[1]?.value, currency)}
          icon={Banknote}
          color="text-green-500"
        />
      </div>
      
      <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20">
        <h3 className="font-semibold text-yellow-700 dark:text-yellow-400">Note on Sales Analytics</h3>
        <p className="text-sm text-yellow-600 dark:text-yellow-500">
          To track **Sales by Staff**, please ensure the `sales` collection includes a `userId` field for each transaction. This report currently tracks Incomes and Expenses logged by staff.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Income Logged by Staff</h3>
          <ReportTable
            headers={["Staff Name", "Amount Logged", "Transactions"]}
            rows={(data.tables?.staffIncomes || []).map((s: any) => [
              s.name,
              formatCurrency(s.total, currency),
              s.count
            ])}
          />
        </Card>
        
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Expenses Logged by Staff</h3>
          <ReportTable
            headers={["Staff Name", "Amount Logged", "Transactions"]}
            rows={(data.tables?.staffExpenses || []).map((s: any) => [
              s.name,
              formatCurrency(s.total, currency),
              s.count
            ])}
          />
        </Card>
      </div>
    </div>
  );
};


// -----------------------------------------------------------------------------
// 🛠️ Reusable Helper Components (MODERNIZED)
// -----------------------------------------------------------------------------
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 transition-all duration-300 hover:shadow-lg ${className}`}>
    {children}
  </div>
);

const KpiCard = ({ title, value, icon: Icon, color = "text-gray-500", className = "" }: { 
  title: string, 
  value: string | number, 
  icon: React.ElementType, 
  color?: string,
  className?: string 
}) => (
  <Card className={`flex items-center gap-4 ${className}`}>
    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${color.replace('text-', 'bg-')} bg-opacity-10`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <p className={`mt-1 truncate text-2xl font-semibold ${color.startsWith('text-') ? color : ''}`}>{value}</p>
    </div>
  </Card>
);

const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Report</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);

const FormInput = ({ label, ...props }: any) => (
  <div className="flex-1">
    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    />
  </div>
);

const FormSelect = ({ label, children, ...props }: any) => (
  <div className="flex-1">
    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    >
      {children}
    </select>
  </div>
);

const PlaceholderComponent = ({ title, icon: Icon, message }: { title: string, icon: React.ElementType, message: string }) => (
  <Card className="flex h-96 flex-col items-center justify-center">
    <Icon className="h-16 w-16 text-gray-400" />
    <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
    <p className="mt-2 max-w-md text-center text-gray-500">{message}</p>
  </Card>
);

const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <Card className="h-96">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="mt-4 h-[300px] w-full">{children}</div>
  </Card>
);

// --- MODERNIZED Report Table ---
const ReportTable = ({ headers, rows, boldRows }: { headers: string[], rows: (string | number)[][], boldRows?: boolean[] }) => {
  if (!rows || rows.length === 0) {
    return <TableEmptyState message="No data found for this report." />;
  }

  // Helper to add color to financial numbers
  const getCellClass = (cell: string | number) => {
    if (typeof cell === 'string') {
      // Check for negative currency
      if (cell.startsWith('(') || cell.startsWith('-')) {
        return "text-red-500 font-medium";
      }
      // Check for positive currency
      if (cell.includes('$') || AVAILABLE_CURRENCIES.some(c => cell.startsWith(c))) {
        return "text-green-600 font-medium";
      }
    }
    return "";
  };

  return (
    <div className="w-full overflow-x-auto"> {/* Responsive wrapper */}
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, i) => (
            <tr key={i} className={`transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${boldRows && boldRows[i] ? 'font-bold bg-gray-50 dark:bg-gray-700' : ''}`}>
              {row.map((cell, j) => (
                <td key={j} className={`px-6 py-4 whitespace-nowrap text-sm ${getCellClass(cell)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// -----------------------------------------------------------------------------
// (B) (NEW) Built-in Date Range Picker
// -----------------------------------------------------------------------------
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

// --- (NEW) Helper Component for the new Calendar ---
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

// -----------------------------------------------------------------------------
// (C) (NEW) Reusable Date Preset Buttons
// -----------------------------------------------------------------------------
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
      newDate = { from: today, to: today };
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

// -----------------------------------------------------------------------------
// (D) (NEW) ModalBase
// -----------------------------------------------------------------------------
const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
    onClick={onClose}
  >
    <div 
      className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} title="Close modal" className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// (E) (NEW) Report Download Modal
// -----------------------------------------------------------------------------
function ReportsDownloadModal({ 
  onClose,
  defaultView,
  defaultCurrency,
  defaultDate
}: { 
  onClose: () => void,
  defaultView: string,
  defaultCurrency: string,
  defaultDate: DateRange | undefined
}) {
  const [reportType, setReportType] = useState(defaultView === 'custom' ? 'sales' : defaultView);
  const [reportCurrency, setReportCurrency] = useState(defaultCurrency);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<any | null>(null);

  const [date, setDate] = React.useState<DateRange | undefined>(defaultDate);
  const [activePreset, setActivePreset] = useState<DatePreset>("custom");
  
  const handleGenerate = async () => {
    setIsLoading(true);
    setGeneratedData(null);
    setErrorMessage(null);
    
    try {
      const params = new URLSearchParams({
        view: reportType,
        currency: reportCurrency,
        startDate: date?.from ? dayjs(date.from).format("YYYY-MM-DD") : "",
        endDate: date?.to ? dayjs(date.to).format("YYYY-MM-DD") : "",
      });

      const data = await fetcher(`/api/reports?${params.toString()}`);
      
      if (data && !data.notImplemented) {
        setGeneratedData(data);
        setErrorMessage(null);
      } else {
        setGeneratedData(null);
        setErrorMessage(`No report data found for "${reportType}" or it's in development.`);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!generatedData) return;

    const wb = XLSX.utils.book_new();
    const reportName = reportNavLinks.find(r => r.id === reportType)?.label || "Report";
    
    if (generatedData.kpis && generatedData.kpis.length > 0) {
      const kpiData = generatedData.kpis.map((kpi: any) => ({
        Metric: kpi.title,
        Value: kpi.format === 'currency' ? formatCurrency(kpi.value, reportCurrency) : kpi.value
      }));
      const ws = XLSX.utils.json_to_sheet(kpiData);
      ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, "KPIs");
    }

    if (generatedData.tables) {
      Object.keys(generatedData.tables).forEach(key => {
        const tableArray = generatedData.tables[key];
        if (Array.isArray(tableArray) && tableArray.length > 0) {
          const formattedArray = tableArray.map((row: any) => {
            const newRow: any = {};
            for (const cellKey in row) {
              const val = row[cellKey];
              if (typeof val === 'number' && (cellKey.includes('Amount') || cellKey.includes('total') || cellKey.includes('revenue') || cellKey.includes('value'))) {
                newRow[cellKey] = formatCurrency(val, reportCurrency);
              } else {
                 newRow[cellKey] = val;
              }
            }
            return newRow;
          });
          const ws = XLSX.utils.json_to_sheet(formattedArray);
          const cols = Object.keys(formattedArray[0] || {}).map(k => ({ wch: k.length > 20 ? 30 : 20 }));
          ws['!cols'] = cols;
          XLSX.utils.book_append_sheet(wb, ws, key.slice(0, 30));
        }
      });
    }
    
    XLSX.writeFile(wb, `${reportType}_report_${reportCurrency}_${dayjs().format("YYYYMMDD")}.xlsx`);
  };

  const handleDownloadPDF = () => {
    if (!generatedData) return;
    
    const doc = new jsPDF();
    const reportName = reportNavLinks.find(r => r.id === reportType)?.label || "Report";
    const dateString = date?.from ? `${format(date.from, "LLL dd, y")} - ${date.to ? format(date.to, "LLL dd, y") : ""}` : "All Time";
    let yPos = 22; 

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(reportName, 14, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${dayjs().format("MMM D, YYYY")}`, 14, yPos);
    
    yPos += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Filters Applied", 14, yPos);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    yPos += 6;
    const filterText = [
      `Date Range: ${dateString}`,
      `Currency: ${reportCurrency}`
    ];
    doc.text(filterText, 14, yPos);
    yPos += 10;
    
    if (generatedData.kpis && generatedData.kpis.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Key Metrics", 14, yPos);
      yPos += 7;
      
      const kpiBody = generatedData.kpis.map((kpi: any) => [
        kpi.title,
        kpi.format === 'currency' ? formatCurrency(kpi.value, reportCurrency) : kpi.value
      ]);
      
      autoTable(doc, {
        body: kpiBody,
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    if (generatedData.tables) {
      Object.keys(generatedData.tables).forEach(key => {
        const tableArray = generatedData.tables[key];
        if (Array.isArray(tableArray) && tableArray.length > 0) {
          
          if (yPos > 250) { 
             doc.addPage();
             yPos = 20;
          }
          
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(key, 14, yPos);
          yPos += 7;

          const headers = Object.keys(tableArray[0]);
          const body = tableArray.map((row: any) => 
            headers.map(header => {
              const val = row[header];
              if (typeof val === 'number' && (header.includes('Amount') || header.includes('total') || header.includes('revenue') || header.includes('value'))) {
                return formatCurrency(val, reportCurrency);
              }
              if (val instanceof Date) {
                return dayjs(val).format("YYYY-MM-DD");
              }
              return val;
            })
          );
          
          autoTable(doc, {
            head: [headers],
            body: body,
            startY: yPos,
            theme: 'grid',
            headStyles: {
              fillColor: [41, 128, 185],
              textColor: 255,
              fontStyle: 'bold',
            },
            didDrawPage: (data) => {
              doc.setFontSize(10);
              doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
            }
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
        }
      });
    }
    
    doc.save(`${reportType}_report_${reportCurrency}_${dayjs().format("YYYYMMDD")}.pdf`);
  };

  return (
    <ModalBase title="Download Report" onClose={onClose}>
      <div className="mt-4 space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect label="Report Type" value={reportType} onChange={(val: string) => setReportType(val)}>
            {reportNavLinks.filter(r => r.id !== 'custom').map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </FormSelect>
          <FormSelect label="Currency for Report" value={reportCurrency} onChange={(val: string) => setReportCurrency(val)}>
            {AVAILABLE_CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FormSelect>
        </div>

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
        
        <div className="pt-4">
          {errorMessage && !generatedData && (
            <div className="w-full text-center rounded-lg bg-red-100 p-3 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300 mb-3">
              {errorMessage}
            </div>
          )}
          
          {generatedData && (
            <div className="w-full text-center rounded-lg bg-green-100 p-3 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300 mb-3">
              Report generated! You can now download.
            </div>
          )}
          
          {!generatedData && (
            <button 
              onClick={handleGenerate} 
              disabled={isLoading} 
              title="First, generate the report"
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate Report
                </>
              )}
            </button>
          )}
          
          {generatedData && (
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleDownloadExcel} 
                title="Download as .xlsx file"
                className="w-full flex justify-center items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-green-800"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </button>
              <button 
                onClick={handleDownloadPDF} 
                title="Download as .pdf file"
                className="w-full flex justify-center items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-800"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalBase>
  );
}