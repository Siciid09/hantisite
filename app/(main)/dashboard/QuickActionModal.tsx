"use client";
// -----------------------------------------------------------------------------
// File: app/(main)/dashboard/QuickActionModal.tsx
//
// --- LATEST UPDATES (v3.0 - API Fix) ---
// 1. (CRITICAL FIX) AddIncomeForm now POSTs to `/api/incomes` instead of `/api/debts`.
// 2. (CRITICAL FIX) AddExpenseForm now POSTs to `/api/expenses` instead of `/api/debts`.
// 3. (CLEANUP) Removed the `type: "new_income"` field from the payload
//    as it's no longer needed.
// 4. (MODERN UI) All previous UI updates and category features are kept.
// -----------------------------------------------------------------------------

import React, { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import { X as XIcon, Loader2, Plus } from "lucide-react";
import dayjs from "dayjs";

// All currencies
const ALL_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KSH", "BIRR"];

// Default categories
const DEFAULT_INCOME_CATEGORIES = ["Sales", "Services", "Rent", "Other Income"];
const DEFAULT_EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Rent",
  "Salaries",
  "Utilities",
  "Travel",
  "Other",
];

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
  const [incomeCategories, setIncomeCategories] = useState(
    DEFAULT_INCOME_CATEGORIES
  );
  const [category, setCategory] = useState(incomeCategories[0]); // Default to first
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNewCategory = (newCategory: string) => {
    if (newCategory.trim() && !incomeCategories.includes(newCategory.trim())) {
      setIncomeCategories((prev) => [...prev, newCategory.trim()]);
      setCategory(newCategory.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      setError("You must be logged in.");
      return;
    }
    if (!amount || !category) {
      setError("Amount and Category are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const payload = {
        // type: "new_income", // <-- No longer needed
        amount: parseFloat(amount),
        currency,
        description: description || `Quick Add Income on ${date}`,
        category,
        date,
      };

      // --- (FIX) Send to the correct API route ---
      const res = await fetch("/api/incomes", {
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
      } else {
         onSuccess();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      {error && (
         <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
         </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Amount"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          required
          className="col-span-1"
        />
        <FormSelect
          label="Currency"
          value={currency}
          onChange={setCurrency}
          className="col-span-1"
        >
          {ALL_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </FormSelect>
      </div>
      <FormInput
        label="Description (Optional)"
        value={description}
        onChange={setDescription}
        placeholder="e.g., Office rent received"
      />
      
      <CategoryInput
        label="Category"
        value={category}
        onChange={setCategory}
        categories={incomeCategories}
        onAddNewCategory={handleAddNewCategory}
      />
      
      <FormInput
        label="Date"
        type="date"
        value={date}
        onChange={setDate}
      />
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-32 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
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
  const [expenseCategories, setExpenseCategories] = useState(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [category, setCategory] = useState(expenseCategories[0]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNewCategory = (newCategory: string) => {
    if (newCategory.trim() && !expenseCategories.includes(newCategory.trim())) {
      setExpenseCategories((prev) => [...prev, newCategory.trim()]);
      setCategory(newCategory.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      setError("You must be logged in.");
      return;
    }
    if (!amount || !category) {
      setError("Amount and Category are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const payload = {
        // type: "new_expense", // <-- No longer needed
        amount: parseFloat(amount),
        currency,
        description: description || `Quick Add Expense on ${date}`,
        category,
        date,
      };

      // --- (FIX) Send to the correct API route ---
      const res = await fetch("/api/expenses", {
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
      } else {
        onSuccess();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      {error && (
         <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
         </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Amount"
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          required
          className="col-span-1"
        />
        <FormSelect
          label="Currency"
          value={currency}
          onChange={setCurrency}
          className="col-span-1"
        >
          {ALL_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </FormSelect>
      </div>

      <FormInput
        label="Description (Optional)"
        value={description}
        onChange={setDescription}
        placeholder="e.g., Printer paper and ink"
      />
      
      <CategoryInput
        label="Category"
        value={category}
        onChange={setCategory}
        categories={expenseCategories}
        onAddNewCategory={handleAddNewCategory}
      />

      <FormInput
        label="Date"
        type="date"
        value={date}
        onChange={setDate}
      />
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-32 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
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

// --- (Re-usable components below are unchanged) ---

// --- Reusable Category Input Component ---
const CategoryInput = ({
  label,
  value,
  onChange,
  categories,
  onAddNewCategory,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  categories: string[];
  onAddNewCategory: (newCategory: string) => void;
}) => {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddNew = () => {
    if (newCategoryName.trim()) {
      onAddNewCategory(newCategoryName.trim());
      onChange(newCategoryName.trim());
      setNewCategoryName("");
      setShowNewInput(false);
    }
  };

  const handleCancelNew = () => {
    setNewCategoryName("");
    setShowNewInput(false);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      
      <div className="flex items-center gap-2">
        <FormSelect
          label=""
          value={value}
          onChange={onChange}
          className="flex-1"
          hideLabel={true}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FormSelect>
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-600 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          title="Add new category"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {showNewInput && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700/50">
          <input
            type="text"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 rounded-md border-gray-300 p-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNew();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddNew}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancelNew}
            className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};


// --- Reusable UI Components ---
const ModalBase = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div 
      className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gamma-700"
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
  hideLabel = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  hideLabel?: boolean;
  [key: string]: any;
}) => (
  <div className={props.className}>
    {!hideLabel && (
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
    )}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
      {...props}
    />
  </div>
);

const FormSelect = ({
  label,
  value,
  onChange,
  children,
  hideLabel = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  children: React.ReactNode;
  hideLabel?: boolean;
  [key: string]: any;
}) => (
  <div className={props.className}>
     {!hideLabel && (
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
     )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500"
      {...props}
    >
      {children}
    </select>
  </div>
);