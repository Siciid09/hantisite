// File: app/(main)/sales/page.tsx
//
// --- FINAL VERSION (with NEW PDF SYSTEM MERGED) ---
// 1. (REMOVED) Old PDF import.
// 2. (NEW) Added imports for @react-pdf/renderer, lucide, and the new pdfService.
// 3. (NEW) Added state for 'saleToPrint' and 'PdfTemplate'.
// 4. (NEW) Updated useAuth to get 'subscription' info.
// 5. (FIX) 'handlePrintSale' is now rewritten to open the new PDF modal.
// 6. (NEW) Added the PDF Download Modal JSX.
// -----------------------------------------------------------------------------

"use client";

import React, { useState, useEffect, Suspense, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext"; // Corrected path
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
  TransitionedModal // <-- (NEW) Added TransitionedModal
} from "./components";
import { Dialog } from "@headlessui/react";
import { Download, Loader2, FileText } from "lucide-react"; // <-- (NEW) Imports for PDF Modal

// --- (NEW) Correct imports for the NEW High-Quality PDF system ---
import { PDFDownloadLink } from "@react-pdf/renderer";
import { getTemplateComponent, ReportType } from "@/lib/pdfService";
// --- (REMOVED) Old PDF import ---
// import { generateInvoicePdf } from "@/lib/pdfService"; 

// =============================================================================
// 📝 Main Sales Page Component
// =============================================================================
function SalesPage() {
  // --- (NEW) Get subscription from Auth ---
  const { user, loading: authLoading, subscription } = useAuth();
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

  // --- (NEW) PDF Modal State ---
  const [saleToPrint, setSaleToPrint] = useState<any | null>(null);
  const [PdfTemplate, setPdfTemplate] = useState<React.ElementType | null>(null);

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

  // --- (FIX) Replaced with new PDF Modal logic ---
  const handlePrintSale = (sale: any) => {
    const storeInfo = {
      name: subscription?.storeName || "My Store",
      address: subscription?.storeAddress || "123 Main St",
      phone: subscription?.storePhone || "555-1234",
      logoUrl: subscription?.logoUrl, 
      planId: subscription?.planId,   
    };
    
    const TemplateComponent = getTemplateComponent('invoice' as ReportType, subscription);
    
    setPdfTemplate(() => TemplateComponent); 
    setSaleToPrint({ data: sale, store: storeInfo }); 
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
      
      {/* --- Standard Modals --- */}
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

      {/* --- (NEW) PDF Download Modal --- */}
      {/* This modal opens when handlePrintSale is called */}
      {saleToPrint && PdfTemplate && (
        <TransitionedModal isOpen={true} onClose={() => setSaleToPrint(null)} size="md">
          <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
            <FileText className="h-6 w-6 text-blue-500 inline-block mr-2" />
            PDF Ready for Download
          </Dialog.Title>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your invoice ({saleToPrint.data.invoiceId}) is ready.
            </p>
            
            {/* This component from @react-pdf/renderer generates the PDF */}
            <PDFDownloadLink
              document={React.createElement(PdfTemplate, { data: saleToPrint.data, store: saleToPrint.store })}
              fileName={`${saleToPrint.data.invoiceId || 'invoice'}.pdf`}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {({ loading }) => 
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Now
                  </>
                )
              }
            </PDFDownloadLink>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setSaleToPrint(null)}
            >
              Close
            </button>
          </div>
        </TransitionedModal>
      )}
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