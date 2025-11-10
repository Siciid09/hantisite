// -----------------------------------------------------------------------------
// File: app/api/finance/route.ts
// Description: SECURED AND FIXED API endpoint for "Income & Finance".
//
// --- FIXES APPLIED (Production v2) ---
// 1. (FIX #15) Added `getTotalPayables` utility to fetch real data.
// 2. (FIX #14) `getFinanceOverview` now provides `zaadBalance` and
//    `edahabBalance` individually instead of one combined `digitalWallets` KPI.
// 3. (FIX #18) Rebuilt `getPaymentsData` (for Payments Tab).
//    - It now runs in 2 queries instead of 16+.
//    - It correctly calculates balances for ALL methods (Cash, Zaad, etc.).
//    - It populates `otherBalances` with any method not hardcoded.
//    - This resolves the "Invalid tab" error by providing correct data.
// 4. (FIX #13) Standardized `getSumByPaymentMethod` to use exact case-sensitive
//    names ("Cash", "Zaad", "eDahab", "Bank").
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import {
  DocumentData,
  Timestamp,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin"; // Standard path
import dayjs from "dayjs";

// -----------------------------------------------------------------------------
// 🔧 Type Declarations (Expanded for All Tabs)
// -----------------------------------------------------------------------------

// --- Base Types ---
interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO string
  category: string;
  paymentMethod: string;
  notes?: string;
}

interface BreakdownItem {
  name: string;
  value: number;
}

// --- Tab-Specific Data Types ---
export interface FinanceOverviewData {
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    cashOnHand: number;
    // --- (FIX #14) ---
    zaadBalance: number;    // No longer combined
    edahabBalance: number;  // No longer combined
    // digitalWallets: number; // This is now removed
    // --- (END FIX) ---
    bankBalance: number;
    outstandingInvoices: number; // Debits
    payables: number; // (FIX #15) Now shows real data
  };
  incomeExpenseTrend: { date: string; income: number; expense: number }[];
}

export interface FinanceIncomeData {
  totalIncome: number;
  incomeByCategory: BreakdownItem[];
  incomeByMethod: BreakdownItem[];
  recentIncomes: Transaction[];
}

export interface FinanceExpensesData {
  totalExpenses: number;
  expensesByCategory: BreakdownItem[];
  expensesByMethod: BreakdownItem[];
  recentExpenses: Transaction[];
}

export interface FinancePaymentsData {
  // Balance = Income - Expense for that method
  cashBalance: number;
  zaadBalance: number;
  edahabBalance: number;
  bankBalance: number;
  otherBalances: BreakdownItem[]; // For any other methods
}

export interface FinanceCashFlowData {
  startingBalance: number; // For simplicity, we'll use 0 and show net flow
  cashFlowTrend: {
    date: string;
    income: number;
    expense: number;
    netFlow: number;
  }[];
}

export interface FinanceReportsData {
  pnl: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  topDebtors: BreakdownItem[]; // From 'debits' collection
  topIncomeSources: BreakdownItem[]; // From 'incomes' category
  topExpenseCategories: BreakdownItem[]; // From 'expenses' category
}

// -----------------------------------------------------------------------------
// 🧩 Utility Functions
// -----------------------------------------------------------------------------

function getNumericField(data: DocumentData, field: string): number {
  const value = data[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

// Helper to format a Firestore doc into our Transaction type
function docToTransaction(doc: QueryDocumentSnapshot): Transaction {
  const data = doc.data();
  return {
    id: doc.id,
    amount: getNumericField(data, "amount"),
    date: (data.createdAt as Timestamp).toDate().toISOString(),
    category: data.category || "Uncategorized",
    paymentMethod: data.paymentMethod || "Unknown",
    notes: data.notes || "",
  };
}

/**
 * --- (FIX #15) This function is copied from your dashboard/route.ts ---
 * Gets total payables (purchases not fully paid).
 */
async function getTotalPayables(storeId: string, currency: string): Promise<number> {
  if (!firestoreAdmin) return 0;
  const collRef = firestoreAdmin.collection("purchases");
  // Note: This query assumes 'currency' exists on purchases.
  // If not, you may need to adjust or remove this .where()
  const q = collRef
    .where("storeId", "==", storeId)
    .where("currency", "==", currency)
    .where("status", "!=", "paid");
  
  try {
    const querySnapshot = await q.get();
    let total = 0.0;
    querySnapshot.forEach((doc) => {
      // Assumes field is 'remainingAmount'. Change if incorrect.
      total += getNumericField(doc.data(), "remainingAmount");
    });
    return total;
  } catch (error: any) {
    console.warn(`Warning for getTotalPayables: ${error.message}`);
    // Fallback: If currency query fails, try without it.
    try {
        const fallbackQ = collRef
            .where("storeId", "==", storeId)
            .where("status", "!=", "paid");
        const querySnapshot = await fallbackQ.get();
        let total = 0.0;
        querySnapshot.forEach((doc) => {
            if (doc.data().currency === currency) {
                 total += getNumericField(doc.data(), "remainingAmount");
            }
        });
        return total;
    } catch (e: any) {
        console.error("Critical error in getTotalPayables:", e.message);
        return 0; // Return 0 if it fails
    }
  }
}

/**
 * Gets aggregate sum from a collection.
 */
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
    console.error(
      `[API Util Error] getAggregateSum for ${collectionName}:`,
      error.message
    );
    throw new Error(`Failed to calculate total for ${collectionName}.`);
  }
}

