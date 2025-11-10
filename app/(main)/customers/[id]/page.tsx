// File: app/(main)/customers/[id]/page.tsx
"use client";

import React, { Suspense } from "react";
// --- (NEW) --- Import useSearchParams
import { useParams, useRouter, useSearchParams } from "next/navigation"; 
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Loader2,
  AlertOctagon,
  CreditCard,
  User,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Receipt,
  TrendingUp,
} from "lucide-react";

// --- (NEW) ---
// Import the REAL modal component from your sales components file
import { ViewSaleModal } from "@/app/(main)/sales/components"; 
// We will also need your Debt modal component
// import { DebtDetailsModal } from "@/app/(main)/debts/components"; // <-- ADD THIS LATER
// --- (END NEW) ---


// --- Fetcher ---
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
  const style = ["USD", "EUR"].includes(currency) ? "currency" : "decimal"; // <-- (FIX) Changed EURO to EUR
  const options: Intl.NumberFormatOptions = {
    style,
    minimumFractionDigits: ["SLSH", "SOS", "BIRR"].includes(currency) ? 0 : 2,
    maximumFractionDigits: ["SLSH", "SOS", "BIRR"].includes(currency) ? 0 : 2,
  };
  if (style === "currency") {
    options.currency = currency;
    options.currencyDisplay = "symbol";
  }
  const formatted = new Intl.NumberFormat("en-US", options).format(amount);
  return style === "decimal" ? `${currency} ${formatted}` : formatted;
};

// --- Suspense Wrapper ---
export default function CustomerDetailPageWrapper() {
  return (
    // Wrap the main page in Suspense to allow useSearchParams
    <Suspense fallback={<LoadingSpinner />}>
      <CustomerDetailPage />
    </Suspense>
  );
}

