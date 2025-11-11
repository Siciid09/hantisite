// File: app/api/hr/payroll/route.ts
// Description: API route for creating a new payroll payment.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs"; 

// Helper function
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
  const role = userData.role;
  if (!storeId) throw new Error("User has no store.");

  return { storeId, uid, userName: userData.name || "System", role };
}

// Helper to get store-specific sub-collection
function getStoreCollection(storeId: string, collectionName: string) {
    return firestoreAdmin.collection("stores").doc(storeId).collection(collectionName);
}

// -----------------------------------------------------------------------------
// 💰 POST - Create New Payroll Payment (MODIFIED)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId, uid, role, userName: adminName } = await getAuth(request); 

    // --- (MODIFIED) Permission Check ---
    if (role !== "admin" && role !== "hr" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin, HR, or Manager role required." }, { status: 403 });
    }
    
    const body = await request.json();
    const { userId, userName, amount, currency, payDate, notes, paymentMethod } = body;

    if (!userId || !userName || !amount || !currency || !payDate || !paymentMethod) {
        return NextResponse.json({ error: "Missing required payment fields (e.g., userId, amount, currency, payDate, paymentMethod)." }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    const paymentDate = new Date(payDate);

    const newPayment = {
      userId: userId,
      userName: userName,
      amount: parsedAmount,
      currency: currency,
      payDate: Timestamp.fromDate(paymentDate),
      notes: notes || "",
      paymentMethod: paymentMethod, 
      processedBy: adminName,
      processedAt: FieldValue.serverTimestamp(),
    };

    // 1. Add to payroll history
    const docRef = await getStoreCollection(storeId, "payrollHistory").add(newPayment);

    // 2. Add corresponding expense
    try {
      const newExpense = {
        amount: parsedAmount,
        currency: currency,
        category: "Salaries", 
        description: `Salary: ${userName} (${dayjs(paymentDate).format("MMM YYYY")})`,
        createdAt: Timestamp.fromDate(paymentDate), 
        storeId: storeId,
        userId: uid, 
        userName: adminName,
        paymentMethod: paymentMethod,
        
        relatedTo: "Payroll",
        relatedId: docRef.id,
        employeeId: userId,
        employeeName: userName,
      };

      await firestoreAdmin.collection("expenses").add(newExpense);
    
    } catch (expenseError: any) {
      console.error("[HR PAYROLL POST] Failed to create linked expense:", expenseError.message);
    }

    return NextResponse.json({ success: true, id: docRef.id, ...newPayment }, { status: 201 });

  } catch (error: any) {
    console.error("[HR PAYROLL POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}