// File: lib/schemas.ts
// Description: REVERTED to the simpler, original data structure.
// --- UPDATES ---
// - Reverted to 'primaryCurrency' on the sale.
// - 'SaleItemSchema' no longer has its own 'currency'.
// - 'refundAmount' is now a simple number (which also fixes your VS Code error).

import { z } from "zod";

// --- Base Schemas ---
const PaymentMethodSchema = z.object({
  method: z.string().min(1, "Payment method is required"),
  amount: z.number().positive("Payment amount must be positive"),
  currency: z.string().min(2, "Currency is required"), // Payments can still be multi-currency
});

const SaleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().min(0, "Price cannot be negative"),
  costPriceUsd: z.number().min(0).optional(),
  // REMOVED: currency: z.string().min(2),
});

// --- API Schemas ---

// POST /api/sales?action=new_sale
export const NewSaleSchema = z.object({
  // Customer info
  customerId: z.string().min(1),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().optional(),
  customerWhatsapp: z.string().optional(),
  customerNotes: z.string().optional(),
  saveToContacts: z.boolean().default(false),

  // Sale info
  primaryCurrency: z.string().min(2, "Primary currency is required"), // ADDED BACK
  items: z.array(SaleItemSchema).min(1, "At least one item is required"),
  paymentMethods: z.array(PaymentMethodSchema).min(0),
});

// POST /api/sales?action=new_return
export const NewReturnSchema = z.object({
  originalSaleId: z.string().min(1, "Original Sale ID is required"),
  originalInvoiceId: z.string().min(1, "Original Invoice ID is required"),
  returnType: z.enum(["refund", "change"]),
  itemsToReturn: z.array(z.object({
      productId: z.string().min(1),
      productName: z.string(),
      quantity: z.number().positive(),
      pricePerUnit: z.number().min(0),
      // REMOVED: currency: z.string().min(2),
    })
  ).min(1, "At least one item must be returned"),
  // --- SOLUTION: Reverted to simple number, fixing the z.record() error ---
  refundAmount: z.number().min(0).default(0),
  reason: z.string().optional(),
});

// PUT /api/sales/[saleId]
export const UpdateSaleSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(["paid", "partial", "unpaid"]).optional(),
});