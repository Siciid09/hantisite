// File: app/api/hr/payroll/route.ts
// Description: API route for creating a new payroll payment.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Helper function (Copied from main route.ts)
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

  // Return role for permission checks by the caller
  return { storeId, uid, userName: userData.name || "System", role };
}

// Helper to get store-specific sub-collection
function getStoreCollection(storeId: string, collectionName: string) {
    return firestoreAdmin.collection("stores").doc(storeId).collection(collectionName);
}

// -----------------------------------------------------------------------------
// 💰 POST - Create New Payroll Payment
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId, role, userName: adminName } = await getAuth(request);

    // --- Permission Check ---
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin or Manager role required." }, { status: 403 });
    }
    
    const body = await request.json();
    const { userId, userName, amount, currency, payDate, notes } = body;

    if (!userId || !userName || !amount || !currency || !payDate) {
        return NextResponse.json({ error: "Missing required payment fields." }, { status: 400 });
    }

    const newPayment = {
      userId: userId,
      userName: userName,
      amount: Number(amount),
      currency: currency,
      payDate: Timestamp.fromDate(new Date(payDate)),
      notes: notes || "",
      processedBy: adminName,
      processedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await getStoreCollection(storeId, "payrollHistory").add(newPayment);

    return NextResponse.json({ success: true, id: docRef.id, ...newPayment }, { status: 201 });

  } catch (error: any) {
    console.error("[HR PAYROLL POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}