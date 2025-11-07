// File: app/(main)/sales/new/page.tsx
//
// --- FINAL VERSION (REBUILT) ---
// 1. (NEW) Added "Invoice Currency" dropdown. This is now the base currency for the sale.
// 2. (NEW) Replaced "Customer Search" modal with an inline Combobox, matching the Product Search.
// 3. (NEW) Implemented "Missing Price" modal: If a product has no price for the
//    selected Invoice Currency, a popup will ask the cashier to enter the price.
// 4. (NEW) Rebuilt Payment Section for "Manual Exchange": If a payment currency
//    does not match the Invoice Currency, a "Value in [CURRENCY]" box appears.
// 5. (NEW) 'handleSaveSale' is now secure. It sends raw data (items, payments with value)
//    to the API and trusts the server to do all calculations.
// 6. (NEW) Added modern "NewDateRangePicker" for the Sale Date.
// -----------------------------------------------------------------------------

"use client";

import React, { useState, useEffect, Suspense, useMemo, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import dayjs from "dayjs";
import {
  DollarSign, Receipt, TrendingUp, Plus, Search, ChevronLeft,
  ChevronRight, X, AlertTriangle, FileText, Save, Trash2,
  Package, RefreshCw, Download, Printer, Share2, MoreVertical,
  User, CreditCard, ChevronDown, CheckCircle, Clock, XCircle, Info,
  PackagePlus, UserPlus, Send, Check, ChevronsUpDown,
  Loader2, Edit, ChevronUp, CheckSquare, Coins, Calendar as CalendarIconLucide
} from "lucide-react";
import { Dialog, Transition, Combobox } from "@headlessui/react";
import { generateInvoicePdf } from "@/lib/pdfService";
import { type DateRange } from "react-day-picker";

// --- HELPERS (Copied from your products/page.tsx and utils.ts) ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/Button";
import { 
  add, addDays, format, startOfWeek, startOfMonth, endOfDay,
  eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, isSameMonth,
  isToday, parse, sub,
  isAfter, isBefore
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =============================================================================
// 💰 API Fetcher & Utilities
// =============================================================================
const fetcher = async (url: string) => {
  const { auth } = await import("@/lib/firebaseConfig");
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("User is not authenticated.");
  const token = await firebaseUser.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  const style = (currency === "USD" || currency === "EURO") ? "currency" : "decimal";
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
    maximumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
  };
  if (style === "currency") {
    options.currency = currency;
    options.currencyDisplay = "symbol";
  }
  const formatter = new Intl.NumberFormat("en-US", options);
  let formatted = formatter.format(amount);
  if (style === "decimal") {
    formatted = `${currency} ${formatted}`;
  }
  return formatted;
};

// =============================================================================
// 🛠️ Debounce Hook
// =============================================================================
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// =============================================================================
// 💰 Currency & Payment Constants
// =============================================================================
const CURRENCIES = ["USD", "SLSH", "SOS", "BIRR", "KES", "EUR"]; // Added BIRR, KES

const PAYMENT_PROVIDERS = {
  CASH: { label: "Cash" },
  BANK: { label: "Bank Transfer" },
  ZAAD: { label: "ZAAD" },
  EDAHAB: { label: "E-Dahab" },
  EVC_PLUS: { label: "EVC Plus" },
  SAHAL: { label: "Sahal (Golis)" },
  E_BIRR: { label: "E-Birr" },
  M_PESA: { label: "M-Pesa" },
  SI_KALE: { label: "Other" },
};

// =============================================================================
// 📝 Main "Add Sale" Page Component
// =============================================================================
export default function AddNewSalePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PosForm />
    </Suspense>
  );
}

// =============================================================================
// 🛒 POS Form Type Definitions
// =============================================================================
interface LineItem {
  id: string; 
  productId: string; 
  productName: string;
  quantity: string;
  pricePerUnit: string; // This is in 'invoiceCurrency'
  costPriceUsd: number; // For server profit calculation
  stock: number;
  discount: string;
  manualPrice: boolean; // Flag to show if price was entered manually
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  notes: string;
  saveToContacts?: boolean;
}

// NEW: Payment line with manual exchange value
interface PaymentLine {
  id: string; 
  method: keyof typeof PAYMENT_PROVIDERS;
  amount: string; // The amount in the payment's currency (e.g., "50" for USD)
  currency: string; // The currency of the payment (e.g., "USD")
  valueInInvoiceCurrency: string; // The value of 'amount' in the 'invoiceCurrency' (e.g., "4700" for BIRR)
}

