// File: app/api/customers/[id]/route.ts
//
// --- FINAL VERSION (REFACTORED) ---
// 1. (FIX) KPI calculation is REMOVED.
// 2. (FIX) 'totalSpent' and 'totalOwed' are now read *directly* from the
//    'customerData' document (e.g., customerData.totalSpent.USD).
// 3. (FIX) This makes the API load instantly.
// 4. (NOTE) It still fetches sales and debits history for the tables.
// 5. (FIX) Updated queries to match the new 'sales' and 'debits' structure.
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
  context: { params: { id: string } } // <-- FIX 1: Changed from {params} to context
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }
  
  try {
    const { storeId } = await checkAuth(request);
    const customerId = context.params.id; // <-- FIX 2: Changed from params.id
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
    
    const debitsHistory = debitsSnap.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            // (FIX) Use invoiceId to create a better reason
            reason: `Debt for ${data.invoiceId}` || "Debt",
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            amountDue: data.amount, // Use the correct field 'amount'
            status: data.status || (data.isPaid ? 'paid' : 'unpaid'),
            currency: data.currency
        };
    });

    // 4. (FIX) Get KPIs DIRECTLY from customer doc
    // Note: We sum up all currencies for a simple display.
    // Tani waa meesha aan ka akhrineyno xogta horay loo xisaabiyay
    const kpis = {
        totalSpent: customerData?.totalSpent || {}, // u dir object-ga oo dhan (e.g., {USD: 100, BIRR: 5000})
        totalOwed: customerData?.totalOwed || {}, // u dir object-ga oo dhan
        totalSales: salesHistory.length, // This is still a real-time count
        outstandingDebts: debitsHistory.filter(d => d.status !== 'paid' && d.status !== 'voided').length
    };
    
    // 5. Return all data
    return NextResponse.json({
      customer: {
        id: customerDoc.id,
        ...customerData,
        createdAt: (customerData?.createdAt as Timestamp)?.toDate().toISOString(),
      },
      kpis, // Send the pre-calculated KPIs
      salesHistory,
      debitsHistory
    });

  } catch (error: any) {
    console.error("[Customer[id] API GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}