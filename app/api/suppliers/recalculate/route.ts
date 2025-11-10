// File: app/api/suppliers/recalculate/route.ts
//
// --- (GEMINI FIX: ONE-TIME SCRIPT TO FIX ALL $0.00) ---
// This is a new, special API route.
// When you call it, it will loop through ALL your purchases
// and recalculate the 'totalOwed' and 'totalSpent' for
// ALL your suppliers, fixing the historical data.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { DocumentData } from "firebase-admin/firestore";

// Helper function to get the user's storeId
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
  
  return { uid, storeId };
}

function getNumericField(data: DocumentData | undefined, field: string): number {
  const value = data?.[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

// -----------------------------------------------------------------------------
// 🚀 POST - Recalculate All Supplier Totals
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);

    // --- Step 1: Create a map to hold the new stats ---
    const supplierStats = new Map<string, { totalOwed: number, totalSpent: number }>();

    // --- Step 2: Read ALL purchases for the store ---
    // Note: For very large stores, this should be paginated,
    // but for this one-time fix, a full read is acceptable.
    const purchasesSnapshot = await firestoreAdmin
      .collection("purchases")
      .where("storeId", "==", storeId)
      .get();
      
    console.log(`[Recalculate] Found ${purchasesSnapshot.size} purchases to process.`);

    // --- Step 3: Loop purchases and calculate stats ---
    purchasesSnapshot.forEach(doc => {
      const purchase = doc.data();
      const supplierId = purchase.supplierId;

      if (!supplierId) return; // Skip if purchase has no supplier

      // Get or initialize stats for this supplier
      if (!supplierStats.has(supplierId)) {
        supplierStats.set(supplierId, { totalOwed: 0, totalSpent: 0 });
      }
      const stats = supplierStats.get(supplierId)!;

      // Add this purchase's amounts
      stats.totalOwed += getNumericField(purchase, "remainingAmount");
      stats.totalSpent += getNumericField(purchase, "paidAmount");
    });
    
    console.log(`[Recalculate] Calculated stats for ${supplierStats.size} suppliers.`);

    // --- Step 4: Get ALL suppliers and update them in a batch ---
    const suppliersSnapshot = await firestoreAdmin
      .collection("suppliers")
      .where("storeId", "==", storeId)
      .get();
      
    const batch = firestoreAdmin.batch();

    suppliersSnapshot.forEach(doc => {
      const supplierRef = doc.ref;
      const supplierId = doc.id;
      
      // Get the *newly calculated* stats from our map
      const newStats = supplierStats.get(supplierId);
      
      if (newStats) {
        // If we have new stats, update the supplier
        batch.update(supplierRef, {
          totalOwed: newStats.totalOwed,
          totalSpent: newStats.totalSpent
        });
      } else {
        // If supplier had no purchases, reset their stats to 0
        batch.update(supplierRef, {
          totalOwed: 0,
          totalSpent: 0
        });
      }
    });

    // --- Step 5: Commit the batch ---
    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Recalculation complete. ${suppliersSnapshot.size} suppliers updated.` 
    }, { status: 200 });

  } catch (error: any) {
    console.error("[Suppliers Recalculate API] Error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to recalculate totals. ${error.message}` }, { status: 500 });
  }
}