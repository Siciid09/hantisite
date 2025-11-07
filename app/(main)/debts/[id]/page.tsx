// File: app/(main)/debts/[id]/page.tsx
// Description: Details page for a single debt record.
// Shows payment history and allows recording new payments.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Loader2,
  AlertOctagon,
  CheckCircle,
  CreditCard,
  Plus,
  ArrowLeft,
  Calendar,
  DollarSign,
  Phone,
  MessageSquare,
  X,
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

// Use the same currency formatter
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
};

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function DebtDetailPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DebtDetailPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📝 Main Debt Detail Page Component
// -----------------------------------------------------------------------------
function DebtDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(id && !authLoading ? `/api/debts/${id}` : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  const handlePaymentSuccess = () => {
    mutate(); // Re-fetch data
    setIsPayModalOpen(false);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  if (!apiData) return <TableEmptyState message="Debt record not found." />;

  const { debt, paymentHistory } = apiData;
  const isPaid = debt.isPaid || debt.amountDue <= 0.01;

  return (
    <div className="mx-auto min-h-screen max-w-4xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/debts")}
            className="mb-2 flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to All Debts
          </button>
          <h1 className="text-3xl font-bold">Debt Details</h1>
        </div>
        {!isPaid && (
          <button
            onClick={() => setIsPayModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        )}
      </header>

      <div className="space-y-6">
        {/* --- Debtor Info & Status --- */}
        <Card>
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <h2 className="text-xl font-semibold">{debt.clientName}</h2>
              <p className="text-gray-500">{debt.reason}</p>
              <div className="mt-2 flex gap-4">
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone className="h-4 w-4" /> {debt.clientPhone}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MessageSquare className="h-4 w-4" /> {debt.clientWhatsapp}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                isPaid 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' 
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
              }`}>
                {isPaid ? "Paid" : "Unpaid"}
              </span>
            </div>
          </div>
        </Card>

        {/* --- KPIs: Total, Paid, Remaining --- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            title="Total Debt"
            value={formatCurrency(debt.totalAmount, debt.currency)}
            icon={DollarSign} color="text-gray-500"
          />
          <KpiCard
            title="Total Paid"
            value={formatCurrency(debt.totalPaid, debt.currency)}
            icon={CheckCircle} color="text-green-500"
          />
          <KpiCard
            title="Remaining Due"
            value={formatCurrency(debt.amountDue, debt.currency)}
            icon={AlertOctagon} color="text-orange-500"
          />
        </div>
        
        {/* --- Payment History --- */}
        <Card>
          <h3 className="text-lg font-semibold">Payment History</h3>
          <PaymentHistoryList payments={paymentHistory} currency={debt.currency} />
        </Card>
      </div>

      {/* --- Modals --- */}
      {isPayModalOpen && (
        <RecordPaymentModal
          debt={debt}
          onClose={() => setIsPayModalOpen(false)}
      _     onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Sub-Components
// -----------------------------------------------------------------------------

const PaymentHistoryList = ({ payments, currency }: any) => {
  if (!payments || payments.length === 0) {
    return <TableEmptyState message="No payment history found." />;
  }
  return (
    <div className="mt-4 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0">Amount</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Method</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Date</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold">Received By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment: any) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
s                   {formatCurrency(payment.amount, currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{payment.paymentMethod || 'N/A'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {dayjs(payment.paymentDate || payment.createdAt).format("DD MMM YYYY")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{payment.userName || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RecordPaymentModal = ({ debt, onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({
    amountPaid: "",
    paymentMethod: "Cash",
    paymentDate: dayjs().format("YYYY-MM-DD"),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmount = parseFloat(formData.amountPaid);
    if (!paidAmount || paidAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (paidAmount > debt.amountDue + 0.01) { // Add tolerance
      setError("Payment cannot be more than the remaining amount due.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
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
s         onChange={handleChange} 
          required 
        />
  _     <FormSelect label="Payment Method" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
          <option value="Cash">Cash</option>
          <option value="Mobile">Mobile (Zaad, eDahab)</option>
          <option value="Bank">Bank</option>
          <option value="Other">Other</option>
        </FormSelect>
        <FormInput 
          label="Payment Date" 
          name="paymentDate" 
          type="date" 
          value={formData.paymentDate} 
s         onChange={handleChange} 
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
// 🛠️ Reusable Helper Components (Copied from your debts/page.tsx)
// -----------------------------------------------------------------------------

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
  </Card>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);

const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
      <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

const FormInput = ({ label, name, ...props }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    />
  </div>
);

const FormSelect = ({ label, name, children, ...props }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    >
      {children}
    </select>
  </div>
);