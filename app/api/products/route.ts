// File: app/api/products/route.ts
//
// --- LATEST FIXES ---
// 1. (FIX) Negative Stock Guard: Prevent adjustments/transfers from creating negative stock.
// 2. (FIX) Cache Clearing: Added clearReportsCache() after every stock change.
// 3. (FIX) Cost Consistency: Ensures costPrice is recorded or defaults to 0.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// --- Helper: Clear Reports Cache ---
async function clearReportsCache(storeId: string) {
  try {
    await firestoreAdmin.collection("reports_cache").doc(storeId).delete();
  } catch (e) {
    // Ignore cache clear errors
  }
}

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
  
  const userRole = userDoc.data()?.role;
  if (userRole !== 'admin') {
    throw new Error("Access denied. Admin permissions required.");
  }
  
  return { uid, storeId, userName: userDoc.data()?.name || "System User", userRole };
}

// =============================================================================
// 逃 GET - Fetch Product Data by Tab
// =============================================================================
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");
    const db = firestoreAdmin;

    switch (tab) {
      case "stock": {
        const productId = searchParams.get("productId");
        if (productId) {
           const stockSnap = await db.collection("stock_levels")
            .where("storeId", "==", storeId)
            .where("productId", "==", productId)
            .get();
          const stockLevels = stockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return NextResponse.json(stockLevels);
        }
        const warehouseSnap = await db.collection("warehouses")
          .where("storeId", "==", storeId)
          .orderBy("name")
          .get();
        const warehouses = warehouseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const cacheRef = db.collection("reports_cache").doc(storeId);
        const cacheDoc = await cacheRef.get();
        let kpis;
        if (cacheDoc.exists && cacheDoc.data()?.product_kpis) {
          kpis = cacheDoc.data()?.product_kpis;
        } else {
          kpis = await aggregateProductKPIs(storeId);
        }
        return NextResponse.json({ kpis, warehouses });
      }

      case "products": {
        const limit = parseInt(searchParams.get("limit") || "10");
        const noLimit = searchParams.get("noLimit") === "true";
        const startAfter = searchParams.get("startAfter");
        const category = searchParams.get("category");
        const search = searchParams.get("search");

        let query = db.collection("products")
          .where("storeId", "==", storeId)
          .orderBy("name");
        
        if (category) query = query.where("category", "==", category);
        if (search) {
          query = query
            .where("name", ">=", search)
            .where("name", "<=", search + "\uf8ff");
        }
        if (startAfter) {
          const lastDoc = await db.collection("products").doc(startAfter).get();
          query = query.startAfter(lastDoc);
        }
        if (!noLimit) {
          query = query.limit(limit);
        }

        const snapshot = await query.get();
        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString(),
        }));
        
        const lastDocId = noLimit || snapshot.empty ? null : snapshot.docs[snapshot.docs.length - 1].id;
        return NextResponse.json({ products, lastDocId });
      }
      
      case "categories": {
        const [catSnap, brandSnap] = await Promise.all([
          db.collection("categories").where("storeId", "==", storeId).orderBy("name").get(),
          db.collection("brands").where("storeId", "==", storeId).orderBy("name").get(),
        ]);
        return NextResponse.json({
          categories: catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          brands: brandSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        });
      }

      case "adjustments": {
        const adjSnap = await db.collection("inventory_adjustments")
          .where("storeId", "==", storeId)
          .orderBy("timestamp", "desc")
          .limit(50)
          .get();
        const adjustments = adjSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: (doc.data().timestamp as Timestamp).toDate().toISOString(),
        }));
        return NextResponse.json(adjustments);
      }
      
      case "reports": {
        const reportType = searchParams.get("report");
        const currency = searchParams.get("currency") || "USD";

        if (reportType === "low_stock") {
          const productsSnap = await db.collection("products")
            .where("storeId", "==", storeId)
            .where("quantity", ">", 0)
            .where("quantity", "<=", 10) 
            .orderBy("quantity", "asc")
            .get();
          
          const lowStockProducts = productsSnap.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name,
                quantity: data.quantity,
                salesCount: 0,
                costPrice: data.costPrices?.[currency] || 0
              };
          });
          return NextResponse.json(lowStockProducts);
        }
        return NextResponse.json([]); 
      }

      default:
        return NextResponse.json({ error: "Invalid tab parameter." }, { status: 400 });
    }

  } catch (error: any) {
    console.error("[Products API GET] Error:", error.stack || error.message);
    if (error.message.includes("Access denied")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: `Failed to load data. ${error.message}` }, { status: 500 });
  }
}

