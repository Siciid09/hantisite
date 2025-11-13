"use client";

import React, { useState, useEffect, Fragment, useMemo } from 'react';
import { useAuth } from "@/app/contexts/AuthContext";
import useSWR, { useSWRConfig } from "swr";
import { auth, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Dialog, Transition } from "@headlessui/react";
import { Plus, Trash, Loader2, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// --- Reusable Fetcher ---
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

const AVAILABLE_CURRENCIES = ["USD", "SLSH", "SOS", "EUR", "KES", "ETB"];

// --- Helper Components (Moved from products/page.tsx) ---

const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    onClick={onClose}
  >
    <div 
      className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()} 
    >
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

const FormInput = ({ label, value, onChange, error, ...props }: {
  label: string,
  value: string | number,
  onChange: (val: string) => void,
  error?: string,
  [key: string]: any
}) => (
  <div className="w-full">
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600"
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const FormTextArea = ({ label, value, onChange, error, ...props }: {
  label: string,
  value: string,
  onChange: (val: string) => void,
  error?: string,
  [key: string]: any
}) => (
  <div>
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600"
      )}
      rows={3}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

const FormSelect = ({ label, value, onChange, children, error, className, ...props }: {
  label?: string,
  value: string | number,
  onChange: (val: string) => void,
  children: React.ReactNode,
  error?: string,
  className?: string
  [key: string]: any
}) => (
  <div className="w-full">
    {label && <label className="mb-1 block text-sm font-medium">{label}</label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border p-2 dark:bg-gray-700",
        error 
          ? "border-red-500" 
          : "border-gray-300 dark:border-gray-600",
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// --- Product Form Modal ---

type ProductFormErrors = {
  name?: string;
  category?: string;
  warehouseId?: string;
  quantity?: string;
};

// --- (FIX) Added 'export' ---
export const ProductFormModal = React.memo(function ProductFormModal({ productToEdit, onClose, storeId }: { 
  productToEdit: any | null, 
  onClose: () => void, 
  storeId: string 
}) {
  const isEditMode = !!productToEdit;
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(productToEdit?.name || "");
  const [description, setDescription] = useState(productToEdit?.description || "");
  const [category, setCategory] = useState(productToEdit?.category || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(isEditMode ? "" : "0");
  const [warehouseId, setWarehouseId] = useState("");
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(productToEdit?.imageUrl || null);
  const [imagePreview, setImagePreview] = useState(productToEdit?.imageUrl || null);
  type PriceField = { id: number, currency: string, sale: string, cost: string };
  const [priceFields, setPriceFields] = useState<PriceField[]>([]);
  
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

  const { data: categoriesData, mutate: mutateCategories } = useSWR("/api/products?tab=categories", fetcher);
  const { data: stockData, mutate: mutateStock } = useSWR("/api/products?tab=stock", fetcher);

  const handleAddInline = async (type: "category" | "warehouse") => {
    setIsSavingInline(true);
    const user = auth.currentUser;
    if (!user) {
      alert("Authentication error.");
      setIsSavingInline(false);
      return;
    }
    let body: any;
    let newName = "";
    if (type === "category") {
      if (!newCategoryName) {
        alert("Category name cannot be empty.");
        setIsSavingInline(false);
        return;
      }
      body = { type: "category", name: newCategoryName };
      newName = newCategoryName;
    } else {
      if (!newWarehouseName) {
        alert("Warehouse name cannot be empty.");
        setIsSavingInline(false);
        return;
      }
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to add ${type}.`);
      }
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
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSavingInline(false);
    }
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
    setPriceFields(prevFields =>
      prevFields.map(field =>
        field.id === id ? { ...field, [key]: value } : field
      )
    );
  };
  
  const addPriceField = () => setPriceFields(prev => [...prev, { id: Date.now(), currency: "SLSH", sale: "", cost: "" }]);
  const removePriceField = (id: number) => setPriceFields(prev => prev.filter(field => field.id !== id));
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormErrors({});
    const errors: ProductFormErrors = {};
    if (!name) {
      errors.name = "Product name is required.";
    }
    if (!category) {
      errors.category = "Please select a category.";
    }
    if (!isEditMode && !warehouseId) {
      errors.warehouseId = "Please select a warehouse for the initial stock.";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }
    const user = auth.currentUser;
    if (!user || !storeId) {
      setFormErrors({ name: "Authentication error. Please log in again." });
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
      if (!imageFile && !existingImageUrl) {
        uploadedImageUrl = null;
      }
      const salePrices: Record<string, number> = {};
      const costPrices: Record<string, number> = {};
      for (const field of priceFields) {
        if (field.currency) {
          if (field.sale) salePrices[field.currency] = parseFloat(field.sale);
          if (field.cost) costPrices[field.currency] = parseFloat(field.cost);
        }
      }
      let body: any;
      let url = "/api/products";
      let method = "POST";
      if (isEditMode) {
        method = "PUT";
        url = `/api/products?id=${productToEdit.id}`;
        body = {
          name, description, category, salePrices, costPrices,
          imageUrl: uploadedImageUrl,
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
        };
      }
      const token = await user.getIdToken();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save product.");
      }
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
    <ModalBase title={isEditMode ? "Edit Product" : "Add New Product"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {formErrors.name && !formErrors.category && !formErrors.warehouseId && (
          <div className="rounded-md bg-red-50 p-3 text-red-700">
            <p className="text-sm font-medium">{formErrors.name}</p>
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          <label className="mb-1 block text-sm font-medium">Product Image (Optional)</label>
          <div className="h-24 w-24 rounded-lg border bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex items-center justify-center">
            {imagePreview ? (
              <Image src={imagePreview} alt="Product" width={96} height={96} className="h-full w-full object-cover rounded-lg" />
            ) : (
              <Camera className="h-10 w-10 text-gray-400" />
            )}
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-md border px-3 py-1 text-sm text-blue-600 dark:border-gray-600 dark:text-blue-400">
              Change Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </label>
            {imagePreview && (
              <button type="button" onClick={() => { setImageFile(null); setExistingImageUrl(null); setImagePreview(null); }} className="text-red-500 text-sm">
                Remove
              </button>
            )}
          </div>
        </div>
        <FormInput 
          label="Product Name" 
          value={name} 
          onChange={setName} 
          error={formErrors.name} 
        />
        <div className="flex items-end gap-2">
          <FormSelect 
            label="Category" 
            value={category} 
            onChange={setCategory} 
            error={formErrors.category}
            className="flex-1"
          >
            <option value="">-- Select Category --</option>
            {categoriesData?.categories?.map((c: any) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </FormSelect>
          <button 
            type="button" 
            title="Add new category"
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="flex-shrink-0 rounded-lg border p-2.5 dark:border-gray-600"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {showAddCategory && (
          <div className="flex items-end gap-2 rounded-lg border p-3 dark:border-gray-600">
            <FormInput
              label="New Category Name"
              value={newCategoryName}
              onChange={setNewCategoryName}
              placeholder="e.g., Electronics"
              className="flex-1"
            />
            <button 
              type="button" 
              onClick={() => handleAddInline("category")}
              disabled={isSavingInline}
              className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {isSavingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </button>
          </div>
        )}
        <FormTextArea label="Description (Optional)" value={description} onChange={setDescription} />
        {!isEditMode && (
          <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-600">
            <h4 className="font-semibold">Initial Stock</h4>
            <p className="text-xs text-gray-500 mb-3">Stock quantity is managed via adjustments after creation.</p>
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Initial Quantity" 
                type="number" 
                value={quantity} 
                onChange={setQuantity} 
                error={formErrors.quantity}
                min="0"
              />
              <div className="flex items-end gap-2">
                <FormSelect 
                  label="Warehouse" 
                  value={warehouseId} 
                  onChange={setWarehouseId} 
                  error={formErrors.warehouseId}
                  className="flex-1"
                >
                  <option value="">-- Select Warehouse --</option>
                  {stockData?.warehouses?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </FormSelect>
                <button 
                  type="button" 
                  title="Add new warehouse"
                  onClick={() => setShowAddWarehouse(!showAddWarehouse)}
                  className="flex-shrink-0 rounded-lg border p-2.5 dark:border-gray-600"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {!isEditMode && showAddWarehouse && (
          <div className="space-y-3 rounded-lg border p-3 dark:border-gray-600">
            <div className="flex items-end gap-2">
              <FormInput
                label="New Warehouse Name"
                value={newWarehouseName}
                onChange={setNewWarehouseName}
                placeholder="e.g., Main Branch"
                className="flex-1"
              />
              <FormInput
                label="Address (Optional)"
                value={newWarehouseAddress}
                onChange={setNewWarehouseAddress}
                placeholder="e.g., 123 Main St"
                className="flex-1"
              />
            </div>
            <button 
              type="button" 
              onClick={() => handleAddInline("warehouse")}
              disabled={isSavingInline}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {isSavingInline ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Warehouse"}
            </button>
          </div>
        )}
        <div className="space-y-3">
          <h4 className="font-semibold">Prices</h4>
          {priceFields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <FormSelect label={index === 0 ? "Currency" : ""} value={field.currency} onChange={(val) => handlePriceChange(field.id, "currency", val)}>
                  {AVAILABLE_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </FormSelect>
              </div>
              <div className="col-span-3">
                <FormInput label={index === 0 ? "Sale Price" : ""} type="number" placeholder="e.g., 10" value={field.sale} onChange={(val) => handlePriceChange(field.id, "sale", val)} />
              </div>
              <div className="col-span-3">
                <FormInput label={index === 0 ? "Cost Price" : ""} type="number" placeholder="e.g., 5" value={field.cost} onChange={(val) => handlePriceChange(field.id, "cost", val)} />
              </div>
              <div className="col-span-2 flex items-end pb-2">
                {priceFields.length > 1 && (
                  <button type="button" onClick={() => removePriceField(field.id)} className="text-red-500">
                    <Trash className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={addPriceField} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
            <Plus className="h-4 w-4" /> Add another currency
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? "Save Changes" : "Create Product")}
          </button>
        </div>
      </form>
    </ModalBase>
  );
});