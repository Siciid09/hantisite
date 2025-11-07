// File: app/(main)/reports/page.tsx
// Description: Main Reports & Analytics page.
// Renders a "very big page" component for each of the 7 tabs.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  LineChart, Line, BarChart as ReBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, ShoppingCart, Package, DollarSign, Users, Briefcase,
  FileText, Loader2, X, ChevronLeft, Calendar, Download, AlertTriangle,
} from "lucide-react";

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
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
};

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
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "hr", label: "HR & Staff", icon: Users },
  { id: "customers", label: "Customers & Suppliers", icon: Briefcase },
  { id: "custom", label: "Custom Reports", icon: FileText },
];

// -----------------------------------------------------------------------------
// 📝 Main Reports Page Component
// -----------------------------------------------------------------------------
function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- State ---
  const view = searchParams.get("view") || "sales"; // Default to Sales tab
  
  const [filters, setFilters] = useState({
    currency: "USD",
    startDate: dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: dayjs().endOf("day").format("YYYY-MM-DD"),
  });
  
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // --- Handlers ---
  const handleTabChange = (newView: string) => {
    router.push(`/reports?view=${newView}`);
  };

  // --- SWR Data Fetching ---
  const params = new URLSearchParams({
    view,
    ...filters,
  });
  const apiUrl = `/api/reports?${params.toString()}`;

  const {
    data: apiData,
    error,
    isLoading,
  } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-500">View all reports for your business</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
          </button>
          <button className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Export Page (PDF)</button>
        </div>
      </header>

      {/* --- 📑 Tab Navigation --- */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {reportNavLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => handleTabChange(link.id)}
            className={`flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${
                view === link.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </button>
        ))}
      </div>
      
      {/* --- Filters --- */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800 md:flex-row">
        <FormInput label="Start Date" type="date" value={filters.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("startDate", e.target.value)} />
        <FormInput label="End Date" type="date" value={filters.endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange("endDate", e.target.value)} />
        <FormSelect label="Currency" value={filters.currency} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFilterChange("currency", e.target.value)}>
          <option value="USD">USD</option>
          <option value="SLSH">SLSH</option>
        </FormSelect>
        {/* The 'Refresh' is handled automatically by SWR on filter change */}
      </div>

      {/* --- 🚦 Content Switcher --- */}
      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <RenderReportTab 
            view={view} 
            data={apiData} 
            currency={filters.currency} 
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
    return (
      <PlaceholderComponent 
        title={`${reportNavLinks.find(l => l.id === view)?.label} Reports`}
        icon={reportNavLinks.find(l => l.id === view)?.icon || AlertTriangle}
        message={`Reports for the "${view}" module are in development.`}
      />
    );
  }

  switch (view) {
    case 'sales':
      return <SalesReportsTab data={data} currency={currency} />;
    case 'finance':
      return <FinanceReportsTab data={data} currency={currency} />;
    case 'inventory':
      return <InventoryReportsTab data={data} currency={currency} />;
    default:
      return (
        <PlaceholderComponent 
          title={`${reportNavLinks.find(l => l.id === view)?.label} Reports`}
          icon={reportNavLinks.find(l => l.id === view)?.icon || AlertTriangle}
          message={`Reports for the "${view}" module are in development.`}
        />
      );
  }
};

// -----------------------------------------------------------------------------
// 1. Sales Reports "Big Page"
// -----------------------------------------------------------------------------
const SalesReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((kpi: any) => (
          <KpiCard key={kpi.title} title={kpi.title} value={formatCurrency(kpi.value, currency)} />
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Sales Trend">
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data.charts.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(val) => formatCurrency(val, currency)} />
              <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
              <Line type="monotone" dataKey="amount" name="Sales" stroke="#3b82f6" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Sales by Payment Method">
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={data.charts.paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                {[...Array(data.charts.paymentMethods.length)].map((_, i) => <Cell key={`cell-${i}`} fill={["#3b82f6", "#16a34a", "#f59e0b", "#9333ea"][i % 4]} />)}
              </Pie>
              <Tooltip formatter={(val: number) => formatCurrency(val, currency)} /> <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Table */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Top-Selling Products</h3>
        <ReportTable
          headers={["Product Name", "Units Sold", "Total Revenue"]}
          rows={data.tables.topProducts.map((p: any) => [
            p.name,
            p.units,
            formatCurrency(p.revenue, currency)
          ])}
        />
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4. Finance Reports "Big Page"
// -----------------------------------------------------------------------------
const FinanceReportsTab = ({ data, currency }: { data: any, currency: string }) => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((kpi: any) => (
          <KpiCard key={kpi.title} title={kpi.title} value={formatCurrency(kpi.value, currency)} />
        ))}
      </div>
      
      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Profit & Loss Statement</h3>
          <ReportTable
            headers={["Item", "Amount"]}
            rows={data.tables.profitAndLoss.map((row: any) => [
              row.item,
              formatCurrency(row.amount, currency)
            ])}
            boldRows={data.tables.profitAndLoss.map((row: any) => !!row.isBold)}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Expense Breakdown</h3>
          <ReportTable
            headers={["Category", "Amount"]}
            rows={data.tables.expenseBreakdown.map((row: any) => [
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
        {data.kpis.map((kpi: any) => (
          <KpiCard 
            key={kpi.title} 
            title={kpi.title} 
            value={kpi.format === 'currency' ? formatCurrency(kpi.value, currency) : kpi.value} 
          />
        ))}
      </div>
      
      {/* Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Low Stock Items</h3>
          <ReportTable
            headers={["Product Name", "Current Qty", "Threshold"]}
            rows={data.tables.lowStock.map((row: any) => [row.name, row.qty, row.threshold])}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Stock Valuation (USD)</h3>
          <ReportTable
            headers={["Product Name", "Qty", "Cost", "Total Value"]}
            rows={data.tables.stockValuation.map((row: any) => [
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
// 🛠️ Reusable Helper Components
// -----------------------------------------------------------------------------
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const KpiCard = ({ title, value }: { title: string, value: string | number }) => (
  <Card className="flex-1">
    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
    <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
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

// Generic Table Component
const ReportTable = ({ headers, rows, boldRows }: { headers: string[], rows: (string | number)[][], boldRows?: boolean[] }) => {
  if (rows.length === 0) {
    return <TableEmptyState message="No data found for this report." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase">{h}</th>
            ))}
          </tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, i) => (
            <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${boldRows && boldRows[i] ? 'font-bold' : ''}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody></table>
    </div>
  );
};