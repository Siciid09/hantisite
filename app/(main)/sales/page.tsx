// File: app/(main)/sales/page.tsx
//
// --- FINAL VERSION (MODIFIED FOR DELETE) ---
// 1. (MOD) Imports 'useSWRConfig' for data mutation.
// 2. (MOD) Imports 'DeleteConfirmModal' from components.
// 3. (MOD) Imports 'auth' for getting user token.
// 4. (NEW) Adds state for 'isDeleteModalOpen', 'saleToDelete', 'isDeleting', 'deleteError'.
// 5. (NEW) Adds 'handleOpenDeleteModal', 'handleCloseDeleteModal', 'handleConfirmDelete' functions.
// 6. (MOD) Gets 'userRole' from 'user' object.
// 7. (MOD) Passes 'userRole' and 'onDeleteSale' props to 'SalesDashboard' and 'SalesDataContainer'.
// 8. (NEW) Renders the 'DeleteConfirmModal' component.
// -----------------------------------------------------------------------------

"use client";
 
import React, { useState, useEffect, Suspense, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr"; // <-- (MOD) Import 'useSWRConfig'
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig"; // <-- (NEW) Import auth
import dayjs from "dayjs";
import {
  AdvancedFilterBar,
  LoadingSpinner,
  ErrorDisplay,
  fetcher,
  ViewSaleModal,
  NewReturnModal,
  CreateInvoiceModal,
  SalesDashboard,
  SalesDataContainer,
  SalesReturns,
  DeleteConfirmModal // <-- (NEW) Import DeleteConfirmModal
} from "./components"; 
import { generateInvoicePdf } from "@/lib/pdfService"; 

// =============================================================================
// 📝 Main Sales Page Component
// =============================================================================
function SalesPage() {
  const { user, loading: authLoading, subscription } = useAuth();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "dashboard";
  const { mutate } = useSWRConfig(); // <-- (NEW) Get mutate function

  // --- (NEW) Get user role ---
  const userRole = (user as any)?.role || 'user';

  // Global filters
  const [filters, setFilters] = useState({
    currency: "USD",
    startDate: dayjs().startOf("month").format("YYYY-MM-DD"),
    endDate: dayjs().endOf("month").format("YYYY-MM-DD"),
    searchQuery: "",
    status: "",
    paymentMethod: "",
    salespersonId: "",
    tag: "",
    amountMin: "",
    amountMax: "",
    customerId: "",
    productId: "",
    branch: "",
  });

  // --- Modal State ---
  const [viewingSale, setViewingSale] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [saleToReturn, setSaleToReturn] = useState<any | null>(null);

  // --- (NEW) Delete Modal State ---
  const [saleToDelete, setSaleToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  // --- SWR Data Fetching (Only for 'returns' view) ---
  const returnsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("view", "returns");
    return params.toString();
  }, [filters]);

  const returnsApiUrl = `/api/returns?${returnsQueryString}`;
  const {
    data: returnsApiData,
    error: returnsApiError,
    isLoading: returnsApiIsLoading,
    mutate: mutateReturns,
  } = useSWR(
    !authLoading && view === 'returns' ? returnsApiUrl : null,
    fetcher
  );
  
  
  // --- Handlers ---
  
  const handleApplyFilters = (newFilters: any) => {
    setFilters(newFilters);
  };
  
  const handleViewSale = (sale: any) => {
    setViewingSale(sale);
    setIsViewModalOpen(true);
  };

  const handlePrintSale = (sale: any) => {
    const storeInfo = {
      name: subscription?.name || subscription?.storeName || "Your Store",
      address: subscription?.address || subscription?.storeAddress || "Your Address",
      phone: subscription?.phone || subscription?.storePhone || "Your Phone"
    };
    generateInvoicePdf(sale, storeInfo); 
  };
  
  // Handlers for the "New Return" modal
  const handleOpenReturnModal = (sale: any | null = null) => {
    setSaleToReturn(sale); 
    setIsNewReturnModalOpen(true);
  };

  const handleCloseReturnModal = () => {
    setIsNewReturnModalOpen(false);
    setSaleToReturn(null); 
  };

  // --- (NEW) Delete Modal Handlers ---
  const handleOpenDeleteModal = (sale: any) => {
    setSaleToDelete(sale);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return; // Don't close while deleting
    setSaleToDelete(null);
    setIsDeleteModalOpen(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("User is not authenticated.");
      const token = await firebaseUser.getIdToken();

      const res = await fetch(`/api/sales/${saleToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete sale.");
      }

      // Success! Close modal and refresh all data
      handleCloseDeleteModal();
      // Mutate all SWR keys that start with '/api/sales' or '/api/returns'
      mutate((key) => typeof key === 'string' && key.startsWith('/api/sales'), undefined, { revalidate: true });
      mutate((key) => typeof key === 'string' && key.startsWith('/api/returns'), undefined, { revalidate: true });

    } catch (err: any) {
      console.error("Delete Error:", err);
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <>
      <AdvancedFilterBar
        initialFilters={filters}
        onApplyFilters={handleApplyFilters}
      />

      {authLoading && <LoadingSpinner />}
      
      {deleteError && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Error: {deleteError}
          </p>
        </div>
      )}

      {view === 'dashboard' && (
        <SalesDashboard
          filters={filters}
          onViewSale={handleViewSale}
          onPrintSale={handlePrintSale}
          onRefund={handleOpenReturnModal}
          userRole={userRole} // <-- (NEW) Pass role
          onDeleteSale={handleOpenDeleteModal} // <-- (NEW) Pass handler
        />
      )}
      
      {view === 'history' && (
        <SalesDataContainer
          filters={filters}
          view="history"
          onViewSale={handleViewSale}
          onPrintSale={handlePrintSale}
          onRefund={handleOpenReturnModal}
          userRole={userRole} // <-- (NEW) Pass role
          onDeleteSale={handleOpenDeleteModal} // <-- (NEW) Pass handler
        />
      )}
      
      {view === 'returns' && (
        <>
          {returnsApiError && <ErrorDisplay error={returnsApiError} />}
          <SalesReturns
            data={returnsApiData}
            isLoading={returnsApiIsLoading}
            currency={filters.currency}
            onPageChange={() => {}} // Pagination is now handled in container
            onNewReturn={() => handleOpenReturnModal(null)} 
            onViewReturn={(ret: any) => console.log("View Return:", ret)} 
          />
        </>
      )}
      
      {view === 'invoices' && (
         <SalesDataContainer
          filters={filters}
          view="invoices"
          onViewSale={handleViewSale}
          onPrintSale={handlePrintSale}
          onRefund={handleOpenReturnModal}
          onCreateInvoice={() => setIsCreateInvoiceModalOpen(true)}
          userRole={userRole} // <-- (NEW) Pass role
          onDeleteSale={handleOpenDeleteModal} // <-- (NEW) Pass handler
        />
      )}
      
      {/* Modals */}
      <ViewSaleModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        sale={viewingSale}
        onPrint={handlePrintSale}
      />
      
      <NewReturnModal
        isOpen={isNewReturnModalOpen}
        onClose={handleCloseReturnModal}
        onSuccess={mutateReturns} 
        saleToReturn={saleToReturn} 
      />
      
      <CreateInvoiceModal
        isOpen={isCreateInvoiceModalOpen}
        onClose={() => setIsCreateInvoiceModalOpen(false)}
        onPrint={handlePrintSale}
        globalFilters={filters}
      />

      {/* --- (NEW) Delete Modal --- */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        saleInvoiceId={saleToDelete?.invoiceId || saleToDelete?.id || ''}
      />
    </>
  );
}


// =============================================================================
// 📦 Suspense Wrapper
// =============================================================================
export default function SalesPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SalesPage />
    </Suspense>
  );
}