interface ProductForPricing {
  product: any;
  manualPrice: string;
}

// =============================================================================
// 🧑‍💼 CustomerSearch (REBUILT as inline Combobox)
// =============================================================================
const CustomerSearch = ({ customer, onCustomerSelect }: { customer: Customer | null, onCustomerSelect: (customer: Customer) => void }) => {
  const [query, setQuery] = useState(customer?.name || "Walk-in Customer");
  const debouncedQuery = useDebounce(query, 300);
  const [saveCustomer, setSaveCustomer] = useState(true);

  const { data, error, isLoading } = useSWR(
    (debouncedQuery && debouncedQuery !== customer?.name) ? `/api/sales?view=search_customers&searchQuery=${encodeURIComponent(debouncedQuery)}` : null, 
    fetcher
  );

  const customers: Customer[] = data?.customers || [];
  const showCreateOption = customers.length === 0 && debouncedQuery && !isLoading && debouncedQuery !== "Walk-in Customer";
  
  const handleSelect = (customer: Customer | string | null) => {
    if (customer === null) return; 
    
    let newCustomer: Customer;
    if (typeof customer === "string") {
      newCustomer = {
        id: `new_${crypto.randomUUID()}`,
        name: customer,
        phone: "",
        whatsapp: "",
        notes: "New customer added from POS",
        saveToContacts: saveCustomer,
      };
    } else {
      newCustomer = customer;
    }
    
    onCustomerSelect(newCustomer);
    setQuery(newCustomer.name); // Set the input field to the name
  };

  return (
    <Combobox value={customer} onChange={handleSelect}>
      <div className="relative flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">2. Search or Create Customer</label>
        <Combobox.Input
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-3 pr-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or phone..."
          value={query}
          onFocus={() => { if (query === "Walk-in Customer") setQuery("") }}
          onBlur={() => { 
            if (!query) {
              setQuery("Walk-in Customer");
              onCustomerSelect({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" });
            }
          }}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 top-6 flex items-center pr-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />}
        </Combobox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 sm:text-sm">
            {error && <div className="relative cursor-default select-none py-2 px-4 text-red-500">Error: {error.message}</div>}
            
            {showCreateOption ? (
              <>
                <Combobox.Option value={query} className={({ active }) => `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`}>
                  Create new customer: "{query}"
                </Combobox.Option>
                <div 
                  onClick={(e) => { e.stopPropagation(); setSaveCustomer(!saveCustomer); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  {saveCustomer ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <div className="h-4 w-4 rounded border border-gray-400" />}
                  Save to contacts
                </div>
              </>
            ) : (
              customers.map((customer) => (
                <Combobox.Option key={customer.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`} value={customer}>
                  {({ selected, active }) => (
                    <>
                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>{customer.name}</span>
                      <span className={`block truncate text-sm ${active ? 'text-blue-100' : 'text-gray-500'}`}>{customer.phone}</span>
                      {selected && <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'}`}><Check className="h-5 w-5" aria-hidden="true" /></span>}
                    </>
                  )}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Transition>
      </div>
    </Combobox>
  );
};

// =============================================================================
// 📦 ProductSearch Component
// =============================================================================
const ProductSearch = ({ onProductSelect, invoiceCurrency }: { onProductSelect: (product: any) => void, invoiceCurrency: string }) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300); 

  const { data, error, isLoading } = useSWR(
    debouncedQuery ? `/api/sales?view=search_products&searchQuery=${encodeURIComponent(debouncedQuery)}` : null, 
    fetcher
  );

  const products = data?.products || [];
  
  const handleSelect = (product: any | null) => {
    if (product === null) return;
    onProductSelect(product);
    setQuery("");
  };
  
  return (
    <Combobox onChange={handleSelect} value={null}>
      <div className="relative flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">3. Search Product</label>
        <Combobox.Input
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-3 pr-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or barcode..."
          value={query}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 top-6 flex items-center pr-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />}
        </Combobox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 sm:text-sm">
            {error && <div className="relative cursor-default select-none py-2 px-4 text-red-500">Error: {error.message}</div>}
            {products.length === 0 && debouncedQuery && !isLoading && (
              <div className="relative cursor-default select-none py-2 px-4 text-gray-500">No products found.</div>
            )}
            {products.map((product: any) => (
              <Combobox.Option key={product.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`} value={product}>
                <div className="flex justify-between">
                  <span className="block truncate font-medium">{product.name}</span>
                  {/* Show price in selected currency if available */}
                  <span className="text-sm">
                    {product.salePrices?.[invoiceCurrency] 
                      ? formatCurrency(product.salePrices[invoiceCurrency], invoiceCurrency)
                      : (product.salePrices?.USD ? `(No ${invoiceCurrency} Price)` : "No Price")
                    }
                  </span>
                </div>
                <span className="block truncate text-sm text-gray-500">{product.quantity} in stock</span>
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Transition>
      </div>
    </Combobox>
  );
};


// =============================================================================
// 🛒 The Main POS Form (REBUILT)
// =============================================================================
function PosForm() {
  const { user } = useAuth();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- Form State ---
  const [invoiceCurrency, setInvoiceCurrency] = useState("USD"); // ** NEW **
  const [items, setItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" });
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [saleDate, setSaleDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  
  // Modals
  const [productForPricing, setProductForPricing] = useState<ProductForPricing | null>(null);
  
  // Additional Info
  const [salesperson, setSalesperson] = useState(user?.name || "Current User");
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  // --- Derived State (Summary Card) ---
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.pricePerUnit) || 0;
      const disc = Number(item.discount) || 0;
      return sum + qty * price * (1 - disc / 100);
    }, 0);
  }, [items]);
  
  // ** NEW: totalPaid is now the sum of 'valueInInvoiceCurrency' **
  const totalPaid = useMemo(() => {
    return paymentLines.reduce((sum, line) => {
      return sum + (Number(line.valueInInvoiceCurrency) || 0);
    }, 0);
  }, [paymentLines]);

  // ** NEW: debtRemaining is now simple **
  const debtRemaining = useMemo(() => {
    return totalAmount - totalPaid;
  }, [totalAmount, totalPaid]);

  
  // --- Handlers ---
  
  const resetForm = () => {
    setItems([]);
    setCustomer({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" });
    setInvoiceCurrency("USD");
    setPaymentLines([]);
    setSalesperson(user?.name || "Current User");
    setAdditionalNotes("");
    setError(null);
    setIsSaving(false);
  };

  // ** NEW: Handle product select (with missing price logic) **
  const handleProductSelect = (product: any) => {
    if (!product || !product.id) return;

    const price = product.salePrices?.[invoiceCurrency];

    if (price === undefined || price === null || price === 0) {
      // Price is missing! Open the modal.
      setProductForPricing({ product, manualPrice: "" });
    } else {
      // Price exists, add to cart.
      addItemToCart(product, price.toString(), false);
    }
  };

  // ** NEW: Handle missing price submission **
  const handleManualPriceSubmit = () => {
    if (!productForPricing) return;
    const price = productForPricing.manualPrice;
    if (Number(price) > 0) {
      addItemToCart(productForPricing.product, price, true);
      setProductForPricing(null); // Close modal
    }
  };

  // ** NEW: Central function to add an item **
  const addItemToCart = (product: any, price: string, manualPrice: boolean) => {
    setItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        quantity: "1",
        pricePerUnit: price, 
        costPriceUsd: product.costPrices?.USD || 0, // Send cost price for profit
        stock: product.quantity,
        discount: "0",
        manualPrice: manualPrice,
      },
    ]);
  };
  
  const handleUpdateItem = (id: string, field: 'quantity' | 'pricePerUnit' | 'discount', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };
  
  // --- **NEW PAYMENT HANDLERS** ---
  
  const handleAddPaymentLine = () => {
    const newPaymentLine: PaymentLine = {
      id: crypto.randomUUID(),
      method: 'CASH',
      amount: "",
      currency: invoiceCurrency, // Default to invoice currency
      valueInInvoiceCurrency: "", // Will be set on change
    };
    setPaymentLines(prev => [...prev, newPaymentLine]);
  };
  
  const handleUpdatePaymentLine = (id: string, field: keyof PaymentLine, value: string) => {
    setPaymentLines(prev => prev.map(line => {
      if (line.id !== id) return line;

      const updatedLine = { ...line, [field]: value };

      // ** NEW: Manual Exchange Logic **
      // If the currency is the SAME as the invoice, value = amount
      if (updatedLine.currency === invoiceCurrency) {
        if (field === 'amount' || field === 'currency') {
          updatedLine.valueInInvoiceCurrency = updatedLine.amount;
        }
      } else {
        // If currency is DIFFERENT, and we change amount, clear the value
        if (field === 'amount') {
          updatedLine.valueInInvoiceCurrency = ""; // Force re-entry of value
        }
        // If we change currency back to invoice currency, auto-fill
        if (field === 'currency' && updatedLine.currency === invoiceCurrency) {
           updatedLine.valueInInvoiceCurrency = updatedLine.amount;
        }
      }
      
      // If we are updating the value field, just update it
      if (field === 'valueInInvoiceCurrency') {
         updatedLine.valueInInvoiceCurrency = value;
      }
      
      return updatedLine;
    }));
  };
  
  const handleRemovePaymentLine = (id: string) => {
    setPaymentLines(prev => prev.filter(line => line.id !== id));
  };
  
  
  // ** NEW SECURE SAVE LOGIC **
  const handleSaveSale = async (action: 'save' | 'save_print') => {
    if (items.length === 0) { setError("Please add at least one item."); return; }
    if (!customer) { setError("Please select or create a customer."); return; }
    
    setIsSaving(true);
    setError(null);

    // 1. Create the 'raw items' payload for the server
    const itemsPayload = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity) || 0,
      discount: Number(item.discount) || 0,
      // If price was manual, send it. Otherwise, let server fetch it.
      pricePerUnit: item.manualPrice ? (Number(item.pricePerUnit) || 0) : null,
    }));
    
    // 2. Create the 'raw payments' payload
    const paymentsPayload = paymentLines
      .filter(line => (Number(line.amount) || 0) > 0)
      .map(line => ({
        method: line.method,
        amount: Number(line.amount) || 0,
        currency: line.currency,
        valueInInvoiceCurrency: Number(line.valueInInvoiceCurrency) || 0,
      }));

    // 3. Create the final transaction object
    const transaction = {
      // Customer
      customer, // Send full customer object (server will handle new/existing)
      
      // Sale Info
      invoiceCurrency: invoiceCurrency,
      items: itemsPayload,
      paymentLines: paymentsPayload,
      saleDate: saleDate?.from ? format(saleDate.from, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      
      // Additional Info
      salesperson: salesperson,
      notes: additionalNotes,
    };
    
    try {
      if (!user || !user.firebaseUser) {
        throw new Error("Authentication error. User context is not available. Please re-login.");
      }
      const token = await user.firebaseUser.getIdToken();

      // ** NEW: Send raw data to the secure server API **
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(transaction),
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save sale."); }
      const data = await res.json(); // Server returns the final, calculated sale
      
      if (action === 'save_print') {
        // We can use the server's response (data.sale) to print
        generateInvoicePdf(data.sale, { name: "HantiKaab Inc." });
        resetForm(); 
      } else {
        resetForm();
        router.push('/sales?view=history');
      }
      
    } catch (err: any) {
      console.error("[HandleSaveSale Error]", err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---
  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); handleSaveSale('save'); }}>
        <div className="mb-24 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* --- Left Panel (Customer & Products) --- */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* A. INVOICE CURRENCY & CUSTOMER */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSelect 
                  label="1. Set Invoice Currency"
                  value={invoiceCurrency}
                  onChange={(val: string) => setInvoiceCurrency(val)}
                  disabled={items.length > 0} // Lock if items are added
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </FormSelect>
                
                {/* NEW: Inline Customer Search */}
                <CustomerSearch customer={customer} onCustomerSelect={setCustomer} />
              </div>
              {items.length > 0 && <p className="text-xs text-orange-600 mt-2">Invoice currency is locked because items are in the cart.</p>}
            </Card>
            
            {/* B. PRODUCTS SECTION */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold dark:text-white">3. Products (Prices in {invoiceCurrency})</h3>
              <div className="flex items-start gap-2">
                <ProductSearch onProductSelect={handleProductSelect} invoiceCurrency={invoiceCurrency} />
              </div>
              
              {/* Product Table */}
              <div className="mt-4 flow-root">
                <div className="-mx-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="py-3 pl-4 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Product</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Qty</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Price</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Discount (%)</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Subtotal</th>
                        <th className="py-3 pr-4 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {items.length === 0 && (
                          <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Add products using the search bar above.</td></tr>
                      )}
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pl-4 text-sm font-medium dark:text-white">
                            {item.productName}
                            {item.manualPrice && <span title="Price entered manually" className="ml-1 text-orange-400">*</span>}
                          </td>
                          <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.id, 'quantity', e.target.value)} className="w-16 rounded-md border-gray-300 p-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.pricePerUnit} onChange={e => handleUpdateItem(item.id, 'pricePerUnit', e.target.value)} className="w-24 rounded-md border-gray-300 p-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></td>
                          <td className="px-2 py-2"><input type="number" value={item.discount} onChange={e => handleUpdateItem(item.id, 'discount', e.target.value)} className="w-16 rounded-md border-gray-300 p-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></td>
                          <td className="px-2 py-2 text-sm dark:text-white">{formatCurrency((Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0) * (1 - (Number(item.discount) || 0) / 100), invoiceCurrency)}</td>
                          <td className="py-2 pr-4 text-right">
                            <button type="button" onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* D. ADDITIONAL INFO SECTION (with Date Picker) */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold dark:text-white">5. Additional Info</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput 
                  label="Salesperson" 
                  type="text" 
                  value={salesperson} 
                  readOnly 
                  className="[&_input]:bg-gray-100 dark:[&_input]:bg-gray-700/50" 
                />
                
                {/* NEW: Modern Date Picker */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Date</label>
                  <NewDateRangePicker
                    date={saleDate}
                    onApply={(newDate) => setSaleDate(newDate)}
                    singleDateMode={true} // Use a custom prop to hide 'to' date
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <FormInput label="Additional Notes" value={additionalNotes} onChange={setAdditionalNotes} placeholder="e.g., Warranty details, special instructions" />
                </div>
              </div>
            </Card>
          </div>

          {/* --- Right Panel (Payment & Summary) --- */}
          <div className="space-y-6 lg:col-span-1 lg:sticky top-24 h-fit">
            
            {/* C. PAYMENT SECTION (REBUILT FOR MANUAL EXCHANGE) */}
            <Card>
              <h3 className="mb-4 text-lg font-semibold dark:text-white">4. Payment Details</h3>
              
              <div className="space-y-4">
                {paymentLines.map((line, index) => (
                  <div key={line.id} className="space-y-3 rounded-lg border border-gray-300 p-3 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium dark:text-white">Payment #{index + 1}</h4>
                      <button type="button" onClick={() => handleRemovePaymentLine(line.id)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                    </div>

                    <FormSelect 
                      label="Method"
                      value={line.method}
                      onChange={(val: string) => handleUpdatePaymentLine(line.id, 'method', val)}
                    >
                      {Object.entries(PAYMENT_PROVIDERS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </FormSelect>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <FormInput
                        label="Amount"
                        type="number"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(val: string) => handleUpdatePaymentLine(line.id, 'amount', val)}
                      />
                      <FormSelect 
                        label="Currency"
                        value={line.currency}
                        onChange={(val: string) => handleUpdatePaymentLine(line.id, 'currency', val)}
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </FormSelect>
                    </div>
                    
                    {/* ** NEW: MANUAL EXCHANGE INPUT ** */}
                    {line.currency !== invoiceCurrency && (
                      <div className="border-t border-dashed border-blue-400 pt-3">
                        <FormInput
                          label={`Value in ${invoiceCurrency}`}
                          type="number"
                          placeholder="0.00"
                          value={line.valueInInvoiceCurrency}
                          onChange={(val: string) => handleUpdatePaymentLine(line.id, 'valueInInvoiceCurrency', val)}
                          className="[&_input]:border-blue-500 [&_input]:ring-1 [&_input]:ring-blue-200"
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                {/* --- Add New Payment Button --- */}
                <button 
                  type="button" 
                  onClick={handleAddPaymentLine} 
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Payment
                </button>
              </div>
            </Card>
            
            {/* D. SUMMARY CARD (REBUILT) */}
            <Card>
              <h3 className="mb-3 text-lg font-semibold dark:text-white">Summary</h3>
              <div className="space-y-2 pt-2">
                <TotalRow label="Total Amount" value={formatCurrency(totalAmount, invoiceCurrency)} isBold={true} />
                
                <TotalRow label="Total Paid" value={formatCurrency(totalPaid, invoiceCurrency)} />
                
                {/* Show breakdown of actual currencies received */}
                <div className="pl-4">
                  {paymentLines.filter(l => Number(l.amount) > 0).map(l => (
                    <p key={l.id} className="text-sm text-gray-500 dark:text-gray-400">
                      - {formatCurrency(Number(l.amount), l.currency)}
                    </p>
                  ))}
                </div>
                
                <hr className="my-2 dark:border-gray-600" />

                <TotalRow 
                  label={`Debt Remaining`}
                  value={formatCurrency(debtRemaining, invoiceCurrency)}
                  isDebt={debtRemaining > 0}
                  isBold={true} 
                  className="text-2xl"
                />
              </div>
            </Card>
          </div>
        </div>

        {/* G. BOTTOM ACTION BAR */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-6 border-t border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              title="Save this sale"
              disabled={isSaving || items.length === 0 || !customer}
              className="flex-2 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isSaving ? "Saving..." : `Save Sale (${formatCurrency(totalAmount, invoiceCurrency)})`}
            </button>
            <button
              type="button"
              title="Save and open print dialog"
              onClick={() => handleSaveSale('save_print')}
              disabled={isSaving || items.length === 0 || !customer}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Save & Print
            </button>
            <button
              type="button"
              title="Clear the form"
              onClick={resetForm}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-500 dark:hover:bg-red-900/50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* NEW: Missing Price Modal */}
      <TransitionedModal isOpen={!!productForPricing} onClose={() => setProductForPricing(null)}>
        <Dialog.Title className="text-lg font-medium dark:text-white">
          Price Not Found
        </Dialog.Title>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The price for "{productForPricing?.product.name}" is not set in {invoiceCurrency}.
            Please enter the price for this sale.
          </p>
          <FormInput 
            label={`Price in ${invoiceCurrency}`}
            type="number"
            value={productForPricing?.manualPrice || ""}
            onChange={(val: string) => setProductForPricing(prev => prev ? ({ ...prev, manualPrice: val }) : null)}
            placeholder="0.00" 
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => setProductForPricing(null)}>Cancel</button>
          <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700" onClick={handleManualPriceSubmit}>Add to Cart</button>
        </div>
      </TransitionedModal>
    </>
  );
}

// =============================================================================
// 🌀 Helper Components (Forms, Modals, Loaders)
// =============================================================================
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>{children}</div>;

const FormInput = React.forwardRef(({ label, type = "text", className = "", onChange, ...props }: any, ref) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <input 
      type={type} 
      ref={ref} 
      {...props} 
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:disabled:bg-gray-700/50" 
    />
  </div>
));
FormInput.displayName = "FormInput";

const FormSelect = ({ label, value, onChange, children, className = "", ...props }: any) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <select value={value} onChange={(e) => onChange(e.target.value)} {...props} className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
      {children}
    </select>
  </div>
);

const TotalRow = ({ label, value, isDebt = false, isBold = false, className = "" }: { label: string, value: string, isDebt?: boolean, isBold?: boolean, className?: string }) => (
  <div className={`flex justify-between text-sm ${isBold ? 'font-semibold' : ''} ${isDebt ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'} ${className}`}>
    <span className="text-gray-600 dark:text-gray-300">{label}:</span>
    <span className={isBold ? 'text-lg' : ''}>{value}</span>
  </div>
);

const TransitionedModal = ({
  isOpen,
  onClose,
  children,
  size = 'md' 
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl'; 
}) => {
  const sizeClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800`}>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// --- NEW Modern Date Picker (from products/page.tsx) ---
function NewDateRangePicker({
  date,
  onApply,
  className,
  singleDateMode = false,
}: {
  date: DateRange | undefined;
  onApply: (date: DateRange | undefined) => void;
  className?: string;
  singleDateMode?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(date?.from || new Date());
  const [selectedDate, setSelectedDate] = useState<DateRange | undefined>(date);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setSelectedDate(date);
    setCurrentMonth(date?.from || new Date());
  }, [date]);

  const handleApply = () => {
    onApply(selectedDate);
    setIsOpen(false);
  };
  const handleCancel = () => {
    setSelectedDate(date); 
    setCurrentMonth(date?.from || new Date()); 
    setIsOpen(false);
  };
  const handleOpenChange = (open: boolean) => {
    if (!open) handleCancel(); 
    setIsOpen(open);
  };
  
  const handleDayClick = (day: Date) => {
    if (singleDateMode) {
      setSelectedDate({ from: day, to: day });
      onApply({ from: day, to: day }); // Apply immediately
      setIsOpen(false); // Close popup
    } else {
      const { from, to } = selectedDate || {};
      if (!from) {
        setSelectedDate({ from: day, to: undefined });
      } else if (from && !to) {
        if (isAfter(day, from)) {
          setSelectedDate({ from, to: day });
        } else {
          setSelectedDate({ from: day, to: from }); // Swap
        }
      } else if (from && to) {
        setSelectedDate({ from: day, to: undefined });
      }
    }
  };

  const displayedDate = date; 
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal shadow-sm bg-white dark:bg-gray-700",
              !displayedDate && "text-muted-foreground"
            )}
          >
            <CalendarIconLucide className="mr-2 h-4 w-4" />
            {displayedDate?.from ? (
              (displayedDate.to && !singleDateMode) ? (
                <>
                  {format(displayedDate.from, "LLL dd, y")} -{" "}
                  {format(displayedDate.to, "LLL dd, y")}
                </>
              ) : (
                format(displayedDate.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border dark:border-gray-700" align="start">
          <CalendarGrid
            month={currentMonth}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
            hoveredDate={hoveredDate}
            setHoveredDate={setHoveredDate}
            onMonthChange={setCurrentMonth}
            singleDateMode={singleDateMode}
          />
          {!singleDateMode && (
            <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-600">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CalendarGrid({
  month,
  selectedDate,
  onDayClick,
  hoveredDate,
  setHoveredDate,
  onMonthChange,
  singleDateMode,
}: {
  month: Date;
  selectedDate: DateRange | undefined;
  onDayClick: (date: Date) => void;
  hoveredDate: Date | undefined;
  setHoveredDate: (date: Date | undefined) => void;
  onMonthChange: (date: Date) => void;
  singleDateMode: boolean;
}) {
  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const startDate = startOfWeek(firstDay);
  const endDate = endOfWeek(lastDay);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  
  const nextMonth = () => onMonthChange(add(month, { months: 1 }));
  const prevMonth = () => onMonthChange(sub(month, { months: 1 }));

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-lg font-semibold dark:text-white">
          {format(month, "MMMM yyyy")}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
      <div 
        className="grid grid-cols-7 gap-1 mt-2"
        onMouseLeave={() => !singleDateMode && setHoveredDate(undefined)}
      >
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, month);
          const isSelectedStart = !!selectedDate?.from && isSameDay(day, selectedDate.from);
          const isSelectedEnd = !!selectedDate?.to && isSameDay(day, selectedDate.to);
          const isInRange = !!(selectedDate?.from && selectedDate?.to) && 
                            !singleDateMode &&
                            isAfter(day, selectedDate.from) && 
                            isBefore(day, selectedDate.to);
          const isHovering = !!(selectedDate?.from && !selectedDate.to && hoveredDate) && !singleDateMode;
          const isHoverStart = isHovering && hoveredDate && selectedDate.from && isBefore(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from;
           const isHoverEnd = isHovering && hoveredDate && selectedDate.from && isAfter(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from;
          const isInHoverRange = isHovering && isHoverStart && isHoverEnd && isAfter(day, isHoverStart) && isBefore(day, isHoverEnd);
          return (
            <button
              key={day.toString()}
              type="button"
              onClick={() => onDayClick(day)}
              onMouseEnter={() => !singleDateMode && setHoveredDate(day)}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-lg text-sm",
                !isCurrentMonth && "text-gray-400 dark:text-gray-600",
                isCurrentMonth && "text-gray-800 dark:text-gray-200",
                isToday(day) && "font-bold text-blue-600",
                (isSelectedStart || isSelectedEnd) && "bg-blue-600 text-white hover:bg-blue-700",
                isInRange && "bg-blue-100 dark:bg-blue-900/50 rounded-none",
                isSelectedStart && !singleDateMode && "rounded-l-lg",
                isSelectedEnd && !singleDateMode && "rounded-r-lg",
                isHovering && (isSameDay(day, isHoverStart!) || isSameDay(day, isHoverEnd!)) && "bg-blue-600/50 text-white",
                isInHoverRange && "bg-blue-100/50 dark:bg-blue-900/20",
                !isSelectedStart && !isSelectedEnd && !isInRange && isCurrentMonth && "hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}