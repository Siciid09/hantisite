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


// --- Helper: checkAuth ---
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
// 🚀 POST - Create New Return (FIXED: Debt Subtraction + Response Format)
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
    // 1. Authentication
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
    
    // 3. Start Transaction
    const newReturn = await db.runTransaction(async (transaction) => {
      const originalSaleRef = db.collection("sales").doc(originalSaleId);

      // --- READ PHASE ---
      const saleDoc = await transaction.get(originalSaleRef);
      if (!saleDoc.exists || saleDoc.data()?.storeId !== storeId) {
        throw new Error("Original sale not found or does not belong to your store.");
      }
      const saleData = saleDoc.data() as any;
      
      if (saleData.status === 'refunded' || saleData.status === 'voided') {
         throw new Error("This sale has already been refunded or voided.");
      }
      if (saleData.paymentStatus === 'unpaid') {
         throw new Error("Cannot issue a refund for an 'unpaid' sale.");
      }
      if (saleData.totalPaid < refundAmount) {
         throw new Error(`Refund amount (${refundAmount}) exceeds the total amount paid.`);
      }

      // Find outstanding Debt
      const debitQuery = db.collection("debits")
          .where("relatedSaleId", "==", originalSaleId)
          .where("isPaid", "==", false);
      const debitSnapshot = await transaction.get(debitQuery);
      
      // Find Product Refs
      const productRefsToFetch = [];
      for (const item of itemsToReturn) {
         if (item.productId && !item.productId.startsWith("manual_")) {
           productRefsToFetch.push({
             ref: db.collection("products").doc(item.productId),
             item: item
           });
         }
      }
      
      // --- WRITE PHASE ---
      const createdAt = Timestamp.now();

      // a. Update Original Sale
      const newTotalPaid = saleData.totalPaid - refundAmount;
      const newDebtAmount = saleData.totalAmount - newTotalPaid;
      const newReturnRef = db.collection("returns").doc();

      transaction.update(originalSaleRef, {
        totalPaid: newTotalPaid,
        debtAmount: newDebtAmount,
        paymentStatus: 'refunded',
        status: 'refunded',
        lastUpdated: createdAt,
        relatedReturnIds: FieldValue.arrayUnion(newReturnRef.id),
      });

      // b. Restock items
      for (const { ref, item } of productRefsToFetch) {
        transaction.update(ref, {
          quantity: FieldValue.increment(item.quantity || 0),
        });
      }
      
      // c. Create Return Document
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

      // d. Create Expense (if actual cash was given back)
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
      
      // e. Update Debt (FIXED: Subtract debt, don't add)
      if (debitSnapshot.docs.length > 0) {
        const debitDoc = debitSnapshot.docs[0];
        const currentData = debitDoc.data();
        
        // Logic: Returning an item reduces the total sale value, which should reduce debt.
        // We reduce the debt by the refund value (assuming the refund value is applied to the debt).
        const currentDue = currentData.amountDue || 0;
        const newDue = currentDue - refundAmount;
        
        transaction.update(debitDoc.ref, {
          amountDue: FieldValue.increment(-refundAmount), // SUBTRACT
          status: newDue <= 0.01 ? 'paid' : 'partial', // Update status based on result
          isPaid: newDue <= 0.01,
          lastUpdated: createdAt,
        });
      }
      
      return newReturnData;
    }); 

    // FIX: Key name must be 'data' to match frontend (savedReturn.data)
    return NextResponse.json({ success: true, data: newReturn }, { status: 201 });

  } catch (error: any) {
    console.error("[Returns API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 📊 GET - Fetch Returns Data (RESTORED)
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