/**
 * Gets aggregate sum for a specific payment method.
 * (FIX #13) This relies on EXACT case-sensitive matches.
 */
async function getSumByPaymentMethod(
  collectionName: string,
  storeId: string,
  currency: string,
  paymentMethod: string, // e.g., "Cash", "Zaad"
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
    console.error(
      `[API Util Error] getSumByPaymentMethod for ${collectionName} (${paymentMethod}):`,
      error.message
    );
    return 0.0; // Return 0 on index error, etc.
  }
}

/**
 * Calculates the balance for a payment method.
 * Balance = Total Income (Method) - Total Expense (Method)
 */
async function getPaymentMethodBalance(
  storeId: string,
  currency: string,
  paymentMethod: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const [totalIncome, totalExpense] = await Promise.all([
    getSumByPaymentMethod(
      "incomes",
      storeId,
      currency,
      paymentMethod,
      startDate,
      endDate
    ),
    getSumByPaymentMethod(
      "expenses",
      storeId,
      currency,
      paymentMethod,
      startDate,
      endDate
    ),
  ]);
  return totalIncome - totalExpense;
}

/**
 * Gets daily trend data for Income vs. Expense.
 */
async function getIncomeExpenseTrend(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; income: number; expense: number }[]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");

  const aggregateData = async (
    collectionName: string
  ): Promise<Map<string, number>> => {
    const map = new Map<string, number>();
    const collRef = firestoreAdmin.collection(collectionName);
    const q = collRef
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    const snapshot = await q.get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      const date = (data.createdAt as Timestamp).toDate();
      const dayStr = dayjs(date).format("YYYY-MM-DD");
      const amount = getNumericField(data, "amount");
      map.set(dayStr, (map.get(dayStr) || 0) + amount);
    });
    return map;
  };

  try {
    const [incomeData, expenseData] = await Promise.all([
      aggregateData("incomes"),
      aggregateData("expenses"),
    ]);

    const trendMap = new Map<string, { income: number; expense: number }>();
    const diffInDays = dayjs(endDate).diff(dayjs(startDate), "day");

    for (let i = 0; i <= diffInDays; i++) {
      const dateStr = dayjs(startDate).add(i, "day").format("YYYY-MM-DD");
      trendMap.set(dateStr, {
        income: incomeData.get(dateStr) || 0,
        expense: expenseData.get(dateStr) || 0,
      });
    }

    return Array.from(trendMap.entries()).map(([date, values]) => ({
      date: dayjs(date).format("MMM D"), // Format for chart
      ...values,
    }));
  } catch (error: any) {
    console.error(`[API Util Error] getIncomeExpenseTrend:`, error.message);
    throw new Error(`Failed to get chart data. ${error.message}`);
  }
}

/**
 * NEW: Gets paginated transactions for Income/Expense tabs.
 */
async function getPaginatedCollection(
  collectionName: string,
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date,
  limit: number = 20
): Promise<Transaction[]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  const collRef = firestoreAdmin.collection(collectionName);
  const q = collRef
    .where("storeId", "==", storeId)
    .where("currency", "==", currency)
    .where("createdAt", ">=", startDate)
    .where("createdAt", "<=", endDate)
    .orderBy("createdAt", "desc")
    .limit(limit);

  const snapshot = await q.get();
  return snapshot.docs.map(docToTransaction);
}

