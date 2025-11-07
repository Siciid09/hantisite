// File: app/(main)/customers/[id]/page.tsx
//
// --- FINAL VERSION (REFACTORED) ---
// 1. (FIX) Updated 'SalesHistoryTable' and 'DebitsHistoryTable' to use
//    the correct field names from the new API (e.g., 'paymentStatus', 'amount').
// 2. (NEW) The KPI cards for 'Total Spent' and 'Total Owed' now correctly
//    display multiple currencies (e.g., $100, 5000 BIRR) by reading
//    the objects sent from the fast API.
// -----------------------------------------------------------------------------
"use client";

import React, { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Loader2,
  AlertOctagon,
  CheckCircle,
  CreditCard,
  User,
  ArrowLeft,
  Calendar,
  DollarSign,
  Phone,
  Receipt,
  Mail,
  MapPin,
  TrendingUp
} from "lucide-react";

// --- API Fetcher ---
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

// --- Currency Formatter ---
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  // Simple formatter
  const style = (currency === "USD" || currency === "EURO") ? "currency" : "decimal";
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
    maximumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
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

// --- Main Page & Suspense Wrapper ---
export default function CustomerDetailPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CustomerDetailPage />
    </Suspense>
  );
}

// --- Main Customer Detail Page Component ---
function CustomerDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string; // This is customerId

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
  } = useSWR(id && !authLoading ? `/api/customers/${id}` : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!apiData) return <TableEmptyState message="Customer record not found." />;

  const { customer, kpis, salesHistory, debitsHistory } = apiData;
  
  // (NEW) Helper function to display multi-currency KPIs
  const renderKpiValue = (kpiObject: { [key: string]: number }) => {
    const entries = Object.entries(kpiObject);
    if (entries.length === 0) return <p className="mt-1 truncate text-2xl font-semibold">0</p>;
    
    return (
      <div className="mt-1 space-y-1">
        {entries.map(([currency, value]) => (
          <p key={currency} className="truncate text-xl font-semibold">
            {formatCurrency(value, currency)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/customers")}
            className="mb-2 flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to All Customers
          </button>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
        </div>
        {/* You could add an "Edit Customer" button here */}
      </header>

      <div className="space-y-6">
        {/* --- Customer Info --- */}
        <Card>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Customer Details</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InfoItem icon={Phone} label="Phone" value={customer.phone} />
            <InfoItem icon={Mail} label="Email" value={customer.email || 'N/A'} />
            <InfoItem icon={MapPin} label="Address" value={customer.address || 'N/A'} />
          </div>
        </Card>

        {/* --- KPIs (Now reading pre-calculated values) --- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Spent (All Time)"
            icon={TrendingUp} color="text-green-500"
          >
            {renderKpiValue(kpis.totalSpent)}
          </KpiCard>
          <KpiCard
            title="Total Outstanding"
            icon={AlertOctagon} color="text-red-500"
          >
            {renderKpiValue(kpis.totalOwed)}
          </KpiCard>
          <KpiCard
            title="Total Sales"
            icon={Receipt} color="text-blue-500"
          >
            <p className="mt-1 truncate text-2xl font-semibold">{kpis.totalSales}</p>
          </KpiCard>
          <KpiCard
            title="Pending Debts"
            icon={CreditCard} color="text-orange-500"
          >
            <p className="mt-1 truncate text-2xl font-semibold">{kpis.outstandingDebts}</p>
          </KpiCard>
        </div>
        
        {/* --- History Tables --- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="text-lg font-semibold">Recent Sales</h3>
              <SalesHistoryTable sales={salesHistory} />
            </Card>
            <Card>
              <h3 className="text-lg font-semibold">Recent Debts</h3>
              <DebitsHistoryTable debits={debitsHistory} />
            </Card>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

// --- History Table Components (FIXED) ---
const SalesHistoryTable = ({ sales }: { sales: any[] }) => {
  if (!sales || sales.length === 0) {
    return <TableEmptyState message="No sales history found." />;
  }
  return (
    <div className="mt-4 flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice ID</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td className="py-4 text-sm font-medium">
                <Link href={`/sales/${sale.id}`} className="text-blue-600 hover:underline">
                  {sale.invoiceId}
                </Link>
              </td>
              <td className="py-4 text-sm">{dayjs(sale.createdAt).format("DD MMM YYYY")}</td>
              <td className="py-4 text-sm">{formatCurrency(sale.totalAmount, sale.currency)}</td>
              <td className="py-4 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  sale.status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : (sale.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')
                }`}>
                  {sale.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DebitsHistoryTable = ({ debits }: { debits: any[] }) => {
  if (!debits || debits.length === 0) {
    return <TableEmptyState message="No debt history found." />;
  }
  return (
    <div className="mt-4 flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Reason</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Amount Due</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {debits.map((debt) => (
            <tr key={debt.id}>
              <td className="py-4 text-sm font-medium">
                <Link href={`/debts/${debt.id}`} className="text-blue-600 hover:underline">
                  {debt.reason}
                </Link>
              </td>
              <td className="py-4 text-sm">{dayjs(debt.createdAt).format("DD MMM YYYY")}</td>
              <td className="py-4 text-sm">{formatCurrency(debt.amountDue, debt.currency)}</td>
              <td className="py-4 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  debt.status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : (debt.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')
                }`}>
                  {debt.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// --- Helper Components ---
const KpiCard = ({ title, icon: Icon, color, children }: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) => (
  <Card className="flex items-start gap-4">
    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${color.replace('text-', 'bg-')} bg-opacity-10`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      {children}
    </div>
  </Card>
);

const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) => (
  <div>
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <p className="mt-1 text-gray-900 dark:text-white">{value || 'N/A'}</p>
  </div>
);

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

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);