// File: app/api/debts/route.ts
// Description: API route for Debts module.
//
// --- LATEST FIX (KPI Mismatch) ---
// 1. (FIXED) The `kpis` object now calculates `totalUnpaid` as the
//    sum of `totalUnpaid` + `totalPartial`.
// 2. (FIX) This ensures the "Total Unpaid Debts" KPI card matches
//    the smart alerts and table totals (e.g., $124.00).
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

// Helper function to get the user's storeId
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

  const userData = userDoc.data()!;
  const storeId = userData.storeId;
  if (!storeId) throw new Error("User has no store.");

  return { storeId, uid, userName: userData.name || "System" };
}

// Helper to format currency (for smart alerts)
const formatCurrency = (amount: number, currency: string): string => {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }
  return `${currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

// -----------------------------------------------------------------------------
// 📊 GET - Fetch Debts Dashboard
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId } = await getAuth(request);
    const { searchParams } = new URL(request.url);

    // --- Parse Filters ---
    const currency = searchParams.get("currency") || "USD";
    const startDate =
      searchParams.get("startDate") ||
      dayjs().startOf("month").format("YYYY-MM-DD");
    const endDate =
      searchParams.get("endDate") || dayjs().endOf("day").format("YYYY-MM-DD");
    const searchQuery = (searchParams.get("searchQuery") || "").toLowerCase();
    const statusFilter = searchParams.get("statusFilter") || "unpaid";
    const tagsFilter = searchParams.getAll("tags");
    const amountMin = parseFloat(searchParams.get("amountMin") || "0");
    const amountMax = parseFloat(
      searchParams.get("amountMax") || "0"
    );
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;

    const startTimestamp = Timestamp.fromDate(
      dayjs(startDate).startOf("day").toDate()
    );
    const endTimestamp = Timestamp.fromDate(
      dayjs(endDate).endOf("day").toDate()
    );

    // --- 1. Base Query (for KPIs, Charts, and List) ---
    const baseDebtsQuery = firestoreAdmin
      .collection("debits")
      .where("storeId", "==", storeId)
      .where("currency", "==", currency)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp);

    const allDebtsSnapshot = await baseDebtsQuery.get();
    const allDebts = allDebtsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id, // <-- IMPORTANT: Ensure ID is included
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        // Ensure fields exist for filtering
        clientName: data.clientName || "",
        clientPhone: data.clientPhone || "",
        clientWhatsapp: data.clientWhatsapp || "",
        reason: data.reason || "",
        status: data.status || "unpaid",
        tags: data.tags || [],
        amountDue: data.amountDue || 0,
        totalAmount: data.totalAmount || 0,
        totalPaid: data.totalPaid || 0,
      };
    });

    // --- 2. Process KPIs & Charts from 'allDebts' ---
    let totalUnpaid = 0; // Only 'unpaid' status
    let totalPaid = 0;
    let totalPartial = 0; // Only 'partial' status
    let overdueCount = 0;
    const topCreditorsMap = new Map<string, number>();
    const monthlyTrendMap = new Map<
      string,
      { outstanding: number; collected: number }
    >();
    const thirtyDaysAgo = dayjs().subtract(30, "days");

    allDebts.forEach((debt) => {
      const month = dayjs(debt.createdAt).format("YYYY-MM");
      const trend = monthlyTrendMap.get(month) || {
        outstanding: 0,
        collected: 0,
      };

      if (debt.status === "unpaid") {
        totalUnpaid += debt.amountDue;
        trend.outstanding += debt.amountDue;
        if (dayjs(debt.createdAt).isBefore(thirtyDaysAgo)) {
          overdueCount++;
        }
      } else if (debt.status === "partial") {
        totalPartial += debt.amountDue;
        trend.outstanding += debt.amountDue;
        if (dayjs(debt.createdAt).isBefore(thirtyDaysAgo)) {
          overdueCount++;
        }
      }
      
      totalPaid += debt.totalPaid;
      trend.collected += debt.totalPaid;

      // For Top Creditors (only count outstanding debt)
      if (debt.status !== "paid") {
        const name = debt.clientName || "Unknown";
        const currentDebt = topCreditorsMap.get(name) || 0;
        topCreditorsMap.set(name, currentDebt + debt.amountDue);
      }
      monthlyTrendMap.set(month, trend);
    });

    // --- (CRITICAL FIX) ---
    // The main KPI for "Total Unpaid" should be the
    // combination of 'unpaid' and 'partial' debts.
    const kpis = {
      totalUnpaid: totalUnpaid + totalPartial, // <-- FIX: This is the total outstanding
      totalPaid,
      totalPartial, // Keep this separate for the Pie Chart
    };

    // --- 3. Query for "Total Debt by Currency" Chart (Optional) ---
    const allCurrencyQuery = firestoreAdmin
      .collection("debits")
      .where("storeId", "==", storeId)
      .where("status", "!=", "paid")
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp);
    
    const allCurrencySnapshot = await allCurrencyQuery.get();
    const byCurrencyMap = new Map<string, number>();
    allCurrencySnapshot.docs.forEach((doc) => {
      const debt = doc.data();
      const curr = debt.currency || "Unknown";
      const currentTotal = byCurrencyMap.get(curr) || 0;
      byCurrencyMap.set(curr, currentTotal + (debt.amountDue || 0));
    });

    // --- 4. Format Chart Data ---
    const charts = {
      paidVsUnpaid: [
        // Use the raw 'totalUnpaid' for the chart, not the combined one
        { name: "Unpaid", value: totalUnpaid }, 
        { name: "Partial", value: totalPartial },
        { name: "Paid (Collected)", value: totalPaid },
      ],
      topCreditors: Array.from(topCreditorsMap.entries())
        .map(([name, totalDebt]) => ({ name, totalDebt }))
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 5),
      monthlyTrend: Array.from(monthlyTrendMap.entries())
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      byCurrency: Array.from(byCurrencyMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
    };

    // --- 5. Smart Alerts ---
    // This calculation (totalUnpaid + totalPartial) was already correct.
    const smartAlerts = [];
    if (totalUnpaid + totalPartial > 0) {
      smartAlerts.push({
        message: `You have ${formatCurrency(
          totalUnpaid + totalPartial,
          currency
        )} in outstanding debts.`,
        type: "warning",
      });
    }
    if (overdueCount > 0) {
      smartAlerts.push({
        message: `You have ${overdueCount} debts over 30 days old.`,
        type: "warning",
      });
    }
    if (totalPaid > 0) {
      smartAlerts.push({
        message: `You collected ${formatCurrency(
          totalPaid,
          currency
        )} in debt payments.`,
        type: "success",
      });
    }

    // --- 6. In-Memory Filtering for List ---
    let filteredDebts = allDebts.filter((debt) => {
      // Status Filter
      if (statusFilter !== "all" && debt.status !== statusFilter) return false;
      
      // Search Query Filter
      if (searchQuery) {
        const search =
          (debt.clientName || "").toLowerCase() +
          (debt.clientPhone || "") +
          (debt.clientWhatsapp || "") +
          (debt.reason || "").toLowerCase() +
          ((debt as any).relatedSaleId || "") + 
          (debt.id || "");
        if (!search.includes(searchQuery)) return false;
      }

      // Amount Range Filter
      const amount = debt.amountDue;
      if (amountMin > 0 && amount < amountMin) return false;
      if (amountMax > 0 && amount > amountMax) return false;

      // Tags Filter
      if (tagsFilter.length > 0) {
        if (!debt.tags || !tagsFilter.some(tag => debt.tags.includes(tag))) {
          return false;
        }
      }
      
      return true;
    });

    // --- 7. Sorting ---
    filteredDebts.sort((a, b) => {
      let valA = a[sortBy as keyof typeof a];
      let valB = b[sortBy as keyof typeof b];

      if (typeof valA === 'string') {
        return sortDir === 'asc' 
          ? valA.localeCompare(valB as string) 
          : (valB as string).localeCompare(valA);
      }
      if (typeof valA === 'number') {
        return sortDir === 'asc' ? valA - (valB as number) : (valB as number) - valA;
      }
      return sortDir === 'asc' 
        ? (valA as string).localeCompare(valB as string) 
        : (valB as string).localeCompare(valA as string);
    });

    // --- 8. Pagination ---
    const totalRecords = filteredDebts.length;
    const totalAmountForFilter = filteredDebts.reduce(
      (sum, debt) => sum + (debt.amountDue || 0),
      0
    );
    const debtRecords = filteredDebts.slice((page - 1) * limit, page * limit);

    const pagination = {
      currentPage: page,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      hasMore: page * limit < totalRecords,
      totalAmountForFilter,
    };

    // --- Return Assembled Response ---
    return NextResponse.json({
      kpis,
      charts,
      smartAlerts,
      debtRecords,
      pagination,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Debts API GET] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ➕ POST - Create New Debt
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// ➕ POST - Create New Debt
// --- (FIX) This is now a TRANSACTION that also updates the customer's totalOwed.
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId, uid, userName } = await getAuth(request);
    const body = await request.json();

    const {
      customerId, // <-- (NEW) ID of existing customer (if any)
      clientName,
      clientPhone,
      clientWhatsapp,
      amountDue,
      reason,
      currency,
      tags,
      relatedSaleId,
    } = body;

    if (!clientName || !clientPhone || !amountDue || !currency) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountDue);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount." },
        { status: 400 }
      );
    }
    
    // This is the ID we will use.
    // If a customer was selected, use their ID.
    // If not, we will create a new customer document.
    let effectiveCustomerId = customerId;
    
    // --- (NEW) Start Transaction ---
    const debtRef = firestoreAdmin.collection("debits").doc(); // Prepare new debt doc
    let customerRef: FirebaseFirestore.DocumentReference; // Prepare customer doc ref

    await firestoreAdmin.runTransaction(async (transaction) => {
      
      // --- Step 1: Handle the Customer ---
      if (effectiveCustomerId) {
        // Use existing customer
        customerRef = firestoreAdmin.collection("customers").doc(effectiveCustomerId);
      } else {
        // Create a new customer
        customerRef = firestoreAdmin.collection("customers").doc();
        effectiveCustomerId = customerRef.id; // Get the new ID
        
        transaction.set(customerRef, {
          name: clientName,
          phone: clientPhone,
          whatsapp: clientWhatsapp || clientPhone,
          storeId,
          createdAt: Timestamp.now(),
          totalSpent: {}, // Initialize KPI
          totalOwed: {}, // Initialize KPI
        });
      }

      // --- Step 2: Create the new Debit document ---
      const newDebt = {
        clientName,
        clientPhone,
        clientWhatsapp: clientWhatsapp || clientPhone,
        customerId: effectiveCustomerId, // <-- (NEW) Link to customer
        totalAmount: amount,
        amountDue: amount,
        totalPaid: 0,
        reason: reason || "N/A",
        currency,
        storeId,
        userId: uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isPaid: false,
        status: "unpaid",
        tags: tags || [],
        paymentHistory: [],
        relatedSaleId: relatedSaleId || null,
        notes: `Created by ${userName}`,
      };
      transaction.set(debtRef, newDebt);

      // --- Step 3: Update the Customer's totalOwed (The "30+30=60" logic) ---
      // We use FieldValue.increment() to safely add the new amount
      const currencyKey = `totalOwed.${currency}`;
      transaction.update(customerRef, {
        [currencyKey]: FieldValue.increment(amount),
      });

      // --- Step 4: Create Activity Log ---
      const logRef = firestoreAdmin.collection("activity_logs").doc();
      transaction.set(logRef, {
        storeId,
        userId: uid,
        userName,
        timestamp: Timestamp.now(),
        actionType: "CREATE",
        collectionAffected: "debits",
        details: `Created new debt for ${clientName} (${formatCurrency(
          amount,
          currency
        )})`,
      });
    }); // --- End Transaction ---

    return NextResponse.json(
      { success: true, id: debtRef.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Debts API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}