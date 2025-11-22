"use client";

import React, { useState, useEffect } from 'react';
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { auth, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Plus, Trash2, Loader2, Camera, X, Layers, 
  DollarSign, Warehouse, Package, AlertCircle, 
  Image as ImageIcon, ChevronDown, UploadCloud, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// --- Constants & Fetcher ---
const AVAILABLE_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KES", "ETB"];

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

// --- 1. ROBUST MODAL BASE (Fixes Scroll Lock) ---
interface ModalBaseProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const ModalBase = ({ title, onClose, children, size = 'md' }: ModalBaseProps) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    // 1. Overlay: fixed to screen, centers content
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      
      {/* 2. The Card: constrained height (h-[85vh]) forces inner content to calculate scroll space */}
      <div 
        className={cn(
          "w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col h-[85vh] transition-all", 
          sizeClasses[size] || sizeClasses.md
        )}
      >
        {/* 3. Header: flex-none prevents it from squishing */}
        <div className="flex-none flex justify-between items-center px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* 4. Content Wrapper: flex-1 takes all remaining space. min-h-0 allows scrolling. */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- 2. Form Components (Unchanged) ---
const FormInput = ({ label, value, onChange, error, type = "text", className, ...props }: any) => (
  <div className="w-full">
    {label && <label className="mb-1.5 block text-sm font-bold text-gray-900 dark:text-white">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full h-11 rounded-lg border px-4 text-sm text-gray-900 shadow-sm transition-all focus:ring-2 focus:ring-offset-0 dark:bg-gray-800 dark:text-white",
        error 
          ? "border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-800" 
          : "border-gray-300 focus:border-blue-500 focus:ring-blue-100 dark:border-gray-600 dark:focus:ring-blue-900",
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
  </div>
);

const FormTextArea = ({ label, value, onChange, error, className, ...props }: any) => (
  <div className="w-full">
    {label && <label className="mb-1.5 block text-sm font-bold text-gray-900 dark:text-white">{label}</label>}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full rounded-lg border px-4 py-3 text-sm text-gray-900 shadow-sm transition-all focus:ring-2 focus:ring-offset-0 dark:bg-gray-800 dark:text-white resize-none",
        error 
          ? "border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-800" 
          : "border-gray-300 focus:border-blue-500 focus:ring-blue-100 dark:border-gray-600 dark:focus:ring-blue-900",
        className
      )}
      rows={3}
      {...props}
    />
    {error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
  </div>
);

const FormSelect = ({ label, value, onChange, children, error, className, ...props }: any) => (
  <div className="w-full">
    {label && <label className="mb-1.5 block text-sm font-bold text-gray-900 dark:text-white">{label}</label>}
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "block w-full h-11 appearance-none rounded-lg border bg-white px-4 text-sm text-gray-900 shadow-sm transition-all focus:ring-2 focus:ring-offset-0 dark:bg-gray-800 dark:text-white",
          error 
            ? "border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-800" 
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-100 dark:border-gray-600 dark:focus:ring-blue-900",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
    {error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
  </div>
);

// --- Main Component ---

type ProductFormErrors = {
  name?: string;
  category?: string;
  warehouseId?: string;
  quantity?: string;
};

export const ProductFormModal = React.memo(function ProductFormModal({ productToEdit, onClose, storeId }: { 
  productToEdit: any | null, 
  onClose: () => void, 
  storeId: string 
}) {
  const isEditMode = !!productToEdit;
  const { mutate } = useSWRConfig();
  
  // Form State
  const [name, setName] = useState(productToEdit?.name || "");
  const [description, setDescription] = useState(productToEdit?.description || "");
  const [category, setCategory] = useState(productToEdit?.category || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(isEditMode ? "" : "");
  const [warehouseId, setWarehouseId] = useState("");
  
  // Variant State
  const [options, setOptions] = useState<{ name: string; values: string }[]>(
    productToEdit?.options?.map((o: any) => ({ name: o.name, values: o.values.join(", ") })) || []
  );

  // UI State
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  
  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(productToEdit?.imageUrl || null);
  const [imagePreview, setImagePreview] = useState(productToEdit?.imageUrl || null);
  
  // Pricing State
  type PriceField = { id: number, currency: string, sale: string, cost: string };
  const [priceFields, setPriceFields] = useState<PriceField[]>([]);

  // --- Effects ---
  useEffect(() => {
    if (isEditMode) {
      const salePrices = productToEdit.salePrices || {};
      const costPrices = productToEdit.costPrices || {};
      const allCurrencies = new Set([...Object.keys(salePrices), ...Object.keys(costPrices)]);
      
      if (allCurrencies.size === 0) {
        setPriceFields([{ id: 1, currency: "USD", sale: "", cost: "" }]);
      } else {
        setPriceFields(
          Array.from(allCurrencies).map((currency, index) => ({
            id: index + 1,
            currency,
            sale: salePrices[currency]?.toString() || "",
            cost: costPrices[currency]?.toString() || "",
          }))
        );
      }
    } else {
      setPriceFields([{ id: 1, currency: "USD", sale: "", cost: "" }]);
    }
  }, [productToEdit, isEditMode]);

  // --- Data Fetching ---
  const { data: categoriesData, mutate: mutateCategories } = useSWR("/api/products?tab=categories", fetcher);
  const { data: stockData, mutate: mutateStock } = useSWR("/api/products?tab=stock", fetcher);

  // --- Handlers ---
  const addOptionRow = () => { if (options.length < 5) setOptions([...options, { name: "", values: "" }]); };
  const removeOptionRow = (idx: number) => { setOptions(options.filter((_, i) => i !== idx)); };
  const handleOptionChange = (idx: number, field: 'name' | 'values', val: string) => {
    const newOpts = [...options];
    newOpts[idx][field] = val;
    setOptions(newOpts);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setExistingImageUrl(null);
    }
  };

  const handlePriceChange = (id: number, key: "currency" | "sale" | "cost", value: string) => {
    setPriceFields(prev => prev.map(field => field.id === id ? { ...field, [key]: value } : field));
  };
  
  const addPriceField = () => setPriceFields(prev => [...prev, { id: Date.now(), currency: "SLSH", sale: "", cost: "" }]);
  const removePriceField = (id: number) => setPriceFields(prev => prev.filter(field => field.id !== id));

  const handleAddInline = async (type: "category" | "warehouse") => {
    setIsSavingInline(true);
    const user = auth.currentUser;
    if (!user) { alert("Authentication error."); setIsSavingInline(false); return; }
    
    let body: any;
    let newName = "";

    if (type === "category") {
      if (!newCategoryName) return setIsSavingInline(false);
      body = { type: "category", name: newCategoryName };
      newName = newCategoryName;
    } else {
      if (!newWarehouseName) return setIsSavingInline(false);
      body = { type: "warehouse", name: newWarehouseName, address: newWarehouseAddress };
      newName = newWarehouseName;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error("Failed to add item");
      
      if (type === "category") {
        await mutateCategories();
        setCategory(newName);
        setNewCategoryName("");
        setShowAddCategory(false);
      } else {
        const newWarehouse = await res.json();
        await mutateStock();
        setWarehouseId(newWarehouse.id);
        setNewWarehouseName("");
        setNewWarehouseAddress("");
        setShowAddWarehouse(false);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingInline(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormErrors({});
    
    const errors: ProductFormErrors = {};
    if (!name) errors.name = "Product name is required.";
    if (!category) errors.category = "Category is required.";
    if (!isEditMode && !warehouseId && quantity) errors.warehouseId = "Warehouse required for stock.";
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    const finalOptions = options
      .filter(o => o.name.trim() !== "")
      .map(o => ({
        name: o.name,
        values: o.values.split(',').map(v => v.trim()).filter(v => v !== "")
      }));

    const user = auth.currentUser;
    if (!user || !storeId) {
      setIsSubmitting(false);
      return;
    }

    try {
      let uploadedImageUrl: string | null = existingImageUrl;
      if (imageFile) {
        const imageRef = ref(storage, `product_images/${storeId}/${Date.now()}_${imageFile.name}`);
        const uploadTask = await uploadBytes(imageRef, imageFile);
        uploadedImageUrl = await getDownloadURL(uploadTask.ref);
      }
      
      const salePrices: Record<string, number> = {};
      const costPrices: Record<string, number> = {};
      priceFields.forEach(f => {
        if (f.currency) {
          if (f.sale) salePrices[f.currency] = parseFloat(f.sale);
          if (f.cost) costPrices[f.currency] = parseFloat(f.cost);
        }
      });

      let body: any;
      let url = "/api/products";
      let method = "POST";

      if (isEditMode) {
        method = "PUT";
        url = `/api/products?id=${productToEdit.id}`;
        body = {
          name, description, category, salePrices, costPrices,
          imageUrl: uploadedImageUrl, options: finalOptions,
        };
      } else {
        const warehouse = stockData?.warehouses.find((w: any) => w.id === warehouseId);
        body = {
          type: "product",
          name, description, category,
          quantity: Number(quantity) || 0,
          warehouseId: warehouse?.id,
          warehouseName: warehouse?.name,
          salePrices, costPrices,
          imageUrl: uploadedImageUrl,
          options: finalOptions,
        };
      }

      const token = await user.getIdToken();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save product.");

      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/products?tab=products'), undefined, { revalidate: true });
      mutate("/api/products?tab=stock");
      if (!isEditMode) mutate("/api/products?tab=adjustments");
      onClose();

    } catch (error: any) {
      setFormErrors({ name: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBase title={isEditMode ? "Edit Product" : "Create New Product"} onClose={onClose} size="xl">
      
      {/* --- 5. FORM CONTAINER --- 
          Use flex-col, h-full, and min-h-0 to ensure it fits the parent ModalBase wrapper perfectly 
      */}
      <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 w-full">
        
        {/* --- 6. SCROLLABLE AREA --- 
            flex-1: Fill available space
            overflow-y-auto: Enable scroll on this specific div
            min-h-0: Crucial for nested flex scrolling
        */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 min-h-0">

          {/* Error Banner */}
          {formErrors.name && !formErrors.category && !formErrors.warehouseId && (
            <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400 animate-in slide-in-from-top-2 border border-red-100 dark:border-red-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-bold">Validation Error</p>
                <p>{formErrors.name}</p>
              </div>
            </div>
          )}

          {/* --- SECTION 1: HERO (Image + Identity) --- */}
          <div className="flex flex-col gap-8 md:flex-row">
            
            {/* LEFT: Modern Image Uploader */}
            <div className="flex-shrink-0 w-full md:w-auto flex justify-center md:block">
              <div className="w-48">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Product Image</label>
                <div className="group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-blue-500 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-blue-400">
                  
                  {imagePreview ? (
                    <>
                      <Image 
                        src={imagePreview} 
                        alt="Preview" 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                        <Camera className="h-8 w-8 text-white drop-shadow-md" />
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setImageFile(null); 
                          setExistingImageUrl(null); 
                          setImagePreview(null); 
                        }} 
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600 z-10 transition-colors"
                        title="Remove Image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center p-4 text-center text-gray-400 transition-colors group-hover:text-blue-500">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-700 dark:ring-gray-600">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Upload Photo</span>
                    </div>
                  )}
                  
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 z-0 cursor-pointer opacity-0" 
                    onChange={handleImageSelect} 
                  />
                </div>
              </div>
            </div>

            {/* RIGHT: Product Identity Inputs */}
            <div className="flex-1 space-y-6">
              <FormInput 
                label="Product Name *" 
                value={name} 
                onChange={setName} 
                error={formErrors.name} 
                placeholder="e.g. Wireless Headphones"
                className="text-lg font-semibold"
              />

              <div className="space-y-4">
                {/* Category Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-gray-900 dark:text-white">Category <span className="text-red-500">*</span></label>
                    <button 
                      type="button" 
                      onClick={() => setShowAddCategory(!showAddCategory)} 
                      className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1"
                    >
                      <Plus className={`h-3 w-3 transition-transform ${showAddCategory ? 'rotate-45' : ''}`} />
                      {showAddCategory ? 'Cancel' : 'Add New'}
                    </button>
                  </div>

                  {/* Inline Add Category Panel */}
                  {showAddCategory ? (
                    <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2 dark:border-blue-900/30 dark:bg-blue-900/10 animate-in fade-in slide-in-from-top-1">
                      <input 
                        className="w-full flex-1 rounded-lg border-0 bg-white py-2 pl-3 text-sm shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-800 dark:ring-gray-700 dark:text-white"
                        placeholder="Name of new category"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleAddInline("category")} 
                        disabled={isSavingInline} 
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                      >
                        {isSavingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </button>
                    </div>
                  ) : (
                    <FormSelect 
                      label="" 
                      value={category} 
                      onChange={setCategory} 
                      error={formErrors.category}
                    >
                      <option value="">Select Category...</option>
                      {categoriesData?.categories?.map((c: any) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </FormSelect>
                  )}
                </div>

                <FormTextArea 
                  label="Description" 
                  value={description} 
                  onChange={setDescription} 
                  placeholder="Add product details, internal notes, or specs..." 
                  rows={3}
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* --- SECTION 2: VARIANTS --- */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                <Layers className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white">Variants (Options)</h4>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-5 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="space-y-4">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="sm:w-1/3">
                      <label className="mb-1 block text-xs font-bold uppercase text-gray-500 sm:hidden">Option</label>
                      <input
                        placeholder="Name (e.g. Size)"
                        value={opt.name}
                        onChange={(e) => handleOptionChange(idx, 'name', e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-gray-600 dark:bg-gray-800"
                      />
                    </div>
                    <div className="flex flex-1 items-start gap-2">
                      <div className="w-full">
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500 sm:hidden">Values</label>
                        <input
                          placeholder="Values (S, M, L...)"
                          value={opt.values}
                          onChange={(e) => handleOptionChange(idx, 'values', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeOptionRow(idx)} 
                        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-red-900/20 transition-colors mt-auto"
                        title="Remove Option"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                type="button" 
                onClick={addOptionRow} 
                className="mt-4 flex items-center gap-2 text-sm font-bold text-purple-600 hover:underline dark:text-purple-400"
              >
                <Plus className="h-4 w-4" /> Add Another Option
              </button>
            </div>
          </div>

          {/* --- SECTION 3: INVENTORY (New Products Only) --- */}
          {!isEditMode && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                  <Warehouse className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white">Initial Stock</h4>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <FormInput 
                    label="Starting Quantity" 
                    type="number" 
                    min="0" 
                    value={quantity} 
                    onChange={setQuantity} 
                    error={formErrors.quantity} 
                    placeholder="0" 
                  />
                  
                  <div className="space-y-1">
                    <div className="flex justify-between mb-1.5">
                        <label className="block text-sm font-bold text-gray-900 dark:text-white">Warehouse</label>
                        <button 
                          type="button"
                          onClick={() => setShowAddWarehouse(!showAddWarehouse)}
                          className="text-xs font-bold text-orange-600 hover:underline dark:text-orange-400"
                        >
                          {showAddWarehouse ? "Cancel" : "+ New Warehouse"}
                        </button>
                    </div>

                    {showAddWarehouse ? (
                      <div className="space-y-2 rounded-lg bg-orange-50/50 p-3 shadow-sm ring-1 ring-orange-200 dark:bg-gray-800 dark:ring-gray-600 animate-in fade-in">
                          <input
                            value={newWarehouseName}
                            onChange={(e) => setNewWarehouseName(e.target.value)}
                            placeholder="Name (e.g. Main Branch)"
                            className="w-full rounded-md border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <input
                            value={newWarehouseAddress}
                            onChange={(e) => setNewWarehouseAddress(e.target.value)}
                            placeholder="Address (Optional)"
                            className="w-full rounded-md border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <button 
                            type="button" 
                            onClick={() => handleAddInline("warehouse")}
                            disabled={isSavingInline}
                            className="w-full rounded-md bg-orange-600 py-1.5 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            {isSavingInline ? "Saving..." : "Save Warehouse"}
                          </button>
                      </div>
                    ) : (
                      <FormSelect label="" value={warehouseId} onChange={setWarehouseId} error={formErrors.warehouseId}>
                        <option value="">Select Warehouse...</option>
                        {stockData?.warehouses?.map((w: any) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </FormSelect>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- SECTION 4: PRICING --- */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-gray-900 dark:text-white">Pricing</h4>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="space-y-4">
                {priceFields.map((field, index) => (
                  <div key={field.id} className="flex flex-col gap-4 sm:flex-row sm:items-end bg-gray-50/50 p-3 rounded-xl sm:bg-transparent sm:p-0 border border-gray-100 sm:border-none dark:border-gray-700 dark:bg-gray-800/50 sm:dark:bg-transparent">
                    <div className="sm:w-1/3">
                      <FormSelect label="Currency" value={field.currency} onChange={(v: string) => handlePriceChange(field.id, "currency", v)}>
                        {AVAILABLE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </FormSelect>
                    </div>
                    
                    <div className="flex-1">
                      <FormInput 
                        label="Selling Price" 
                        type="number" 
                        value={field.sale} 
                        onChange={(v: string) => handlePriceChange(field.id, "sale", v)} 
                        placeholder="0.00" 
                      />
                    </div>

                    <div className="flex-1">
                        <FormInput 
                          label="Cost Price" 
                          type="number" 
                          value={field.cost} 
                          onChange={(v: string) => handlePriceChange(field.id, "cost", v)} 
                          placeholder="0.00" 
                        />
                    </div>

                    {priceFields.length > 1 && (
                      <div className="flex justify-end sm:mb-1">
                        <button 
                          type="button" 
                          onClick={() => removePriceField(field.id)} 
                          className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-red-900/20 transition-colors"
                          title="Remove Price"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                <button type="button" onClick={addPriceField} className="flex items-center gap-1 text-sm font-bold text-green-600 hover:underline dark:text-green-400">
                  <Plus className="h-4 w-4" /> Add Another Currency
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* --- 7. STICKY FOOTER ACTIONS --- 
            flex-none: Prevents footer from shrinking or disappearing
            z-10: Ensures it stays above the scroll content if overlap occurs
        */}
        <div className="flex-none border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/80 backdrop-blur-sm rounded-b-2xl z-10">
          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:shadow-blue-600/40 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Package className="h-5 w-5" /> 
                  {isEditMode ? "Save Changes" : "Create Product"}
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </ModalBase>
  );
});