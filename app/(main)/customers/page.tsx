// File: app/(main)/customers/page.tsx
//
// --- LATEST FIX (UI & Date) ---
// 1. (FIXED) `CustomerBalancesTab` now correctly renders the ISO date
//    string from the API and uses `d.clientName` to fix "Invalid Date"
//    and "Unknown" name errors.
// 2. (REMOVED) All `window.confirm` and `alert` popups.
// 3. (ADDED) `ConfirmModal` and `GlobalErrorToast` for modern UI.
// 4. (REBUILT) `AddCustomerModal` to use a modern `formData` state
//    and a consistent `FormInput` component.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, FormEvent, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import Link from "next/link";

// --- Icons ---
import {
  Users,
  CreditCard,
  Plus,
  Trash,
  Edit,
  X,
  Loader2,
  AlertTriangle,
  List,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// --- (A) API Fetcher ---
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// --- (B) Main Customers Page Component ---
export default function CustomersModulePage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("All Customers");
  
  // --- (NEW) Global Error State ---
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return <div className="p-6">Please log in to view customers.</div>;
  }

  // --- Render UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {/* --- (NEW) Error Toast --- */}
      <GlobalErrorToast error={globalError} onClose={() => setGlobalError(null)} />

      {/* --- Header --- */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your customer list and outstanding balances.
        </p>
      </header>

      {/* --- Tab Navigation --- */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* --- Tab Content --- */}
      <div className="mt-6">
        {activeTab === "All Customers" && <CustomerListTab setGlobalError={setGlobalError} />}
        {activeTab === "Customer Balances" && <CustomerBalancesTab setGlobalError={setGlobalError} />}
      </div>
    </div>
  );
}

// --- (C) Tab Navigation Component ---
const TABS = [
  { name: "All Customers", icon: Users },
  { name: "Customer Balances", icon: CreditCard },
];

const TabNav = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => (
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
          <tab.icon className={`h-5 w-5 ${activeTab === tab.name ? "text-blue-500 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500"}`} />
          {tab.name}
        </button>
      ))}
    </nav>
  </div>
);
// --- (D) Tab Content Components ---

