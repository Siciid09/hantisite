// -----------------------------------------------------------------------------
// File: app/api/dashboard/route.ts
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";

import { type DashboardSummary } from "../types";

// --- CONSTANTS ---
const PAYMENT_METHODS: Record<string, string[]> = {
  USD: ["CASH", "BANK", "ZAAD", "EDAHAB", "SOMNET", "EVC_PLUS", "SAHAL", "OTHER"],
  SLSH: ["CASH", "BANK", "ZAAD", "EDAHAB", "OTHER"],
  SOS: ["CASH", "BANK", "EVC_PLUS", "OTHER"],
  EUR: ["CASH", "BANK", "OTHER"],
  KES: ["CASH", "BANK", "M_PESA", "OTHER"],
  BIRR: ["CASH", "BANK", "E_BIRR", "OTHER"],
};

// -----------------------------------------------------------------------------
//  HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function getNumericField(data: DocumentData, field: string): number {
  const value = data[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

// Generic Sum Helper
async function getAggregateSum(
  collectionName: string,
  amountField: string,
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  try {
    const collRef = firestoreAdmin.collection(collectionName);
    const q = collRef
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      total += getNumericField(doc.data(), amountField);
    });
    return total;
  } catch (error: any) {
    console.warn(`Warning for ${collectionName}: ${error.message}`);
    return 0;
  }
}

// Calculates REVENUE (Total Sales Value for KPI only)
async function getSalesSum(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  try {
    const collRef = firestoreAdmin.collection("sales");
    const q = collRef
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);
      
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      total += getNumericField(doc.data(), "totalAmount");
    });
    return total;
  } catch (error: any) {
    console.warn(`Warning for getSalesSum: ${error.message}`);
    return 0;
  }
}

// --- [UPDATED] Running Balance Logic ---
// logic strictly matches Finance API: (Incomes - Expenses)
// We removed the code that looked at the 'sales' collection to avoid double counting.
async function getRunningBalance(
  storeId: string,
  currency: string,
  paymentMethod: string
): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  
  try {
    const [incomeSnap, expenseSnap] = await Promise.all([
      // 1. All Money In (Incomes collection is the Source of Truth)
      firestoreAdmin.collection("incomes")
        .where("storeId", "==", storeId)
        .where("currency", "==", currency)
        .where("paymentMethod", "==", paymentMethod)
        .get(),

      // 2. All Money Out (Expenses)
      firestoreAdmin.collection("expenses")
        .where("storeId", "==", storeId)
        .where("currency", "==", currency)
        .where("paymentMethod", "==", paymentMethod)
        .get()
    ]);

    let totalIncome = 0;
    incomeSnap.forEach(doc => totalIncome += getNumericField(doc.data(), "amount"));

    let totalExpense = 0;
    expenseSnap.forEach(doc => totalExpense += getNumericField(doc.data(), "amount"));

    // Final Balance Calculation
    return totalIncome - totalExpense;

  } catch (error: any) {
    console.warn(`Warning for getRunningBalance (${paymentMethod}): ${error.message}`);
    return 0;
  }
}

async function getTotalOutstandingDebts(storeId: string, currency: string): Promise<number> {
  if (!firestoreAdmin) return 0;
  const collRef = firestoreAdmin.collection("debits");
  const q = collRef
    .where("storeId", "==", storeId)
    .where("currency", "==", currency)
    .where("status", "!=", "paid");
  
  try {
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      total += getNumericField(doc.data(), "amountDue");
    });
    return total;
  } catch (error: any) {
    return 0;
  }
}

async function getTotalPayables(storeId: string, currency: string): Promise<number> {
  if (!firestoreAdmin) return 0;
  const collRef = firestoreAdmin.collection("purchases");
  const q = collRef
    .where("storeId", "==", storeId)
    .where("currency", "==", currency)
    .where("status", "!=", "paid");
  
  try {
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      total += getNumericField(doc.data(), "remainingAmount");
    });
    return total;
  } catch (error: any) {
    return 0;
  }
}

async function getTotalProducts(storeId: string): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  const collRef = firestoreAdmin
    .collection("products")
    .where("storeId", "==", storeId);
  const snapshot = await collRef.count().get();
  return snapshot.data().count;
}