/**
 * NEW: Gets breakdown by a specific field (e.g., 'category', 'paymentMethod').
 */
async function getBreakdown(
  collectionName: string,
  groupByField: string,
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<BreakdownItem[]> {
  if (!firestoreAdmin) throw new Error("Firestore Admin not initialized.");
  const map = new Map<string, number>();
  const collRef = firestoreAdmin.collection(collectionName);
  const q = collRef
    .where("storeId", "==", storeId)
    .where("currency", "==", currency)
    .where("createdAt", ">=", startDate)
    .where("createdAt", "<=", endDate);

  const snapshot = await q.get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    const key = data[groupByField] || `Uncategorized`;
    const amount = getNumericField(data, "amount");
    map.set(key, (map.get(key) || 0) + amount);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value); // Sort descending
}

// -----------------------------------------------------------------------------
// 🧮 Main Business Logic Functions (One for each tab)
// -----------------------------------------------------------------------------

// --- TAB 1: Overview ---
async function getFinanceOverview(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceOverviewData> {
  const [
    totalIncome,
    totalExpenses,
    outstandingInvoices,
    incomeExpenseTrend,
    cashOnHand,
    zaadBalance,
    edahabBalance,
    bankBalance,
    payables, // (FIX #15)
  ] = await Promise.all([
    getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
    getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate),
    getAggregateSum("debits", "amountDue", storeId, currency, startDate, endDate), // Assumes 'debits' collection
    getIncomeExpenseTrend(storeId, currency, startDate, endDate),
    getPaymentMethodBalance(storeId, currency, "Cash", startDate, endDate),
    getPaymentMethodBalance(storeId, currency, "Zaad", startDate, endDate), // (FIX #14)
    getPaymentMethodBalance(storeId, currency, "eDahab", startDate, endDate), // (FIX #14)
    getPaymentMethodBalance(storeId, currency, "Bank", startDate, endDate),
    getTotalPayables(storeId, currency), // (FIX #15) - Note: Not date ranged
  ]);

  const netProfit = totalIncome - totalExpenses;

  return {
    kpis: {
      totalIncome,
      totalExpenses,
      netProfit,
      cashOnHand,
      zaadBalance,    // (FIX #14)
      edahabBalance,  // (FIX #14)
      bankBalance,
      outstandingInvoices,
      payables,       // (FIX #15)
    },
    incomeExpenseTrend,
  };
}

// --- TAB 2: Income ---
async function getIncomeData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceIncomeData> {
  const [
    totalIncome,
    incomeByCategory,
    incomeByMethod,
    recentIncomes,
  ] = await Promise.all([
    getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
    getBreakdown("incomes", "category", storeId, currency, startDate, endDate),
    getBreakdown(
      "incomes",
      "paymentMethod",
      storeId,
      currency,
      startDate,
      endDate
    ),
    getPaginatedCollection(
      "incomes",
      storeId,
      currency,
      startDate,
      endDate,
      25
    ),
  ]);

  return { totalIncome, incomeByCategory, incomeByMethod, recentIncomes };
}

// --- TAB 3: Expenses ---
async function getExpensesData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceExpensesData> {
  const [
    totalExpenses,
    expensesByCategory,
    expensesByMethod,
    recentExpenses,
  ] = await Promise.all([
    getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate),
    getBreakdown("expenses", "category", storeId, currency, startDate, endDate),
    getBreakdown(
      "expenses",
      "paymentMethod",
      storeId,
      currency,
      startDate,
      endDate
    ),
    getPaginatedCollection(
      "expenses",
      storeId,
      currency,
      startDate,
      endDate,
      25
    ),
  ]);

  return { totalExpenses, expensesByCategory, expensesByMethod, recentExpenses };
}