// --- TAB 1: All Customers ---
function CustomerListTab({ setGlobalError }: { setGlobalError: (err: string) => void }) {
  const { data, error, isLoading, mutate } = useSWR("/api/customers?tab=list", fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  
  // --- (NEW) State for delete modal ---
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/customers?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete.");
      }
      
      mutate(); // Re-fetch list
      setConfirmDelete(null); // Close modal on success
    } catch (err: any) {
      setGlobalError(err.message);
      setConfirmDelete(null); // Close modal on error
    }
  };
  
  return (
    <Card>
      {modalOpen && <AddCustomerModal 
        customer={editCustomer} 
        onClose={() => {
          setModalOpen(false);
          setEditCustomer(null);
        }}
        onSuccess={() => {
          setModalOpen(false);
          setEditCustomer(null);
          mutate();
        }}
        setGlobalError={setGlobalError}
      />}
      
      {/* --- (NEW) Delete Confirmation Modal --- */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Customer"
          message={`Are you sure you want to delete ${confirmDelete.name}? This action cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">All Customers</h3>
        <button onClick={() => { setEditCustomer(null); setModalOpen(true); }} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>
      
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Address</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading && <tr><td colSpan={5}><TableLoader /></td></tr>}
            {error && <tr><td colSpan={5}><ErrorDisplay error={error} /></td></tr>}
            {data?.map((c: any) => (
              <tr key={c.id}>
                <td className="py-4 font-medium">
                  <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {c.name}
                  </Link>
                </td>
                <td className="py-4">{c.phone || 'N/A'}</td>
                <td className="py-4">{c.email || 'N/A'}</td>
                <td className="py-4">{c.address || 'N/A'}</td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditCustomer(c); setModalOpen(true); }} className="rounded p-1 text-green-600 hover:bg-green-100" title="Edit">
                      <Edit className="h-4 w-4" />
                    </button>
                    {/* --- (FIX) Replaced window.confirm --- */}
                    <button onClick={() => setConfirmDelete(c)} className="rounded p-1 text-red-500 hover:bg-red-100" title="Delete">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.length === 0 && <TableEmptyState message="No customers found. Click 'Add Customer' to start." />}
      </div>
    </Card>
  );
}

// --- TAB 2: Customer Balances / Credits (FIXED) ---
function CustomerBalancesTab({ setGlobalError }: { setGlobalError: (err: string) => void }) {
  const { data, error, isLoading, mutate } = useSWR("/api/customers?tab=balances", fetcher);
  
  // --- (NEW) State for pay modal ---
  const [confirmPay, setConfirmPay] = useState<any | null>(null);

  const handleMarkAsPaid = async (debitId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "pay_balance", debitId }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to mark as paid.");
      }
      
      mutate(); // Re-fetch balances
      setConfirmPay(null); // Close modal
    } catch (err: any) {
      setGlobalError(err.message);
      setConfirmPay(null); // Close modal
    }
  };

  return (
    <Card>
      {/* --- (NEW) Pay Confirmation Modal --- */}
      {confirmPay && (
        <ConfirmModal
          title="Mark Balance as Paid"
          message={`Are you sure this balance has been paid? This is for corrections only.\n
Customer: ${confirmPay.clientName}
Amount: $${(confirmPay.amountDue || 0).toFixed(2)}`}
          onConfirm={() => handleMarkAsPaid(confirmPay.id)}
          onClose={() => setConfirmPay(null)}
          confirmText="Mark as Paid"
          confirmColor="bg-green-600 hover:bg-green-700"
        />
      )}
      
      <h3 className="text-lg font-semibold">Outstanding Customer Balances (Debits)</h3>
      <p className="text-sm text-gray-500">
        This list shows all unpaid balances from sales.
      </p>
      
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Customer Name</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Amount Due</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Sale Date</th>
              <th className="py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading && <tr><td colSpan={4}><TableLoader /></td></tr>}
            {error && <tr><td colSpan={4}><ErrorDisplay error={error} /></td></tr>}
            {data?.map((d: any) => (
              <tr key={d.id}>
                {/* --- (FIX 1) Use clientName, not customerName --- */}
                <td className="py-4 font-medium">{d.clientName || "Unknown"}</td>
                
                <td className="py-4 font-medium text-red-500">${(d.amountDue || 0).toFixed(2)}</td>
                
                {/* --- (FIX 2) Handle ISO Date String (which API now sends) --- */}
                <td className="py-4">
                  {dayjs(d.createdAt).format("MMM D, YYYY")}
                </td>
                
                <td className="py-4">
                  {/* --- (FIX) Replaced window.confirm --- */}
                  <button onClick={() => setConfirmPay(d)} className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-700 hover:bg-green-200">
                    <CheckCircle className="h-4 w-4" /> Mark as Paid
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data?.length === 0 && <TableEmptyState message="No outstanding customer balances." />}
      </div>
    </Card>
  );
}

// --- (E) Helper & Modal Components ---

// --- (NEW) Modern AddCustomerModal ---
function AddCustomerModal({ customer, onClose, onSuccess, setGlobalError }: { 
  customer?: any, 
  onClose: () => void,
  onSuccess: () => void,
  setGlobalError: (err: string) => void,
}) {
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(""); // Local form error
  
  const isEditMode = !!customer;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear local error
    
    if (!formData.name || !formData.phone) {
      setError("Name and Phone are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const payload = {
        type: isEditMode ? "update_customer" : "new_customer",
        ...formData,
        id: isEditMode ? customer.id : undefined,
      };
      
      const res = await fetch("/api/customers", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save customer.");
      }
      onSuccess(); // Call success
    } catch (err: any) {
      setGlobalError(err.message); // Use global error for API fails
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase title={isEditMode ? "Edit Customer" : "Add New Customer"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* --- (FIX) Modern 2x2 grid --- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Customer Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <FormInput
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
          <FormInput
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>
        
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="flex min-w-[100px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? "Save Changes" : "Save Customer")}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}


// --- Standard UI Components (Cards, Loaders, etc.) ---
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const TableLoader = () => (
  <div className="flex w-full justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5" />
      <div>
        <h3 className="font-semibold">Error Loading Data</h3>
        <p className="text-sm">{error.message}</p>
      </div>
    </div>
  </div>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
    <List className="mx-auto mb-2 h-12 w-12 opacity-50" />
    {message}
  </div>
);

const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// --- (NEW) Modern FormInput component ---
const FormInput = ({ label, name, value, onChange, ...props }: {
  label: string,
  name: string,
  value: string,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  [key: string]: any
}) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
    <input
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
      {...props}
    />
  </div>
);

// --- (NEW) Confirm Modal ---
const ConfirmModal = ({ title, message, onClose, onConfirm, confirmText = "Confirm", confirmColor = "bg-red-600 hover:bg-red-700" }: {
  title: string,
  message: string,
  onClose: () => void,
  onConfirm: () => void,
  confirmText?: string,
  confirmColor?: string,
}) => {
  return (
    <ModalBase title={title} onClose={onClose}>
      <div className="mt-4">
        <p className="text-sm text-gray-500 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3 pt-6">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm text-white ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalBase>
  );
};

// --- (NEW) Global Error Toast ---
const GlobalErrorToast = ({ error, onClose }: { error: string | null, onClose: () => void }) => {
  useEffect(() => {
    if (error) {
      const timer = setTimeout(onClose, 5000); // Auto-dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [error, onClose]);

  if (!error) return null;
  return (
    <div className="fixed top-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-red-600 p-4 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm font-medium">{error}</span>
        <button onClick={onClose} className="ml-4 rounded-full p-1 hover:bg-red-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};