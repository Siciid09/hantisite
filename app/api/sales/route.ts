// File: app/api/sales/route.ts
//
// --- LATEST FIX (Product History Bug) ---
// 1. (FIX) The 'customerRef' (ts(2454)) error is fixed.
// 2. (FIX) The customer KPI logic moved inside if/else block.
// 3. (KEPT) All other logic (income, debt creation) is the same.
// 4. (NEW) Added server-side overpayment validation.
// 5. (CRITICAL FIX) Added 'productIds' array to the 'newSaleData' object.
//    This is required for the product details page to find sales.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";
import dayjs from "dayjs";

// --- Helper: checkAuth (Unchanged) ---
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

  if (!userDoc.exists) throw new Error("Unauthorized: User data not found.");
  
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
// 🚀 POST - Create New Sale (MODIFIED)
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
    // 1. Authenticate and Authorize
    const { storeId, uid, userName } = await checkAuth(request, ['admin', 'manager', 'user']);

    // 2. Parse Raw Data from Client
    const body = await request.json();
    const {
      customer, // { id, name, phone, ... }
      invoiceCurrency, // "BIRR"
      items: rawItems, // [{ productId, quantity, discount, pricePerUnit (if manual) }]
      paymentLines, // [{ method, amount, currency, valueInInvoiceCurrency }]
      saleDate, // "2025-11-05"
      salesperson,
      notes,
    } = body;
    
    // 3. Basic Validation
    if (!invoiceCurrency || !rawItems || rawItems.length === 0 || !customer) {
      return NextResponse.json({ error: "Invalid data. Missing required fields." }, { status: 400 });
    }
    
    const createdAt = saleDate ? Timestamp.fromDate(dayjs(saleDate).toDate()) : Timestamp.now();
    let newCustomerId = customer.id;

    // 4. Run as a single, atomic transaction
    const newSale = await db.runTransaction(async (transaction) => {
      let totalAmount = 0;
      let totalCostUsd = 0;
      const processedItems = [];
      const productUpdates = []; // Will store { ref, change }
      
      // --- 5. READ PHASE ---
      const productRefsToFetch = [];
      const manualItems = [];

      for (const item of rawItems) {
        if (item.productId.startsWith("manual_")) {
          manualItems.push(item);
        } else {
          productRefsToFetch.push({
            ref: db.collection("products").doc(item.productId),
            item: item,
          });
        }
      }
      const productDocs = await Promise.all(
        productRefsToFetch.map(p => transaction.get(p.ref))
      );

      // --- 6. PROCESS & VALIDATE (In-Memory) ---
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const { ref, item } = productRefsToFetch[i]; 

        if (!productDoc.exists) {
          throw new Error(`Product not found: ${item.productName}`);
        }
        const productData = productDoc.data();
        
        const currentStock = productData?.quantity || 0;
        if (currentStock < item.quantity) { 
          throw new Error(`Not enough stock for ${productData?.name}. Available: ${currentStock}`);
        }

        let pricePerUnit = productData?.salePrices?.[invoiceCurrency];
        if (pricePerUnit === undefined || pricePerUnit === null || pricePerUnit === 0) {
          if (item.pricePerUnit) {
            pricePerUnit = item.pricePerUnit;
          } else {
            throw new Error(`Price for ${productData?.name} in ${invoiceCurrency} is not set.`);
          }
        }
        const subtotal = (pricePerUnit * item.quantity) * (1 - (item.discount || 0) / 100);
        const itemCostUsd = (productData?.costPrices?.USD || 0) * item.quantity;
        
        totalAmount += subtotal;
        totalCostUsd += itemCostUsd;
        
        processedItems.push({
          ...item,
          pricePerUnit: pricePerUnit,
          costPriceUsd: productData?.costPrices?.USD || 0,
          subtotal: subtotal
        });
        
        productUpdates.push({
          ref: ref,
          change: -item.quantity
        });
      }

      for (const item of manualItems) {
        const price = item.pricePerUnit || 0;
        const subtotal = (price * item.quantity) * (1 - (item.discount || 0) / 100);
        totalAmount += subtotal;
        
        processedItems.push({
          ...item,
          pricePerUnit: price,
          costPriceUsd: 0,
          subtotal: subtotal
        });
      }
      
      // --- 7. WRITE PHASE ---
      
      // b. Calculate Payment Totals
      const totalPaid = paymentLines.reduce((sum: number, p: any) => sum + (p.valueInInvoiceCurrency || 0), 0);
      
      if (totalPaid > totalAmount + 0.01) {
        throw new Error(`Overpayment is not allowed. Total paid (${totalPaid}) exceeds total amount (${totalAmount}).`);
      }
      
      const debtAmount = totalAmount - totalPaid;
      const paymentStatus = debtAmount <= 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

      // a. Handle Customer & Update KPIs
      let customerRef: FirebaseFirestore.DocumentReference;

      if (customer.id === "walkin") {
        newCustomerId = "walkin";
      } else if (customer.id.startsWith("new_")) {
        // Create new customer
        customerRef = db.collection("customers").doc();
        newCustomerId = customerRef.id;
        
        transaction.set(customerRef, {
          storeId: storeId,
          name: customer.name,
          phone: customer.phone || null,
          whatsapp: customer.whatsapp || null,
          notes: customer.notes || null,
          createdAt: FieldValue.serverTimestamp(),
          totalSpent: {},
          totalOwed: {},
        }, { merge: true });

        // Update KPIs for the NEW customer
        transaction.update(customerRef, {
          [`totalSpent.${invoiceCurrency}`]: FieldValue.increment(totalAmount)
        });
        if (debtAmount > 0) {
          transaction.update(customerRef, {
            [`totalOwed.${invoiceCurrency}`]: FieldValue.increment(debtAmount)
          });
        }

      } else {
        // Use existing customer
        customerRef = db.collection("customers").doc(newCustomerId);
        
        if (customer.saveToContacts) {
          transaction.set(customerRef, {
            name: customer.name,
            phone: customer.phone || null,
            whatsapp: customer.whatsapp || null,
            notes: customer.notes || null,
          }, { merge: true });
        }
        
        // Update KPIs for the EXISTING customer
        transaction.update(customerRef, {
          [`totalSpent.${invoiceCurrency}`]: FieldValue.increment(totalAmount)
        });
        if (debtAmount > 0) {
          transaction.update(customerRef, {
            [`totalOwed.${invoiceCurrency}`]: FieldValue.increment(debtAmount)
          });
        }
      }

      // --- (CRITICAL FIX) ---
      // Create a simple array of product IDs for querying
      const productIds = processedItems.map(item => item.productId);
      // --- (END FIX) ---

      // c. Prepare Sale Document
      const newSaleRef = db.collection("sales").doc();
      const newSaleData = {
        id: newSaleRef.id,
        storeId,
        uid,
        salesperson: salesperson || userName,
        customerId: newCustomerId,
        customerName: customer.name,
        items: processedItems,
        productIds: productIds, // <-- ADDED THIS FIELD
        invoiceCurrency,
        totalAmount,
        totalCostUsd,
        paymentLines: paymentLines,
        totalPaid: totalPaid,
        debtAmount: debtAmount,
        paymentStatus,
        notes: notes || null,
        createdAt: createdAt,
        invoiceId: `INV-${Date.now().toString().slice(-6)}`,
      };
      
      // d. Save the Sale
      transaction.set(newSaleRef, newSaleData);

      // e. Decrement Stock
      for (const update of productUpdates) {
        transaction.update(update.ref, { 
          quantity: FieldValue.increment(update.change) 
        });
      }
      
      // f. Create Income Documents
      for (const payment of paymentLines) {
        if (payment.amount > 0) {
          const incomeRef = db.collection("incomes").doc();
          transaction.set(incomeRef, {
            storeId,
            uid,
            relatedSaleId: newSaleRef.id,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.method,
            category: "Sales",
            notes: `Payment for Invoice ${newSaleData.invoiceId}`,
            createdAt: createdAt,
          });
        }
      }

      // g. Create Debit Document
      if (debtAmount > 0) {
        const debitRef = db.collection("debits").doc();
        transaction.set(debitRef, {
          storeId,
          customerId: newCustomerId,
          clientName: customer.name, 
          clientPhone: customer.phone || null,
          clientWhatsapp: customer.whatsapp || customer.phone || null,
          relatedSaleId: newSaleRef.id,
          invoiceId: newSaleData.invoiceId,
          reason: `Debt for ${newSaleData.invoiceId}`,
          totalAmount: debtAmount,
          amountDue: debtAmount,
          totalPaid: 0,
          currency: invoiceCurrency,
          isPaid: false,
          status: 'unpaid',
          createdAt: createdAt,
          dueDate: Timestamp.fromDate(dayjs(createdAt.toDate()).add(30, 'day').toDate()),
        });
      }
      
      return newSaleData; // Return the final sale data
    }); // End of Transaction

    // 10. Return the successfully created sale
    return NextResponse.json({ success: true, sale: newSale }, { status: 201 });

  } catch (error: any) {
    console.error("[Sales API POST] Error:", error.stack || error.message);
    if (error.message.startsWith("Overpayment detected")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 📊 GET - Fetch Sales Data
// =============================================================================
// (This GET function is unchanged)
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await checkAuth(request, ['admin', 'manager', 'user']);
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const currency = searchParams.get("currency") || "USD";

    // --- Handle Search Views ---
    const searchQuery = searchParams.get("searchQuery");
    if (view === "search_products") {
      if (!searchQuery) return NextResponse.json({ products: [] });
      const productsQuery = firestoreAdmin.collection("products")
        .where("storeId", "==", storeId)
        .orderBy("name")
        .startAt(searchQuery)
        .endAt(searchQuery + "\uf8ff")
        .limit(10);
      const snapshot = await productsQuery.get();
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return NextResponse.json({ products });
    }
    
    if (view === "search_customers") {
      if (!searchQuery) return NextResponse.json({ customers: [] });
      const customersQuery = firestoreAdmin.collection("customers")
        .where("storeId", "==", storeId)
        .orderBy("name")
        .startAt(searchQuery)
        .endAt(searchQuery + "\uf8ff")
        .limit(10);
      const snapshot = await customersQuery.get();
      const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return NextResponse.json({ customers });
    }
    // --- End of Search ---

    // Date filters
    const startDate = dayjs(searchParams.get("startDate") || dayjs().startOf("month")).startOf("day").toDate();
    const endDate = dayjs(searchParams.get("endDate") || dayjs().endOf("month")).endOf("day").toDate();
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;
    const status = searchParams.get("status");

    // Build base query
    let baseQuery: Query = firestoreAdmin
      .collection("sales")
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

  

    if (status && status !== 'all') { // <-- This is the only line that changed
      baseQuery = baseQuery.where("paymentStatus", "==", status);
    } else {
      // This will now correctly run for "all" or if no status is provided
      baseQuery = baseQuery.where("paymentStatus", "not-in", ["voided", "refunded"]);
    }

    // Get paginated list
    const paginatedQuery = baseQuery
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    const [listSnapshot, countSnapshot] = await Promise.all([
      paginatedQuery.get(),
      baseQuery.count().get()
    ]);

    const salesList = listSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));

    const totalMatchingSales = countSnapshot.data().count;
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalMatchingSales / limit),
      totalResults: totalMatchingSales,
    };

    // --- Data specifically for Dashboard View ---
    if (view === "dashboard") {
      const allDocsSnapshot = await baseQuery.get();

      let totalSales = 0;
      let totalTransactions = 0;
      let totalDebts = 0;
      let paidTransactions = 0;
      const paymentMethodBreakdown = new Map<string, number>();
      const salesOverTime = new Map<string, number>();

      allDocsSnapshot.forEach((doc) => {
        const data = doc.data();
        totalTransactions++;
        totalSales += data.totalAmount || 0;
        totalDebts += data.debtAmount || 0;
        if (data.paymentStatus === 'paid') paidTransactions++;

        data.paymentLines?.forEach((p: any) => {
          paymentMethodBreakdown.set(
            p.method,
            (paymentMethodBreakdown.get(p.method) || 0) + (p.valueInInvoiceCurrency || 0)
          );
        });

        const dateStr = dayjs(data.createdAt.toDate()).format("YYYY-MM-DD");
        salesOverTime.set(
          dateStr,
          (salesOverTime.get(dateStr) || 0) + (data.totalAmount || 0)
        );
      });

      const kpis = {
        totalSales,
        totalTransactions,
        avgSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
        totalDebts,
        paidPercent: totalTransactions > 0 ? (paidTransactions / totalTransactions) * 100 : 0,
      };

      const charts = {
        paymentBreakdown: Array.from(paymentMethodBreakdown.entries()).map(
          ([name, value]) => ({ name, value })
        ),
        salesTrend: Array.from(salesOverTime.entries())
          .map(([date, sales]) => ({ date, sales }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
      
      return NextResponse.json({
        view: "dashboard",
        kpis,
        charts,
        salesList,
        pagination,
      });
    }

    // --- Data for History / Invoices (just the list) ---
    return NextResponse.json({
      view: view,
      salesList,
      pagination,
    });

  } catch (error: any)
{
    console.error("[Sales API GET] Error:", error.stack || error.message);
    if (error.message.includes("requires an index")) {
         return NextResponse.json(
           { error: `Query failed. You need to create a composite index in Firestore. ${error.message}` },
           { status: 500 }
         );
    }
    return NextResponse.json({ error: `Failed to load sales. ${error.message}` }, { status: 500 });
  }
}