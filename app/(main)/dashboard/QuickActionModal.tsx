"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import { 
  X, Loader2, Plus, DollarSign, Calendar, 
  Tag, Check, TrendingUp, TrendingDown, ChevronDown, CreditCard
} from "lucide-react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";

// --- Constants (Unchanged) ---
const ALL_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KSH", "BIRR"];
const DEFAULT_INCOME_CATEGORIES = ["Sales", "Services", "Rent", "Other Income"];
const DEFAULT_EXPENSE_CATEGORIES = ["Office Supplies", "Rent", "Salaries", "Utilities", "Travel", "Other"];

const paymentMethodsByCurrency: Record<string, string[]> = {
  USD: ["CASH", "BANK", "ZAAD", "EDAHAB", "SOMNET", "EVC_PLUS", "SAHAL", "OTHER"],
  SOS: ["CASH", "BANK", "OTHER"],
  SLSH: ["CASH", "BANK", "EDAHAB", "ZAAD", "OTHER"],
  BIRR: ["CASH", "BANK", "E_BIRR", "OTHER"],
  KSH: ["BANK", "CASH", "M_PESA", "OTHER"],
  EUR: ["CASH", "BANK", "OTHER"],
};

// --- 1. LARGER CENTERED MODAL BASE ---
const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => {
  return (
    // items-center ensures vertical centering
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      
      {/* 1. max-w-3xl: Increased width (was 2xl)
         2. scale-100: Ensures it renders at full size
      */}
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800">
        
        {/* Larger Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h3>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-all shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Larger Content Area */}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- 2. Larger Components ---
const CategoryInput = ({ value, onChange, categories, onAddNewCategory }: any) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  const handleAdd = () => {
    if (newCat.trim()) {
      onAddNewCategory(newCat.trim());
      onChange(newCat.trim()); 
      setIsAdding(false);
      setNewCat("");
    }
  };

  if (isAdding) {
    return (
      <div className="flex gap-2 animate-in fade-in h-[50px]">
        <input 
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New Category..."
          className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-4 text-base focus:outline-none dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <button type="button" onClick={handleAdd} className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700"><Check className="h-5 w-5"/></button>
        <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 px-2"><X className="h-5 w-5"/></button>
      </div>
    )
  }

  return (
    <div className="relative h-[50px]">
      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
        <Tag className="h-5 w-5" />
      </div>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "ADD_NEW") setIsAdding(true);
          else onChange(e.target.value);
        }}
        className="block w-full h-full appearance-none rounded-xl border border-gray-200 bg-white pl-11 pr-10 text-base text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white cursor-pointer"
      >
        {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        <option value="ADD_NEW" className="text-blue-600 font-bold">+ Add New Category</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
        <ChevronDown className="h-5 w-5" />
      </div>
    </div>
  );
};

