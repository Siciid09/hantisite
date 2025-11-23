// File: lib/pdfService.ts

import * as Templates from '@/app/components/pdf/AllTemplates';

// --- Interface Definition ---
// FIX: We added 'subscriptionType' because that is what your database uses.
interface PdfSettings {
  planId?: string;
  subscriptionType?: string; 
  invoiceTemplate?: string;
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
  | 'inventory_summary'
  | 'sales_summary';

// --- Master Template Map ---
const templateMap = {
  'invoice': {
    default: Templates.InvoiceDefault,
    modern: Templates.InvoiceModern,
    premium: Templates.InvoicePremium
  },
  'sales_summary': {
    default: Templates.SalesSummaryReportDefault,
    modern: Templates.SalesSummaryReportDefault, 
    premium: Templates.SalesSummaryReportDefault,
  },
  'inventory_summary': {
    default: Templates.InventorySummaryReportDefault,
    modern: Templates.InventorySummaryReportDefault,
    premium: Templates.InventorySummaryReportDefault,
  },
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
  // 1. Get the set of 3 templates for this report type
  const templateSet = templateMap[reportType];
  
  // Safety check: if type doesn't exist, fallback to invoice default to prevent crash
  if (!templateSet) {
    console.error(`No templates found for type: ${reportType}`);
    return templateMap['invoice'].default; 
  }

  // 2. Get user's plan
  // FIX: This line is the magic. It checks 'planId' OR 'subscriptionType'
  // If both are missing, it defaults to 'trial'
  const rawPlan = settings?.planId || settings?.subscriptionType || 'trial';
  const planId = rawPlan.toLowerCase();
  
  // Get chosen template (defaults to 'default')
  const chosenTemplate = settings?.invoiceTemplate || 'default';

  // 3. Check permissions

  // Rule: 'business' or higher can use 'premium'
  if (chosenTemplate === 'premium') {
    if (['business', 'pro', 'unlimited', 'lifetime'].includes(planId)) {
      return templateSet.premium;
    }
  }
  
  // Rule: 'standard' or higher can use 'modern'
  if (chosenTemplate === 'modern') {
    if (['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId)) {
      return templateSet.modern;
    }
  }

  // 4. Fallback to default
  // If they selected a template they aren't allowed to use, 
  // or if they selected 'default', we return the default template.
  return templateSet.default;
};