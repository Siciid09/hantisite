// File: app/(main)/sales/page.tsx
//
// --- FINAL VERSION ---
// - Manages global filters and modal states.
// - Imports all components, including the self-fetching 'SalesDashboard'
//   and 'SalesDataContainer' from components.tsx.
// -----------------------------------------------------------------------------

"use client";
 
import React, { useState, useEffect, Suspense, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
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
  SalesReturns // <-- This component is now imported
} from "./components"; 
import { generateInvoicePdf } from "@/lib/pdfService"; 

// =============================================================================
// 📝 Main Sales Page Component
// =============================================================================
// =============================================================================
// 📝 Main Sales Page Component
// =============================================================================
function SalesPage() {
  const { user, loading: authLoading, subscription } = useAuth(); // <-- FIX: Add `subscription` here
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "dashboard";

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
  // --- (FIX) Get store info from `subscription` object ---
  const storeInfo = {
    // Check your Firestore 'stores' collection for the exact field names
    name: PushSubscription?.name || subscription?.storeName || "Your Store",
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
      
      {view === 'dashboard' && (
        <SalesDashboard
          filters={filters}
          onViewSale={handleViewSale}
          onPrintSale={handlePrintSale}
          onRefund={handleOpenReturnModal}
        />
      )}
      
      {view === 'history' && (
        <SalesDataContainer
          filters={filters}
          view="history"
          onViewSale={handleViewSale}
          onPrintSale={handlePrintSale}
          onRefund={handleOpenReturnModal}
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