async function getIncomeExpenseTrend(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<DashboardSummary["incomeExpenseTrend"]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");

  try {
    const incomePromise = firestoreAdmin
      .collection("incomes")
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .get();

    const expensePromise = firestoreAdmin
      .collection("expenses")
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .get();

    const [incomeSnap, expenseSnap] = await Promise.all([
      incomePromise,
      expensePromise,
    ]);

    const trendMap = new Map<string, { income: number; expense: number }>();

    incomeSnap.forEach((doc) => {
      const data = doc.data();
      const date = (data.createdAt as Timestamp).toDate();
      const dateKey = dayjs(date).format("YYYY-MM-DD");
      const amount = getNumericField(data, "amount");
      const current = trendMap.get(dateKey) || { income: 0, expense: 0 };
      current.income += amount;
      trendMap.set(dateKey, current);
    });

    expenseSnap.forEach((doc) => {
      const data = doc.data();
      const date = (data.createdAt as Timestamp).toDate();
      const dateKey = dayjs(date).format("YYYY-MM-DD");
      const amount = getNumericField(data, "amount");
      const current = trendMap.get(dateKey) || { income: 0, expense: 0 };
      current.expense += amount;
      trendMap.set(dateKey, current);
    });

    const results: DashboardSummary["incomeExpenseTrend"] = [];
    let currentDay = dayjs(startDate);
    const endDay = dayjs(endDate);

    while (currentDay.isBefore(endDay) || currentDay.isSame(endDay, "day")) {
      const dateKey = currentDay.format("YYYY-MM-DD");
      const data = trendMap.get(dateKey) || { income: 0, expense: 0 };
      results.push({
        date: dateKey,
        income: data.income,
        expense: data.expense,
      });
      currentDay = currentDay.add(1, "day");
    }
    return results;
  } catch (error: any) {
    return [];
  }
}

async function getExpenseBreakdown(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<DashboardSummary["expenseBreakdown"]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");

  try {
    const expenseSnap = await firestoreAdmin
      .collection("expenses")
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .get();

    const breakdownMap = new Map<string, number>();
    expenseSnap.forEach((doc) => {
      const data = doc.data();
      const category = data.category || "Uncategorized";
      const amount = getNumericField(data, "amount");
      const currentTotal = breakdownMap.get(category) || 0;
      breakdownMap.set(category, currentTotal + amount);
    });
    return Array.from(breakdownMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  } catch (error: any) {
    return [];
  }
}

async function getSalesData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalSalesCount: number;
  recentSales: DashboardSummary["recentSales"];
  topSellingProducts: DashboardSummary["topSellingProducts"];
  salesByPaymentType: DashboardSummary["salesByPaymentType"];
}> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");

  try {
    const salesQuery = firestoreAdmin
      .collection("sales")
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    const recentSalesSnap = await salesQuery
      .orderBy("createdAt", "desc") 
      .limit(5)
      .get();

    const recentSales = recentSalesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        customerName: data.customerName || "Walk-in",
        totalAmount: getNumericField(data, "totalAmount"),
        status: data.paymentStatus || "paid",
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    });

    const allSalesSnap = await salesQuery.get();

    const totalSalesCount = allSalesSnap.size;
    const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    const paymentMap = new Map<string, number>();

    allSalesSnap.forEach((doc) => {
      const data = doc.data();
      const paymentLines = data.paymentLines || [];
      paymentLines.forEach((line: any) => {
        // Normalize Payment Type
        const type = (line.method || "Other").toUpperCase().replace(/_/g, " ");
        const amount = Number(line.valueInInvoiceCurrency) || 0; 
        const currentTotal = paymentMap.get(type) || 0;
        paymentMap.set(type, currentTotal + amount);
      });

      const items = data.items || [];
      items.forEach((item: any) => {
        const productId = item.productId || "unknown";
        const current = productMap.get(productId) || {
          name: item.productName || "Unknown Product",
          unitsSold: 0,
          revenue: 0,
        };
        const quantity = item.quantity || 0;
        const price = item.pricePerUnit || 0;
        current.unitsSold += quantity;
        current.revenue += quantity * price;
        productMap.set(productId, current);
      });
    });

    const topSellingProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const salesByPaymentType = Array.from(paymentMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    return {
      totalSalesCount,
      recentSales,
      topSellingProducts,
      salesByPaymentType,
    };
  } catch (error: any) {
    console.warn(`Warning for getSalesData: ${error.message}`);
    return {
      totalSalesCount: 0,
      recentSales: [],
      topSellingProducts: [],
      salesByPaymentType: [],
    };
  }
}

