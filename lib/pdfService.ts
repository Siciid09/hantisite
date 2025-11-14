// File: lib/pdfService.ts

import * as Templates from '@/app/components/pdf/AllTemplates';

// Define the shape of the settings/subscription object
interface PdfSettings {
  planId?: string;
  invoiceTemplate?: string;
  //
}

// Define the types of reports we can generate
export type ReportType = 
  | 'invoice' 
  | 'product_report' 
  | 'payroll' 
  | 'purchase' 
  | 'refund' 
  | 'financial' 
  | 'hr' 
  | 'main_business' 
  | 'debts_credits' 
  | 'customer_supplier'
  | 'inventory_summary' // <-- (NEW) Add this new report type
  | 'sales_summary'; // <-- (NEW) Added this new report type

// --- Master Template Map ---
const templateMap = {
  'invoice': {
    default: Templates.InvoiceDefault,
    modern: Templates.InvoiceModern,
    premium: Templates.InvoicePremium
  },
  // --- (NEW) Added this entry for the Sales Report page ---
  'sales_summary': {
    default: Templates.SalesSummaryReportDefault,
    modern: Templates.SalesSummaryReportDefault, // You can create Modern/Premium versions later
    premium: Templates.SalesSummaryReportDefault,
  },
  // --- (NEW) Add this new entry ---
  'inventory_summary': {
    default: Templates.InventorySummaryReportDefault,
    modern: Templates.InventorySummaryReportDefault, // You can make Modern/Premium later
    premium: Templates.InventorySummaryReportDefault,
  },
  // --- End of new entry ---
  'product_report': {
    default: Templates.ProductReportDefault,
    modern: Templates.ProductReportModern,
    premium: Templates.ProductReportPremium
  },
  'payroll': {
    default: Templates.PayrollDefault,
    modern: Templates.PayrollModern,
    premium: Templates.PayrollPremium
  },
  'purchase': {
    default: Templates.PurchaseDefault,
    modern: Templates.PurchaseModern,
    premium: Templates.PurchasePremium
  },
  'refund': {
    default: Templates.RefundDefault,
    modern: Templates.RefundModern,
    premium: Templates.RefundPremium
  },
  'financial': {
    default: Templates.FinancialDefault,
    modern: Templates.FinancialModern,
    premium: Templates.FinancialPremium
  },
  'hr': {
    default: Templates.HrDefault,
    modern: Templates.HrModern,
    premium: Templates.HrPremium
  },
  'main_business': {
    default: Templates.MainBusinessDefault,
    modern: Templates.MainBusinessModern,
    premium: Templates.MainBusinessPremium
  },
  'debts_credits': {
    default: Templates.DebtsCreditsDefault,
    modern: Templates.DebtsCreditsModern,
    premium: Templates.DebtsCreditsPremium
  },
  'purchase_report': {
    default: Templates.PurchaseReportDefault,
    modern: Templates.PurchaseReportModern,
    premium: Templates.PurchaseReportPremium
  },
  'customer_supplier': {
    default: Templates.CustomerSupplierDefault,
    modern: Templates.CustomerSupplierModern,
    premium: Templates.CustomerSupplierPremium
  }
};

/**
 * The "Smart Generator" service.
 * This function checks the user's plan and settings
 * and returns the correct React component for the PDF.
 */
export const getTemplateComponent = (reportType: ReportType, settings: PdfSettings) => {
  // 1. Get the set of 3 templates
  const templateSet = templateMap[reportType];
  if (!templateSet) {
    console.error(`No templates found for type: ${reportType}`);
    return templateMap['invoice'].default; // Fallback
  }

  // 2. Get user's plan
  // and chosen template
  const planId = settings?.planId?.toLowerCase() || 'trial';
  const chosenTemplate = settings?.invoiceTemplate || 'default';

  // 3. Check permissions
  // 'business' or higher can use 'premium'
  if (chosenTemplate === 'premium') {
    if (['business', 'pro', 'unlimited', 'lifetime'].includes(planId)) {
      return templateSet.premium;
    }
  }
  
  // 'standard' or higher can use 'modern'
  if (chosenTemplate === 'modern') {
    if (['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId)) {
      return templateSet.modern;
    }
  }

  // 4. Fallback to default
  return templateSet.default;
};