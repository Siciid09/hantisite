import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";

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

// -----------------------------------------------------------------------------
// ➕ POST - Create New Income
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

    // [FIX] Added paymentMethod here
    const {
      amount,
      currency,
      description,
      category,
      date,
      paymentMethod, 
    } = body;

    if (!amount || !currency || !category || !date) {
      return NextResponse.json(
        { error: "Missing required fields: amount, currency, category, or date." },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount." },
        { status: 400 }
      );
    }

    const newIncome = {
      amount: parsedAmount,
      currency,
      category,
      description: description || `Quick Add Income on ${date}`,
      // [FIX] Save the payment method (default to CASH if missing)
      paymentMethod: paymentMethod || "CASH",
      createdAt: Timestamp.fromDate(dayjs(date).toDate()),
      storeId,
      userId: uid,
      userName,
    };

    const incomeRef = await firestoreAdmin.collection("incomes").add(newIncome);

    // Optional: Log to Activity Feed if you use one
    /*
    await firestoreAdmin.collection("activity_feed").add({
      storeId,
      description: `Added Income: ${currency} ${amount}`,
      userName,
      timestamp: new Date(),
    });
    */

    return NextResponse.json(
      { success: true, id: incomeRef.id },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("[Incomes API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}