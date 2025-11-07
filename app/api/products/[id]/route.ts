// File: app/api/products/[id]/route.ts
// Description: NEW API route to get all data for a single product "hub" page.
//
// --- FEATURES ---
// 1. (GET) Fetches the product's main document.
// 2. (GET) Fetches its recent sales history by querying the 'sales' collection.
// 3. (GET) Fetches its stock history from the 'inventory_adjustments' collection.
// 4. (GET) Calculates KPIs like total units sold and total revenue.
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
// 📦 GET - Get a single product's data hub
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // <-- FIX 1: Next.js 16 fix
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }
  
  let productDoc: any; // <-- FIX 2: Declare productDoc here

  try {
    const { storeId } = await checkAuth(request);
    const { id: productId } = await params; // <-- FIX 1: Next.js 16 fix
    const db = firestoreAdmin;

    // 1. Get Product Details
    const productRef = db.collection("products").doc(productId);
    productDoc = await productRef.get(); // <-- FIX 3: Assign value (no 'const')

    if (!productDoc.exists || productDoc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const productData = productDoc.data();

    // 2. Get Sales History (query 'sales' collection)
    const salesQuery = db.collection("sales")
      .where("storeId", "==", storeId)
      .where("items", "array-contains", { productId: productId }) // This is a simple query
      .orderBy("createdAt", "desc")
      .limit(20);
      
    // 3. Get Stock Adjustment History
    const adjustmentsQuery = db.collection("inventory_adjustments")
      .where("storeId", "==", storeId)
      .where("productId", "==", productId)
      .orderBy("timestamp", "desc")
      .limit(20);

    const [salesSnap, adjustmentsSnap] = await Promise.all([
      salesQuery.get(),
      adjustmentsQuery.get()
    ]);

    // Process sales to get history and KPIs
    let totalUnitsSold = 0;
    let totalRevenue = 0; // In USD, based on sale currency
    
    const salesHistory = salesSnap.docs.map(doc => {
        const sale = doc.data();
        const saleItem = sale.items.find((item: any) => item.productId === productId);
        
        if (saleItem) {
            const quantity = saleItem.quantity || 0;
            const price = saleItem.pricePerUnit || 0;
            const itemRevenue = quantity * price;
            
            totalUnitsSold += quantity;
            // This is a simplification; ideally, you'd convert currencies
            if (sale.currency === "USD") {
                totalRevenue += itemRevenue;
            }
        }
        
        return { 
            id: doc.id,
            invoiceId: sale.invoiceId,
            createdAt: (sale.createdAt as Timestamp).toDate().toISOString(),
            quantitySold: saleItem.quantity || 0,
            salePrice: saleItem.pricePerUnit || 0,
            currency: sale.currency
        };
    });
    
    const adjustmentHistory = adjustmentsSnap.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            reason: data.reason,
            timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
            change: data.change,
            newQuantity: data.newQuantity,
            warehouseName: data.warehouseName,
        };
    });

    // 5. Return all data
    return NextResponse.json({
      product: {
        id: productDoc.id,
        ...productData,
        createdAt: (productData?.createdAt as Timestamp)?.toDate().toISOString(),
      },
      kpis: {
        totalUnitsSold,
        totalRevenueUsd: totalRevenue, // Only tracks USD sales for now
        currentStock: productData?.quantity || 0,
      },
      salesHistory,
      adjustmentHistory
    });

  } catch (error: any) {
    console.error("[Product[id] API GET] Error:", error.message);
    // Handle complex queries that might fail
    if (error.message.includes("array-contains")) {
      return NextResponse.json({
         product: productDoc?.data(), // Now visible here
         kpis: { totalUnitsSold: 0, totalRevenueUsd: 0, currentStock: productDoc?.data()?.quantity || 0 },
         salesHistory: [], // Return empty array
         adjustmentHistory: [],
         error: "Failed to query sales history. This query may require a composite index."
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}