// --- Main Page ---
function CustomerDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  // --- (NEW) --- Get URL search params
  const searchParams = useSearchParams();
  const saleIdToShow = searchParams.get("viewSale");
  const debtIdToShow = searchParams.get("viewDebt");
  // --- (END NEW) ---

  const { data, error, isLoading } = useSWR(
    id && !authLoading ? `/api/customers/${id}` : null,
    fetcher
  );
  
  // --- (NEW) --- Helper function to close modals
  const closeModal = () => {
    // Pushes the URL without query params, e.g., /customers/[id]
    router.push(`/customers/${id}`); 
  };
  
  // --- (NEW) --- Placeholder Print Function
  const handlePrint = (sale: any) => {
     // You need to import and call your PDF service here
     // import { generateInvoicePdf } from "@/lib/pdfService";
     // generateInvoicePdf(sale);
     console.log("Printing sale:", sale);
  };
  // --- (END NEW) ---

  if (authLoading || isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!data) return <TableEmptyState message="Customer record not found." />;

  const { customer, kpis, salesHistory, debitsHistory } = data;

  const renderKpiValue = (kpiObject: { [key: string]: number }) => {
    const entries = Object.entries(kpiObject);
    if (entries.length === 0) return <p className="text-xl font-semibold">0</p>;
    return (
      <div className="space-y-0.5">
        {entries.map(([currency, value]) => (
          <p key={currency} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(value, currency)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => router.push("/customers")}
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {customer.name}
        </h1>
      </div>

      <div className="space-y-8">
        {/* Customer Info */}
        <Section title="Customer Details" icon={User}>
          <div className="grid gap-6 sm:grid-cols-3">
            <InfoItem icon={Phone} label="Phone" value={customer.phone} />
            <InfoItem icon={Mail} label="Email" value={customer.email || "N/A"} />
            <InfoItem icon={MapPin} label="Address" value={customer.address || "N/A"} />
          </div>
        </Section>

        {/* KPIs */}
        <Section title="Overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total Spent" icon={TrendingUp} color="text-green-500">
              {renderKpiValue(kpis.totalSpent)}
            </KpiCard>
            <KpiCard title="Total Outstanding" icon={AlertOctagon} color="text-red-500">
              {renderKpiValue(kpis.totalOwed)}
            </KpiCard>
            <KpiCard title="Total Sales" icon={Receipt} color="text-blue-500">
              <p className="text-2xl font-semibold">{kpis.totalSales}</p>
            </KpiCard>
            <KpiCard title="Pending Debts" icon={CreditCard} color="text-orange-500">
              <p className="text-2xl font-semibold">{kpis.outstandingDebts}</p>
            </KpiCard>
          </div>
        </Section>

        {/* Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Recent Sales">
            {/* --- (NEW) --- Pass customerId to the table */}
            <SalesHistoryTable sales={salesHistory} customerId={id} />
          </Section>
          <Section title="Recent Debts">
            {/* --- (NEW) --- Pass customerId to the table */}
            <DebitsHistoryTable debits={debitsHistory} customerId={id} />
          </Section>
        </div>
      </div>
      
      {/* --- (NEW) --- MODAL RENDERING --- */}
      {/* This renders the wrapper if the URL param exists */}
      <Suspense fallback={null}>
        {saleIdToShow && (
          <SaleDetailModalWrapper
            saleId={saleIdToShow}
            onClose={closeModal}
            onPrint={handlePrint}
          />
        )}
      </Suspense>

      
      {/* --- (END NEW) --- */}
      
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 (NEW) Self-Fetching Modal Wrapper
// -----------------------------------------------------------------------------
function SaleDetailModalWrapper({ saleId, onClose, onPrint }: {
  saleId: string;
  onClose: () => void;
  onPrint: (sale: any) => void;
}) {
  // This wrapper fetches the full sale data, 
  // because the customer page only has a summary.
  
  // NOTE: This assumes you have an API endpoint at /api/sales/[id]
  // If you don't, we must create one or change this fetch URL.
  const { data, error, isLoading } = useSWR(
    `/api/sales/${saleId}`, // <-- ASSUMPTION
    fetcher
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }
  
  if (error || !data) {
    // A simple error state
    return (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
         <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="font-semibold text-red-600">Error</h3>
            <p className="text-gray-700 dark:text-gray-300">Could not load sale details.</p>
            <p className="text-sm text-gray-500">{error?.message}</p>
         </div>
       </div>
    );
  }

  // Once data is loaded, render the REAL modal with the full sale object
  return (
    <ViewSaleModal
      isOpen={true}
      onClose={onClose}
      sale={data.sale} // Assuming the API returns { sale: {...} }
      onPrint={onPrint}
    />
  );
}


// -----------------------------------------------------------------------------
// 🧩 Reusable Components
// -----------------------------------------------------------------------------
const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) => (
  <Card>
    <div className="mb-5 flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
      {Icon && <Icon className="h-5 w-5 text-gray-500" />}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
    {children}
  </Card>
);

const KpiCard = ({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50">
    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color} bg-opacity-10`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
      <div className="mt-1">{children}</div>
    </div>
  </div>
);

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div>
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <p className="mt-1 text-gray-900 dark:text-white">{value}</p>
  </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card>
    <h3 className="text-lg font-semibold text-red-600">Error Loading Data</h3>
    <p className="mt-1 text-sm text-red-500">{error.message}</p>
  </Card>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500">{message}</div>
);

// --- Tables ---
// --- (NEW) --- Added 'customerId' prop
const SalesHistoryTable = ({ sales, customerId }: { sales: any[]; customerId: string; }) => {
  if (!sales?.length) return <TableEmptyState message="No sales history found." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            <Th>Invoice</Th>
            <Th>Date</Th>
            <Th>Amount</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sales.map((sale) => (
            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
              <Td>
                {/* --- (NEW) --- Updated Link href to set URL param */}
                <Link 
                  href={`/customers/${customerId}?viewSale=${sale.id}`} 
                  scroll={false} 
                  className="text-blue-600 hover:underline"
                >
                  {sale.invoiceId}
                </Link>
                {/* --- (END NEW) --- */}
              </Td>
              <Td>{dayjs(sale.createdAt).format("DD MMM YYYY")}</Td>
              <Td>{formatCurrency(sale.totalAmount, sale.currency)}</Td>
              <Td>
                <StatusBadge status={sale.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- (NEW) --- Added 'customerId' prop
const DebitsHistoryTable = ({ debits, customerId }: { debits: any[]; customerId: string; }) => {
  if (!debits?.length) return <TableEmptyState message="No debt history found." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            <Th>Reason</Th>
            <Th>Date</Th>
            <Th>Amount Due</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {debits.map((debt) => (
            <tr key={debt.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
              <Td>
                {/* --- (NEW) --- Updated Link href to set URL param */}
                <Link 
                  href={`/customers/${customerId}?viewDebt=${debt.id}`} 
                  scroll={false} 
                  className="text-blue-600 hover:underline"
                >
                  {debt.reason}
                </Link>
                {/* --- (END NEW) --- */}
              </Td>
              <Td>{dayjs(debt.createdAt).format("DD MMM YYYY")}</Td>
              <Td>{formatCurrency(debt.amountDue, debt.currency)}</Td>
              <Td>
                <StatusBadge status={debt.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
    {children}
  </th>
);
const Td = ({ children }: { children: React.ReactNode }) => (
  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">{children}</td>
);

const StatusBadge = ({ status }: { status: string }) => {
  const color =
    status === "paid"
      ? "bg-green-100 text-green-700"
      : status === "partial"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${color}`}>
      {status}
    </span>
  );
};