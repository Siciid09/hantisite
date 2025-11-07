// File: app/(main)/suppliers/page.tsx
// Description: Main Suppliers page with "All Suppliers" and "Supplier Payments" tabs.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Users, Briefcase, DollarSign, Plus, Search, ChevronLeft,
  ChevronRight, X, Loader2, Phone, MessageSquare, AlertOctagon,
  CreditCard,
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

const formatCurrency = (amount: number | undefined | null, currency: string = "USD"): string => {
  if (amount == null) return "N/A";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
};

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function SuppliersPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SuppliersPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📝 Main Suppliers Page Component
// -----------------------------------------------------------------------------
const navLinks = [
  { id: "list", label: "All Suppliers", icon: Briefcase },
  { id: "payables", label: "Supplier Payments / Debts", icon: DollarSign },
];

function SuppliersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState<any | null>(null);

  // --- State ---
  const view = searchParams.get("view") || "list";
  const page = parseInt(searchParams.get("page") || "1");
  const searchQuery = searchParams.get("searchQuery") || "";

  // --- SWR Data Fetching ---
  const getApiUrl = () => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("searchQuery", searchQuery);
    
    if (view === 'list') {
      return `/api/suppliers?${params.toString()}`;
    }
    if (view === 'payables') {
      params.append("view", "pending"); // Use the purchases route
      return `/api/purchases?${params.toString()}`;
    }
    return null;
  };
  
  const apiUrl = getApiUrl();
  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
  } = useSWR(!authLoading && user ? apiUrl : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  // --- Handlers ---
  const handleTabChange = (newView: string) => {
    router.push(`/suppliers?view=${newView}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/suppliers?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSearch = formData.get("search") as string;
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("searchQuery", newSearch);
    params.set("page", "1");
    router.push(`/suppliers?${params.toString()}`);
  };
  
  const handleActionSuccess = () => {
    mutate(apiUrl); // Re-fetch data for the current view
    setIsAddModalOpen(false);
    setIsPayModalOpen(null);
  };

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold">Suppliers</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add New Supplier
        </button>
      </header>
      
      {/* --- 📑 Tab Navigation --- */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {navLinks.map((link) => (
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
      
      {/* --- Search Bar --- */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative flex-grow">
          <input
            type="search"
            name="search"
            defaultValue={searchQuery}
            placeholder={view === 'list' ? "Search suppliers..." : "Search pending orders..."}
            className="w-full rounded-lg border border-gray-300 p-2.5 pl-10 dark:border-gray-600 dark:bg-gray-800"
          />
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </form>

      {/* --- 🚦 Content Switcher --- */}
      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <Card>
            {view === 'list' && (
              <SupplierList suppliers={apiData.data} />
            )}
            {view === 'payables' && (
              <SupplierPayablesList 
                payables={apiData.data} 
                onRecordPayment={setIsPayModalOpen}
              />
            )}
            <Pagination
              currentPage={apiData.pagination.currentPage}
              hasMore={apiData.pagination.hasMore}
              onPageChange={handlePageChange}
            />
          </Card>
        )}
      </div>

      {/* --- Modals --- */}
      {isAddModalOpen && (
        <AddSupplierModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleActionSuccess}
        />
      )}
      {isPayModalOpen && (
        <RecordPaymentModal
          purchaseOrder={isPayModalOpen}
          onClose={() => setIsPayModalOpen(null)}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Tab-Specific Components
// -----------------------------------------------------------------------------

// 1. All Suppliers List
const SupplierList = ({ suppliers }: { suppliers: any[] }) => {
  if (!suppliers || suppliers.length === 0) {
    return <TableEmptyState message="No suppliers found." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Supplier</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Contact</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Total Owed</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Total Spent</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
          </tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-500">{s.contactPerson}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div>{s.phone}</div>
                <div>{s.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">
                {formatCurrency(s.totalOwed, "USD")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">
                {formatCurrency(s.totalSpent, "USD")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <a href={`tel:${s.phone}`} className="p-2 text-gray-500 hover:text-blue-600" title="Call">
                  <Phone className="h-4 w-4" />
                </a>
                <a href={`https://wa.me/${s.phone}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-500 hover:text-green-600" title="WhatsApp">
                  <MessageSquare className="h-4 w-4" />
                </a>
              </td>
            </tr>
          ))}
        </tbody></table>
    </div>
  );
};

// 2. Supplier Payments / Debts List
const SupplierPayablesList = ({ payables, onRecordPayment }: { payables: any[], onRecordPayment: (po: any) => void }) => {
  if (!payables || payables.length === 0) {
    return <TableEmptyState message="No pending payments found." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Order #</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Supplier</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Expected Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Amount Owed</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
          </tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {payables.map((po) => (
            <tr key={po.id}>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{po.poNumber}</td>
              <td className="px-6 py-4 whitespace-nowrap">{po.supplierName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {dayjs(po.expectedDate).format("DD MMM YYYY")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">
                {formatCurrency(po.totalAmount, "USD")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button
                  onClick={() => onRecordPayment(po)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Record Payment
                </button>
              </td>
            </tr>
          ))}
        </tbody></table>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 🧩 Modals & Helpers
// -----------------------------------------------------------------------------

const AddSupplierModal = ({ onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setError("Supplier Name and Phone are required.");
      return;
    }
    setIsSaving(true); setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save supplier.");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title="Add New Supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput label="Supplier Name" name="name" value={formData.name} onChange={handleChange} required />
        <FormInput label="Contact Person (Optional)" name="contactPerson" value={formData.contactPerson} onChange={handleChange} />
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} required />
        <FormInput label="Email (Optional)" name="email" type="email" value={formData.email} onChange={handleChange} />
        <FormInput label="Address (Optional)" name="address" value={formData.address} onChange={handleChange} />
        
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

const RecordPaymentModal = ({ purchaseOrder: po, onClose, onSuccess }: any) => {
  const [amountPaid, setAmountPaid] = useState(po.totalAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(amountPaid);
    if (!paid || paid <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    
    setIsSaving(true); setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/purchases/${po.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountPaid: paid, paymentMethod, currency: "USD" }), // Assuming USD
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
    <ModalBase title={`Pay PO #${po.poNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Supplier: {po.supplierName}</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
            {formatCurrency(po.totalAmount, "USD")}
          </p>
        </div>
        
        <FormInput label="Amount to Pay" name="amountPaid" type="number" value={amountPaid} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountPaid(e.target.value)} required />
        <FormSelect label="Payment Method" name="paymentMethod" value={paymentMethod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPaymentMethod(e.target.value)}>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Cash">Cash</option>
          <option value="Zaad">Zaad</option>
          <option value="eDahab">eDahab</option>
        </FormSelect>
        
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


// --- Reusable Helper Components ---
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

const Pagination = ({ currentPage, hasMore, onPageChange }: any) => (
  <div className="mt-4 flex items-center justify-between">
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