async function getStockOverview(storeId: string): Promise<{
  lowStockCount: number;
  stockOverview: DashboardSummary["stockOverview"];
}> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  const LOW_STOCK_THRESHOLD = 10;

  try {
    const productsRef = firestoreAdmin
      .collection("products")
      .where("storeId", "==", storeId);

    const countSnap = await productsRef
      .where("quantity", "<=", LOW_STOCK_THRESHOLD)
      .count()
      .get();
    const lowStockCount = countSnap.data().count;

    const overviewSnap = await productsRef
      .where("quantity", "<=", LOW_STOCK_THRESHOLD)
      .orderBy("quantity", "asc")
      .limit(5)
      .get();

    const stockOverview = overviewSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Unnamed Product",
        quantity: getNumericField(data, "quantity"),
      };
    });
    return { lowStockCount, stockOverview };
  } catch (error: any) {
    return { lowStockCount: 0, stockOverview: [] };
  }
}

async function getActivityFeed(storeId: string): Promise<DashboardSummary["activityFeed"]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  try {
    const feedSnap = await firestoreAdmin
      .collection("activity_feed")
      .where("storeId", "==", storeId)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    return feedSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        description: data.description || "",
        userName: data.userName || "System",
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
      };
    });
  } catch (error) {
    return [];
  }
}

async function getPerformanceComparison(
  storeId: string,
  currency: string,
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date
): Promise<DashboardSummary["performanceComparison"]> {
  const [
    currentSales,
    currentExpenses,
    prevSales,
    prevExpenses,
  ] = await Promise.all([
    getSalesSum(storeId, currency, currentStart, currentEnd),
    getAggregateSum("expenses", "amount", storeId, currency, currentStart, currentEnd),
    getSalesSum(storeId, currency, prevStart, prevEnd),
    getAggregateSum("expenses", "amount", storeId, currency, prevStart, prevEnd),
  ]);

  const currentProfit = currentSales - currentExpenses;
  const prevProfit = prevSales - prevExpenses;

  const calculateChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100.0 : 0.0;
    return ((current - prev) / prev) * 100;
  };

  return {
    salesChangePercent: calculateChange(currentSales, prevSales),
    profitChangePercent: calculateChange(currentProfit, prevProfit),
  };
}

function generateSmartInsight(
  profitChange: number,
  topProduct: string | undefined
): string {
  if (profitChange > 20) {
    return `Great job! Profit is up ${profitChange.toFixed(0)}%. Keep pushing ${topProduct || "your top products"}!`;
  }
  if (profitChange < -10) {
    return `Profit is down ${profitChange.toFixed(0)}%. Review expenses and sales strategies.`;
  }
  return `Steady performance. ${topProduct || "Top products"} are leading your sales.`;
}

