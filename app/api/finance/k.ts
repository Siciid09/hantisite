// -----------------------------------------------------------------------------
// File: app/api/finance/route.ts
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";

// -----------------------------------------------------------------------------
// Type Declarations
// -----------------------------------------------------------------------------

interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string;
  paymentMethod: string;
  notes?: string;
}

interface BreakdownItem {
  name: string;
  value: number;
}

interface BalanceItem {
  method: string;
  amount: number;
}

export interface FinanceOverviewData {
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    outstandingInvoices: number;
    payables: number;
    accounts: BalanceItem[]; // [UPDATED] Dynamic list of accounts
  };
  incomeExpenseTrend: { date: string; income: number; expense: number }[];
}

export interface FinanceIncomeData { totalIncome: number; incomeByCategory: BreakdownItem[]; incomeByMethod: BreakdownItem[]; recentIncomes: Transaction[]; }
export interface FinanceExpensesData { totalExpenses: number; expensesByCategory: BreakdownItem[]; expensesByMethod: BreakdownItem[]; recentExpenses: Transaction[]; }
export interface FinancePaymentsData { 
  accounts: BalanceItem[]; // [UPDATED] Dynamic list of accounts
}
export interface FinanceCashFlowData { startingBalance: number; cashFlowTrend: any[]; }
export interface FinanceReportsData { pnl: any; topDebtors: any[]; topIncomeSources: any[]; topExpenseCategories: any[]; }

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function getNumericField(data: DocumentData, field: string): number {
  const value = data[field];
  return typeof value === "number" && !isNaN(value) ? value : 0.0;
}

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
 * [NEW] Get Dynamic Balances (All Time)
 * Scans all incomes and expenses for the store/currency, groups them by Method,
 * and calculates the running balance (Income - Expense).
 */
async function getDynamicBalances(storeId: string, currency: string): Promise<BalanceItem[]> {
  if (!firestoreAdmin) return [];

  const balances = new Map<string, number>();

  // Helper to process collections
  const processCollection = async (colName: string, isIncome: boolean) => {
    try {
      const q = firestoreAdmin.collection(colName)
        .where("storeId", "==", storeId)
        .where("currency", "==", currency);
        // NO Date Filter: We want All Time "Cash on Hand"
      
      const snap = await q.get();
      snap.forEach(doc => {
        const data = doc.data();
        const method = data.paymentMethod || "Unknown";
        const amount = getNumericField(data, "amount");
        
        const current = balances.get(method) || 0;
        balances.set(method, isIncome ? current + amount : current - amount);
      });
    } catch (e) {
      console.warn(`Error processing balance for ${colName}`, e);
    }
  };

  await Promise.all([
    processCollection("incomes", true),
    processCollection("expenses", false)
  ]);

  // Convert Map to Array and Sort
  return Array.from(balances.entries())
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount); // Highest balance first
}

async function getAggregateSum(
  collectionName: string,
  amountField: string,
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  if (!firestoreAdmin) return 0;
  try {
    const q = firestoreAdmin.collection(collectionName)
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate);

    const snap = await q.get();
    let total = 0;
    snap.forEach((doc) => total += getNumericField(doc.data(), amountField));
    return total;
  } catch (error) { return 0; }
}

async function getTotalPayables(storeId: string, currency: string): Promise<number> {
  if (!firestoreAdmin) return 0;
  try {
    const q = firestoreAdmin.collection("purchases")
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("status", "!=", "paid");
    const snap = await q.get();
    let total = 0;
    snap.forEach((doc) => total += getNumericField(doc.data(), "remainingAmount"));
    return total;
  } catch (e) { return 0; }
}

async function getIncomeExpenseTrend(
  storeId: string,
  currency: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; income: number; expense: number }[]> {
  if (!firestoreAdmin) return [];
  
  const getData = async (col: string) => {
    const map = new Map<string, number>();
    const s = await firestoreAdmin.collection(col)
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .get();
    s.forEach(d => {
      const date = dayjs((d.data().createdAt as Timestamp).toDate()).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + getNumericField(d.data(), "amount"));
    });
    return map;
  };

  const [inc, exp] = await Promise.all([getData("incomes"), getData("expenses")]);
  const diff = dayjs(endDate).diff(dayjs(startDate), "day");
  const res = [];
  
  for (let i = 0; i <= diff; i++) {
    const d = dayjs(startDate).add(i, "day").format("YYYY-MM-DD");
    res.push({
      date: dayjs(d).format("MMM D"),
      income: inc.get(d) || 0,
      expense: exp.get(d) || 0
    });
  }
  return res;
}

// Helpers for other tabs
async function getPaginatedCollection(col: string, storeId: string, currency: string, start: Date, end: Date, limit: number = 20) {
  const s = await firestoreAdmin!.collection(col).where("storeId", "==", storeId).where("currency", "==", currency).where("createdAt", ">=", start).where("createdAt", "<=", end).orderBy("createdAt", "desc").limit(limit).get();
  return s.docs.map(docToTransaction);
}

