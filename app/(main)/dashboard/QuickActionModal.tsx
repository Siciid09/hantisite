"use client";
// -----------------------------------------------------------------------------
// File: app/(main)/dashboard/QuickActionModal.tsx
//
// --- LATEST UPDATES ---
// 1. (FIX) Currency dropdowns now include "EUR", "KSH", and "BIRR".
// 2. (FIX) "Description" field is now optional. If left blank, a default
//    value is sent to the API to pass validation.
// 3. (FIX) Modal background is changed to `bg-gray-900/70` to fix the
//    "black screen" bug.
// -----------------------------------------------------------------------------

import React, { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import { X as XIcon, Loader2 } from "lucide-react";
import dayjs from "dayjs";

// (FIX) All currencies
const ALL_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KSH", "BIRR"];

// --- Main Modal Component ---
export const QuickActionModal = ({
  modalType,
  onClose,
  onSuccess,
}: {
  modalType: string;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const title = modalType === "Add Income" ? "Add New Income" : "Add New Expense";

  return (
    <ModalBase title={title} onClose={onClose}>
      {modalType === "Add Income" && (
        <AddIncomeForm onClose={onClose} onSuccess={onSuccess} />
      )}
      {modalType === "Add Expense" && (
        <AddExpenseForm onClose={onClose} onSuccess={onSuccess} />
      )}
    </ModalBase>
  );
};

// --- Add Income Form ---
const AddIncomeForm = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other Income");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      setError("You must be logged in.");
      return;
    }
    // (FIX) Description is no longer required client-side
    if (!amount) {
      setError("Amount is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const payload = {
        type: "new_income", // This type MUST match your Debts API
        amount: parseFloat(amount),
        currency,
        // (FIX) Send a default description if empty
        description: description || `Quick Add Income on ${date}`,
        category,
        date,
      };

      const res = await fetch("/api/debts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save income.");
      }

      onSuccess(); // Refresh dashboard
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <FormInput
          label="Amount"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          required
          className="flex-1"
        />
        <FormSelect
          label="Currency"
          value={currency}
          onChange={setCurrency}
          className="flex-1"
        >
          {/* (FIX) All currencies */}
          {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect>
      </div>
      <FormInput
        label="Description (Optional)"
        value={description}
        onChange={setDescription}
        placeholder="e.g., Office rent received"
      />
      <div className="flex gap-3">
        <FormInput
          label="Category"
          value={category}
          onChange={setCategory}
          placeholder="e.g., Other Income"
          className="flex-1"
        />
        <FormInput
          label="Date"
          type="date"
          value={date}
          onChange={setDate}
          className="flex-1"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-28 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Save Income"
          )}
        </button>
      </div>
    </form>
  );
};

// --- Add Expense Form ---
const AddExpenseForm = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Office Supplies");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      setError("You must be logged in.");
      return;
    }
    // (FIX) Description is no longer required client-side
    if (!amount) {
      setError("Amount is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const payload = {
        type: "new_expense", // This type MUST match your Debts API
        amount: parseFloat(amount),
        currency,
        // (FIX) Send a default description if empty
        description: description || `Quick Add Expense on ${date}`,
        category,
        date,
      };

      const res = await fetch("/api/debts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save expense.");
      }

      onSuccess(); // Refresh dashboard
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <FormInput
          label="Amount"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          required
          className="flex-1"
        />
        <FormSelect
          label="Currency"
          value={currency}
          onChange={setCurrency}
          className="flex-1"
        >
          {/* (FIX) All currencies */}
          {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </FormSelect>
      </div>
      <FormInput
        label="Description (Optional)"
        value={description}
        onChange={setDescription}
        placeholder="e.g., Printer paper and ink"
      />
      <div className="flex gap-3">
        <FormInput
          label="Category"
          value={category}
          onChange={setCategory}
          placeholder="e.g., Office Supplies"
          className="flex-1"
        />
        <FormInput
          label="Date"
          type="date"
          value={date}
          onChange={setDate}
          className="flex-1"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-28 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Save Expense"
          )}
        </button>
      </div>
    </form>
  );
};

// --- Reusable UI Components (Copied from your other modules for consistency) ---

const ModalBase = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  // (FIX) Changed background to fix "black screen" bug
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormInput = ({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  [key: string]: any;
}) => (
  <div className={props.className}>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
      {...props}
    />
  </div>
);

const FormSelect = ({
  label,
  value,
  onChange,
  children,
  ...props
}: {
  label:string;
  value: string;
  onChange: (val: string) => void;
  children: React.ReactNode;
  [key: string]: any;
}) => (
  <div className={props.className}>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
      {...props}
    >
      {children}
    </select>
  </div>
);