// -----------------------------------------------------------------------------
// MAIN BUSINESS LOGIC
// -----------------------------------------------------------------------------
async function generateDashboardSummary(
  storeId: string,
  currency: string,
  currentStart: Date,
  currentEnd: Date,
  prevStart: Date,
  prevEnd: Date
): Promise<DashboardSummary> {
  const todayStart = dayjs().startOf("day").toDate();
  const todayEnd = dayjs().endOf("day").toDate();

  // Prepare list of active payment methods (Using the UPPERCASE constants)
  const activeMethods = PAYMENT_METHODS[currency] || ["CASH", "BANK"];
  
  const [
    todaysSales,
    totalRevenue,
    totalExpenses,
    newDebtsAmount,
    salesData,
    stockData,
    activityFeed,
    incomeExpenseTrend,
    expenseBreakdown,
    performanceComparison,
    totalProducts,
    outstandingInvoices,
    totalPayables,
    ...accountBalancesRaw
  ] = await Promise.all([
    getSalesSum(storeId, currency, todayStart, todayEnd),
    getSalesSum(storeId, currency, currentStart, currentEnd),
    getAggregateSum("expenses", "amount", storeId, currency, currentStart, currentEnd),
    getAggregateSum("debits", "amountDue", storeId, currency, currentStart, currentEnd),
    getSalesData(storeId, currency, currentStart, currentEnd), 
    getStockOverview(storeId),
    getActivityFeed(storeId),
    getIncomeExpenseTrend(storeId, currency, currentStart, currentEnd),
    getExpenseBreakdown(storeId, currency, currentStart, currentEnd),
    getPerformanceComparison(storeId, currency, currentStart, currentEnd, prevStart, prevEnd),
    getTotalProducts(storeId),
    getTotalOutstandingDebts(storeId, currency),
    getTotalPayables(storeId, currency),
    // Calculate ALL TIME running balance for each method
    ...activeMethods.map(method => getRunningBalance(storeId, currency, method))
  ]);

  const accountBalances = activeMethods.map((method, index) => ({
    name: method,
    value: accountBalancesRaw[index]
  }));

  const cashBalanceObj = accountBalances.find(a => a.name === "CASH");
  const cashBalance = cashBalanceObj ? cashBalanceObj.value : 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const smartInsight = generateSmartInsight(
    performanceComparison.profitChangePercent,
    salesData.topSellingProducts[0]?.name
  );

  const summary: DashboardSummary = {
    todaysSales,
    totalIncomes: totalRevenue,
    totalExpenses,
    netProfit,
    totalSalesCount: salesData.totalSalesCount,
    newDebtsAmount,
    lowStockCount: stockData.lowStockCount,
    totalProducts,
    outstandingInvoices, 
    totalPayables,
    cashBalance,
    accountBalances, 
    profitMargin,
    incomeExpenseTrend,
    expenseBreakdown,
    salesByPaymentType: salesData.salesByPaymentType,
    topSellingProducts: salesData.topSellingProducts,
    recentSales: salesData.recentSales,
    stockOverview: stockData.stockOverview,
    activityFeed,
    performanceComparison,
    smartInsight,
    timestamp: new Date().toISOString(),
  };
  return summary;
}

function filterSensitiveData(
  data: DashboardSummary,
  role: string
): DashboardSummary {
  if (role === "admin" || role === "manager") {
    return data; 
  }
  return {
    ...data,
    totalIncomes: 0,
    totalExpenses: 0,
    netProfit: 0,
    expenseBreakdown: [],
    performanceComparison: { salesChangePercent: 0, profitChangePercent: 0 },
    smartInsight: "All systems operational.",
    outstandingInvoices: 0,
    totalPayables: 0,
    cashBalance: 0,
    accountBalances: [],
    profitMargin: 0,
  };
}

export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];

    let decodedToken;
    try {
      decodedToken = await authAdmin.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: "Invalid token." }, { status: 403 });
    }

    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const userData = userDoc.data();
    const storeId = userData?.storeId;
    const role = userData?.role || "user";

    if (!storeId) {
      return NextResponse.json({ error: "User has no store." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency") || "USD";
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "startDate and endDate are required." },
        { status: 400 }
      );
    }

    const currentStart = dayjs(startDateStr).startOf("day").toDate();
    const currentEnd = dayjs(endDateStr).endOf("day").toDate();
    const diffInDays = dayjs(currentEnd).diff(dayjs(currentStart), "day");
    const prevEnd = dayjs(currentStart).subtract(1, "day").endOf("day").toDate();
    const prevStart = dayjs(prevEnd)
      .subtract(diffInDays, "day")
      .startOf("day")
      .toDate();

    console.log("[Dashboard API] Generating REAL-TIME data (Cache Disabled).");
    const summary = await generateDashboardSummary(
      storeId, currency, currentStart, currentEnd, prevStart, prevEnd
    );

    const secureSummary = filterSensitiveData(summary, role);
    return NextResponse.json(secureSummary, { status: 200 });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to load dashboard data. ${error.message}` },
      { status: 500 }
    );
  }
}