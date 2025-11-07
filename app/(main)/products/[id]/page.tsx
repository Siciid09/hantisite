// File: app/(main)/products/[id]/page.tsx
// Description: NEW "Product Hub" page.
//
// --- FEATURES ---
// 1. (NEW) Displays all data for a single product.
// 2. (NEW) Shows KPIs like Total Units Sold and Current Stock.
// 3. (NEW) Shows a table of the product's recent Sales History.
// 4. (NEW) Shows a table of the product's recent Stock Adjustments.
// -----------------------------------------------------------------------------
"use client";

import React, { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import Image from "next/image";
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
  TrendingUp,
  Package,
  Warehouse,
  GitCompare,
  TrendingDown,
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
  return `${currency} ${new Intl.NumberFormat("en-US", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

// --- Main Page & Suspense Wrapper ---
export default function ProductDetailPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProductDetailPage />
    </Suspense>
  );
}

// --- Main Product Detail Page Component ---
function ProductDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string; // This is productId

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
  } = useSWR(id && !authLoading ? `/api/products/${id}` : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!apiData) return <TableEmptyState message="Product record not found." />;

  const { product, kpis, salesHistory, adjustmentHistory } = apiData;

  return (
    <div className="mx-auto min-h-screen max-w-5xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/products")}
            className="mb-2 flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to All Products
          </button>
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <Image 
                src={product.imageUrl} 
                alt={product.name}
                width={64}
                height={64}
                className="rounded-lg object-cover w-16 h-16"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-700">
                <Package className="h-8 w-8" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="text-gray-500">{product.category}</p>
            </div>
          </div>
        </div>
        {/* You could add an "Edit Product" button here */}
      </header>

      <div className="space-y-6">
        {/* --- KPIs --- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Current Stock (Total)"
            value={kpis.currentStock}
            icon={Warehouse} color="text-blue-500"
          />
          <KpiCard
            title="Total Units Sold"
            value={kpis.totalUnitsSold}
            icon={TrendingUp} color="text-green-500"
          />
          <KpiCard
            title="Total Revenue (USD)"
            value={formatCurrency(kpis.totalRevenueUsd, "USD")}
            icon={DollarSign} color="text-green-500"
          />
        </div>
        
        {/* --- History Tables --- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="text-lg font-semibold">Recent Sales</h3>
              <SalesHistoryTable sales={salesHistory} />
            </Card>
            <Card>
              <h3 className="text-lg font-semibold">Stock Adjustments</h3>
              <AdjustmentsHistoryTable adjustments={adjustmentHistory} />
            </Card>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

// --- History Table Components ---
const SalesHistoryTable = ({ sales }: { sales: any[] }) => {
  if (!sales || sales.length === 0) {
    return <TableEmptyState message="No sales history found for this product." />;
  }
  return (
    <div className="mt-4 flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Invoice</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Qty</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
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
              <td className="py-4 text-sm font-bold">{sale.quantitySold}</td>
              <td className="py-4 text-sm">
                {formatCurrency(sale.salePrice, sale.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AdjustmentsHistoryTable = ({ adjustments }: { adjustments: any[] }) => {
  if (!adjustments || adjustments.length === 0) {
    return <TableEmptyState message="No stock adjustments found." />;
  }
  return (
    <div className="mt-4 flow-root">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead>
          <tr>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Reason</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Change</th>
            <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Warehouse</th>
Z         </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {adjustments.map((adj) => (
            <tr key={adj.id}>
              <td className="py-4 text-sm font-medium">{adj.reason}</td>
              <td className="py-4 text-sm">{dayjs(adj.timestamp).format("DD MMM YYYY")}</td>
              <td className={`py-4 text-sm font-bold ${adj.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {adj.change > 0 ? `+${adj.change}` : adj.change}
              </td>
              <td className="py-4 text-sm">{adj.warehouseName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


// --- Helper Components ---
const KpiCard = ({ title, value, icon: Icon, color }: any) => (
  <Card className="flex items-center gap-4">
    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${color.replace('text-', 'bg-')} bg-opacity-10`}>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
    <div>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
    </div>
  </Card>
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
D   </Card>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);