// =============================================================================
// 逃 POST - Create New Product, Category, etc.
// =============================================================================
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId, uid, userName } = await checkAuth(request);
    const body = await request.json();
    const db = firestoreAdmin;

    switch (body.type) {
      
      case "product": {
        const { name, description, category, quantity, warehouseId, warehouseName, salePrices, costPrices, imageUrl } = body;
        const newProductRef = db.collection("products").doc();
        const productId = newProductRef.id;

        // FIX: Cost Consistency (Ensure costPrices defaults to {})
        const finalCostPrices = costPrices || { USD: 0 };

        const productData = {
          id: productId,
          storeId,
          name,
          description: description || "",
          category: category || "Uncategorized",
          quantity: Number(quantity) || 0,
          salePrices: salePrices || {},
          costPrices: finalCostPrices, // Use the ensured costs
          imageUrl: imageUrl || null,
          createdAt: Timestamp.now(),
          createdBy: uid,
        };

        const batch = db.batch();
        batch.set(newProductRef, productData);

        const stockRef = db.collection("stock_levels").doc(`${storeId}_${warehouseId}_${productId}`);
        batch.set(stockRef, {
          storeId,
          warehouseId,
          warehouseName,
          productId,
          productName: name,
          quantity: Number(quantity) || 0,
        });

        const adjRef = db.collection("inventory_adjustments").doc();
        batch.set(adjRef, {
          storeId,
          productId,
          productName: name,
          warehouseId,
          warehouseName,
          change: Number(quantity) || 0,
          newQuantity: Number(quantity) || 0,
          reason: "Initial Stock",
          timestamp: Timestamp.now(),
          userId: uid,
          userName: userName,
        });

        await batch.commit();
        
        // FIX: Clear cache
        await clearReportsCache(storeId);
        
        return NextResponse.json(productData, { status: 201 });
      }
      
      case "category":
      case "brand": {
        const collection = body.type === "category" ? "categories" : "brands";
        const docRef = await db.collection(collection).add({
          name: body.name,
          storeId,
          createdAt: Timestamp.now(),
        });
        return NextResponse.json({ id: docRef.id, name: body.name }, { status: 201 });
      }
      case "warehouse": {
         const docRef = await db.collection("warehouses").add({
          name: body.name,
          address: body.address || "",
          storeId,
        });
        return NextResponse.json({ id: docRef.id, name: body.name }, { status: 201 });
      }

      case "adjustment": {
        const { productId, warehouseId, warehouseName, change, reason } = body;
        const changeAmount = Number(change) || 0;
        
        if (changeAmount === 0) {
          return NextResponse.json({ error: "Change cannot be zero." }, { status: 400 });
        }

        const batch = db.batch();
        const productRef = db.collection("products").doc(productId);
        const stockRef = db.collection("stock_levels").doc(`${storeId}_${warehouseId}_${productId}`);
        const adjRef = db.collection("inventory_adjustments").doc();
        
        const stockDoc = await stockRef.get();
        const currentQuantity = stockDoc.data()?.quantity || 0;
        const newQuantity = currentQuantity + changeAmount;
        
        // FIX: Negative Stock Guard
        if (newQuantity < 0) {
            return NextResponse.json(
                { error: `Insufficient stock for adjustment. Current: ${currentQuantity}, Change: ${changeAmount}` }, 
                { status: 400 }
            );
        }
        
        const productDoc = await productRef.get();
        const productName = productDoc.data()?.name || "Unknown Product";

        batch.update(productRef, {
          quantity: FieldValue.increment(changeAmount)
        });

        batch.set(stockRef, {
          storeId,
          warehouseId,
          warehouseName,
          productId,
          productName,
          quantity: FieldValue.increment(changeAmount)
        }, { merge: true });

        batch.set(adjRef, {
          storeId,
          productId,
          productName,
          warehouseId,
          warehouseName,
          change: changeAmount,
          newQuantity: newQuantity,
          reason: reason || "Adjustment",
          timestamp: Timestamp.now(),
          userId: uid,
          userName: userName,
        });

        await batch.commit();
        
        // FIX: Clear cache
        await clearReportsCache(storeId);

        return NextResponse.json({ success: true, newQuantity: newQuantity }, { status: 201 });
      }

      case "transfer": {
        const { productId, fromWarehouse, toWarehouse, quantity } = body;
        const transferQty = Number(quantity) || 0;

        if (transferQty <= 0) {
          return NextResponse.json({ error: "Transfer quantity must be positive." }, { status: 400 });
        }
        if (fromWarehouse.id === toWarehouse.id) {
            return NextResponse.json({ error: "Cannot transfer to the same warehouse." }, { status: 400 });
        }

        const batch = db.batch();
        const productDoc = await db.collection("products").doc(productId).get();
        if (!productDoc.exists) throw new Error("Product not found.");
        const productName = productDoc.data()?.name || "Unknown Product";

        // 1. 'From' Warehouse (Subtract)
        const fromStockRef = db.collection("stock_levels").doc(`${storeId}_${fromWarehouse.id}_${productId}`);
        const fromAdjRef = db.collection("inventory_adjustments").doc();
        const fromStockDoc = await fromStockRef.get();
        const fromCurrentQty = fromStockDoc.data()?.quantity || 0;
        
        // FIX: Strict Negative Check
        if (fromCurrentQty < transferQty) {
           return NextResponse.json(
               { error: `Not enough stock in ${fromWarehouse.name}. Available: ${fromCurrentQty}` }, 
               { status: 400 }
           );
        }
        const fromNewQty = fromCurrentQty - transferQty;

        // 2. 'To' Warehouse (Add)
        const toStockRef = db.collection("stock_levels").doc(`${storeId}_${toWarehouse.id}_${productId}`);
        const toAdjRef = db.collection("inventory_adjustments").doc();
        const toStockDoc = await toStockRef.get();
        const toCurrentQty = toStockDoc.data()?.quantity || 0;
        const toNewQty = toCurrentQty + transferQty;
        
        // 3. Batch operations
        batch.set(fromStockRef, { quantity: FieldValue.increment(-transferQty) }, { merge: true });
        batch.set(fromAdjRef, {
          storeId, productId, productName,
          warehouseId: fromWarehouse.id, warehouseName: fromWarehouse.name,
          change: -transferQty,
          newQuantity: fromNewQty,
          reason: `Transfer to ${toWarehouse.name}`,
          timestamp: Timestamp.now(), userId: uid, userName,
        });

        batch.set(toStockRef, {
          storeId,
          warehouseId: toWarehouse.id,
          warehouseName: toWarehouse.name,
          productId,
          productName,
          quantity: FieldValue.increment(transferQty)
        }, { merge: true });
        batch.set(toAdjRef, {
          storeId, productId, productName,
          warehouseId: toWarehouse.id, warehouseName: toWarehouse.name,
          change: transferQty,
          newQuantity: toNewQty,
          reason: `Transfer from ${fromWarehouse.name}`,
          timestamp: Timestamp.now(), userId: uid, userName,
        });

        await batch.commit();
        
        // FIX: Clear cache
        await clearReportsCache(storeId);

        return NextResponse.json({ success: true }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: "Invalid POST type." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Products API POST] Error:", error.message);
    if (error.message.includes("Access denied")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 逃 PUT - Update Existing Product
// =============================================================================
export async function PUT(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, category, salePrices, costPrices, imageUrl } = body;

    const productRef = firestoreAdmin.collection("products").doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists || productDoc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const updateData = {
      name,
      description,
      category,
      salePrices,
      costPrices,
      imageUrl,
      updatedAt: Timestamp.now(),
    };

    await productRef.update(updateData);
    
    // Also update productName in stock_levels
    const stockSnap = await firestoreAdmin.collection("stock_levels")
        .where("storeId", "==", storeId)
        .where("productId", "==", productId)
        .get();
        
    const batch = firestoreAdmin.batch();
    stockSnap.docs.forEach(doc => {
        batch.update(doc.ref, { productName: name });
    });
    await batch.commit();
    
    // FIX: Clear cache
    await clearReportsCache(storeId);

    return NextResponse.json({ id: productId, ...updateData }, { status: 200 });

  } catch (error: any) {
    console.error("[Products API PUT] Error:", error.message);
    if (error.message.includes("Access denied")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 逃 DELETE - Delete Existing Product
// =============================================================================
export async function DELETE(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required." }, { status: 400 });
    }

    let collectionName = "";
    switch (type) {
      case "product": collectionName = "products"; break;
      case "category": collectionName = "categories"; break;
      case "brand": collectionName = "brands"; break;
      case "warehouse": collectionName = "warehouses"; break;
      default:
        return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }

    const docRef = firestoreAdmin.collection(collectionName).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Document not found or access denied." }, { status: 404 });
    }
    
    await docRef.delete();
    
    // FIX: Clear cache after deletion
    if (type === "product") {
        await clearReportsCache(storeId);
    }

    return NextResponse.json({ success: true, id: id }, { status: 200 });

  } catch (error: any) {
    console.error("[Products API DELETE] Error:", error.message);
    if (error.message.includes("Access denied")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


// --- Helper function (copied from your Cloud Function) ---
async function aggregateProductKPIs(storeId: string) {
  const productsSnap = await firestoreAdmin.collection("products")
    .where("storeId", "==", storeId).get();

  const kpis = {
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    stockValueMap: new Map<string, number>(),
  };

  productsSnap.forEach(doc => {
    const product = doc.data();
    kpis.totalProducts++;
    const qty = product.quantity || 0;
    if (qty <= 0) kpis.outOfStock++;
    else if (qty <= (product.lowStockThreshold || 5)) kpis.lowStock++; // Using 5 as default
    const costPrices = product.costPrices || {};
    for (const currency in costPrices) {
      const cost = costPrices[currency] || 0;
      const value = cost * qty;
      kpis.stockValueMap.set(currency, (kpis.stockValueMap.get(currency) || 0) + value);
    }
  });

  return {
    ...kpis,
    stockValueMap: Object.fromEntries(kpis.stockValueMap), 
  };
}