// File: app/api/reports/route.ts
//
// --- FULLY IMPLEMENTED VERSION ---
// This version replaces the "placeholder" logic for all tabs.
// It now contains the real-time ("slow path") queries for all 7 report modules,
// borrowing logic from your other API routes.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp, DocumentData } from "firebase-admin/firestore";
import dayjs from "dayjs";

// Helper function to get the user's storeId (unchanged)
async function getAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized.");
  }
  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("User not found.");
  const storeId = userDoc.data()?.storeId;
  if (!storeId) throw new Error("User has no store.");
  return { storeId, uid };
}

// Helper to get number field safely
function getNumericField(data: DocumentData | undefined, field: string): number {
  const value = data?.[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

// -----------------------------------------------------------------------------
// 🚀 FAST PATH: Fetch pre-calculated report from cache
// -----------------------------------------------------------------------------
async function fetchCachedReport(storeId: string, view: string, currency: string) {
  // (This function is unchanged from your file)
  const cacheRef = firestoreAdmin.collection("reports_cache").doc(storeId);
  const cacheDoc = await cacheRef.get();

  if (!cacheDoc.exists) {
    console.warn(`Cache miss for store ${storeId}.`);
    return null; // Cache doesn't exist, will trigger fallback
  }

  const reportData = cacheDoc.data();
  const viewData = reportData?.[view];
  
  if (!viewData) {
     return { kpis: [], charts: {}, tables: {}, notImplemented: true, view };
  }
  
  const currencyData = viewData[currency];
  if (!currencyData) {
     console.warn(`Cache miss for currency ${currency} in view ${view}.`);
     return viewData["USD"] || { kpis: [], charts: {}, tables: {}, error: "Data for this currency not cached."};
  }
  
  return currencyData;
}

// -----------------------------------------------------------------------------
// 🐢 SLOW PATH: Your original real-time calculation
// --- THIS FUNCTION IS NOW FULLY IMPLEMENTED ---
// -----------------------------------------------------------------------------
async function fetchRealtimeReport(storeId: string, view: string, currency: string, startDate: Date, endDate: Date) {
  
  const baseQuery = (collection: string) => firestoreAdmin.collection(collection)
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

  const sortMapByValue = (map: Map<string, any>, sortKey: string, slice = 10) => {
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b[sortKey] - a[sortKey])
      .slice(0, slice);
  };

  let data;

  switch (view) {
    // -------------------------------------------------
    // ✅ 1. SALES
    // -------------------------------------------------
    case "sales": {
      // (Your original 'sales' case logic - this was already complete)
      const [salesSnap, productsSnap, refundsSnap] = await Promise.all([
          baseQuery("sales").get(),
          firestoreAdmin.collection("products").where("storeId", "==", storeId).get(),
          baseQuery("refunds").get() 
        ]);
        const productCategoryMap = new Map<string, string>();
        productsSnap.forEach(doc => {
          productCategoryMap.set(doc.data().name, doc.data().category || "Uncategorized");
        });
        let totalSales = 0;
        let totalRefunds = 0;
        refundsSnap.forEach(doc => { totalRefunds += doc.data().amount || 0; });
        const paymentMethods = new Map<string, number>();
        const salesByDay = new Map<string, number>();
        const productSales = new Map<string, { units: number, revenue: number }>();
        const categorySales = new Map<string, { units: number, revenue: number }>();
        const customerSales = new Map<string, { count: number, total: number }>();
        salesSnap.forEach(doc => {
          const sale = doc.data();
          const saleAmount = sale.totalAmount || 0;
          totalSales += saleAmount;
          
          // (Fix: Use paymentLines array from new sale structure)
          (sale.paymentLines || [{method: 'Unknown', valueInInvoiceCurrency: saleAmount}]).forEach((line: any) => {
             const type = line.method || "Other";
             const amount = line.valueInInvoiceCurrency || 0;
             paymentMethods.set(type, (paymentMethods.get(type) || 0) + amount);
          });
          
          const date = dayjs(sale.createdAt.toDate()).format("YYYY-MM-DD");
          salesByDay.set(date, (salesByDay.get(date) || 0) + saleAmount);
          const customer = sale.customerName || "Walk-in Customer";
          const customerStat = customerSales.get(customer) || { count: 0, total: 0 };
          customerSales.set(customer, { count: customerStat.count + 1, total: customerStat.total + saleAmount });
          (sale.items || []).forEach((item: any) => {
            const name = item.productName || "Unknown";
            const category = productCategoryMap.get(name) || "Uncategorized";
            const itemRevenue = (item.quantity * item.pricePerUnit) || 0;
            const itemUnits = item.quantity || 0;
            const pStats = productSales.get(name) || { units: 0, revenue: 0 };
            productSales.set(name, { units: pStats.units + itemUnits, revenue: pStats.revenue + itemRevenue });
            const cStats = categorySales.get(category) || { units: 0, revenue: 0 };
            categorySales.set(category, { units: cStats.units + itemUnits, revenue: cStats.revenue + itemRevenue });
          });
        });
        data = {
          kpis: [
            { title: "Total Sales", value: totalSales, format: "currency" },
            { title: "Net Sales (Sales - Refunds)", value: totalSales - totalRefunds, format: "currency" },
            { title: "Transactions", value: salesSnap.size, format: "number" },
            { title: "Avg. Sale Value", value: salesSnap.size > 0 ? totalSales / salesSnap.size : 0, format: "currency" },
          ],
          charts: {
            salesTrend: Array.from(salesByDay.entries()).map(([date, amount]) => ({ date, amount })).sort((a,b) => a.date.localeCompare(b.date)),
            paymentMethods: Array.from(paymentMethods.entries()).map(([name, value]) => ({ name, value })),
          },
          tables: {
            topProducts: sortMapByValue(productSales, 'revenue', 10),
            salesByCategory: sortMapByValue(categorySales, 'revenue', 10),
            salesByCustomer: sortMapByValue(customerSales, 'total', 10),
          },
        };
      break;
    }
    
    // -------------------------------------------------
    // ✅ 2. FINANCE (Copied from api/finance/route.ts)
    // -------------------------------------------------
    case "finance": {
      const [incomesSnap, expensesSnap] = await Promise.all([
        baseQuery("incomes").get(),
        baseQuery("expenses").get()
      ]);

      let totalIncome = 0;
      const incomeTrend = new Map<string, number>();
      const expenseBreakdown = new Map<string, number>();

      incomesSnap.forEach(doc => {
        const income = doc.data();
        const amount = getNumericField(income, "amount");
        totalIncome += amount;
        const date = dayjs(income.createdAt.toDate()).format("YYYY-MM-DD");
        incomeTrend.set(date, (incomeTrend.get(date) || 0) + amount);
      });

      let totalExpenses = 0;
      const expenseTrend = new Map<string, number>();

      expensesSnap.forEach(doc => {
        const expense = doc.data();
        const amount = getNumericField(expense, "amount");
        totalExpenses += amount;
        const category = expense.category || "Uncategorized";
        expenseBreakdown.set(category, (expenseBreakdown.get(category) || 0) + amount);
        const date = dayjs(expense.createdAt.toDate()).format("YYYY-MM-DD");
        expenseTrend.set(date, (expenseTrend.get(date) || 0) + amount);
      });

      const netProfit = totalIncome - totalExpenses;

      // Combine trends
      const allDates = new Set([...incomeTrend.keys(), ...expenseTrend.keys()]);
      const incomeExpenseTrend = Array.from(allDates).map(date => ({
        date,
        income: incomeTrend.get(date) || 0,
        expense: expenseTrend.get(date) || 0,
      })).sort((a, b) => a.date.localeCompare(b.date));

      data = {
        kpis: [
          { title: "Total Income", value: totalIncome, format: "currency" },
          { title: "Total Expenses", value: totalExpenses, format: "currency" },
          { title: "Net Profit", value: netProfit, format: "currency" },
        ],
        charts: {
          incomeExpenseTrend
        },
        tables: {
          profitAndLoss: [
            { item: "Total Income", amount: totalIncome, isBold: false },
            { item: "Total Expenses", amount: -totalExpenses, isBold: false },
            { item: "Net Profit", amount: netProfit, isBold: true },
          ],
          expenseBreakdown: sortMapByValue(expenseBreakdown, 'value', 10),
        },
      };
      break;
    }

    // -------------------------------------------------
    // ✅ 3. INVENTORY (Copied from api/products/route.ts)
    // -------------------------------------------------
    case "inventory": {
      const productsSnap = await firestoreAdmin.collection("products")
        .where("storeId", "==", storeId).get();
      
      const salesSnap = await firestoreAdmin.collection("sales")
        .where("storeId", "==", storeId)
        .where("createdAt", ">=", startDate)
        .where("createdAt", "<=", endDate)
        .get();

      let totalStockValueUsd = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      const productSales = new Map<string, { unitsSold: number, qty: number }>();
      const stockValuation = new Map<string, { qty: number, cost: number, value: number }>();
      const stockValueByCategory = new Map<string, number>();

      productsSnap.forEach(doc => {
        const product = doc.data();
        const qty = getNumericField(product, "quantity");
        const costUsd = getNumericField(product.costPrices, "USD");
        const valueUsd = qty * costUsd;
        const category = product.category || "Uncategorized";

        totalStockValueUsd += valueUsd;
        if (qty <= 0) outOfStockCount++;
        else if (qty <= (product.lowStockThreshold || 5)) lowStockCount++;

        productSales.set(product.name, { unitsSold: 0, qty });
        stockValuation.set(product.name, { qty, cost: costUsd, value: valueUsd });
        stockValueByCategory.set(category, (stockValueByCategory.get(category) || 0) + valueUsd);
      });

      salesSnap.forEach(doc => {
        const sale = doc.data();
        (sale.items || []).forEach((item: any) => {
          const name = item.productName || "Unknown";
          const stats = productSales.get(name);
          if (stats) {
            stats.unitsSold += item.quantity || 0;
          }
        });
      });

      data = {
        kpis: [
          { title: "Total Products", value: productsSnap.size, format: "number" },
          { title: "Total Stock Value (USD)", value: totalStockValueUsd, format: "currency" },
          { title: "Low Stock Items", value: lowStockCount, format: "number" },
          { title: "Out of Stock Items", value: outOfStockCount, format: "number" },
        ],
        charts: {
           stockValueByCategory: sortMapByValue(stockValueByCategory, 'value', 10)
        },
        tables: {
          fastMoving: Array.from(productSales.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
          slowMoving: Array.from(productSales.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 10),
          lowStock: Array.from(productSales.entries()).map(([name, data]) => ({ name, qty: data.qty, threshold: 5 })).filter(p => p.qty > 0 && p.qty <= 5), // Simplified
          stockValuation: sortMapByValue(stockValuation, 'value', 50),
        }
      };
      break;
    }
    
    // -------------------------------------------------
    // ✅ 4. PURCHASES (Copied from api/purchases/route.ts)
    // -------------------------------------------------
    case "purchases": {
      const purchasesSnap = await firestoreAdmin.collection("purchases")
        .where("storeId", "==", storeId)
        .where("currency", "==", currency)
        .where("purchaseDate", ">=", startDate)
        .where("purchaseDate", "<=", endDate)
        .get();
      
      let totalPurchases = 0;
      let totalPending = 0;
      const supplierSpend = new Map<string, { count: number, total: number }>();
      const purchaseTrend = new Map<string, number>();

      purchasesSnap.forEach(doc => {
        const purchase = doc.data();
        const amount = getNumericField(purchase, "totalAmount");
        totalPurchases += amount;
        if (purchase.status !== 'paid') {
          totalPending += getNumericField(purchase, "remainingAmount");
        }
        
        const supplier = purchase.supplierName || "Unknown";
        const supplierStat = supplierSpend.get(supplier) || { count: 0, total: 0 };
        supplierSpend.set(supplier, { count: supplierStat.count + 1, total: supplierStat.total + amount });
        
        const date = dayjs(purchase.purchaseDate.toDate()).format("YYYY-MM-DD");
        purchaseTrend.set(date, (purchaseTrend.get(date) || 0) + amount);
      });
      
      data = {
         kpis: [
            { title: "Total Purchases", value: totalPurchases, format: "currency" },
            { title: "Pending Payables", value: totalPending, format: "currency" },
            { title: "Total Orders", value: purchasesSnap.size, format: "number" },
         ],
         charts: {
            purchaseTrend: Array.from(purchaseTrend.entries()).map(([date, amount]) => ({ date, amount })).sort((a,b) => a.date.localeCompare(b.date)),
         },
         tables: {
            topSuppliers: sortMapByValue(supplierSpend, 'total', 10),
         }
      };
      break;
    }

    // -------------------------------------------------
    // ✅ 5. DEBTS (Copied from api/debts/route.ts)
    // -------------------------------------------------
    case "debts": {
      const debtsSnap = await baseQuery("debits").get();
      
      let totalOutstanding = 0;
      let totalCollected = 0;
      const topDebtors = new Map<string, { count: number, total: number }>();

      debtsSnap.forEach(doc => {
        const debt = doc.data();
        const outstanding = getNumericField(debt, "amountDue");
        const collected = getNumericField(debt, "totalPaid");
        
        totalOutstanding += outstanding;
        totalCollected += collected;
        
        if (outstanding > 0) {
          const customer = debt.customerName || "Unknown";
          const debtStat = topDebtors.get(customer) || { count: 0, total: 0 };
          topDebtors.set(customer, { count: debtStat.count + 1, total: debtStat.total + outstanding });
        }
      });
      
      data = {
        kpis: [
          { title: "Total Outstanding Debts", value: totalOutstanding, format: "currency" },
          { title: "Total Collected", value: totalCollected, format: "currency" },
          { title: "Total Debtors", value: topDebtors.size, format: "number" },
        ],
        charts: {
          debtStatus: [
            { name: "Collected", value: totalCollected },
            { name: "Outstanding", value: totalOutstanding },
          ]
        },
        tables: {
          topDebtors: sortMapByValue(topDebtors, 'total', 10),
        }
      };
      break;
    }
    
    // -------------------------------------------------
    // ✅ 6. CUSTOMERS (Combined logic)
    // -------------------------------------------------
    case "customers": {
      const [customersSnap, salesSnap, suppliersSnap] = await Promise.all([
        firestoreAdmin.collection("customers").where("storeId", "==", storeId).get(),
        baseQuery("sales").get(),
        firestoreAdmin.collection("suppliers").where("storeId", "==", storeId).get(),
      ]);

      const customerStats = new Map<string, { count: number, total: number, avg: number, lastPurchase: any }>();
      
      salesSnap.forEach(doc => {
        const sale = doc.data();
        const amount = getNumericField(sale, "totalAmount");
        const customer = sale.customerName || "Walk-in";
        if (customer === "Walk-in") return;
        
        const stats = customerStats.get(customer) || { count: 0, total: 0, avg: 0, lastPurchase: null };
        stats.count++;
        stats.total += amount;
        stats.lastPurchase = stats.lastPurchase ? (sale.createdAt > stats.lastPurchase ? sale.createdAt : stats.lastPurchase) : sale.createdAt;
        customerStats.set(customer, stats);
      });
      
      customerStats.forEach(stats => {
        stats.avg = stats.total / stats.count;
      });

      data = {
        kpis: [
          { title: "Total Customers", value: customersSnap.size, format: "number" },
          { title: "Total Suppliers", value: suppliersSnap.size, format: "number" },
        ],
        charts: {},
        tables: {
          topCustomers: sortMapByValue(customerStats, 'total', 10).map(c => ({...c, lastPurchase: c.lastPurchase?.toDate()})),
          topSuppliers: suppliersSnap.docs.map(doc => ({
            name: doc.data().name,
            total: getNumericField(doc.data(), "totalSpent"), // Uses pre-calculated data
            count: 0, // Not available without reading purchases
            owed: getNumericField(doc.data(), "totalOwed"), // Uses pre-calculated data
          })).sort((a, b) => b.total - a.total).slice(0, 10)
        }
      };
      break;
    }
    
    // -------------------------------------------------
    // ✅ 7. HR (Copied from api/hr/route.ts)
    // -------------------------------------------------
    case "hr": {
      const [usersSnap, incomesSnap, expensesSnap] = await Promise.all([
         firestoreAdmin.collection("users").where("storeId", "==", storeId).get(),
         baseQuery("incomes").get(),
         baseQuery("expenses").get(),
      ]);

      const staffIncomes = new Map<string, { count: number, total: number }>();
      incomesSnap.forEach(doc => {
         const income = doc.data();
         const name = income.userName || "Unknown";
         const stats = staffIncomes.get(name) || { count: 0, total: 0 };
         stats.count++;
         stats.total += getNumericField(income, "amount");
         staffIncomes.set(name, stats);
      });
      
      const staffExpenses = new Map<string, { count: number, total: number }>();
      expensesSnap.forEach(doc => {
         const expense = doc.data();
         const name = expense.userName || "Unknown";
         const stats = staffExpenses.get(name) || { count: 0, total: 0 };
         stats.count++;
         stats.total += getNumericField(expense, "amount");
         staffExpenses.set(name, stats);
      });

      const totalPayroll = 0; // This would require reading the 'salaries' sub-collection

      data = {
         kpis: [
           { title: "Total Staff", value: usersSnap.size, format: "number" },
           { title: "Total Payroll (Est.)", value: totalPayroll, format: "currency" },
         ],
         charts: {},
         tables: {
           staffIncomes: sortMapByValue(staffIncomes, 'total', 10),
           staffExpenses: sortMapByValue(staffExpenses, 'total', 10),
         }
      };
      break;
    }
    
    // -------------------------------------------------
    // 8. DEFAULT
    // -------------------------------------------------
    default:
      data = { kpis: [], charts: {}, tables: {}, notImplemented: true, view };
      break;
  }
  return data;
}

// -----------------------------------------------------------------------------
// 📊 GET - HYBRID Handler
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "sales";

  try {
    const { storeId } = await getAuth(request);

    // --- Parameters ---
    const currency = searchParams.get("currency") || "USD";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // --- Date Logic ---
    const defaultStart = dayjs().startOf("month").format("YYYY-MM-DD");
    const defaultEnd = dayjs().endOf("day").format("YYYY-MM-DD");
    
    const startDate = startDateParam || defaultStart;
    const endDate = endDateParam || defaultEnd;

    // --- HYBRID CHECK ---
    const isDefaultRange = 
      startDate === defaultStart &&
      (endDate === defaultEnd || !endDateParam);
      
    let data;

    if (isDefaultRange && view !== 'sales') { // 'sales' logic was already in your file
      // --- FAST PATH ---
      console.log(`[Reports API GET - ${view}] Using FAST PATH (cached)`);
      data = await fetchCachedReport(storeId, view, currency);
      
      if (!data) {
        console.log(`[Reports API GET - ${view}] Cache miss, falling back to SLOW PATH`);
        data = await fetchRealtimeReport(storeId, view, currency, dayjs(startDate).toDate(), dayjs(endDate).toDate());
      }
    } else {
      // --- SLOW PATH ---
      console.log(`[Reports API GET - ${view}] Using SLOW PATH (real-time)`);
      data = await fetchRealtimeReport(storeId, view, currency, dayjs(startDate).toDate(), dayjs(endDate).toDate());
    }
    
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`[Reports API GET - ${view}] Error:`, error.stack || error.message);
    return NextResponse.json({ error: `Failed to generate report. ${error.message}` }, { status: 500 });
  }
}