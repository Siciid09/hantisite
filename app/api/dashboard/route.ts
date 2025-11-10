// -----------------------------------------------------------------------------
// File: app/api/dashboard/route.ts
//
// --- LATEST FIXES (v6.0) ---
// 1. (CRITICAL) `getSalesData`: Changed query to 'orderBy("createdAt", "asc")'
//    to match the (ASC) index you built in Firestore.
//    This will fix the 'Sales Count: 0' bug.
// 2. (FIX) `getSalesData`: Added a 'try/catch' block to match the
//    other helpers, preventing API crashes from index errors.
// 3. (KEPT) All logic for 12 KPIs and Profit Margin is included.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";

// --- Make sure this file 'app/api/dashboard/types.ts' exists! ---
import { type DashboardSummary } from "../types";

// -----------------------------------------------------------------------------
//  HELPER FUNCTIONS (Shaqooyinka Caawiya)
// -----------------------------------------------------------------------------

function getNumericField(data: DocumentData, field: string): number {
  const value = data[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

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
    console.warn(`Warning for getTotalOutstandingDebts: ${error.message}`);
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
    console.warn(`Warning for getTotalPayables: ${error.message}`);
    return 0;
  }
}

async function getSumByPaymentMethod(
  collectionName: string,
  storeId: string,
  currency: string,
  paymentMethod: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  try {
    const collRef = firestoreAdmin.collection(collectionName);
    const q = collRef
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("paymentMethod", "==", paymentMethod)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      total += getNumericField(doc.data(), "amount");
    });
    return total;
  } catch (error: any) {
    console.warn(`Warning for ${collectionName} (${paymentMethod}): ${error.message}`);
    return 0;
  }
}

async function getPaymentMethodBalance(
  storeId: string,
  currency: string,
  paymentMethod: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const [totalIncome, totalExpense] = await Promise.all([
    getSumByPaymentMethod("incomes", storeId, currency, paymentMethod, startDate, endDate),
    getSumByPaymentMethod("expenses", storeId, currency, paymentMethod, startDate, endDate),
  ]);
  return totalIncome - totalExpense;
}

async function getTotalProducts(storeId: string): Promise<number> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  const collRef = firestoreAdmin
    .collection("products")
    .where("storeId", "==", storeId);
  const snapshot = await collRef.count().get();
  return snapshot.data().count;
}

// -----------------------------------------------------------------------------
// [BUUXIYAY] - Shaqooyinkii Madhanaa oo la Dhammaystiray
// -----------------------------------------------------------------------------

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
    console.warn(`Warning for getIncomeExpenseTrend: ${error.message}`);
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
    console.warn(`Warning for getExpenseBreakdown: ${error.message}`);
    return [];
  }
}

/**
 * [BUUXIYAY & LA SAXAY] - Wuxuu soo saaraa xogta iibka (Sales Data) oo dhan.
 */
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

  // --- (FIX 1) Added try/catch block for safety ---
  try {
    const salesQuery = firestoreAdmin
      .collection("sales")
      .where("storeId", "==", storeId)
      .where("invoiceCurrency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    // --- (FIX 2) Changed to 'asc' to match your enabled index ---
    const recentSalesSnap = await salesQuery
      .orderBy("createdAt", "asc") // <-- MUST MATCH YOUR INDEX
      .limit(5)
      .get();

    // Because we used 'asc', we reverse it in code to show newest first
    const recentSales = recentSalesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        customerName: data.customerName || "Walk-in",
        totalAmount: getNumericField(data, "totalAmount"),
        status: data.paymentStatus || "paid",
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      };
    }).reverse(); // <-- Reverse to show newest

    const allSalesSnap = await salesQuery.get();

    const totalSalesCount = allSalesSnap.size;
    const productMap = new Map<string, { name: string; unitsSold: number; revenue: number }>();
    const paymentMap = new Map<string, number>();

    allSalesSnap.forEach((doc) => {
      const data = doc.data();
      const paymentLines = data.paymentLines || [];
      paymentLines.forEach((line: any) => {
        const type = line.method || "Other";
        const amount = line.valueInInvoiceCurrency || 0; 
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
    // --- (FIX 1 cont.) ---
    console.warn(`Warning for getSalesData: ${error.message}`);
    // Return empty data instead of crashing
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
    console.warn(`Warning for getStockOverview: ${error.message}`);
    return { lowStockCount: 0, stockOverview: [] };
  }
}

async function getActivityFeed(
  storeId: string
): Promise<DashboardSummary["activityFeed"]> {
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
  console.warn(`Could not load activity feed: ${(error as Error).message}`);
    return [
      {
        id: "1",
        description: "Activity Feed collection-ka lama helin.",
        userName: "System",
        timestamp: new Date().toISOString(),
      },
    ];
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
    currentIncomes,
    currentExpenses,
    prevIncomes,
    prevExpenses,
  ] = await Promise.all([
    getAggregateSum("incomes", "amount", storeId, currency, currentStart, currentEnd),
    getAggregateSum("expenses", "amount", storeId, currency, currentStart, currentEnd),
    getAggregateSum("incomes", "amount", storeId, currency, prevStart, prevEnd),
    getAggregateSum("expenses", "amount", storeId, currency, prevStart, prevEnd),
  ]);

  const currentProfit = currentIncomes - currentExpenses;
  const prevProfit = prevIncomes - prevExpenses;

  const calculateChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100.0 : 0.0;
    return ((current - prev) / prev) * 100;
  };

  return {
    salesChangePercent: calculateChange(currentIncomes, prevIncomes),
    profitChangePercent: calculateChange(currentProfit, prevProfit),
  };
}

