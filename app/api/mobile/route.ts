import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";
import dayjs from "dayjs";

// --- Helper: Authentication ---
async function checkAuth(
  request: NextRequest,
  allowedRoles: ('admin' | 'manager' | 'user' | 'cashier')[]
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
    throw new Error("Forbidden: You do not have permission to perform this action.");
  }
  
  return { uid, storeId, role, userName: userData?.name || "System User" };
}

// =============================================================================
// 🚀 POST - Create New Sale (Mobile Optimized)
// =============================================================================
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Internal server error: Admin SDK not configured." }, { status: 500 });
  }

  const db = firestoreAdmin;
  
  try {
    // 1. Authenticate
    const { storeId, uid, userName } = await checkAuth(request, ['admin', 'manager', 'user', 'cashier']);

    // 2. Parse Data
    const body = await request.json();
    const {
      customer, 
      invoiceCurrency, 
      items: rawItems, 
      paymentLines, 
      saleDate, 
      salesperson, // <--- Now prioritized
      notes,
    } = body;
    
    // 3. Validate
    if (!invoiceCurrency || !rawItems || rawItems.length === 0 || !customer) {
      return NextResponse.json({ error: "Invalid data. Missing required fields." }, { status: 400 });
    }
    
    const createdAt = saleDate ? Timestamp.fromDate(dayjs(saleDate).toDate()) : Timestamp.now();
    let newCustomerId = customer.id;
    let isNewCustomer = false;

    // 4. Start Transaction (Atomic Safety)
    const newSale = await db.runTransaction(async (transaction) => {
      let serverCalculatedTotal = 0; // <--- SECURITY FIX: We calculate this, we don't trust the app.
      let totalCostUsd = 0;
      const processedItems = [];
      const productUpdates = []; 
      
      // --- A. DUPLICATE CUSTOMER CHECK ---
      if (newCustomerId.startsWith("new_") || newCustomerId === "walkin") {
        if (customer.phone && customer.phone.length > 3) {
           const existingQuery = db.collection("customers")
            .where("storeId", "==", storeId)
            .where("phone", "==", customer.phone)
            .limit(1);
            
          const existingSnap = await transaction.get(existingQuery);
          
          if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            newCustomerId = existingDoc.id;
            // Update existing customer data
            transaction.set(existingDoc.ref, {
               name: customer.name,
               address: customer.address || existingDoc.data().address || null, // Preserve or update address
               updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          } else {
            isNewCustomer = true;
          }
        } else {
             // No phone provided, treat as new if not walkin
             if(newCustomerId !== "walkin") isNewCustomer = true;
        }
      }

      // --- B. READ PRODUCTS (Locking Inventory) ---
      const productRefsToFetch = [];
      const manualItems = [];

      for (const item of rawItems) {
        if (item.productId && item.productId.startsWith("temp_")) {
           // Handle case where app sends temp ID but product was just created.
           // In a perfect world, app awaits ID. If not, we might fail here or treat as manual.
           // For safety, we treat strictly as manual if ID is unknown or fail.
           // Here assuming standard flow:
           manualItems.push(item);
        } else if (item.productId && !item.productId.startsWith("manual_")) {
          productRefsToFetch.push({
            ref: db.collection("products").doc(item.productId),
            item: item,
          });
        } else {
          manualItems.push(item);
        }
      }
      
      const productDocs = await Promise.all(
        productRefsToFetch.map(p => transaction.get(p.ref))
      );

      // --- C. PROCESS & RECALCULATE ---
      for (let i = 0; i < productDocs.length; i++) {
        const productDoc = productDocs[i];
        const { ref, item } = productRefsToFetch[i]; 

        if (!productDoc.exists) {
           // If product deleted while selling, fail safely or convert to manual
           throw new Error(`Product not found (ID: ${item.productId}). Inventory may have changed.`);
        }
        const productData = productDoc.data();
        
        // 1. Stock Check (Race Condition Fix)
        const currentStock = productData?.quantity || 0;
        if (currentStock < item.quantity) { 
          throw new Error(`Stock mismatch for ${productData?.name}. Available: ${currentStock}, Requested: ${item.quantity}`);
        }

        // 2. Price Logic (Trust App Unit Price for discounts, but recalc Total)
        // Note: We trust pricePerUnit from app to allow bargaining/manual edits,
        // BUT we recalculate the subtotal to prevent math errors.
        const pricePerUnit = Number(item.pricePerUnit) || 0;
        const qty = Number(item.quantity) || 0;
        const discount = Number(item.discount) || 0;

        const subtotal = (pricePerUnit * qty) * (1 - (discount / 100));
        
        // Cost Calculation (Always from DB for accuracy)
        const itemCostUsd = (productData?.costPrices?.USD || 0) * qty;
        
        serverCalculatedTotal += subtotal;
        totalCostUsd += itemCostUsd;
        
        processedItems.push({
          ...item,
          productId: productDoc.id, // Ensure real ID
          productName: productData?.name || item.productName,
          pricePerUnit: pricePerUnit,
          costPriceUsd: productData?.costPrices?.USD || 0,
          subtotal: subtotal // Saved for record
        });
        
        productUpdates.push({
          ref: ref,
          change: -qty
        });
      }

      // Handle Manual Items
      for (const item of manualItems) {
        const price = Number(item.pricePerUnit) || 0;
        const qty = Number(item.quantity) || 0;
        const subtotal = (price * qty) * (1 - (Number(item.discount) || 0) / 100);
        
        serverCalculatedTotal += subtotal;
        
        processedItems.push({
          ...item,
          pricePerUnit: price,
          costPriceUsd: 0,
          subtotal: subtotal
        });
      }
      
      // --- D. PAYMENT RECONCILIATION ---
      const totalPaid = paymentLines.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      // Floating point safe comparison
      const diff = totalPaid - serverCalculatedTotal;
      if (diff > 0.05) {
        throw new Error(`Overpayment detected. Total paid (${totalPaid.toFixed(2)}) exceeds total amount (${serverCalculatedTotal.toFixed(2)}).`);
      }
      
      const debtAmount = serverCalculatedTotal - totalPaid;
      const safeDebtAmount = debtAmount < 0.05 ? 0 : debtAmount;
      const paymentStatus = safeDebtAmount <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

      // --- E. WRITE PHASE: Customer ---
      let customerRef;

      if (newCustomerId === "walkin") {
        newCustomerId = "walkin";
      } else if (isNewCustomer) {
        // Create NEW Customer
        customerRef = db.collection("customers").doc();
        newCustomerId = customerRef.id;
        
        transaction.set(customerRef, {
          storeId: storeId,
          name: customer.name,
          phone: customer.phone || null,
          address: customer.address || null, // Capture address
          whatsapp: customer.whatsapp || null,
          notes: customer.notes || null,
          createdAt: FieldValue.serverTimestamp(),
          totalSpent: {},
          totalOwed: {},
        }, { merge: true });

        // KPIs
        transaction.update(customerRef, {
          [`totalSpent.${invoiceCurrency}`]: FieldValue.increment(serverCalculatedTotal)
        });
        if (safeDebtAmount > 0) {
          transaction.update(customerRef, {
            [`totalOwed.${invoiceCurrency}`]: FieldValue.increment(safeDebtAmount)
          });
        }

      } else {
        // Update EXISTING Customer
        customerRef = db.collection("customers").doc(newCustomerId);
        
        // Update contact info if requested
        if (customer.saveToContacts) {
          transaction.set(customerRef, {
            name: customer.name,
            phone: customer.phone || null,
            address: customer.address || null,
            whatsapp: customer.whatsapp || null,
          }, { merge: true });
        }
        
        transaction.update(customerRef, {
          [`totalSpent.${invoiceCurrency}`]: FieldValue.increment(serverCalculatedTotal)
        });
        if (safeDebtAmount > 0) {
          transaction.update(customerRef, {
            [`totalOwed.${invoiceCurrency}`]: FieldValue.increment(safeDebtAmount)
          });
        }
      }

      // --- F. WRITE PHASE: Sale Document ---
      const productIds = processedItems.map(item => item.productId);
      const newSaleRef = db.collection("sales").doc();
      
      const newSaleData = {
        id: newSaleRef.id,
        storeId,
        uid,
        salesperson: salesperson || userName, // Prioritize App-sent name
        customerId: newCustomerId,
        customerName: customer.name,
        customerAddress: customer.address || null,
        items: processedItems,
        productIds: productIds,
        invoiceCurrency,
        totalAmount: serverCalculatedTotal, // TRUST SERVER MATH
        totalCostUsd,
        paymentLines: paymentLines,
        totalPaid: totalPaid,
        debtAmount: safeDebtAmount,
        paymentStatus,
        notes: notes || null,
        createdAt: createdAt,
        invoiceId: `INV-${Date.now().toString().slice(-6)}`,
      };
      
      transaction.set(newSaleRef, newSaleData);

      // --- G. WRITE PHASE: Stock ---
      for (const update of productUpdates) {
        transaction.update(update.ref, { 
          quantity: FieldValue.increment(update.change) 
        });
      }
      
      // --- H. WRITE PHASE: Incomes ---
      for (const payment of paymentLines) {
        if (Number(payment.amount) > 0) {
          const incomeRef = db.collection("incomes").doc();
          transaction.set(incomeRef, {
            storeId,
            uid,
            relatedSaleId: newSaleRef.id,
            amount: Number(payment.amount),
            currency: payment.currency,
            paymentMethod: payment.method || "Cash",
            category: "Sales",
            description: `Sale: ${newSaleData.invoiceId}`,
            notes: `Auto-generated from Sale`,
            createdAt: createdAt,
          });
        }
      }

      // --- I. WRITE PHASE: Debts ---
      if (safeDebtAmount > 0) {
        const debitRef = db.collection("debits").doc();
        transaction.set(debitRef, {
          storeId,
          customerId: newCustomerId,
          clientName: customer.name, 
          clientPhone: customer.phone || null,
          clientWhatsapp: customer.address || null, // Using address field for clarity
          relatedSaleId: newSaleRef.id,
          invoiceId: newSaleData.invoiceId,
          reason: `Debt for ${newSaleData.invoiceId}`,
          totalAmount: safeDebtAmount,
          amountDue: safeDebtAmount,
          totalPaid: 0,
          currency: invoiceCurrency,
          isPaid: false,
          status: 'unpaid',
          createdAt: createdAt,
          dueDate: Timestamp.fromDate(dayjs(createdAt.toDate()).add(30, 'day').toDate()),
        });
      }
      
      return newSaleData; 
    }); 

    return NextResponse.json({ success: true, sale: newSale }, { status: 201 });

  } catch (error: any) {
    console.error("[Mobile Sales API] Error:", error.stack || error.message);
    if (error.message.includes("Overpayment detected") || error.message.includes("Stock mismatch")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: `Server Error: ${error.message}` }, { status: 500 });
  }
}

