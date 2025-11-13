// File: app/api/products/[id]/route.ts
//
// --- LATEST UPDATE (Product History Bug) ---
// 1. (FIX) Added 'role' check to 'checkAuth' function.
// 2. (CRITICAL FIX) Replaced the broken `array-contains` query
//    with a query on the new `productIds` field. This will
//    now correctly find the sales history for this product.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// --- Helper: checkAuth (UPDATED) ---
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

  // --- THIS IS THE FIX ---
  ///halkan roles
  const userRole = userDoc.data()?.role;
  if (userRole !== 'admin') {
    // You can modify this check later to include other roles
    // e.g., if (!['admin', 'manager'].includes(userRole)) { ... }
    throw new Error("Access denied. Admin permissions required.");
  }
  // --- END FIX ---
  
  return { uid, storeId, userName: userDoc.data()?.name || "System User", userRole };
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
    // --- (CRITICAL FIX) ---
    // Changed query from `items` to `productIds`
    const salesQuery = db.collection("sales")
      .where("storeId", "==", storeId)
      .where("productIds", "array-contains", productId) // <-- THIS IS THE FIX
      .orderBy("createdAt", "desc")
      .limit(20);
    // --- (END FIX) ---
      
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
            if (sale.invoiceCurrency === "USD") {
                totalRevenue += itemRevenue;
            }
        }
        
        return { 
            id: doc.id,
            invoiceId: sale.invoiceId,
            createdAt: (sale.createdAt as Timestamp).toDate().toISOString(),
            quantitySold: saleItem?.quantity || 0, // Added safe navigation
            salePrice: saleItem?.pricePerUnit || 0, // Added safe navigation
            currency: sale.invoiceCurrency
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
    
    // Handle auth errors
    if (error.message.includes("Access denied")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    // Handle query errors
    if (error.message.includes("array-contains")) {
       return NextResponse.json(
           { error: `Query failed. You may need to create a composite index in Firestore. ${error.message}` },
           { status: 500 }
         );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}