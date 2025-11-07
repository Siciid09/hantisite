// File: app/api/returns/route.ts
//
// --- FINAL VERSION (FIXED) ---
// 1. (FIX) 'POST' function: Waxaa la saxay 'if' statement-ka si uu u
//    ogolaado 'refundAmount' oo ah 0.
// 2. (FIX) 'GET' function: Waa laga saaray '.where("refundCurrency", "==", currency)'
//    si ay miiska ugu soo baxaan dhammaan returns-ka, iyadoon loo eegin
//    filter-ka lacagta (currency filter).
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";
import dayjs from "dayjs";

// --- Helper: checkAuth (Ensures security and role-awareness) ---
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
// 🚀 POST - Create New Return
// =============================================================================
// =============================================================================
// 🚀 POST - Create New Return
// =============================================================================
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. Authentication & Authorization (Only Admin/Manager can create a return)
    const { uid, storeId, userName } = await checkAuth(request, ['admin', 'manager']);

    // 2. Parse and Validate Body
    const body = await request.json();
    const { 
      originalSaleId, 
      itemsToReturn, // Expected: [{ productId, productName, quantity, pricePerUnit }]
      reason,
      refundAmount, 
      refundCurrency, 
      refundMethod,
      status = 'processed' // Default to 'processed'
    } = body;

    // --- FIX: Validation logic updated to allow '0' ---
    // 1. Hubi in refundAmount uu yahay nambar sax ah (ma aha "abc" ama negative)
    if (typeof refundAmount !== 'number' || isNaN(refundAmount) || refundAmount < 0) {
        return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 });
    }

    // 2. Hubi inta kale ee muhiimka ah
    if (!originalSaleId || !itemsToReturn || itemsToReturn.length === 0 || !refundCurrency || !refundMethod) {
      return NextResponse.json({ error: "Invalid data. Missing required fields." }, { status: 400 });
    }

    // 3. Hadda si ammaan ah u isticmaal
    const numericRefundAmount = refundAmount; 
    // --- DHAMMAADKA HAGAAJINTA ---
    
    // 3. Prepare new return document
    const returnRef = firestoreAdmin.collection("returns").doc();
    const createdAt = Timestamp.now();
    
    const newReturnData = {
      id: returnRef.id,
      storeId,
      originalSaleId,
      items: itemsToReturn, // Store the returned items
      reason,
      refundAmount: numericRefundAmount,
      refundCurrency,
      refundMethod,
      status, // e.g., 'pending', 'processed', 'rejected'
      createdAt,
      processedByUserId: uid,
      processedByUserName: userName,
    };

    // 4. Start Firestore Transaction
    await firestoreAdmin.runTransaction(async (transaction) => {
      
      // --- (FIX) STEP 1: AKHRISKA MARKA HORE ---
      // Waa qasab in akhriska la hormariyo ka hor qorista
      const saleRef = firestoreAdmin.collection("sales").doc(originalSaleId);
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists) {
        throw new Error("Original sale not found.");
      }
      // (Waxaad halkan ku dari kartaa akhriska alaabta (products) haddii aad u baahato)
      
      // --- (FIX) STEP 2: QORISTA HADDII LA BILAABO ---

      // a. Set the new return document
      transaction.set(returnRef, newReturnData);
      
      // b. Restock items
      for (const item of itemsToReturn) {
        if (item.productId && !item.productId.startsWith("manual_")) {
          const productRef = firestoreAdmin.collection("products").doc(item.productId);
          // (Si loo sii ammaan yareeyo, waxaad halkan ku 'get'-garan kartaa product-ga
          // laakiin 'increment' kaligiis waa 'write' wuuna shaqaynayaa)
          transaction.update(productRef, {
            quantity: FieldValue.increment(Number(item.quantity) || 0),
          });
        }
      }

      // c. Create a corresponding expense document to log the refund
      const expenseRef = firestoreAdmin.collection("expenses").doc();
      transaction.set(expenseRef, {
        amount: numericRefundAmount,
        currency: refundCurrency,
        description: `Refund for Sale ${originalSaleId}. Reason: ${reason}`,
        category: "Sales Refund",
        createdAt: createdAt,
        storeId: storeId,
        userId: uid,
        paymentMethod: refundMethod,
        relatedReturnId: returnRef.id,
        relatedSaleId: originalSaleId,
      });
      
      // d. Update the original sale (Hadda waa qoris kaliya)
      transaction.update(saleRef, {
        status: 'refunded', // Or 'partial_refund'
        hasReturn: true,
        relatedReturnIds: FieldValue.arrayUnion(returnRef.id)
      });
    });

    return NextResponse.json(
      { success: true, returnId: returnRef.id },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("[Returns API POST] Error:", error.stack || error.message);
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: `Failed to process return. ${error.message}` },
      { status: 500 }
    );
  }
}

// =============================================================================
// 📊 GET - Fetch Returns Data (for Returns Dashboard)
// =============================================================================
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. Authentication (All users can view returns)
    const { storeId } = await checkAuth(request, ['admin', 'manager', 'user']);

    // 2. Get Query Params
    const { searchParams } = new URL(request.url);
    // const currency = searchParams.get("currency") || "USD"; // <-- WAA LAGA SAARAY
    const startDate = dayjs(searchParams.get("startDate") || dayjs().startOf("month")).startOf("day").toDate();
    const endDate = dayjs(searchParams.get("endDate") || dayjs().endOf("month")).endOf("day").toDate();
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;

    // 3. Build Base Query
    let baseQuery: Query = firestoreAdmin
      .collection("returns")
      .where("storeId", "==", storeId)
      // --- FIX: Laga saaray line-kii shaandheynayay lacagta ---
      // .where("refundCurrency", "==", currency) 
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
    // (NEW) KPIs waa in ay lacagaha kala saaraan
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
      // (NEW) U dir object ahaan
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
    if (error.message.includes("requires an index")) {
         return NextResponse.json(
           { error: `Query failed. You need to create a composite index in Firestore. ${error.message}` },
           { status: 500 }
         );
    }
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