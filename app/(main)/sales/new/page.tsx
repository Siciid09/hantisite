"use client";

import React, { useState, useEffect, Suspense, useMemo, Fragment } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime"; 
dayjs.extend(relativeTime); // For "2 mins ago"

import {
  DollarSign, Receipt, Plus, Search, ChevronLeft,
  ChevronRight, X, Save, Trash2,
  Download, Printer, ChevronDown, CheckCircle,
  ChevronsUpDown, Loader2, Calendar as CalendarIconLucide,
  MapPin, Phone, Check, FileClock, PlayCircle
} from "lucide-react";
import { Dialog, Transition, Combobox } from "@headlessui/react";
import { type DateRange } from "react-day-picker";

// --- PDF Imports ---
import { PDFDownloadLink } from '@react-pdf/renderer';
import { getTemplateComponent, ReportType } from '@/lib/pdfService'; 

// --- Import Product Modal ---
import { ProductFormModal } from '../../products/ProductFormModal'; 

// --- HELPERS ---
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Button } from "@/app/components/ui/Button";
import { 
  add, format, startOfWeek, startOfMonth, endOfMonth, endOfWeek, 
  isSameDay, isSameMonth, isToday, sub, isAfter, isBefore, eachDayOfInterval
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
  if (amount == null) amount = 0;
  const displayCurrency = currency === "EURO" ? "EUR" : currency;
  const style = (displayCurrency === "USD" || displayCurrency === "EUR") ? "currency" : "decimal";
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
    maximumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
  };
  if (style === "currency") {
    options.currency = displayCurrency;
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
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// =============================================================================
// 💰 Currency & Payment Constants
// =============================================================================
const CURRENCIES = ["USD", "SOS", "SLSH", "EUR", "KSH", "BIRR"];

const PAYMENT_PROVIDERS = {
  CASH: { label: "Cash" },
  BANK: { label: "Bank Transfer" },
  ZAAD: { label: "ZAAD" },
  EDAHAB: { label: "E-Dahab" },
  EVC_PLUS: { label: "EVC Plus" },
  SAHAL: { label: "Sahal (Golis)" },
  SOMNET: { label: "Somnet" },
  E_BIRR: { label: "E-Birr" },
  M_PESA: { label: "M-Pesa" },
  OTHER: { label: "Other" },
};

const paymentMethodsByCurrency: { [key: string]: (keyof typeof PAYMENT_PROVIDERS)[] } = {
  USD: ["CASH", "BANK", "ZAAD", "EDAHAB", "SOMNET", "EVC_PLUS", "SAHAL", "OTHER"],
  SOS: ["CASH", "BANK", "OTHER"],
  SLSH: ["CASH", "BANK", "EDAHAB", "ZAAD", "OTHER"],
  BIRR: ["CASH", "BANK", "E_BIRR", "OTHER"],
  KSH: ["BANK", "CASH", "M_PESA", "OTHER"],
  EUR: ["CASH", "BANK", "OTHER"],
};

// =============================================================================
// 📝 Types
// =============================================================================
interface LineItem {
  id: string; 
  productId: string; 
  productName: string;
  quantity: string;
  pricePerUnit: string;
  costPriceUsd: number;
  stock: number;
  discount: string;
  selectedVariants?: Record<string, string>;
  manualPrice: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  whatsapp: string;
  notes: string;
  saveToContacts?: boolean;
}

interface PaymentLine {
  id: string; 
  method: keyof typeof PAYMENT_PROVIDERS | "";
  amount: string;
  currency: string;
  valueInInvoiceCurrency: string;
}

interface ProductForPricing {
  product: any;
  manualPrice: string;
}

interface Draft {
  id: string; 
  customer: Customer; 
  items: LineItem[]; 
  paymentLines: PaymentLine[]; 
  invoiceCurrency: string;
  totalAmount: number; 
  savedBy: string; 
  updatedAt: string; 
  notes: string;
}

// =============================================================================
// 🧑‍💼 CustomerSearch
// =============================================================================
const CustomerSearch = ({ customer, onCustomerSelect }: { customer: Customer | null, onCustomerSelect: (customer: Customer) => void }) => {
  const [query, setQuery] = useState(customer?.name || "Walk-in Customer");
  const debouncedQuery = useDebounce(query, 300);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", address: "" });

  const { data, isLoading } = useSWR(
    (debouncedQuery && debouncedQuery !== customer?.name) ? `/api/sales?view=search_customers&searchQuery=${encodeURIComponent(debouncedQuery)}` : null, 
    fetcher
  );

  const customers: Customer[] = data?.customers || [];
  const showCreateOption = customers.length === 0 && debouncedQuery && !isLoading && debouncedQuery !== "Walk-in Customer";
  
  const handleSelect = (selected: Customer | string | null) => {
    if (selected === null) return; 
    if (typeof selected === "string") {
      setNewCustomerData({ name: selected, phone: "", address: "" });
      setIsCreateModalOpen(true);
    } else {
      onCustomerSelect(selected);
      setQuery(selected.name);
    }
  };

  const handleCreateConfirm = () => {
    const newCustomer: Customer = {
      id: `new_${crypto.randomUUID()}`,
      name: newCustomerData.name,
      phone: newCustomerData.phone,
      address: newCustomerData.address,
      whatsapp: "",
      notes: "New customer added from POS",
      saveToContacts: true,
    };
    onCustomerSelect(newCustomer);
    setQuery(newCustomer.name);
    setIsCreateModalOpen(false);
  };

  return (
    <>
    <Combobox value={customer} onChange={handleSelect}>
      <div className="relative flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">2. Search or Create Customer</label>
        <Combobox.Input
          className="w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-3 pr-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or phone..."
          value={query}
          onFocus={() => { if (query === "Walk-in Customer") setQuery("") }}
          onBlur={() => { if (!query && !isCreateModalOpen) { setQuery("Walk-in Customer"); onCustomerSelect({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" }); } }}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 top-6 flex items-center pr-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />}
        </Combobox.Button>
        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 sm:text-sm">
            {showCreateOption ? (
              <Combobox.Option value={query} className={({ active }) => `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`}>
                <span className="font-semibold text-green-500 mr-2">+</span> Create "{query}"
              </Combobox.Option>
            ) : (
              customers.map((cust) => (
                <Combobox.Option key={cust.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`} value={cust}>
                  <span className={`block truncate ${cust.name}`}>{cust.name}</span>
                  <span className={`block truncate text-sm text-gray-500`}>{cust.phone}</span>
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Transition>
      </div>
    </Combobox>

    <TransitionedModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} size="md">
        <Dialog.Title className="text-lg font-medium dark:text-white">Create New Customer</Dialog.Title>
        <div className="mt-4 space-y-4">
          <FormInput label="Customer Name" value={newCustomerData.name} onChange={(v: string) => setNewCustomerData({...newCustomerData, name: v})} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Phone Number" icon={<Phone className="h-4 w-4" />} value={newCustomerData.phone} onChange={(v: string) => setNewCustomerData({...newCustomerData, phone: v})} placeholder="e.g. 252..." />
            <FormInput label="Address (Optional)" icon={<MapPin className="h-4 w-4" />} value={newCustomerData.address} onChange={(v: string) => setNewCustomerData({...newCustomerData, address: v})} placeholder="City, District..." />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleCreateConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save & Select</button>
        </div>
    </TransitionedModal>
    </>
  );
};

// =============================================================================
// 📦 ProductSearch
// =============================================================================
const ProductSearch = ({ onProductSelect, invoiceCurrency }: { onProductSelect: (product: any) => void, invoiceCurrency: string }) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300); 
  const { data, isLoading } = useSWR(debouncedQuery ? `/api/sales?view=search_products&searchQuery=${encodeURIComponent(debouncedQuery)}` : null, fetcher);
  const products = data?.products || [];
  
  return (
    <Combobox onChange={(p) => { if(p) { onProductSelect(p); setQuery(""); } }} value={null}>
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
        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 sm:text-sm">
            {products.map((product: any) => (
              <Combobox.Option key={product.id} className={({ active }) => `relative cursor-pointer select-none py-2 pl-4 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-gray-200'}`} value={product}>
                <div className="flex justify-between">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="text-sm">{product.salePrices?.[invoiceCurrency] ? formatCurrency(product.salePrices[invoiceCurrency], invoiceCurrency) : "No Price"}</span>
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
// 🛒 Main POS Form
// =============================================================================
export default function AddNewSalePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PosForm />
    </Suspense>
  );
}

function PosForm() {
  const { user, subscription } = useAuth();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // -- DRAFTS STATE --
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showDraftsModal, setShowDraftsModal] = useState(false);

  // Variant Modal
  const [variantModal, setVariantModal] = useState<{ isOpen: boolean; product: any | null }>({ isOpen: false, product: null });
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});

  // Main Form
  const [invoiceCurrency, setInvoiceCurrency] = useState("USD");
  const [items, setItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" });
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [saleDate, setSaleDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  
  // Modals & Other
  const [productForPricing, setProductForPricing] = useState<ProductForPricing | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<any | null>(null);
  const [PdfTemplate, setPdfTemplate] = useState<React.ElementType | null>(null);
  const [salesperson, setSalesperson] = useState(user?.name || "Current User");
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  // Calculations
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0) * (1 - (Number(item.discount) || 0) / 100), 0), [items]);
  const totalPaid = useMemo(() => paymentLines.reduce((sum, line) => sum + (Number(line.valueInInvoiceCurrency) || 0), 0), [paymentLines]);
  const debtRemaining = totalAmount - totalPaid;
  const isOverpaid = totalPaid > totalAmount + 0.01; 
  
  const resetForm = () => {
    setItems([]);
    setCustomer({ id: "walkin", name: "Walk-in Customer", phone: "", whatsapp: "", notes: "" });
    setInvoiceCurrency("USD");
    setPaymentLines([]);
    setSalesperson(user?.name || "Current User");
    setAdditionalNotes("");
    setActiveDraftId(null);
    setError(null);
    setSuccessMsg(null);
    setIsSaving(false);
  };

  const handleProductSelect = (product: any) => {
    if (!product || !product.id) return;
    if (product.options && product.options.length > 0) {
      setVariantModal({ isOpen: true, product });
      setSelectedChoices({});
      return;
    }
    const price = product.salePrices?.[invoiceCurrency];
    if (price === undefined || price === null || price === 0) {
      setProductForPricing({ product, manualPrice: "" });
    } else {
      addItemToCart(product, price.toString(), false, {});
    }
  };

  const addItemToCart = (product: any, price: string, manualPrice: boolean, variants: Record<string, string> = {}) => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(), productId: product.id, productName: product.name,
      quantity: "1", pricePerUnit: price, costPriceUsd: product.costPrices?.USD || 0,
      stock: product.quantity, discount: "0", manualPrice: manualPrice, selectedVariants: variants,
    }]);
  };
  
  const handleUpdateItem = (id: string, field: 'quantity' | 'pricePerUnit' | 'discount', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const handleDeleteItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));
  
  const handleAddPaymentLine = () => setPaymentLines(prev => [...prev, { id: crypto.randomUUID(), method: '', amount: "", currency: invoiceCurrency, valueInInvoiceCurrency: "" }]);
  
  const handleUpdatePaymentLine = (id: string, field: keyof PaymentLine, value: string) => {
    setPaymentLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      let updatedLine = { ...line, [field]: value };
      if (field === 'currency' || field === 'amount') updatedLine.valueInInvoiceCurrency = updatedLine.currency === invoiceCurrency ? updatedLine.amount : (field === 'amount' ? "" : updatedLine.valueInInvoiceCurrency);
      if (field === 'currency') updatedLine.method = ""; 
      if (field === 'valueInInvoiceCurrency') updatedLine.valueInInvoiceCurrency = value;
      return updatedLine;
    }));
  };
  
  const handleRemovePaymentLine = (id: string) => setPaymentLines(prev => prev.filter(line => line.id !== id));

  // --- DRAFT HANDLERS ---
  const handleSaveDraft = async () => {
    if (items.length === 0) { setError("Cannot park an empty sale."); return; }
    setIsSaving(true);
    try {
      if (!user?.firebaseUser) throw new Error("Auth Error");
      const token = await user.firebaseUser.getIdToken();
      
      const draftPayload = {
        id: activeDraftId, 
        customer, items, paymentLines, invoiceCurrency,
        totalAmount, notes: additionalNotes
      };

      await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draftPayload),
      });
      
      setSuccessMsg("Sale Parked Successfully!");
      setTimeout(() => resetForm(), 1500); 
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResumeDraft = (draft: Draft) => {
    setCustomer(draft.customer);
    setItems(draft.items);
    setPaymentLines(draft.paymentLines);
    setInvoiceCurrency(draft.invoiceCurrency);
    setAdditionalNotes(draft.notes || "");
    setActiveDraftId(draft.id); 
    setShowDraftsModal(false);
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Delete this draft permanently?")) return;
    try {
      if (!user?.firebaseUser) return;
      const token = await user.firebaseUser.getIdToken();
      await fetch(`/api/drafts?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      mutate("/api/drafts");
    } catch (e) { console.error(e); }
  };
  
  const handleSaveSale = async (action: 'save' | 'save_print') => {
    setError(null); 
    if (isOverpaid) return setError("Overpayment is not allowed.");
    if (items.length === 0) return setError("Please add at least one item.");
    if (!customer) return setError("Please select or create a customer.");
    if (paymentLines.some(line => (Number(line.amount) > 0) && !line.method)) return setError("Please select a payment method.");
    
    setIsSaving(true);
    
    const transaction = {
      customer, invoiceCurrency,
      items: items.map(item => ({
        productId: item.productId, productName: item.productName,
        quantity: Number(item.quantity) || 0, discount: Number(item.discount) || 0,
        pricePerUnit: item.manualPrice ? (Number(item.pricePerUnit) || 0) : null,
        selectedVariants: item.selectedVariants || {}, 
      })),
      paymentLines: paymentLines.filter(line => (Number(line.amount) || 0) > 0 && line.method).map(line => ({
          method: line.method, amount: Number(line.amount) || 0,
          currency: line.currency, valueInInvoiceCurrency: Number(line.valueInInvoiceCurrency) || 0,
      })),
      saleDate: saleDate?.from ? format(saleDate.from, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      salesperson, notes: additionalNotes,
    };
    
    try {
      if (!user?.firebaseUser) throw new Error("Authentication error.");
      const token = await user.firebaseUser.getIdToken();

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(transaction),
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save sale."); }
      const data = await res.json();

      if (activeDraftId) {
         await fetch(`/api/drafts?id=${activeDraftId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      }
      
      if (action === 'save_print') {
        const storeInfo = {
          name: subscription?.storeName || "My Store",
          address: subscription?.storeAddress || "123 Main St",
          phone: subscription?.storePhone || "555-1234",
          logoUrl: subscription?.logoUrl, planId: subscription?.planId,
        };
        const printData = {
            ...data.sale,
            customer: { ...data.sale.customer, name: customer.name || data.sale.customer?.name, phone: customer.phone || data.sale.customer?.phone || "", address: customer.address || data.sale.customer?.address || "" }
        };
        const TemplateComponent = getTemplateComponent('invoice' as ReportType, subscription);
        setPdfTemplate(() => TemplateComponent); 
        setSaleToPrint({ data: printData, store: storeInfo }); 
        resetForm(); 
      } else {
        resetForm();
        router.push('/sales?view=history');
      }
    } catch (err: any) { console.error(err); setError(err.message); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* --- FORCED VISIBLE TOOLBAR --- */}
      <div className="flex flex-col gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-900/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    Draft Actions:
                </span>
                {activeDraftId && (
                   <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-700 shadow-sm dark:bg-gray-800">
                     <FileClock className="h-3 w-3" /> Resuming Draft
                     <button onClick={() => { if(confirm("Discard changes?")) resetForm(); }} className="ml-2 hover:text-red-600"><X className="h-3 w-3" /></button>
                   </div>
                )}
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={handleSaveDraft} disabled={isSaving || items.length === 0} className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 shadow-sm">
                     <Save className="h-4 w-4" /> {activeDraftId ? "Update Draft" : "Park Sale (Save Draft)"}
                </button>
                <button type="button" onClick={() => setShowDraftsModal(true)} className="flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-sm">
                      <FileClock className="h-4 w-4" /> View All Drafts
                </button>
            </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSaveSale('save'); }}>
        <div className="mb-24 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormSelect label="1. Set Invoice Currency" value={invoiceCurrency} onChange={(val: string) => setInvoiceCurrency(val)} disabled={items.length > 0}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </FormSelect>
                <CustomerSearch customer={customer} onCustomerSelect={setCustomer} />
              </div>
              {items.length > 0 && <p className="text-xs text-orange-600 mt-2">Invoice currency is locked because items are in the cart.</p>}
            </Card>
            <Card>
              <div className="flex items-start gap-2">
                <ProductSearch onProductSelect={handleProductSelect} invoiceCurrency={invoiceCurrency} />
                <button type="button" onClick={() => setShowAddProductModal(true)} className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700"><Plus className="h-5 w-5" /></button>
              </div>
              <div className="mt-4 flow-root">
                <div className="-mx-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="py-3 pl-4 text-left text-xs font-medium uppercase text-gray-500">Product</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500">Qty</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500">Disc %</th>
                        <th className="px-2 py-3 text-left text-xs font-medium uppercase text-gray-500">Subtotal</th>
                        <th className="py-3 pr-4 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {items.length === 0 && (<tr><td colSpan={6} className="py-10 text-center text-sm text-gray-500">Add products using the search bar above.</td></tr>)}
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pl-4 text-sm font-medium dark:text-white">{item.productName} {item.manualPrice && <span className="ml-1 text-orange-400">*</span>}</td>
                          <td className="px-2 py-2 w-20"><FormInput type="number" value={item.quantity} onChange={(val: string) => handleUpdateItem(item.id, 'quantity', val)} /></td>
                          <td className="px-2 py-2 w-28"><FormInput type="number" value={item.pricePerUnit} onChange={(val: string) => handleUpdateItem(item.id, 'pricePerUnit', val)} /></td>
                          <td className="px-2 py-2 w-20"><FormInput type="number" value={item.discount} onChange={(val: string) => handleUpdateItem(item.id, 'discount', val)} /></td>
                          <td className="px-2 py-2 text-sm dark:text-white">{formatCurrency((Number(item.quantity) || 0) * (Number(item.pricePerUnit) || 0) * (1 - (Number(item.discount) || 0) / 100), invoiceCurrency)}</td>
                          <td className="py-2 pr-4 text-right"><button type="button" onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
            <Card>
              <h3 className="mb-4 text-lg font-semibold dark:text-white">5. Additional Info</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput label="Salesperson" value={salesperson} readOnly className="[&_input]:bg-gray-100 dark:[&_input]:bg-gray-700/50" />
                <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Date</label><NewDateRangePicker date={saleDate} onApply={(newDate) => setSaleDate(newDate)} singleDateMode={true} /></div>
                <div className="sm:col-span-2"><FormInput label="Additional Notes" value={additionalNotes} onChange={setAdditionalNotes} placeholder="Details..." /></div>
              </div>
            </Card>
          </div>
          <div className="space-y-6 lg:col-span-1 lg:sticky top-24 h-fit">
            <Card>
              <h3 className="mb-4 text-lg font-semibold dark:text-white">4. Payment Details</h3>
              <div className="space-y-4">
                {paymentLines.map((line, index) => (
                    <div key={line.id} className="space-y-3 rounded-lg border border-gray-300 p-3 dark:border-gray-600">
                      <div className="flex justify-between items-center"><h4 className="font-medium dark:text-white">Payment #{index + 1}</h4><button type="button" onClick={() => handleRemovePaymentLine(line.id)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></div>
                      <FormSelect label="Method" value={line.method} onChange={(val: string) => handleUpdatePaymentLine(line.id, 'method', val)}><option value="" disabled>Select a method</option>{(paymentMethodsByCurrency[line.currency] || []).map(k => <option key={k} value={k}>{PAYMENT_PROVIDERS[k].label}</option>)}</FormSelect>
                      <div className="grid grid-cols-2 gap-2"><FormInput label="Amount" type="number" value={line.amount} onChange={(val: string) => handleUpdatePaymentLine(line.id, 'amount', val)} /><FormSelect label="Currency" value={line.currency} onChange={(val: string) => handleUpdatePaymentLine(line.id, 'currency', val)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</FormSelect></div>
                      {line.currency !== invoiceCurrency && (<div className="border-t border-dashed border-blue-400 pt-3"><FormInput label={`Value in ${invoiceCurrency}`} type="number" value={line.valueInInvoiceCurrency} onChange={(val: string) => handleUpdatePaymentLine(line.id, 'valueInInvoiceCurrency', val)} className="[&_input]:border-blue-500" /></div>)}
                    </div>
                ))}
                <button type="button" onClick={handleAddPaymentLine} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><Plus className="h-4 w-4" /> Add Payment</button>
              </div>
            </Card>
            <Card>
              <h3 className="mb-3 text-lg font-semibold dark:text-white">Summary</h3>
              <div className="space-y-2 pt-2">
                <TotalRow label="Total Amount" value={formatCurrency(totalAmount, invoiceCurrency)} isBold={true} />
                <TotalRow label="Total Paid" value={formatCurrency(totalPaid, invoiceCurrency)} isDebt={isOverpaid} />
                <hr className="my-2 dark:border-gray-600" />
                <TotalRow label={isOverpaid ? `Change Due` : `Debt Remaining`} value={formatCurrency(isOverpaid ? totalPaid - totalAmount : debtRemaining, invoiceCurrency)} isDebt={!isOverpaid && debtRemaining > 0} isBold={true} className="text-2xl" />
              </div>
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 left-0 right-0 z-10 mt-6 border-t border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {successMsg && <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 rounded bg-green-600 px-4 py-2 text-white shadow-lg">{successMsg}</div>}
          {isOverpaid && <p className="mb-2 text-center text-sm text-red-600">Overpayment is not allowed.</p>}
          {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={isSaving || items.length === 0 || !customer || isOverpaid} className="flex-2 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isSaving ? "Saving..." : `Save Sale (${formatCurrency(totalAmount, invoiceCurrency)})`}
            </button>
            <button type="button" onClick={() => handleSaveSale('save_print')} disabled={isSaving || items.length === 0 || !customer || isOverpaid} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"><Printer className="h-4 w-4" /> Save & Print</button>
            <button type="button" onClick={resetForm} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/50"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </div>
      </form>

      <DraftsListModal isOpen={showDraftsModal} onClose={() => setShowDraftsModal(false)} onSelect={handleResumeDraft} onDelete={handleDeleteDraft} />

      {showAddProductModal && (<ProductFormModal productToEdit={null} onClose={() => { setShowAddProductModal(false); mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products'), undefined, { revalidate: true }); }} storeId={subscription?.storeId || user?.storeId || ""} />)}

      {saleToPrint && PdfTemplate && (
        <TransitionedModal isOpen={true} onClose={() => setSaleToPrint(null)} size="md">
          <Dialog.Title className="text-lg font-medium dark:text-white"><CheckCircle className="h-6 w-6 text-green-500 inline-block mr-2" /> Sale Saved Successfully!</Dialog.Title>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Your sale ({saleToPrint.data.invoiceId}) has been saved. Download PDF below.</p>
            <PDFDownloadLink document={React.createElement(PdfTemplate, { data: saleToPrint.data, store: saleToPrint.store })} fileName={`${saleToPrint.data.invoiceId || 'invoice'}.pdf`} className="w-full flex justify-center items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800">
              {({ loading }) => loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4" /> Download PDF Now</>}
            </PDFDownloadLink>
          </div>
          <div className="mt-6 flex justify-end"><button type="button" className="rounded-lg border px-4 py-2" onClick={() => setSaleToPrint(null)}>Close</button></div>
        </TransitionedModal>
      )}

      <TransitionedModal isOpen={!!productForPricing} onClose={() => setProductForPricing(null)}>
        <Dialog.Title className="text-lg font-medium dark:text-white">Price Not Found</Dialog.Title>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">Price for "{productForPricing?.product.name}" is missing in {invoiceCurrency}.</p>
          <FormInput label={`Price in ${invoiceCurrency}`} type="number" value={productForPricing?.manualPrice || ""} onChange={(val: string) => setProductForPricing(prev => prev ? ({ ...prev, manualPrice: val }) : null)} placeholder="0.00" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setProductForPricing(null)}>Cancel</button>
          <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-white" onClick={() => { if(Number(productForPricing?.manualPrice)>0){ addItemToCart(productForPricing?.product, productForPricing!.manualPrice, true, {}); setProductForPricing(null); } }}>Add to Cart</button>
        </div>
      </TransitionedModal>

      <TransitionedModal isOpen={variantModal.isOpen} onClose={() => setVariantModal({ isOpen: false, product: null })} size="md">
        <Dialog.Title className="text-lg font-medium dark:text-white">Select Options</Dialog.Title>
        <div className="mt-4 space-y-4">
          {variantModal.product?.options?.map((opt: any, idx: number) => (
            <div key={idx}>
              <label className="block text-sm font-medium mb-1">{opt.name}</label>
              <select className="w-full rounded-lg border p-2.5 dark:bg-gray-700" value={selectedChoices[opt.name] || ""} onChange={(e) => setSelectedChoices(prev => ({ ...prev, [opt.name]: e.target.value }))}>
                <option value="">Not Included</option>
                {opt.values.map((val: string) => <option key={val} value={val}>{val}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setVariantModal({ isOpen: false, product: null })} className="rounded-lg border px-4 py-2">Cancel</button>
          <button type="button" onClick={() => {
              const product = variantModal.product;
              const price = product.salePrices?.[invoiceCurrency];
              if (price === undefined || price === null || price === 0) {
                 setVariantModal({ isOpen: false, product: null });
                 setProductForPricing({ product, manualPrice: "" });
              } else {
                 addItemToCart(product, price.toString(), false, selectedChoices);
                 setVariantModal({ isOpen: false, product: null });
              }
            }} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Confirm & Add</button>
        </div>
      </TransitionedModal>
    </div>
  );
}

// =============================================================================
// 📂 Drafts List Modal
// =============================================================================
function DraftsListModal({ isOpen, onClose, onSelect, onDelete }: { isOpen: boolean, onClose: () => void, onSelect: (d: Draft) => void, onDelete: (id: string) => void }) {
  const { data, isLoading, mutate } = useSWR(isOpen ? "/api/drafts" : null, fetcher);
  const drafts: Draft[] = data?.drafts || [];

  return (
    <TransitionedModal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
            <h3 className="text-xl font-bold dark:text-white">Parked Sales (Drafts)</h3>
            <button onClick={onClose}><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        {isLoading ? ( <div className="p-8 text-center text-gray-500">Loading drafts...</div> ) : drafts.length === 0 ? ( <div className="p-8 text-center text-gray-500">No parked sales found.</div> ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {drafts.map((draft) => (
                    <div key={draft.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 dark:text-white">{draft.customer.name}</span>
                                <span className="text-xs text-gray-500">{dayjs(draft.updatedAt).fromNow()}</span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {draft.items.length} items • Total: {formatCurrency(draft.totalAmount, draft.invoiceCurrency)}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onSelect(draft)} className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><PlayCircle className="h-4 w-4" /> Resume</button>
                            <button onClick={() => { onDelete(draft.id); mutate(); }} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:bg-gray-700 dark:border-gray-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </TransitionedModal>
  );
}

// =============================================================================
// 🌀 Helpers & UI Components
// =============================================================================
const LoadingSpinner = () => <div className="flex h-screen w-full items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>{children}</div>;
const FormInput = React.forwardRef(({ label, type = "text", className = "", onChange, icon, ...props }: any, ref) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">{icon}</div>}
      <input type={type} ref={ref} {...props} onChange={onChange ? (e) => onChange(e.target.value) : undefined} onWheel={(e) => type === 'number' && (e.target as HTMLInputElement).blur()} className={`w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${icon ? 'pl-10' : ''}`} />
    </div>
  </div>
));
FormInput.displayName = "FormInput";
const FormSelect = ({ label, value, onChange, children, className = "", ...props }: any) => (
  <div className={className}>
    {label && <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <select value={value} onChange={(e) => onChange(e.target.value)} {...props} className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">{children}</select>
  </div>
);
const TotalRow = ({ label, value, isDebt = false, isBold = false, className = "" }: any) => (
  <div className={`flex justify-between text-sm ${isBold ? 'font-semibold' : ''} ${isDebt ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'} ${className}`}>
    <span className="text-gray-600 dark:text-gray-300">{label}:</span>
    <span className={isBold ? 'text-lg' : ''}>{value}</span>
  </div>
);
const TransitionedModal = ({ isOpen, onClose, children, size = 'md' }: any) => {
  const sizeClasses: Record<string, string> = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80" />
        <div className="fixed inset-0 overflow-y-auto"><div className="flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800`}>{children}</Dialog.Panel>
        </div></div>
      </Dialog>
    </Transition>
  );
}

// --- FULLY RESTORED DATE PICKER ---
function NewDateRangePicker({ date, onApply, className, singleDateMode = false }: { date: DateRange | undefined; onApply: (date: DateRange | undefined) => void; className?: string; singleDateMode?: boolean; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(date?.from || new Date());
  const [selectedDate, setSelectedDate] = useState<DateRange | undefined>(date);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
  useEffect(() => { setSelectedDate(date); setCurrentMonth(date?.from || new Date()); }, [date]);
  const handleApply = () => { onApply(selectedDate); setIsOpen(false); };
  const handleCancel = () => { setSelectedDate(date); setCurrentMonth(date?.from || new Date()); setIsOpen(false); };
  const handleOpenChange = (open: boolean) => { if (!open) handleCancel(); setIsOpen(open); };
  const handleDayClick = (day: Date) => {
    if (singleDateMode) { setSelectedDate({ from: day, to: day }); onApply({ from: day, to: day }); setIsOpen(false); } else {
      const { from, to } = selectedDate || {};
      if (!from) { setSelectedDate({ from: day, to: undefined }); } else if (from && !to) { if (isAfter(day, from)) { setSelectedDate({ from, to: day }); } else { setSelectedDate({ from: day, to: from }); } } else if (from && to) { setSelectedDate({ from: day, to: undefined }); }
    }
  };
  const displayedDate = date; 
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild><Button id="date" variant="outline" className={cn("w-full justify-start text-left font-normal shadow-sm bg-white dark:bg-gray-700", !displayedDate && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{displayedDate?.from ? ((displayedDate.to && !singleDateMode) ? <>{format(displayedDate.from, "LLL dd, y")} - {format(displayedDate.to, "LLL dd, y")}</> : format(displayedDate.from, "LLL dd, y")) : <span>Pick a date</span>}</Button></PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-800 border dark:border-gray-700" align="start"><CalendarGrid month={currentMonth} selectedDate={selectedDate} onDayClick={handleDayClick} hoveredDate={hoveredDate} setHoveredDate={setHoveredDate} onMonthChange={setCurrentMonth} singleDateMode={singleDateMode} />{!singleDateMode && (<div className="flex justify-end gap-2 p-4 border-t dark:border-gray-600"><Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button><Button size="sm" onClick={handleApply}>Apply</Button></div>)}</PopoverContent>
      </Popover>
    </div>
  );
}

function CalendarGrid({ month, selectedDate, onDayClick, hoveredDate, setHoveredDate, onMonthChange, singleDateMode }: { month: Date; selectedDate: DateRange | undefined; onDayClick: (date: Date) => void; hoveredDate: Date | undefined; setHoveredDate: (date: Date | undefined) => void; onMonthChange: (date: Date) => void; singleDateMode: boolean; }) {
  const firstDay = startOfMonth(month); const lastDay = endOfMonth(month); const startDate = startOfWeek(firstDay); const endDate = endOfWeek(lastDay); const days = eachDayOfInterval({ start: startDate, end: endDate }); const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; const nextMonth = () => onMonthChange(add(month, { months: 1 })); const prevMonth = () => onMonthChange(sub(month, { months: 1 }));
  return (
    <div className="p-4"><div className="flex justify-between items-center mb-2"><span className="text-lg font-semibold dark:text-white">{format(month, "MMMM yyyy")}</span><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button></div></div><div className="grid grid-cols-7 gap-1">{weekDays.map(day => (<div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">{day}</div>))}</div><div className="grid grid-cols-7 gap-1 mt-2" onMouseLeave={() => !singleDateMode && setHoveredDate(undefined)}>{days.map(day => { const isCurrentMonth = isSameMonth(day, month); const isSelectedStart = !!selectedDate?.from && isSameDay(day, selectedDate.from); const isSelectedEnd = !!selectedDate?.to && isSameDay(day, selectedDate.to); const isInRange = !!(selectedDate?.from && selectedDate?.to) && !singleDateMode && isAfter(day, selectedDate.from) && isBefore(day, selectedDate.to); const isHovering = !!(selectedDate?.from && !selectedDate.to && hoveredDate) && !singleDateMode; const isHoverStart = isHovering && hoveredDate && selectedDate.from && isBefore(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from; const isHoverEnd = isHovering && hoveredDate && selectedDate.from && isAfter(hoveredDate, selectedDate.from) ? hoveredDate : selectedDate?.from; const isInHoverRange = isHovering && isHoverStart && isHoverEnd && isAfter(day, isHoverStart) && isBefore(day, isHoverEnd); return (<button key={day.toString()} type="button" onClick={() => onDayClick(day)} onMouseEnter={() => !singleDateMode && setHoveredDate(day)} className={cn("h-9 w-9 flex items-center justify-center rounded-lg text-sm", !isCurrentMonth && "text-gray-400 dark:text-gray-600", isCurrentMonth && "text-gray-800 dark:text-gray-200", isToday(day) && "font-bold text-blue-600", (isSelectedStart || isSelectedEnd) && "bg-blue-600 text-white hover:bg-blue-700", isInRange && "bg-blue-100 dark:bg-blue-900/50 rounded-none", isSelectedStart && !singleDateMode && "rounded-l-lg", isSelectedEnd && !singleDateMode && "rounded-r-lg", isHovering && (isSameDay(day, isHoverStart!) || isSameDay(day, isHoverEnd!)) && "bg-blue-600/50 text-white", isInHoverRange && "bg-blue-100/50 dark:bg-blue-900/20", !isSelectedStart && !isSelectedEnd && !isInRange && isCurrentMonth && "hover:bg-gray-100 dark:hover:bg-gray-700")}>{format(day, "d")}</button>); })}</div></div>
  );
}