// File: app/api/customers/[id]/route.ts
//
// --- LATEST FIX (Data Bug) ---
// 1. (CRITICAL FIX) The `debitsHistory` map now looks for
//    `data.amountDue` (not data.amount) and
//    `data.reason` (not data.invoiceId).
// 2. (FIX) This will fix the "N/A" and "Debt for undefined" errors.
// 3. (KEPT FIX) All timestamps are still converted to ISO strings.
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
  { params }: { params: { id: string } } // <-- This is NOT a Promise, removed await
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);
    const { id: customerId } = params; // <-- Removed await

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
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            totalAmount: data.totalAmount,
            status: data.paymentStatus, // Use the correct field 'paymentStatus'
            currency: data.invoiceCurrency // Use the correct field 'invoiceCurrency'
        };
    });
    
    // --- (CRITICAL FIX) ---
    // The fields were wrong. It's `data.reason` and `data.amountDue`.
    const debitsHistory = debitsSnap.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            reason: data.reason || "Debt", // <-- (FIX 1) Use data.reason
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            amountDue: data.amountDue, // <-- (FIX 2) Use data.amountDue
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
        createdAt: (customerData?.createdAt as Timestamp)?.toDate().toISOString(),
      },
      kpis,
      salesHistory,
      debitsHistory
    });

  } catch (error: any) {
    console.error("[Customer[id] API GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}