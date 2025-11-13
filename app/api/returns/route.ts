// File: app/api/returns/route.ts
//
// --- FINAL VERSION (FIXED) ---
// 1. (FIX) POST route rewritten to use a Firestore Transaction.
// 2. (FIX) Blocks refunds if sale.status is 'refunded' or 'voided'.
// 3. (FIX) Blocks refunds if sale.paymentStatus is 'unpaid'.
// 4. (FIX) Blocks if refundAmount > saleData.totalPaid (server-side check).
// 5. (FIX) Updates original sale:
//    - Deducts refundAmount from sale.totalPaid.
//    - Recalculates sale.debtAmount.
//    - Sets sale.status to 'refunded'.
//    - *** SETS sale.paymentStatus to 'refunded' (This fixes the dashboard KPI). ***
// 6. (FIX) Updates any related open Debit by ADDING the refundAmount to
//    the amountDue (increasing the debt).
// 7. (FIX) Creates an Expense document for the refund cash-out.
// 8. (FIX) Restocks product quantities.
// 9. (FIX) Defines 'newReturnRef' *before* its use in 'relatedReturnIds'.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";
import dayjs from "dayjs";
import { z } from "zod";

// --- Schema for POST validation ---
const ReturnSchema = z.object({
  originalSaleId: z.string().min(1),
  itemsToReturn: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().nonnegative(),
    pricePerUnit: z.number().nonnegative(),
  })).min(1),
  reason: z.string().min(3),
  refundAmount: z.number().nonnegative(),
  refundCurrency: z.string().min(1),
  refundMethod: z.string().min(1),
  status: z.enum(['pending', 'approved', 'processed', 'rejected']).optional(),
});


// --- Helper: checkAuth (Unchanged) ---
async function checkAuth(
  request: NextRequest,
  allowedRoles: ('admin' | 'manager' | 'user')[]
) {
  if (!authAdmin) throw new Error("Auth Admin is not initialized.");
  if (!firestoreAdmin) throw new Error("Firestore Admin is not initialized.");

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: No token provided.");
  
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new Error("Unauthorized: User data not found.");
  }
  
  const userData = userDoc.data();
  const storeId = userData?.storeId;
  const role = userData?.role; 
  if (!storeId) throw new Error("Unauthorized: User has no store.");
  
  if (!role || !allowedRoles.includes(role)) {
    console.warn(`[Auth] User ${uid} (Role: ${role}) tried to access a resource restricted to roles: [${allowedRoles.join(', ')}]`);
    throw new Error("Forbidden: You do not have permission to perform this action.");
  }
  
  return { 
    uid, 
    storeId, 
    role, 
    userName: userData?.name || "System User" 
  };
}


