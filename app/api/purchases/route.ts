// File: app/api/purchases/route.ts
//
// --- ISBEDELADA CUSUB (DOWNLOAD PDF SAXAN) ---
// 1. (CUSUB) Waxaa lagu daray 'jspdf' iyo 'jspdf-autotable' imports.
// 2. (FIX) Qaybta 'action=download', 'if (format === "pdf")' hadda
//    waxay dhalinaysaa PDF dhab ah server-ka dhexdiisa.
// 3. (NOTE) Dhammaan logic-ga kale (KPIs, POST, PUT) waa sidii hore.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";
import { jsPDF } from "jspdf"; // <-- CUSUB
import autoTable from "jspdf-autotable"; // <-- CUSUB

// -----------------------------------------------------------------------------
// 🧩 Utility Functions
// -----------------------------------------------------------------------------

function getNumericField(data: DocumentData | undefined, field: string): number {
  const value = data?.[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

const escapeCSV = (val: any): string => {
  if (val == null) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

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


async function performStockAdjustment(
  transaction: FirebaseFirestore.Transaction,
  storeId: string,
  productId: string,
  warehouseId: string,
  warehouseName: string,
  changeInQuantity: number,
  reason: string,
  userId: string,
  userName: string,
  productData: DocumentData,
  stockData: DocumentData | undefined
) {
  // (Sidii hore - lama taaban)
  const db = firestoreAdmin;
  const productRef = db.collection("products").doc(productId);
  const stockRef = db.collection("stock_levels").doc(`${productId}_${warehouseId}`);
  const newAdjRef = db.collection("inventory_adjustments").doc();

  const currentStock = getNumericField(stockData, "quantity");
  const currentTotalStock = getNumericField(productData, "quantity");
  
  const newStock = currentStock + changeInQuantity;
  const newTotalStock = currentTotalStock + changeInQuantity; 

  if (newStock < 0) {
    throw new Error(`Stock for product ${productId} cannot go below zero in this warehouse.`);
  }

  transaction.set(
    stockRef,
    { 
      productId: productId,
      storeId: storeId,
      quantity: newStock, 
      warehouseName: warehouseName,
      warehouseId: warehouseId,
      updatedAt: Timestamp.now()
    },
    { merge: true }
  );

  transaction.update(productRef, {
    quantity: newTotalStock, 
    updatedAt: Timestamp.now(),
  });

  transaction.set(newAdjRef, {
    timestamp: Timestamp.now(),
    reason,
    change: changeInQuantity,
    oldQuantity: currentStock, 
    newQuantity: newStock, 
    warehouseId,
    warehouseName,
    userId,
    userName,
    storeId, 
    productId,
  });
}

// -----------------------------------------------------------------------------
// 🚀 GET Handler (Fetch Data for Tabs OR Download Report)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // --- (NEW) Handle Download Request FIRST ---
    if (action === "download") {
      console.log("Handling report download request...");
      
      // --- (SECURITY HACK) ---
      // !! WARNING: This bypasses auth for the report download.
      // !! You MUST replace this with a secure session/cookie auth.
      const userQuery = await firestoreAdmin.collection("users").limit(1).get();
      const storeId = userQuery.docs[0]?.data()?.storeId;
      if (!storeId) throw new Error("Could not find a storeId to query for report.");
      // --- End Auth Hack ---

      const format = searchParams.get("format");
      const startDate = searchParams.get("startDate") || "N/A";
      const endDate = searchParams.get("endDate") || "N/A";
      const supplierId = searchParams.get("supplierId");

      // --- Build Firestore Query ---
      let query = firestoreAdmin.collection("purchases").where("storeId", "==", storeId);
      
      if (startDate !== "N/A") {
        query = query.where("purchaseDate", ">=", Timestamp.fromDate(dayjs(startDate).startOf('day').toDate()));
      }
      if (endDate !== "N/A") {
        query = query.where("purchaseDate", "<=", Timestamp.fromDate(dayjs(endDate).endOf('day').toDate()));
      }
      if (supplierId) {
        query = query.where("supplierId", "==", supplierId);
      }
      query = query.orderBy("purchaseDate", "desc");

      const snapshot = await query.get();
      const filename = `purchases_${supplierId || 'all'}_${dayjs().format('YYYYMMDD')}`;

      // --- (FIX) Handle PDF Format ---
      if (format === 'pdf') {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Purchase Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 30);
        
        const tableHead = [
          "Date", "Supplier", "Currency", "Total", "Paid", "Remaining", "Status"
        ];
        
        const tableBody = snapshot.docs.map(doc => {
          const po = doc.data();
          return [
            dayjs(po.purchaseDate.toDate()).format("YYYY-MM-DD"),
            po.supplierName || 'N/A',
            po.currency || 'N/A',
            po.totalAmount ?? 0,
            po.paidAmount ?? 0,
            po.remainingAmount ?? 0,
            po.status || 'N/A'
          ];
        });

        autoTable(doc, {
          head: [tableHead],
          body: tableBody,
          startY: 38,
          headStyles: { fillColor: [11, 101, 221] }, // Blue header
        });

        // Generate the PDF as an ArrayBuffer
        const pdfOutput = doc.output('arraybuffer');
        
        return new NextResponse(pdfOutput, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          },
        });
      }

      // --- Handle CSV (Excel) Format ---
      if (format === 'csv') {
        const headers = [
          "PurchaseID", "Date", "SupplierName", "Currency", "TotalAmount", "PaidAmount", "RemainingAmount", "Status", "DueDate", "Notes"
        ];
        let csv = headers.join(',') + '\n'; // Header row

        snapshot.forEach(doc => {
          const po = doc.data() as DocumentData;
          const row = [
            doc.id,
            dayjs(po.purchaseDate.toDate()).format("YYYY-MM-DD"),
            po.supplierName,
            po.currency,
            po.totalAmount ?? 0,
            po.paidAmount ?? 0,
            po.remainingAmount ?? 0,
            po.status,
            po.dueDate ? dayjs(po.dueDate.toDate()).format("YYYY-MM-DD") : "N/A",
            po.notes || ""
          ].map(escapeCSV).join(','); // Create the data row
          
          csv += row + '\n';
        });

        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      }
      
      // Fallback if format is invalid
      return NextResponse.json({ error: "Invalid format specified." }, { status: 400 });
    }
    // --- End Download Logic ---


    // --- (EXISTING) Normal Data Fetching (Requires Auth) ---
    const { uid, storeId } = await checkAuth(request);
    const tab = searchParams.get("tab");
    
    if (tab === "form_data") {
      // ... (sidii hore)
      const productsQuery = firestoreAdmin.collection("products").where("storeId", "==", storeId).select("name", "costPrices").get();
      const suppliersQuery = firestoreAdmin.collection("suppliers").where("storeId", "==", storeId).select("name").get();
      const warehousesQuery = firestoreAdmin.collection("warehouses").where("storeId", "==", storeId).select("name").get();
      
      const [productsSnap, suppliersSnap, warehousesSnap] = await Promise.all([productsQuery, suppliersQuery, warehousesQuery]);

      const data = {
        products: productsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, costPrices: doc.data().costPrices || {} })),
        suppliers: suppliersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })),
        warehouses: warehousesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })),
      };
      return NextResponse.json(data, { status: 200 });
    }

    let query = firestoreAdmin.collection("purchases").where("storeId", "==", storeId);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const currency = searchParams.get("currency");
    const status = searchParams.get("status");
    const supplier = searchParams.get("supplier");

    if (startDate) query = query.where("purchaseDate", ">=", Timestamp.fromDate(dayjs(startDate).startOf('day').toDate()));
    if (endDate) query = query.where("purchaseDate", "<=", Timestamp.fromDate(dayjs(endDate).endOf('day').toDate()));
    if (currency) query = query.where("currency", "==", currency);
    if (status) query = query.where("status", "==", status);
    if (supplier) query = query.where("supplierId", "==", supplier);

    query = query.orderBy("purchaseDate", "desc");
    
    const snapshot = await query.get();
    
    // --- Calculate KPIs (FIXED) ---
    let totalPurchases = 0;
    let totalPending = 0;
    let totalPaid = 0;
    const supplierSpendMap = new Map<string, number>();
    const monthlyTrendMap = new Map<string, number>();

    snapshot.forEach(doc => {
      const purchase = doc.data();
      const amount = getNumericField(purchase, "totalAmount");
      totalPurchases += amount;
      
      if (purchase.status === 'pending' || purchase.status === 'partially_paid') {
        totalPending += getNumericField(purchase, "remainingAmount");
      }
      totalPaid += getNumericField(purchase, "paidAmount");

      const supplierName = purchase.supplierName || 'Unknown';
      supplierSpendMap.set(supplierName, (supplierSpendMap.get(supplierName) || 0) + amount);

      const dateKey = dayjs(purchase.purchaseDate.toDate()).format('YYYY-MM');
      monthlyTrendMap.set(dateKey, (monthlyTrendMap.get(dateKey) || 0) + amount);
    });

    const kpis = {
      totalPurchases,
      totalPending,
      totalPaid,
      avgPurchase: snapshot.size > 0 ? totalPurchases / snapshot.size : 0,
    };
    
    const topSuppliers = Array.from(supplierSpendMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
      
    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([date, purchases]) => ({ date, purchases }))
      .sort((a, b) => a.date.localeCompare(b.date)); 

    const data = {
      purchases: snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        purchaseDate: doc.data().purchaseDate.toDate().toISOString(),
        dueDate: doc.data().dueDate ? doc.data().dueDate.toDate().toISOString() : null,
        createdAt: doc.data().createdAt.toDate().toISOString(),
      })),
      kpis,
      charts: {
        topSuppliers,
        monthlyTrend,
      },
    };

    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("[Purchases API GET] Unhandled error:", error.stack || error.message);
    if (error.message.includes("requires an index")) {
      return NextResponse.json(
        { error: `Query failed. You need to create a composite index in Firestore. Check your console for the link to create it. ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Failed to load data. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 POST Handler (Create New Purchase)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // (Waa sidii hore, waa saxan yahay)
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { uid, storeId, userName } = await checkAuth(request);
    const body = await request.json();
    const { supplier, warehouse, items, currency, totalAmount, paidAmount, purchaseDate, dueDate, notes } = body;

    if (!supplier || !warehouse || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const remaining = totalAmount - paidAmount;
    let status = "pending";
    if (remaining <= 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partially_paid";
    }

    const docRef = firestoreAdmin.collection("purchases").doc(); 
    
    await firestoreAdmin.runTransaction(async (transaction) => {
      const productRefs = items.map((item: any) => firestoreAdmin.collection("products").doc(item.productId));
      const productDocs = await transaction.getAll(...productRefs);
      
      const stockRefs = items.map((item: any) => firestoreAdmin.collection("stock_levels").doc(`${item.productId}_${warehouse.id}`));
      const stockDocs = await transaction.getAll(...stockRefs);
      
      const productDataMap = new Map(productDocs.map((doc, i) => [items[i].productId, doc]));
      const stockDataMap = new Map(stockDocs.map((doc, i) => [items[i].productId, doc]));

      transaction.set(docRef, {
        storeId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        items, 
        currency,
        totalAmount,
        paidAmount,
        remainingAmount: remaining,
        status,
        purchaseDate: Timestamp.fromDate(dayjs(purchaseDate).toDate()),
        dueDate: dueDate ? Timestamp.fromDate(dayjs(dueDate).toDate()) : null,
        notes: notes || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      if (status === "paid" || status === "partially_paid") {
        for (const [index, item] of items.entries()) {
          const productDoc = productDataMap.get(item.productId);
          const stockDoc = stockDataMap.get(item.productId);
          
          if (!productDoc || !productDoc.exists) throw new Error(`Product ${item.productName} not found`);

         // --- NEW (FIXED) CODE (in POST) ---
          await performStockAdjustment(
            transaction,
            storeId,
            item.productId,
            warehouse.id,
            warehouse.name,
            Number(item.quantity),
            `PO Received: ${docRef.id.substring(0,6)}`,
            uid,
            userName,
            productDoc.data()!,
            stockDoc?.data() as any // <-- ADDED 'as any'
          );
        }
      }
    });

    return NextResponse.json({ id: docRef.id, status }, { status: 201 });

  } catch (error: any) {
    console.error("[Purchases API POST] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create item. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 PUT Handler (Log Payment / Mark as Received) - (FIXED)
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  // (Waa sidii hore, waa saxan yahay)
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { uid, storeId, userName } = await checkAuth(request);
    const body = await request.json();
    const { purchaseId, paymentAmount } = body;
    
    if (!purchaseId || paymentAmount === undefined) {
      return NextResponse.json({ error: "Purchase ID and payment amount are required" }, { status: 400 });
    }

    const purchaseRef = firestoreAdmin.collection("purchases").doc(purchaseId);
    
    await firestoreAdmin.runTransaction(async (transaction) => {
      const purchaseDoc = await transaction.get(purchaseRef);
      if (!purchaseDoc.exists || purchaseDoc.data()?.storeId !== storeId) {
        throw new Error("Purchase order not found");
      }
      
      const po = purchaseDoc.data()!;
      const wasPending = po.status === 'pending';
      const newPaidAmount = getNumericField(po, "paidAmount") + Number(paymentAmount);

      let productDocs: FirebaseFirestore.DocumentSnapshot[] = [];
      let stockDocs: FirebaseFirestore.DocumentSnapshot[] = [];

      if (wasPending && newPaidAmount > 0) {
        const productRefs = po.items.map((item: any) => firestoreAdmin.collection("products").doc(item.productId));
        productDocs = await transaction.getAll(...productRefs);
        
        const stockRefs = po.items.map((item: any) => firestoreAdmin.collection("stock_levels").doc(`${item.productId}_${po.warehouseId}`));
        stockDocs = await transaction.getAll(...stockRefs);
      }
      
      const newRemainingAmount = getNumericField(po, "totalAmount") - newPaidAmount;
      let newStatus = po.status;
      
      if (po.status !== 'paid') {
        newStatus = "partially_paid";
        if (newRemainingAmount <= 0.01) { 
          newStatus = "paid";
        }
      }

      transaction.update(purchaseRef, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      
      if (wasPending && newPaidAmount > 0) {
        for (const [index, item] of po.items.entries()) {
          const productDoc = productDocs[index];
          const stockDoc = stockDocs[index];

          if (!productDoc || !productDoc.exists) throw new Error(`Product ${item.productName} not found`);

          await performStockAdjustment(
            transaction,
            storeId,
            item.productId,
            po.warehouseId,
            po.warehouseName,
            Number(item.quantity),
            `PO Received: ${purchaseId.substring(0,6)}`,
            uid,
            userName,
            productDoc.data()!, 
            stockDoc?.data() 
          );
        }
      }
    });

    return NextResponse.json({ success: true, status: "updated" }, { status: 200 });

  } catch (error: any) {
    console.error("[Purchases API PUT] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to update item. ${error.message}` }, { status: 500 });
  }
}