// File: /functions_new/src/index.ts
//
// --- ISBEDELADA CUSUB ---
// 1. (FIX) Lagu saxay TS18048 (possibly 'undefined') ee onPurchaseWriteUpdateSupplier
//    iyadoo la hubinayo '.exists' ka hor inta aan la isticmaalin '.data()'.
// 2. (FIX) Lagu saxay TS18048 ee onSaleCreated, onDebitCreated, iyo onDebitUpdated
//    iyadoo la hubinayo '.exists' iyo '.data()' si sax ah.
// -----------------------------------------------------------------------------

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import dayjs from "dayjs";

admin.initializeApp();
const db = admin.firestore();

// =============================================================================
// PATTERN 1: THE SCHEDULED AGGREGATOR (UNCHANGED)
// =============================================================================
export const generateDailyReports = onSchedule({
  schedule: "every day 03:00",
  timeZone: "Africa/Mogadishu", // Set to your timezone
}, async (event: any) => { // <-- FIX 1: Added 'event: any'
  
  // (Kani waa sidii hore)
  console.log("Starting nightly aggregation...");

  const usersSnap = await db.collection("users").get();
  const storeIds = new Set<string>();
  usersSnap.forEach((doc) => {
    if (doc.data()?.storeId) storeIds.add(doc.data().storeId);
  });

  for (const storeId of storeIds) {
    console.log(`Aggregating data for store: ${storeId}`);
    try {
      const defaultStartDate = dayjs().startOf("month").startOf("day").toDate();
      const defaultEndDate = dayjs().endOf("day").toDate();
      
      // --- 2a. Run Supplier KPI aggregation ---
      const supplierStats = await aggregateSupplierStats(storeId);
      const batch = db.batch();
      for (const [id, stats] of supplierStats.entries()) {
        const ref = db.collection("suppliers").doc(id);
        batch.update(ref, { 
          totalOwed: stats.totalOwed,
          totalSpent: stats.totalSpent
        });
      }
      await batch.commit();
      console.log(`Updated supplier stats for store: ${storeId}`);

      // --- 2b. Run Product KPI aggregation ---
      const productKPIs = await aggregateProductKPIs(storeId);
      const kpiRef = db.collection("reports_cache").doc(storeId); 
      await kpiRef.set({ product_kpis: productKPIs }, { merge: true });
      console.log(`Updated product KPIs for store: ${storeId}`);
      
      // --- 2c. Run Full Reports aggregation ---
      const currencies = ["USD", "SLSH", "SOS"];
      const fullReport: any = {
        sales: {},
        finance: {},
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        reportRange: {
          start: defaultStartDate,
          end: defaultEndDate,
          label: "This Month",
        },
      };

      for (const currency of currencies) {
        fullReport.sales[currency] = await aggregateSalesTab(storeId, currency, defaultStartDate, defaultEndDate);
        fullReport.finance[currency] = await aggregateFinanceTab(storeId, currency, defaultStartDate, defaultEndDate);
      }
      
      await kpiRef.set(fullReport, { merge: true });
      console.log(`Generated full report for store: ${storeId}`);

    } catch (error: any) {
      console.error(`Failed to aggregate for store ${storeId}:`, error.message);
    }
  }
  console.log("Nightly aggregation complete.");
});