// =============================================================================
// 📊 GET - Fetch Sales (Mobile Optimized)
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await checkAuth(request, ['admin', 'manager', 'user', 'cashier']);
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const currency = searchParams.get("currency") || "USD";

    // --- Search Logic ---
    const searchQuery = searchParams.get("search"); // Mobile uses 'search', not 'searchQuery'
    
    if (view === "search_products") {
      if (!searchQuery) return NextResponse.json({ products: [] });
      const productsQuery = firestoreAdmin.collection("products")
        .where("storeId", "==", storeId)
        .orderBy("name")
        .startAt(searchQuery)
        .endAt(searchQuery + "\uf8ff")
        .limit(20);
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

    // --- List Logic ---
    const startDate = dayjs(searchParams.get("startDate") || dayjs().startOf("month")).startOf("day").toDate();
    const endDate = dayjs(searchParams.get("endDate") || dayjs().endOf("month")).endOf("day").toDate();
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;
    const status = searchParams.get("status");

    // Query Construction
    let baseQuery: Query = firestoreAdmin
      .collection("sales")
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    if (status && status !== 'all') {
      baseQuery = baseQuery.where("paymentStatus", "==", status);
    }

    // Sort Descending (Newest First)
    baseQuery = baseQuery.orderBy("createdAt", "desc");

    // Run Queries
    const paginatedQuery = baseQuery.limit(limit).offset((page - 1) * limit);
    const [listSnapshot, countSnapshot] = await Promise.all([
      paginatedQuery.get(),
      baseQuery.count().get() 
    ]);

    const salesList = listSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate().toISOString(),
    }));

    // --- Dashboard View Support ---
    if (view === "dashboard") {
       // Logic mirrored from web route if needed, 
       // or simplified for mobile efficiency.
       // For mobile dashboard, we usually return list + simple totals.
       const totalMatchingSales = countSnapshot.data().count;
       return NextResponse.json({
         view: "dashboard",
         salesList,
         pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalMatchingSales / limit),
            totalRecords: totalMatchingSales,
            hasMore: totalMatchingSales > (page * limit)
         },
         // Add simple KPIs here if Mobile Dashboard needs them immediately
         kpis: {
             totalTransactions: totalMatchingSales,
             // Note: real totals require aggregation query or 'dashboard' collection
         }
       });
    }

    return NextResponse.json({
      view: view || 'list',
      salesList,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(countSnapshot.data().count / limit),
        totalRecords: countSnapshot.data().count,
        hasMore: countSnapshot.data().count > (page * limit)
      }
    });

  } catch (error: any) {
    console.error("[Mobile API GET] Error:", error.message);
    return NextResponse.json({ error: `Load failed: ${error.message}` }, { status: 500 });
  }
}
