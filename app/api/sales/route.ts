// File: app/api/sales/route.ts
//
// --- SOLVED ---
// 1. (CRITICAL FIX) 'POST' function: The transaction is rebuilt.
//    - It now performs a "Read Phase" (getting all products)
//    - THEN it performs a "Write Phase" (creating customers, sales,
//      and updating stock).
//    - This fixes the "reads must be before writes" error.
// 2. (FIX) 'GET' function: Includes 'baseQuery.count().get()' fix
//    from your original file.
// --- (NEW FIXES APPLIED) ---
// 3. (FIX) 'GET' function: Now applies the 'status' filter from the URL
//    and defaults to hiding 'voided'/'refunded' sales.
// 4. (FIX) 'POST' function: Debit creation now uses the correct
//    fields ('totalAmount', 'amountDue') to match the Debts module.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";
import dayjs from "dayjs";

// --- Helper: checkAuth ---
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
// 🚀 POST - Create New Sale (SOLVED)
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
      // Get all product data first
      
      const productRefsToFetch = [];
      const manualItems = [];

      for (const item of rawItems) {
        if (item.productId.startsWith("manual_")) {
          // This is a manual, non-stock item. No read needed.
          manualItems.push(item);
        } else {
          // This is a real product. Add its ref to the list to fetch.
          productRefsToFetch.push({
            ref: db.collection("products").doc(item.productId),
            item: item, // Keep original item data
          });
        }
      }

      // Execute all product reads
      const productDocs = await Promise.all(
        productRefsToFetch.map(p => transaction.get(p.ref))
      );

      // --- 6. PROCESS & VALIDATE (In-Memory) ---
      // Now loop through the *results* of the reads
      
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const { ref, item } = productRefsToFetch[i]; // Get original item

        if (!productDoc.exists) {
          throw new Error(`Product not found: ${item.productName}`);
        }
        const productData = productDoc.data();
        
        // Check stock
        const currentStock = productData?.quantity || 0;
        
        // --- FIX 1: Check 'quantity', not 'stock' ---
        if (currentStock < item.quantity) { 
          // --- FIX 2: Add '?' to productData.name ---
          throw new Error(`Not enough stock for ${productData?.name}. Available: ${currentStock}`);
        }

        // Get price
        let pricePerUnit = productData?.salePrices?.[invoiceCurrency];
        
        if (pricePerUnit === undefined || pricePerUnit === null || pricePerUnit === 0) {
          if (item.pricePerUnit) {
            pricePerUnit = item.pricePerUnit; // Trust manual price
          } else {
            // This line is already correct!
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
        
        // Prepare stock update (for write phase)
        productUpdates.push({
          ref: ref,
          change: -item.quantity
        });
      }

      // Process manual items (no reads, just add to totals)
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
      // All reads are done. Now we can safely write.

      // a. Handle Customer (Create if new)
      if (customer.id === "walkin") {
        newCustomerId = "walkin";
      } else if (customer.id.startsWith("new_") || customer.saveToContacts) {
        const customerRef = customer.id.startsWith("new_") 
          ? db.collection("customers").doc() 
          : db.collection("customers").doc(customer.id);
        
        newCustomerId = customerRef.id;
        
        transaction.set(customerRef, {
          storeId: storeId,
          name: customer.name,
          phone: customer.phone || null,
          whatsapp: customer.whatsapp || null,
          notes: customer.notes || null,
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // b. Calculate Payment Totals
      const totalPaid = paymentLines.reduce((sum: number, p: any) => sum + (p.valueInInvoiceCurrency || 0), 0);
      const debtAmount = totalAmount - totalPaid;
      const paymentStatus = debtAmount <= 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

      // c. Prepare Sale Document
      const newSaleRef = db.collection("sales").doc();
      const newSaleData = {
        id: newSaleRef.id,
        storeId,
        uid,
        salesperson: salesperson || userName,
        
        // Customer
        customerId: newCustomerId,
        customerName: customer.name,
        
        // Items & Totals (Server-Calculated)
        items: processedItems,
        invoiceCurrency,
        totalAmount,
        totalCostUsd, // For profit calculation
        
        // Payment & Debt (Server-Calculated)
        paymentLines: paymentLines, // Store the raw payments
        totalPaid: totalPaid, // Total value in invoiceCurrency
        debtAmount: debtAmount,
        paymentStatus,
        
        // Metadata
        notes: notes || null,
        createdAt: createdAt,
        invoiceId: `INV-${Date.now().toString().slice(-6)}`, // Simple invoice ID
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
            method: payment.method,
            notes: `Payment for Invoice ${newSaleData.invoiceId}`,
            createdAt: createdAt,
          });
        }
      }

      // g. Create Debit Document
      if (debtAmount > 0) {
        const debitRef = db.collection("debits").doc();
        
        // --- FIX: Match the fields in the Debts module (k.ts) ---
        transaction.set(debitRef, {
          storeId,
          customerId: newCustomerId,
          customerName: customer.name,
          clientPhone: customer.phone || null, // <-- ADDED for consistency
          clientWhatsapp: customer.whatsapp || customer.phone || null, // <-- ADDED for consistency
          relatedSaleId: newSaleRef.id,
          invoiceId: newSaleData.invoiceId,
          
          totalAmount: debtAmount,   // <-- ADDED (This was missing)
          amountDue: debtAmount,     // <-- RENAMED (from 'amount')
          totalPaid: 0,            // <-- RENAMED (from 'amountPaid')

          currency: invoiceCurrency,
          isPaid: false,
          status: 'unpaid',
          createdAt: createdAt,
          dueDate: Timestamp.fromDate(dayjs(createdAt.toDate()).add(30, 'day').toDate()), // Default 30 day due date
        });
        // --- END FIX ---
      }
      
      return newSaleData; // Return the final sale data
    }); // End of Transaction

    // 10. Return the successfully created sale
    return NextResponse.json({ success: true, sale: newSale }, { status: 201 });

  } catch (error: any) {
    console.error("[Sales API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 📊 GET - Fetch Sales Data (Your Fixed Version)
// =============================================================================
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
    
    // --- FIX: Read the status filter from the URL ---
    const status = searchParams.get("status");

    // Build base query
    let baseQuery: Query = firestoreAdmin
      .collection("sales")
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    // --- FIX: Apply status filter if it exists, otherwise hide voided/refunded ---
    if (status) {
      // If a status is provided (e.g., "paid"), filter for it
      baseQuery = baseQuery.where("paymentStatus", "==", status);
    } else {
      // Otherwise, hide 'voided' and 'refunded' by default
      baseQuery = baseQuery.where("paymentStatus", "not-in", ["voided", "refunded"]);
    }
    // --- END FIX ---

    // --- Data for Dashboard / History / Invoices ---
    
    // Get paginated list
    const paginatedQuery = baseQuery
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset((page - 1) * limit);

    // -- CRITICAL FIX: Added .get() --
    const [listSnapshot, countSnapshot] = await Promise.all([
      paginatedQuery.get(),
      baseQuery.count().get() // Get total count for pagination
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
      // For KPIs, we need all docs in range, not just one page
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

        // Payment breakdown
        data.paymentLines?.forEach((p: any) => {
          paymentMethodBreakdown.set(
            p.method,
            (paymentMethodBreakdown.get(p.method) || 0) + (p.valueInInvoiceCurrency || 0)
          );
        });

        // Sales over time
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

  } catch (error: any) {
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