// (Helper functions waa sidoodii)
async function aggregateSupplierStats(storeId: string) {
  const purchasesSnap = await db.collection("purchases")
    .where("storeId", "==", storeId).get();
  
  const statsMap = new Map<string, { totalOwed: number, totalSpent: number }>();

  purchasesSnap.forEach(doc => {
    const po = doc.data();
    if (!po.supplierId) return;
    const stats = statsMap.get(po.supplierId) || { totalOwed: 0, totalSpent: 0 };
    if (po.status === "pending" || po.status === "partially_paid") {
      stats.totalOwed += po.remainingAmount || 0;
    }
    if (po.status === "paid" || po.status === "partially_paid") {
      stats.totalSpent += po.paidAmount || 0;
    }
    statsMap.set(po.supplierId, stats);
  });
  return statsMap;
}
async function aggregateProductKPIs(storeId: string) {
  const productsSnap = await db.collection("products")
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
  else if (qty <= (product.lowStockThreshold || 5)) kpis.lowStock++;
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
async function aggregateSalesTab(storeId: string, currency: string, startDate: Date, endDate: Date) {
  return {
    kpis: [{ title: "Total Sales", value: 0, format: "currency" }],
    charts: { salesTrend: [] },
    tables: { topProducts: [] },
  };
}
async function aggregateFinanceTab(storeId: string, currency: string, startDate: Date, endDate: Date) {
  return {
    kpis: [{ title: "Total Revenue", value: 0, format: "currency" }],
    charts: {},
    tables: {},
  };
}


// =============================================================================
// PATTERN 2: THE REAL-TIME TRIGGER FUNCTIONS (FIXED)
// =============================================================================

export const onPurchaseWriteUpdateSupplier = onDocumentWritten("purchases/{purchaseId}", async (event: any) => { // <-- FIX 2: Added 'event: any'
  const change = event.data; 
  if (!change) {
    console.log("onPurchaseWriteUpdateSupplier: No data change, exiting.");
    return;
  }
  
  // -- FIX: Si ammaan ah u hel 'data' adigoo hubinaya '.exists' --
  const beforeData = change.before.exists ? change.before.data() : undefined;
  const afterData = change.after.exists ? change.after.data() : undefined;

  // -- FIX: Hubi in midkood 'before' ama 'after' uu jiro --
  if (!beforeData && !afterData) {
    console.log("onPurchaseWriteUpdateSupplier: No data before or after, exiting.");
    return;
  }

  const supplierId = afterData?.supplierId || beforeData?.supplierId;
  const storeId = afterData?.storeId || beforeData?.storeId; 
  
  if (!supplierId || !storeId) {
    console.log("Missing supplierId or storeId, exiting.");
    return;
  }

  const purchasesSnap = await db.collection("purchases")
    .where("storeId", "==", storeId) 
    .where("supplierId", "==", supplierId)
    .get();

   let totalOwed = 0;
  let totalSpent = 0;
  purchasesSnap.forEach(doc => {
    const po = doc.data();
    if (po.status === "pending" || po.status === "partially_paid") {
      totalOwed += po.remainingAmount || 0;
    }
    if (po.status === "paid" || po.status === "partially_paid") {
      totalSpent += po.paidAmount || 0;
    }
  });

  const supplierRef = db.collection("suppliers").doc(supplierId);
  return supplierRef.update({ totalOwed, totalSpent });
});

export const onProductWriteUpdateKPIs = onDocumentWritten("products/{productId}", async (event: any) => { // <-- FIX 3: Added 'event: any'
  console.log("Product written, nightly job will update KPIs.");
  return;
});

// =============================================================================
// *** CUSUB: REAL-TIME TRIGGERS FOR CUSTOMER KPIs (FIXED) ***
// =============================================================================

export const onSaleCreated = onDocumentWritten("sales/{saleId}", async (event: any) => { // <-- FIX 4: Added 'event: any'
  // -- FIX: Hubi in 'event.data' uu jiro --
  if (!event.data) {
    console.log("onSaleCreated: No event data, exiting.");
    return;
  }
  
  // Kaliya shaqee marka document cusub la abuuro
  // -- FIX: Hubi in 'after.exists' laakiin 'before' uusan jirin --
  if (event.data.before.exists || !event.data.after.exists) {
    return;
  }
  
  const saleData = event.data.after.data();
  if (!saleData) return;

  const customerId = saleData.customerId;
  const totalAmount = saleData.totalAmount || 0; 
  const currency = saleData.invoiceCurrency;

  if (!customerId || customerId === "walkin" || totalAmount === 0 || !currency) {
    console.log("Skipping onSaleCreated: No customerId, walk-in, or zero amount.");
    return;
  }

  const customerRef = db.collection("customers").doc(customerId);

  try {
    const fieldToUpdate = `totalSpent.${currency}`;
    
    await customerRef.update({
      [fieldToUpdate]: admin.firestore.FieldValue.increment(totalAmount),
      'lastActive': admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Updated totalSpent for customer ${customerId} by ${totalAmount} ${currency}`);
  } catch (error) {
    console.error(`Failed to update totalSpent for customer ${customerId}:`, error);
  }
});

export const onDebitCreated = onDocumentWritten("debits/{debitId}", async (event: any) => { // <-- FIX 5: Added 'event: any'
   // -- FIX: Hubi in 'event.data' uu jiro --
  if (!event.data) {
    console.log("onDebitCreated: No event data, exiting.");
    return;
  }
  
  // Kaliya shaqee marka document cusub la abuuro
  // -- FIX: Hubi in 'after.exists' laakiin 'before' uusan jirin --
  if (event.data.before.exists || !event.data.after.exists) {
    return;
  }

  const debitData = event.data.after.data();
  if (!debitData) return;

  const customerId = debitData.customerId;
  const amountOwed = debitData.amount || 0;
  const currency = debitData.currency;

  if (!customerId || customerId === "walkin" || amountOwed === 0 || !currency) {
    console.log("Skipping onDebitCreated: No customerId, walk-in, or zero amount.");
    return;
  }

  const customerRef = db.collection("customers").doc(customerId);

  try {
    const fieldToUpdate = `totalOwed.${currency}`;
    
    await customerRef.update({
      [fieldToUpdate]: admin.firestore.FieldValue.increment(amountOwed)
    });
    
    console.log(`Updated totalOwed for customer ${customerId} by ${amountOwed} ${currency}`);
  } catch (error) {
    console.error(`Failed to update totalOwed for customer ${customerId}:`, error);
  }
});

export const onDebitUpdated = onDocumentWritten("debits/{debitId}", async (event: any) => { // <-- FIX 6: Added 'event: any'
  // -- FIX: Hubi in 'event.data' IYO before/after ay jiraan --
  if (!event.data || !event.data.before.exists || !event.data.after.exists) {
    console.log("onDebitUpdated: Event is not an update, exiting.");
    return;
  }

  // Hadda waa ammaan in la isticmaalo
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // -- FIX: Hubi in 'data' uusan 'undefined' ahayn (inkastoo 'exists' la hubiyay) --
  if (!beforeData || !afterData) {
      console.log("onDebitUpdated: Data is missing, exiting.");
      return;
  }

  // Hubi haddii deynta hadda la bixiyay ama la 'void'-gareeyay
  const justPaid = beforeData.status !== 'paid' && afterData.status === 'paid';
  const justVoided = beforeData.status !== 'voided' && afterData.status === 'voided';
  
  if (!justPaid && !justVoided) {
    return; // Waxba iskama beddelin xaaladda (status)
   }

  const customerId = afterData.customerId;
  const amount = afterData.amount || 0;
  const currency = afterData.currency;
  
  const amountToDecrease = -amount;

  if (!customerId || customerId === "walkin" || amount === 0 || !currency) {
    console.log("Skipping onDebitUpdated: No customerId, walk-in, or zero amount.");
   return;
  }
  
  const customerRef = db.collection("customers").doc(customerId);

  try {
    const fieldToUpdate = `totalOwed.${currency}`;
    
    await customerRef.update({
      [fieldToUpdate]: admin.firestore.FieldValue.increment(amountToDecrease)
    });
    
    console.log(`Decreased totalOwed for customer ${customerId} by ${amount} ${currency}`);
  } catch (error) {
    console.error(`Failed to decrease totalOwed for customer ${customerId}:`, error);
  }
});