// --- TAB 4: Payments & Currencies ---
// --- (FIX #18) This function is completely rebuilt for efficiency ---
async function getPaymentsData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinancePaymentsData> {
  
  // 1. Get all income and expense breakdowns in just 2 queries
  const [incomeByMethod, expenseByMethod] = await Promise.all([
    getBreakdown(
      "incomes",
      "paymentMethod",
      storeId,
      currency,
      startDate,
      endDate
    ),
    getBreakdown(
      "expenses",
      "paymentMethod",
      storeId,
      currency,
      startDate,
      endDate
    ),
  ]);

  // 2. Combine them into a balance map
  const balanceMap = new Map<string, number>();

  incomeByMethod.forEach((item) => {
    balanceMap.set(item.name, (balanceMap.get(item.name) || 0) + item.value);
  });

  expenseByMethod.forEach((item) => {
    balanceMap.set(item.name, (balanceMap.get(item.name) || 0) - item.value);
  });

  // 3. Initialize the result object
  const data: FinancePaymentsData = {
    cashBalance: 0,
    zaadBalance: 0,
    edahabBalance: 0,
    bankBalance: 0,
    otherBalances: [],
  };

  // 4. Distribute the balances from the map
  balanceMap.forEach((balance, name) => {
    switch (name) {
      case "Cash":
        data.cashBalance = balance;
        break;
      case "Zaad":
        data.zaadBalance = balance;
        break;
      case "eDahab":
        data.edahabBalance = balance;
        break;
      case "Bank":
        data.bankBalance = balance;
        break;
      default:
        // Add any other method to the 'otherBalances' array
        data.otherBalances.push({ name: name, value: balance });
        break;
    }
  });

  return data;
}
// --- (END FIX #18) ---

// --- TAB 5: Cash Flow ---
async function getCashFlowData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceCashFlowData> {
  const trend = await getIncomeExpenseTrend(
    storeId,
    currency,
    startDate,
    endDate
  );

  const cashFlowTrend = trend.map((day) => ({
    ...day,
    netFlow: day.income - day.expense,
  }));

  return {
    startingBalance: 0, // Calculating a true running balance is complex
    cashFlowTrend,
  };
}

// --- TAB 6: Reports ---
async function getReportsData(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<FinanceReportsData> {
  const [
    totalIncome,
    totalExpenses,
    topDebtors, // Assumes 'debits' collection has 'customerName'
    topIncomeSources,
    topExpenseCategories,
  ] = await Promise.all([
    getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
    getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate),
    getBreakdown("debits", "customerName", storeId, currency, startDate, endDate),
    getBreakdown("incomes", "category", storeId, currency, startDate, endDate),
    getBreakdown("expenses", "category", storeId, currency, startDate, endDate),
  ]);

  return {
    pnl: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    },
    topDebtors,
    topIncomeSources,
    topExpenseCategories,
  };
}

// -----------------------------------------------------------------------------
// 🚀 API Route Handler (SECURED)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. Authenticate User
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

    // 2. Get User's Store
    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const storeId = userDoc.data()?.storeId;
    if (!storeId) {
      return NextResponse.json({ error: "User has no store." }, { status: 403 });
    }

    // 3. Get Query Params
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "Overview";
    const currency = searchParams.get("currency") || "USD"; // Default USD
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: "startDate and endDate are required." },
        { status: 400 }
      );
    }

    const startDate = dayjs(startDateStr).startOf("day").toDate();
    const endDate = dayjs(endDateStr).endOf("day").toDate();

    console.log(
      `[Finance API] Fetching for tab: ${tab}, storeId: ${storeId}, Currency: ${currency}`
    );

    // 4. Route to correct data fetcher based on tab
    let data;
    switch (tab) {
      case "Overview":
        data = {
          overview: await getFinanceOverview(
            storeId,
            currency,
            startDate,
            endDate
          ),
        };
        break;
      case "Income":
        data = {
          income: await getIncomeData(storeId, currency, startDate, endDate),
        };
        break;
      case "Expenses":
        data = {
          expenses: await getExpensesData(
            storeId,
            currency,
            startDate,
            endDate
          ),
        };
        break;
      case "Payments & Currencies":
        data = {
          payments: await getPaymentsData(
            storeId,
            currency,
            startDate,
            endDate
          ),
        };
        break;
      case "Cash Flow":
        data = {
          cashFlow: await getCashFlowData(
            storeId,
            currency,
            startDate,
            endDate
          ),
        };
        break;
      case "Reports":
        data = {
          reports: await getReportsData(
            storeId,
            currency,
            startDate,
            endDate
          ),
        };
        break;
      default:
        return NextResponse.json(
          { error: `Invalid tab: ${tab}` },
          { status: 400 }
        );
    }

    console.log(`[Finance API] Success for tab: ${tab}.`);
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error(
      "[Finance API] Unhandled error in GET:",
      error.stack || error.message
    );
    return NextResponse.json(
      { error: `Failed to load finance data. ${error.message}` },
      { status: 500 }
    );
  }
}