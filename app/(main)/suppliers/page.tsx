// File: app/(main)/suppliers/page.tsx
//
// --- (GEMINI FIX: RECALCULATE BUTTON) ---
// 1. (FIX) RECALC: Imported 'RefreshCw' icon.
// 2. (FIX) RECALC: Added 'Recalculate Totals' button to the header.
// 3. (FIX) RECALC: Added 'isRecalculating' state.
// 4. (FIX) RECALC: Added 'handleRecalculate' function to call the new
//    /api/suppliers/recalculate route and fix all $0.00 data.
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
 Eye,
  RefreshCw , Building2, 
  User, 

  MessageCircle, 
  Mail, 
  MapPin, 
  TrendingUp, 
  AlertCircle, 
  History,Save,
  Calendar,
  CreditCard// <-- (FIX) RECALC: Added icon
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
  const [isViewModalOpen, setIsViewModalOpen] = useState<any | null>(null); 
  
  // --- (FIX) RECALC: State for the new button ---
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  // --- End Fix ---

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
      params.append("status", "pending");
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
  
  // --- (FIX) RECALC: Handler for the new button ---
  const handleRecalculate = async () => {
    if (!confirm("This will recalculate totals for ALL suppliers based on purchase history. This is safe to run. Continue?")) {
      return;
    }
    
    setIsRecalculating(true);
    setRecalcError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/suppliers/recalculate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to recalculate.");
      }
      
      // Success! Refresh the main supplier list
      mutate(apiUrl);
      
    } catch (err: any) {
      setRecalcError(err.message);
    } finally {
      setIsRecalculating(false);
    }
  };
  // --- End Fix ---

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold">Suppliers</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* --- (FIX) RECALC: Recalculate Button --- */}
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center justify-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800 shadow-sm hover:bg-yellow-100 disabled:opacity-50 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
          >
            {isRecalculating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recalculate Totals
          </button>
          {/* --- End Fix --- */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add New Supplier
          </button>
        </div>
      </header>
      
      {/* --- (FIX) RECALC: Error message display --- */}
      {recalcError && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
          <strong>Recalculation Failed:</strong> {recalcError}
        </div>
      )}
      {/* --- End Fix --- */}
      
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
            {view === 'list' && apiData.data && (
              <SupplierList 
                suppliers={apiData.data} 
                onView={setIsViewModalOpen}
              />
            )}
            
            {view === 'payables' && apiData.purchases && (
              <SupplierPayablesList 
                payables={apiData.purchases} 
                onRecordPayment={setIsPayModalOpen}
              />
            )}

            {apiData.pagination && (
              <Pagination
                currentPage={apiData.pagination.currentPage}
                hasMore={apiData.pagination.hasMore}
                onPageChange={handlePageChange}
              />
            )}
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
      {isViewModalOpen && (
        <ViewSupplierModal
          supplier={isViewModalOpen}
          onClose={() => setIsViewModalOpen(null)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Tab-Specific Components
// -----------------------------------------------------------------------------

// 1. All Suppliers List
const SupplierList = ({ suppliers, onView }: { suppliers: any[], onView: (supplier: any) => void }) => {
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
                <div><span className="font-medium">P:</span> {s.phone}</div>
                <div><span className="font-medium">W:</span> {s.whatsapp || 'N/A'}</div>
                <div>{s.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">
                {/* This will now show real data after recalculation! */}
                {formatCurrency(s.totalOwed, "USD")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">
                {/* This will now show real data after recalculation! */}
                {formatCurrency(s.totalSpent, "USD")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end items-center">
                <button
                  onClick={() => onView(s)}
                  className="p-2 text-gray-500 hover:text-blue-600" 
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <a href={`tel:${s.phone}`} className="p-2 text-gray-500 hover:text-blue-600" title="Call">
                  <Phone className="h-4 w-4" />
                </a>
                <a 
                  href={`https://wa.me/${s.whatsapp || s.phone}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-2 text-gray-500 hover:text-green-600" 
                  title="WhatsApp"
                >
                  <MessageSquare className="h-4 w-4" />
                </a>
              </td>
            </tr>
          ))}
        </tbody></table>
    </div>
  );
};

// 2. Supplier Payments / Debts List (Unchanged)
const SupplierPayablesList = ({ payables, onRecordPayment }: { payables: any[], onRecordPayment: (po: any) => void }) => {
  if (!payables || payables.length === 0) {
    return <TableEmptyState message="No pending payments found." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Order #</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Supplier</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Purchase Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Amount Owed</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
          </tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {payables.map((po) => (
            <tr key={po.id}>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{po.id.substring(0, 8)}...</td>
              <td className="px-6 py-4 whitespace-nowrap">{po.supplierName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {dayjs(po.purchaseDate).format("DD MMM YYYY")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-red-600">
                {formatCurrency(po.remainingAmount, po.currency)}
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

// AddSupplierModal (Unchanged)
const AddSupplierModal = ({ onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({ 
    name: "", 
    contactPerson: "", 
    phone: "", 
    whatsapp: "", 
    email: "", 
    address: "" 
  });
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
    <ModalBase title="Register New Supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-1 pb-2">
        
        <div className="space-y-6">
          {/* --- SECTION 1: IDENTITY --- */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Building2 className="h-3.5 w-3.5" /> Business Identity
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormInput 
                  label="Supplier / Company Name" 
                  name="name" 
                  placeholder="e.g. Global Trading Co."
                  value={formData.name} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div className="sm:col-span-2">
                <FormInput 
                  label="Contact Person" 
                  name="contactPerson" 
                  placeholder="e.g. Ahmed Ali"
                  value={formData.contactPerson} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          {/* --- SECTION 2: CONTACT DETAILS --- */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Phone className="h-3.5 w-3.5" /> Contact Information
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput 
                label="Phone Number" 
                name="phone" 
                placeholder="Primary Contact"
                value={formData.phone} 
                onChange={handleChange} 
                required 
              />
              <FormInput 
                label="WhatsApp" 
                name="whatsapp" 
                placeholder="e.g. +252..." 
                value={formData.whatsapp} 
                onChange={handleChange} 
              />
              <div className="sm:col-span-2">
                <FormInput 
                  label="Email Address" 
                  name="email" 
                  type="email" 
                  placeholder="info@example.com"
                  value={formData.email} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          {/* --- SECTION 3: LOCATION --- */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <MapPin className="h-3.5 w-3.5" /> Location
            </h4>
            <FormInput 
              label="Physical Address" 
              name="address" 
              placeholder="Street, City, Region"
              value={formData.address} 
              onChange={handleChange} 
            />
          </div>
        </div>
        
        {/* --- ERROR DISPLAY --- */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        
        {/* --- FOOTER ACTIONS --- */}
        <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSaving} 
            className="flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" /> 
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Supplier
              </>
            )}
          </button>
        </div>

      </form>
    </ModalBase>
  );
};

// RecordPaymentModal (Unchanged)
const RecordPaymentModal = ({ purchaseOrder: po, onClose, onSuccess }: any) => {
  const [amountPaid, setAmountPaid] = useState(po.remainingAmount.toString());
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
    if (paid > po.remainingAmount + 0.01) { // 0.01 buffer for floats
      setError("Payment cannot be more than the remaining amount.");
      return;
    }
    
    setIsSaving(true); setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/purchases`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          purchaseId: po.id, 
          paymentAmount: paid,
        }),
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
    <ModalBase title={`Pay PO #${po.id.substring(0, 8)}...`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Supplier: {po.supplierName}</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
            {formatCurrency(po.remainingAmount, po.currency)}
          </p>
        </div>
        
        <FormInput label="Amount to Pay" name="amountPaid" type="number" step="0.01" value={amountPaid} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountPaid(e.target.value)} required />
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

// ViewSupplierModal (Unchanged)
const ViewSupplierModal = ({ supplier, onClose }: { supplier: any, onClose: () => void }) => {
  const { 
    data: purchaseData, 
    error, 
    isLoading 
  } = useSWR(supplier ? `/api/purchases?supplierId=${supplier.id}` : null, fetcher);

return (
 <ModalBase title="Supplier Profile" onClose={onClose}>
      <div className="px-1 pb-6">
        
        {/* --- HERO SECTION: Identity --- */}
        <div className="mt-2 flex flex-col gap-6 sm:flex-row">
          {/* Avatar / Icon Placeholder */}
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-900/30">
            <Building2 className="h-10 w-10" />
          </div>

          {/* Name & Contact Person */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {supplier.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {supplier.contactPerson || "No contact person"}
                </span>
              </div>
              {supplier.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{supplier.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- CONTACT GRID --- */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
              <Phone className="h-3 w-3" /> Phone
            </div>
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {supplier.phone || "N/A"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </div>
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {supplier.whatsapp || "N/A"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
              <Mail className="h-3 w-3" /> Email
            </div>
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {supplier.email || "N/A"}
            </p>
          </div>
        </div>

        {/* --- FINANCIAL STATS --- */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl bg-red-50 p-4 dark:bg-red-900/10">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> Outstanding Balance
              </p>
              <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">
                {formatCurrency(supplier.totalOwed, "USD")}
              </p>
            </div>
            <div className="rounded-full bg-white p-2 text-red-500 shadow-sm dark:bg-red-900/30 dark:text-red-300">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-green-50 p-4 dark:bg-green-900/10">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-green-600 dark:text-green-400">
                <TrendingUp className="h-3.5 w-3.5" /> Lifetime Spent
              </p>
              <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(supplier.totalSpent, "USD")}
              </p>
            </div>
            <div className="rounded-full bg-white p-2 text-green-500 shadow-sm dark:bg-green-900/30 dark:text-green-300">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* --- PURCHASE HISTORY --- */}
        <div className="mt-10">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-gray-900 dark:text-white">
            <History className="h-4 w-4 text-gray-500" /> Purchase History
          </h3>
          
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            {isLoading && (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            )}
            
            {error && <ErrorDisplay error={error} />}
            
            {purchaseData && (
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 sticky top-0 z-10 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Remaining</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {purchaseData.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 italic">
                          No purchase records found.
                        </td>
                      </tr>
                    ) : (
                      purchaseData.purchases.map((po: any) => (
                        <tr key={po.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              {dayjs(po.purchaseDate).format("DD MMM YY")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(po.totalAmount, po.currency)}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-medium ${po.remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(po.remainingAmount, po.currency)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              po.status === 'received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              po.status === 'ordered' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {po.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* --- ACTIONS --- */}
        <div className="mt-8 flex justify-end border-t border-gray-100 pt-5 dark:border-gray-700">
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close Profile
          </button>
        </div>

      </div>
    </ModalBase>
  );
};


// --- Reusable Helper Components --- (All unchanged)
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
      <div className="mt-6 max-h-[80vh] overflow-y-auto pr-2">{children}</div>
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