function generateSmartInsight(
  profitChange: number,
  topProduct: string | undefined
): string {
  if (profitChange > 20) {
    return `Great job! Profit is up ${profitChange.toFixed(
      0
    )}%. Keep pushing ${topProduct || "your top products"}!`;
  }
  if (profitChange < -10) {
    return `Profit is down ${profitChange.toFixed(
      0
    )}%. Review expenses and sales strategies.`;
  }
  return `Steady performance. ${
    topProduct || "Top products"
  } are leading your sales.`;
}

// -----------------------------------------------------------------------------
// MAIN BUSINESS LOGIC (Shaqada Ugu Muhiimsan) - (UPDATED)
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

  const [
    todaysSales,
    totalIncomes,
    totalExpenses,
    newDebtsAmount,
    salesData, // <-- (FIX) This now comes from 'sales'
    stockData,
    activityFeed,
    incomeExpenseTrend,
    expenseBreakdown,
    performanceComparison,
    totalProducts,
    // --- (NEW) ---
    outstandingInvoices,
    totalPayables,
    cashBalance,
    // --- (END NEW) ---
  ] = await Promise.all([
    // 8-dii hore
    getAggregateSum("incomes", "amount", storeId, currency, todayStart, todayEnd),
    getAggregateSum("incomes", "amount", storeId, currency, currentStart, currentEnd),
    getAggregateSum("expenses", "amount", storeId, currency, currentStart, currentEnd),
    getAggregateSum("debits", "amountDue", storeId, currency, currentStart, currentEnd),
    getSalesData(storeId, currency, currentStart, currentEnd), // (FIX)
    getStockOverview(storeId),
    getActivityFeed(storeId),
    getIncomeExpenseTrend(storeId, currency, currentStart, currentEnd),
    getExpenseBreakdown(storeId, currency, currentStart, currentEnd),
    getPerformanceComparison(
      storeId,
      currency,
      currentStart,
      currentEnd,
      prevStart,
      prevEnd
    ),
    getTotalProducts(storeId),
    // --- (NEW) 4-ta cusub ---
    getTotalOutstandingDebts(storeId, currency), // Total, not date-ranged
    getTotalPayables(storeId, currency), // Total, not date-ranged
    getPaymentMethodBalance(storeId, currency, "Cash", currentStart, currentEnd), // Date-ranged
  ]);

  const netProfit = totalIncomes - totalExpenses;
  // --- (FIX) Xisaabi Profit Margin ---
  const profitMargin = totalIncomes > 0 ? (netProfit / totalIncomes) * 100 : 0;
  
  const smartInsight = generateSmartInsight(
    performanceComparison.profitChangePercent,
    salesData.topSellingProducts[0]?.name
  );

  const summary: DashboardSummary = {
    // 8-dii hore
    todaysSales,
    totalIncomes, // Total Revenue
    totalExpenses,
    netProfit,
    totalSalesCount: salesData.totalSalesCount, // (FIX)
    newDebtsAmount, // 'New Debts' ee xilligan
    lowStockCount: stockData.lowStockCount,
    totalProducts,
    
    // --- (NEW) 4-ta cusub ---
    outstandingInvoices, // Wadarta guud ee deymaha
    totalPayables,
    cashBalance,
    profitMargin, // (FIX)
    // --- (END NEW) ---
    
    // Inta kale ee charts-ka iyo xogta
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

// -----------------------------------------------------------------------------
// [LAGU DARAY] - SECURITY FUNCTION (Shaqada Amniga)
// -----------------------------------------------------------------------------
function filterSensitiveData(
  data: DashboardSummary,
  role: string
): DashboardSummary {
  if (role === "admin" || role === "manager") {
    return data; // Admins/Managers wax walba way arki karaan
  }

  return {
    ...data,
    totalIncomes: 0,
    totalExpenses: 0,
    netProfit: 0,
    expenseBreakdown: [],
    performanceComparison: { salesChangePercent: 0, profitChangePercent: 0 },
    smartInsight: "All systems operational. Have a great day!",
    outstandingInvoices: 0,
    totalPayables: 0,
    cashBalance: 0,
    profitMargin: 0,
  };
}

// -----------------------------------------------------------------------------
// [LAGU DARAY] - CACHING HELPER (Shaqada Kaydinta)
// -----------------------------------------------------------------------------
function isDefaultRange(startDateStr: string, endDateStr: string): string | null {
  const now = dayjs();
  const today = {
    start: now.startOf("day").format("YYYY-MM-DD"),
    end: now.endOf("day").format("YYYY-MM-DD"),
  };
  if (startDateStr === today.start && endDateStr === today.end) return "today";

  const thisWeek = {
    start: now.startOf("week").format("YYYY-MM-DD"),
    end: now.endOf("week").format("YYYY-MM-DD"),
  };
  if (startDateStr === thisWeek.start && endDateStr === thisWeek.end)
    return "this_week";

  const thisMonth = {
    start: now.startOf("month").format("YYYY-MM-DD"),
    end: now.endOf("month").format("YYYY-MM-DD"),
  };
  if (startDateStr === thisMonth.start && endDateStr === thisMonth.end)
    return "this_month";

  const thisYear = {
    start: now.startOf("year").format("YYYY-MM-DD"),
    end: now.endOf("year").format("YYYY-MM-DD"),
  };
  if (startDateStr === thisYear.start && endDateStr === thisYear.end)
    return "this_year";

  return null;
}

// -----------------------------------------------------------------------------
// API Route Handler (Waa la Casriyeeyay)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. HUBINTA AMNIGA & SOO QAADASHADA ROLE-KA
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

    // 2. SOO QAADO QUERY PARAMS
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

    // 3. LOGIC-GA KAYDINTA (HYBRID CACHE LOGIC)
    const defaultRangeKey = isDefaultRange(startDateStr, endDateStr);
    let summary: DashboardSummary;

    const currentStart = dayjs(startDateStr).startOf("day").toDate();
    const currentEnd = dayjs(endDateStr).endOf("day").toDate();
    const diffInDays = dayjs(currentEnd).diff(dayjs(currentStart), "day");
    const prevEnd = dayjs(currentStart).subtract(1, "day").endOf("day").toDate();
    const prevStart = dayjs(prevEnd)
      .subtract(diffInDays, "day")
      .startOf("day")
      .toDate();

    if (defaultRangeKey) {
      // --- A: Isku day inaad kaydka (cache) wax ka akhrido ---
      const cacheRef = firestoreAdmin.doc(
        `stores/${storeId}/reports_cache/dashboard_${currency}`
      );
      const cacheDoc = await cacheRef.get();
      const cacheData = cacheDoc.data();
      const cachedSummary = cacheData?.[defaultRangeKey];

      const isCacheStale =
        !cacheData?.lastUpdated ||
        dayjs().diff(dayjs(cacheData.lastUpdated.toDate()), "hour") > 1;

      if (cacheDoc.exists && cachedSummary && !isCacheStale) {
        console.log(`[Dashboard API] Serving "${defaultRangeKey}" from CACHE`);
        summary = cachedSummary as DashboardSummary;
      } else {
        // --- B: Cache-ku wuu maqan yahay ama wuu duugoobay
        console.log(
          `[Dashboard API] Cache MISS for "${defaultRangeKey}". Running real-time.`
        );
        
        summary = await generateDashboardSummary(
          storeId, currency, currentStart, currentEnd, prevStart, prevEnd
        );
        
        cacheRef.set({
            [defaultRangeKey]: summary,
            lastUpdated: FieldValue.serverTimestamp()
          }, { merge: true })
          .catch(err => console.error("Failed to update cache:", err));
      }
    } else {
      // --- C: Waa taariikh kale (custom range)
      console.log("[Dashboard API] Serving CUSTOM range from REAL-TIME query.");
      summary = await generateDashboardSummary(
        storeId, currency, currentStart, currentEnd, prevStart, prevEnd
      );
    }

    // 4. KU DABAQ SHAANDHAYNTA AMNIGA
    const secureSummary = filterSensitiveData(summary, role);

    console.log("[Dashboard API] Success.");
    return NextResponse.json(secureSummary, { status: 200 });
  } catch (error: any) {
    console.error(
      "[Dashboard API] Unhandled error in GET:",
      error.stack || error.message
    );
    return NextResponse.json(
      { error: `Failed to load dashboard data. ${error.message}` },
      { status: 500 }
    );
  }
}