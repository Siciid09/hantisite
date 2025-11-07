// File: app/(main)/customers/page.tsx
//
// --- LATEST UPDATE ---
// 1. (FIX) Imported the `Link` component from `next/link`.
// 2. (FIX) In `CustomerListTab`, the customer's name `<td>` is now a
//    <Link> component pointing to `/customers/[id]`.
// 3. (FIX) This page is no longer a "dead-end."
// -----------------------------------------------------------------------------
"use client";

import React, { useState, FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import Link from "next/link"; // <-- 1. IMPORT LINK

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

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return <div className="p-6">Please log in to view customers.</div>;
  }

  // --- Render UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
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
        {activeTab === "All Customers" && <CustomerListTab />}
        {activeTab === "Customer Balances" && <CustomerBalancesTab />}
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
function CustomerListTab() {
  const { data, error, isLoading, mutate } = useSWR("/api/customers?tab=list", fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      await fetch(`/api/customers?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      mutate(); // Re-fetch list
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  return (
    <Card>
      {modalOpen && <AddCustomerModal customer={editCustomer} onClose={() => {
        setModalOpen(false);
        setEditCustomer(null);
        mutate();
      }} />}
      
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
                {/* --- 2. THIS IS THE FIX --- */}
                <td className="py-4 font-medium">
                  <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {c.name}
                  </Link>
                </td>
                {/* --- END FIX --- */}
                <td className="py-4">{c.phone || 'N/A'}</td>
                <td className="py-4">{c.email || 'N/A'}</td>
                <td className="py-4">{c.address || 'N/A'}</td>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditCustomer(c); setModalOpen(true); }} className="rounded p-1 text-green-600 hover:bg-green-100" title="Edit">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="rounded p-1 text-red-500 hover:bg-red-100" title="Delete">
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

// --- TAB 2: Customer Balances / Credits ---
function CustomerBalancesTab() {
  const { data, error, isLoading, mutate } = useSWR("/api/customers?tab=balances", fetcher);
  
  const handleMarkAsPaid = async (debitId: string) => {
    // This should ideally open a payment modal, but for now, we'll
    // assume it's just marking as paid without a payment record.
    // A better flow would be to link to the /debts/[id] page.
    if (!window.confirm("Are you sure this balance has been paid? This action is for corrections. For payments, go to the Debts page.")) return;
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      // This endpoint seems incorrect for this action, but it's what's in the file.
      // A DELETE to /api/debts/[id] or PUT to /api/debts/[id] would be better.
      await fetch("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "pay_balance", debitId }),
      });
      mutate(); // Re-fetch balances
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <Card>
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
                <td className="py-4 font-medium">{d.customerName || "Unknown"}</td>
                <td className="py-4 font-medium text-red-500">${(d.amountDue || 0).toFixed(2)}</td>
                <td className="py-4">{dayjs(d.createdAt).format("MMM D, YYYY")}</td>
                <td className="py-4">
                  <button onClick={() => handleMarkAsPaid(d.id)} className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-700 hover:bg-green-200">
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
// (All helper components: AddCustomerModal, Card, Loaders, etc. are unchanged)

function AddCustomerModal({ customer, onClose }: { customer?: any, onClose: () => void }) {
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isEditMode = !!customer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const payload = {
        type: isEditMode ? "update_customer" : "new_customer",
        id: isEditMode ? customer.id : undefined,
        name,
        phone,
        email,
        address,
      };
      
      await fetch("/api/customers", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase title={isEditMode ? "Edit Customer" : "Add New Customer"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormInput label="Customer Name" value={name} onChange={setName} required className="md:col-span-2" />
        <FormInput label="Phone Number" value={phone} onChange={setPhone} required />
        <FormInput label="Email Address" type="email" value={email} onChange={setEmail} />
        <FormInput label="Address" value={address} onChange={setAddress} className="md:col-span-2" />
        
        <div className="flex justify-end gap-3 pt-4 md:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
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

const FormInput = ({ label, value, onChange, ...props }: {
  label: string,
  value: string,
  onChange: (val: string) => void,
  [key: string]: any
}) => (
  <div>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
      {...props}
    />
  </div>
);