async function getBreakdown(col: string, field: string, storeId: string, currency: string, start: Date, end: Date) {
  const map = new Map<string, number>();
  const s = await firestoreAdmin!.collection(col).where("storeId", "==", storeId).where("currency", "==", currency).where("createdAt", ">=", start).where("createdAt", "<=", end).get();
  s.forEach(d => {
    const key = d.data()[field] || "Uncategorized";
    map.set(key, (map.get(key) || 0) + getNumericField(d.data(), "amount"));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// -----------------------------------------------------------------------------
// TAB LOGIC
// -----------------------------------------------------------------------------

async function getFinanceOverview(storeId: string, currency: string, startDate: Date, endDate: Date): Promise<FinanceOverviewData> {
  const [
    totalIncome, totalExpenses, outstandingInvoices, incomeExpenseTrend, payables, accounts
  ] = await Promise.all([
    getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
    getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate),
    getAggregateSum("debits", "amountDue", storeId, currency, startDate, endDate),
    getIncomeExpenseTrend(storeId, currency, startDate, endDate),
    getTotalPayables(storeId, currency),
    getDynamicBalances(storeId, currency), // [FIX] Dynamic list
  ]);

  return {
    kpis: {
      totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses,
      outstandingInvoices, payables,
      accounts // Pass the full list
    },
    incomeExpenseTrend
  };
}

async function getPaymentsData(storeId: string, currency: string, startDate: Date, endDate: Date): Promise<FinancePaymentsData> {
  // [FIX] Fetch dynamic balances instead of hardcoded 4 variables
  const accounts = await getDynamicBalances(storeId, currency);
  
  return {
    accounts
  };
}

// -----------------------------------------------------------------------------
// API ROUTE
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) return NextResponse.json({ error: "Server Error" }, { status: 500 });

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split("Bearer ")[1];
    const decoded = await authAdmin.verifyIdToken(token);
    const userDoc = await firestoreAdmin.collection("users").doc(decoded.uid).get();
    
    if (!userDoc.exists || !userDoc.data()?.storeId) return NextResponse.json({ error: "No Store" }, { status: 403 });
    const storeId = userDoc.data()!.storeId;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "Overview";
    const currency = searchParams.get("currency") || "USD";
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!startDateStr || !endDateStr) return NextResponse.json({ error: "Missing Dates" }, { status: 400 });

    const startDate = dayjs(startDateStr).startOf("day").toDate();
    const endDate = dayjs(endDateStr).endOf("day").toDate();

    let data;
    switch (tab) {
      case "Overview":
        data = { overview: await getFinanceOverview(storeId, currency, startDate, endDate) };
        break;
      case "Income":
        data = {
          income: {
            totalIncome: await getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
            incomeByCategory: await getBreakdown("incomes", "category", storeId, currency, startDate, endDate),
            incomeByMethod: await getBreakdown("incomes", "paymentMethod", storeId, currency, startDate, endDate),
            recentIncomes: await getPaginatedCollection("incomes", storeId, currency, startDate, endDate),
          }
        };
        break;
      case "Expenses":
        data = {
          expenses: {
            totalExpenses: await getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate),
            expensesByCategory: await getBreakdown("expenses", "category", storeId, currency, startDate, endDate),
            expensesByMethod: await getBreakdown("expenses", "paymentMethod", storeId, currency, startDate, endDate),
            recentExpenses: await getPaginatedCollection("expenses", storeId, currency, startDate, endDate),
          }
        };
        break;
      case "Payments & Currencies":
        data = { payments: await getPaymentsData(storeId, currency, startDate, endDate) };
        break;
      case "Cash Flow":
        const trend = await getIncomeExpenseTrend(storeId, currency, startDate, endDate);
        data = {
          cashFlow: {
            startingBalance: 0, 
            cashFlowTrend: trend.map(d => ({ ...d, netFlow: d.income - d.expense }))
          }
        };
        break;
      case "Reports":
        const [inc, exp] = await Promise.all([
             getAggregateSum("incomes", "amount", storeId, currency, startDate, endDate),
             getAggregateSum("expenses", "amount", storeId, currency, startDate, endDate)
        ]);
        data = {
          reports: {
            pnl: { totalIncome: inc, totalExpenses: exp, netProfit: inc - exp },
            topDebtors: await getBreakdown("debits", "customerName", storeId, currency, startDate, endDate),
            topIncomeSources: await getBreakdown("incomes", "category", storeId, currency, startDate, endDate),
            topExpenseCategories: await getBreakdown("expenses", "category", storeId, currency, startDate, endDate),
          }
        };
        break;
      default:
        return NextResponse.json({ error: "Invalid Tab" }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}