// --- 3. LARGER Add Income Form ---
const AddIncomeForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [incomeCategories, setIncomeCategories] = useState(DEFAULT_INCOME_CATEGORIES);
  const [category, setCategory] = useState(incomeCategories[0]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  useEffect(() => {
    const methods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];
    setPaymentMethod(methods[0]);
  }, [currency]);

  const handleAddNewCategory = (newCat: string) => {
    if (!incomeCategories.includes(newCat)) setIncomeCategories(prev => [...prev, newCat]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setError("Please log in.");
    if (!amount || !category) return setError("Amount and Category required.");

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "new_income", amount: parseFloat(amount), currency,
          description: description || `Income on ${date}`,
          category, paymentMethod, date,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Failed to save.");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableMethods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];

  return (
    <form onSubmit={handleSubmit} className="space-y-8"> {/* Increased vertical spacing */}
      
      {error && (
        <div className="p-3 text-base text-red-600 bg-red-50 border border-red-100 rounded-xl dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      {/* ROW 1: Amount, Currency, Method (Combined) */}
      <div className="grid grid-cols-12 gap-4"> {/* Increased gap */}
        
        {/* Amount */}
        <div className="col-span-5">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Amount</label>
          <div className="relative h-[50px]"> {/* Fixed height for alignment */}
             <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
               <DollarSign className="h-5 w-5 text-green-600" />
             </div>
             <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="block w-full h-full rounded-xl border border-gray-200 bg-white pl-10 pr-2 text-lg font-bold text-green-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-green-400"
              autoFocus
            />
          </div>
        </div>

        {/* Currency */}
        <div className="col-span-3">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="block w-full h-[50px] rounded-xl border border-gray-200 bg-gray-50 px-3 text-base font-bold text-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white cursor-pointer"
          >
            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Method */}
        <div className="col-span-4">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Method</label>
          <div className="relative h-[50px]">
             <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full h-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-8 text-base text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white cursor-pointer"
            >
              {availableMethods.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Category & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Category</label>
          <CategoryInput 
            value={category}
            onChange={setCategory}
            categories={incomeCategories}
            onAddNewCategory={handleAddNewCategory}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Date</label>
          <div className="relative h-[50px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
              <Calendar className="h-5 w-5" />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full h-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-base text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ROW 3: Description */}
      <div>
        <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={3}
          className="block w-full rounded-xl border border-gray-200 bg-white p-4 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none"
        />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button type="button" onClick={onClose} className="px-6 py-3 text-base font-bold text-gray-600 hover:bg-gray-100 rounded-xl dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-green-600 px-8 py-3 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-500/30 transition-all hover:scale-[1.02]"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><TrendingUp className="h-5 w-5" /> Save Income</>}
        </button>
      </div>
    </form>
  );
};

// --- 4. LARGER Add Expense Form ---
const AddExpenseForm = ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [expenseCategories, setExpenseCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [category, setCategory] = useState(expenseCategories[0]);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  useEffect(() => {
    const methods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];
    setPaymentMethod(methods[0]);
  }, [currency]);

  const handleAddNewCategory = (newCat: string) => {
    if (!expenseCategories.includes(newCat)) setExpenseCategories(prev => [...prev, newCat]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setError("Please log in.");
    if (!amount || !category) return setError("Amount and Category required.");

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "new_expense", amount: parseFloat(amount), currency,
          description: description || `Expense on ${date}`,
          category, paymentMethod, date,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Failed to save.");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableMethods = paymentMethodsByCurrency[currency] || ["CASH", "OTHER"];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-3 text-base text-red-600 bg-red-50 border border-red-100 rounded-xl dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {error}
        </div>
      )}

      {/* ROW 1: Amount, Currency, Method (Combined) */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Amount */}
        <div className="col-span-5">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Amount</label>
          <div className="relative h-[50px]">
             <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
               <DollarSign className="h-5 w-5 text-red-600" />
             </div>
             <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="block w-full h-full rounded-xl border border-gray-200 bg-white pl-10 pr-2 text-lg font-bold text-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-red-400"
              autoFocus
            />
          </div>
        </div>

        {/* Currency */}
        <div className="col-span-3">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="block w-full h-[50px] rounded-xl border border-gray-200 bg-gray-50 px-3 text-base font-bold text-gray-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white cursor-pointer"
          >
            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Method */}
        <div className="col-span-4">
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Method</label>
          <div className="relative h-[50px]">
             <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full h-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-8 text-base text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white cursor-pointer"
            >
              {availableMethods.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Category & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Expense Type</label>
          <CategoryInput 
            value={category}
            onChange={setCategory}
            categories={expenseCategories}
            onAddNewCategory={handleAddNewCategory}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Date</label>
          <div className="relative h-[50px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
              <Calendar className="h-5 w-5" />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full h-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-base text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ROW 3: Description */}
      <div>
        <label className="text-xs font-bold uppercase text-gray-500 mb-2 block tracking-wider">Notes</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes..."
          rows={3}
          className="block w-full rounded-xl border border-gray-200 bg-white p-4 text-base focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-white resize-none"
        />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-4 pt-4">
        <button type="button" onClick={onClose} className="px-6 py-3 text-base font-bold text-gray-600 hover:bg-gray-100 rounded-xl dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3 text-base font-bold text-white hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02]"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><TrendingDown className="h-5 w-5" /> Record Expense</>}
        </button>
      </div>
    </form>
  );
};

// --- Main Wrapper ---
export const QuickActionModal = ({
  modalType,
  onClose,
  onSuccess,
}: {
  modalType: string;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const isIncome = modalType === "Add Income";
  const title = isIncome ? "Register New Income" : "Record New Expense";

  return (
    <ModalBase title={title} onClose={onClose}>
      {isIncome ? (
        <AddIncomeForm onClose={onClose} onSuccess={onSuccess} />
      ) : (
        <AddExpenseForm onClose={onClose} onSuccess={onSuccess} />
      )}
    </ModalBase>
  );
};