// =============================================================================
// 🚀 POST - Create New Return (REBUILT WITH TRANSACTION)
// =============================================================================
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }
  const db = firestoreAdmin;

  try {
    // 1. Authentication & Authorization (Admin/Manager)
    const { uid, storeId, userName } = await checkAuth(request, ['admin', 'manager']);

    // 2. Parse and Validate Body
    const body = await request.json();
    const validation = ReturnSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid data.", issues: validation.error.issues }, { status: 400 });
    }
    const {
      originalSaleId,
      itemsToReturn,
      reason,
      refundAmount,
      refundCurrency,
      refundMethod,
    } = validation.data;
    
    // 3. Start Firestore Transaction (Ensures Atomicity)
    const newReturn = await db.runTransaction(async (transaction) => {
      const originalSaleRef = db.collection("sales").doc(originalSaleId);

      // --- 4. READ PHASE ---
      // a. Get the original Sale
      const saleDoc = await transaction.get(originalSaleRef);
      if (!saleDoc.exists || saleDoc.data()?.storeId !== storeId) {
        throw new Error("Original sale not found or does not belong to your store.");
      }
      const saleData = saleDoc.data() as any;
      
      // b. CRITICAL CHECKS
      if (saleData.status === 'refunded' || saleData.status === 'voided') {
         throw new Error("This sale has already been refunded or voided. Cannot refund again.");
      }
      if (saleData.paymentStatus === 'unpaid') {
         throw new Error("Cannot issue a refund for an 'unpaid' sale. Please cancel the sale instead.");
      }
      if (saleData.totalPaid < refundAmount) {
         throw new Error(`Refund amount (${refundAmount}) exceeds the total amount paid (${saleData.totalPaid}).`);
      }

      // c. Find outstanding Debit (if any)
      const debitQuery = db.collection("debits")
          .where("relatedSaleId", "==", originalSaleId)
          .where("isPaid", "==", false)
          .where("status", "in", ["unpaid", "partial"]); // Only active debts
      const debitSnapshot = await transaction.get(debitQuery);
      
      // d. Find Product Refs (for restocking)
      const productRefsToFetch = [];
      for (const item of itemsToReturn) {
         if (item.productId && !item.productId.startsWith("manual_")) {
           productRefsToFetch.push({
             ref: db.collection("products").doc(item.productId),
             item: item
           });
         }
      }
      
      // --- 5. WRITE PHASE (The Fixes) ---
      const createdAt = Timestamp.now();

      // a. Calculate new sale totals and status
      const newTotalPaid = saleData.totalPaid - refundAmount;
      const newDebtAmount = saleData.totalAmount - newTotalPaid;
      
      // *** FIX: Define newSaleStatus for use below ***
      const newSaleStatus = 'refunded';
      
      // *** FIX: Define newReturnRef *before* it is referenced ***
      const newReturnRef = db.collection("returns").doc();

      // b. Update the original sale document (Deducting from paid amount)
      transaction.update(originalSaleRef, {
        totalPaid: newTotalPaid,
        debtAmount: newDebtAmount,
        paymentStatus: 'refunded', // <-- *** THE KPI FIX ***
        status: newSaleStatus,     // <-- *** FIXES 'Cannot find name' ERROR ***
        lastUpdated: createdAt,
        relatedReturnIds: FieldValue.arrayUnion(newReturnRef.id), // <-- *** FIXES ReferenceError ***
      });

      // c. Restock the returned items
      for (const { ref, item } of productRefsToFetch) {
        transaction.update(ref, {
          quantity: FieldValue.increment(item.quantity || 0), // Add back
        });
      }
      
      // d. Create the Return Document
      // (Ref was already created above)
      const newReturnData = {
        id: newReturnRef.id,
        storeId,
        uid,
        processedByUserName: userName,
        originalSaleId,
        invoiceId: saleData.invoiceId,
        customerId: saleData.customerId,
        customerName: saleData.customerName,
        itemsReturned: itemsToReturn,
        reason,
        refundAmount,
        refundCurrency,
        refundMethod,
        status: validation.data.status || 'processed',
        createdAt: createdAt,
      };
      transaction.set(newReturnRef, newReturnData);

      // e. Create Expense Document (for the cash paid out)
      if (refundAmount > 0) {
        const expenseRef = db.collection("expenses").doc();
        transaction.set(expenseRef, {
          storeId,
          uid,
          relatedSaleId: originalSaleId,
          relatedReturnId: newReturnRef.id,
          amount: refundAmount,
          currency: refundCurrency,
          method: refundMethod,
          description: `Refund for Sale ${saleData.invoiceId || originalSaleId}`,
          category: "Sales Refund",
          createdAt: createdAt,
        });
      }
      
      // f. Update any outstanding Debit (Increasing the debt)
      if (debitSnapshot.docs.length > 0) {
        const debitDoc = debitSnapshot.docs[0];
        // The refund increases the outstanding debt amount
        transaction.update(debitDoc.ref, {
          amountDue: FieldValue.increment(refundAmount),
          status: 'unpaid', // Force status to unpaid as debt has increased
          lastUpdated: createdAt,
        });
      }
      
      return newReturnData;
    }); // End of Transaction

    // 6. Return the successfully created return record
    return NextResponse.json({ success: true, return: newReturn }, { status: 201 });

  } catch (error: any) {
    console.error("[Returns API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 📊 GET - Fetch Returns Data (Unchanged - Already Correct)
// =============================================================================
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. Authentication
    const { storeId } = await checkAuth(request, ['admin', 'manager', 'user']);

    // 2. Get Query Params
    const { searchParams } = new URL(request.url);
    const startDate = dayjs(searchParams.get("startDate") || dayjs().startOf("month")).startOf("day").toDate();
    const endDate = dayjs(searchParams.get("endDate") || dayjs().endOf("month")).endOf("day").toDate();
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;

    // 3. Build Base Query
    let baseQuery: Query = firestoreAdmin
      .collection("returns")
      .where("storeId", "==", storeId)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    if (status) {
      baseQuery = baseQuery.where("status", "==", status);
    }
    
    // 4. Fetch Paginated Returns List
    const paginatedQuery = baseQuery
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    const listSnapshot = await paginatedQuery.get();
    const returnsList = listSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));
    
    // 5. Get Total Count for Pagination
    const countSnapshot = await baseQuery.count().get();
    const totalMatchingReturns = countSnapshot.data().count;

    const pagination = {
      currentPage: page,
      hasMore: (page * limit) < totalMatchingReturns,
      totalPages: Math.ceil(totalMatchingReturns / limit),
      totalResults: totalMatchingReturns,
    };

    // 6. Fetch Aggregated Data (KPIs for 'returns' view)
    const kpiSnapshot = await baseQuery.get();
    
    let totalReturns = 0;
    let pendingRequests = 0;
    const totalRefundsByCurrency = new Map<string, number>();

    kpiSnapshot.forEach((doc) => {
      const data = doc.data();
      totalReturns++;
      
      const amount = data.refundAmount || 0;
      const currency = data.refundCurrency || "USD";
      totalRefundsByCurrency.set(
        currency,
        (totalRefundsByCurrency.get(currency) || 0) + amount
      );
      
      if (data.status === 'pending') {
        pendingRequests++;
      }
    });

    const kpis = {
      totalReturns,
      totalRefunds: Object.fromEntries(totalRefundsByCurrency),
      pendingRequests,
    };

    // 8. Return all data for returns dashboard
    return NextResponse.json({
      view: "returns",
      kpis,
      returnsList,
      pagination,
    });
  } catch (error: any) {
    console.error("[Returns API GET] Error:", error.stack || error.message);
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: `Failed to load returns data. ${error.message}` },
      { status: 500 }
    );
  }
}