// File: app/api/customers/[id]/route.ts
//
// --- LATEST FIX (500 Error) ---
// 1. (FIX) Reverted `params` to use `Promise` and `await`. The
//    previous change likely caused the 500 Internal Server Error.
// 2. (FIX) Added `?.` to `.toDate()` in sales and debits history
//    to prevent 500 errors if `createdAt` is missing.
// 3. (KEPT) The fix for `debitsHistory` (using `data.reason` and
//    `data.amountDue`) is still included.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// --- Helper: checkAuth ---
async function checkAuth(request: NextRequest) {
  if (!authAdmin) throw new Error("Auth Admin is not initialized.");
  if (!firestoreAdmin) throw new Error("Firestore Admin is not initialized.");

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized.");
  
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  const storeId = userDoc.data()?.storeId;
  if (!storeId) throw new Error("User has no store.");
  
  return { uid, storeId, userName: userDoc.data()?.name || "System User" };
}

// =============================================================================
// 📦 GET - Get a single customer's data hub (FAST)
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // <-- (FIX 1) Reverted to Promise
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);

    // ✅ Await params because Vercel treats it as a Promise
    const { id: customerId } = await params; // <-- (FIX 1) Reverted to await

    const db = firestoreAdmin;


    // 1. Get Customer Details (This now contains our KPIs)
    const customerRef = db.collection("customers").doc(customerId);
    const customerDoc = await customerRef.get();

    if (!customerDoc.exists || customerDoc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }
    const customerData = customerDoc.data();

    // 2. Get Sales History (Still needed for the table)
    const salesQuery = db.collection("sales")
      .where("storeId", "==", storeId)
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(20);

    // 3. Get Debits History (Still needed for the table)
    const debitsQuery = db.collection("debits")
      .where("storeId", "==", storeId)
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(20);

    const [salesSnap, debitsSnap] = await Promise.all([
      salesQuery.get(),
      debitsQuery.get()
    ]);

    const salesHistory = salesSnap.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            invoiceId: data.invoiceId,
            // (FIX 2) Added ?. to prevent 500 error
            createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() || null,
            totalAmount: data.totalAmount,
            status: data.paymentStatus,
            currency: data.invoiceCurrency
        };
    });
    
    // --- (KEPT FIX) ---
    // The fields were wrong. It's `data.reason` and `data.amountDue`.
    const debitsHistory = debitsSnap.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            reason: data.reason || "Debt", // <-- (FIX) Use data.reason
            // (FIX 2) Added ?. to prevent 500 error
            createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() || null,
            amountDue: data.amountDue, // <-- (FIX) Use data.amountDue
            status: data.status || (data.isPaid ? 'paid' : 'unpaid'),
            currency: data.currency
        };
    });
    // --- END FIX ---

    // 4. (FIX) Get KPIs DIRECTLY from customer doc
    const kpis = {
        totalSpent: customerData?.totalSpent || {},
        totalOwed: customerData?.totalOwed || {},
        totalSales: salesHistory.length,
        outstandingDebts: debitsHistory.filter(d => d.status !== 'paid' && d.status !== 'voided').length
    };
    
    // 5. Return all data
    return NextResponse.json({
      customer: {
        id: customerDoc.id,
        ...customerData,
        // (FIX 2) Added ?. to prevent 500 error
        createdAt: (customerData?.createdAt as Timestamp)?.toDate()?.toISOString() || null,
      },
      kpis,
      salesHistory,
      debitsHistory
    });

  } catch (error: any) {
    console.error("[Customer[id] API GET] Error:", error.message, error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}