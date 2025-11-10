// File: app/api/debts/[id]/route.ts
//
// --- LATEST FIX (TypeScript) ---
// 1. (NEW FIX) Changed signature to accept `params: Promise<{ id: string }>`
//    and added `const params = await context.params;` to handle the
//    unusual type requirement from Next.js 16 (Turbopack).
// 2. (KEPT) All previous fixes.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp, DocumentData } from "firebase-admin/firestore";

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

// Helper to format currency
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
// 💰 PUT - Record a Payment
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // <-- (NEW FIX) Accept Promise
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId, uid, userName } = await getAuth(request);

    const params = await context.params; // <-- (NEW FIX) Await params
    let debtId = params.id; // <-- (NEW FIX) Use resolved params

    if (!debtId) {
      console.warn("Params.id failed, trying URL parsing...");
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      debtId = pathSegments[pathSegments.length - 1];
    }

    const body = await request.json();
    const { amountPaid, paymentMethod } = body;
    const paidAmount = parseFloat(amountPaid);

    if (!debtId || debtId === "[id]") {
      return NextResponse.json({ error: "Debt ID missing from URL." }, { status: 400 });
    }
    if (isNaN(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const debtRef = firestoreAdmin.collection("debits").doc(debtId);
    let newStatus = "partial"; // Default

    // --- Use a Transaction with all READS before all WRITES ---
    await firestoreAdmin.runTransaction(async (transaction) => {
      // --- START OF READS ---
      const debtDoc = await transaction.get(debtRef); // READ 1: The Debt

      if (!debtDoc.exists) {
        throw new Error("Debt not found.");
      }

      const debtData = debtDoc.data(); // This is DocumentData | undefined
      if (!debtData || debtData.storeId !== storeId) { // Check debtData exists
        throw new Error("Access denied or debt data missing.");
      }

      // READ 2: The related Sale (if any)
      const relatedSaleId = debtData.relatedSaleId;
      let saleRef: FirebaseFirestore.DocumentReference | null = null;
      let saleDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (relatedSaleId) {
        saleRef = firestoreAdmin.collection("sales").doc(relatedSaleId);
        saleDoc = await transaction.get(saleRef);
      }

      // READ 3: The related Customer (if any)
      const customerId = debtData.customerId;
      let customerRef: FirebaseFirestore.DocumentReference | null = null;
      if (customerId) {
        customerRef = firestoreAdmin.collection("customers").doc(customerId);
        await transaction.get(customerRef); // Add customer to the "read" list
      }
      // --- END OF READS ---


      // --- START OF CALCULATIONS ---
      const newTotalPaid = (debtData.totalPaid || 0) + paidAmount;
      const newAmountDue = debtData.totalAmount - newTotalPaid;
      newStatus = newAmountDue <= 0.01 ? "paid" : "partial";

      if (newAmountDue < -0.01) {
        throw new Error("Payment exceeds amount due.");
      }
      // --- END OF CALCULATIONS ---


      // --- START OF WRITES ---
      // WRITE 1: Update the debt document
      transaction.update(debtRef, {
        totalPaid: newTotalPaid,
        amountDue: newAmountDue,
        status: newStatus,
        isPaid: newStatus === "paid",
        paymentHistory: FieldValue.arrayUnion({
          amount: paidAmount,
          date: Timestamp.now(),
          method: paymentMethod || "Cash",
          recordedBy: uid,
        }),
        updatedAt: Timestamp.now(),
      });

      // WRITE 2: Create an income record for this payment
      const incomeRef = firestoreAdmin.collection("incomes").doc();
      transaction.set(incomeRef, {
        amount: paidAmount,
        category: "Debt Payment",
        description: `Payment for debt from ${debtData.clientName} (Debt ID: ${debtId})`,
        currency: debtData.currency,
        storeId,
        userId: uid,
        createdAt: Timestamp.now(),
        notes: `Payment method: ${paymentMethod || "Cash"}`,
        relatedDebtId: debtId,
      });

      // WRITE 3: Create activity log
      const logRef = firestoreAdmin.collection("activity_logs").doc();
      transaction.set(logRef, {
        storeId,
        userId: uid,
        userName,
        timestamp: Timestamp.now(),
        actionType: "UPDATE",
        collectionAffected: "debits",
        details: `Recorded payment of ${formatCurrency(
          paidAmount,
          debtData.currency
        )} for ${debtData.clientName}. New status: ${newStatus.toUpperCase()}`,
      });

      // WRITE 4: Update the related Sale document (if any)
      if (relatedSaleId && saleRef && saleDoc && saleDoc.exists) {
        const saleData = saleDoc.data(); // This is DocumentData | undefined
        if (saleData) { // Check if saleData exists
          const newSaleAmountPaid = (saleData.amountPaid || 0) + paidAmount;
          const newSaleDebtAmount = saleData.totalAmount - newSaleAmountPaid;
          const newSaleStatus = newSaleDebtAmount <= 0.01 ? "paid" : "partial";

          transaction.update(saleRef, {
            amountPaid: newSaleAmountPaid,
            debtAmount: newSaleDebtAmount,
            status: newSaleStatus,
            updatedAt: Timestamp.now(),
          });
        }
      }

      // WRITE 5: Update the Customer's balance
      if (customerRef) {
        const currencyKey = `totalOwed.${debtData.currency}`;
        transaction.update(customerRef, {
          [currencyKey]: FieldValue.increment(-paidAmount) // Subtract the payment
        });
      }
      // --- END OF WRITES ---
    }); // --- End of Transaction ---

    return NextResponse.json({ success: true, status: newStatus });

  } catch (error: any) {
    console.error("[Debts API PUT] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ❌ DELETE - Delete a Debt
// -----------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // <-- (NEW FIX) Accept Promise
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId, uid, userName } = await getAuth(request);

    const params = await context.params; // <-- (NEW FIX) Await params
    let debtId = params.id; // <-- (NEW FIX) Use resolved params

    if (!debtId) {
      console.warn("Params.id failed, trying URL parsing...");
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      debtId = pathSegments[pathSegments.length - 1];
    }

    if (!debtId || debtId === "[id]") {
      return NextResponse.json({ error: "Debt ID missing from URL." }, { status: 400 });
    }

    const debtRef = firestoreAdmin.collection("debits").doc(debtId);

    // --- Deleting a debt must also be a transaction ---
    await firestoreAdmin.runTransaction(async (transaction) => {
      // --- READ PHASE ---
      // READ 1: The Debt
      const debtDoc = await transaction.get(debtRef);

      if (!debtDoc.exists) {
        throw new Error("Debt not found.");
      }

      // --- (CRITICAL FIX) Check debtData exists right after getting it ---
      const debtData: DocumentData | undefined = debtDoc.data();
      if (!debtData || debtData.storeId !== storeId) {
        throw new Error("Access denied or debt data missing.");
      }
      // --- END FIX ---

      // READ 2: The related Sale (if any)
      const relatedSaleId = debtData.relatedSaleId;
      let saleRef: FirebaseFirestore.DocumentReference | null = null;
      let saleDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (relatedSaleId) {
        saleRef = firestoreAdmin.collection("sales").doc(relatedSaleId);
        saleDoc = await transaction.get(saleRef);
      }

      // READ 3: The related Customer (if any)
      const customerId = debtData.customerId;
      let customerRef: FirebaseFirestore.DocumentReference | null = null;
      if (customerId) {
        customerRef = firestoreAdmin.collection("customers").doc(customerId);
        await transaction.get(customerRef);
      }
      // --- END OF READS ---


      // --- WRITE PHASE ---
      // WRITE 1: Delete the debt
      transaction.delete(debtRef);

      // WRITE 2: Create activity log
      const logRef = firestoreAdmin.collection("activity_logs").doc();
      transaction.set(logRef, {
        storeId,
        userId: uid,
        userName,
        timestamp: Timestamp.now(),
        actionType: "DELETE",
        collectionAffected: "debits",
        details: `Deleted debt for ${
          debtData.clientName
        } (${formatCurrency(debtData.totalAmount, debtData.currency)})`,
        in: "DELETED",
        Tender: "DELETED",
      });

      // WRITE 3: Re-calculate the related Sale
      if (saleRef && saleDoc && saleDoc.exists) {
        const saleData = saleDoc.data(); // This is DocumentData | undefined
        if (saleData) { // Check if saleData exists
          const newTotalAmount = saleData.totalAmount - debtData.totalAmount;
          const newAmountPaid = saleData.amountPaid - debtData.totalPaid;
          const newDebtAmount = newTotalAmount - newAmountPaid;
          const newStatus = newDebtAmount <= 0.01 ? "paid" : "partial";

          transaction.update(saleRef, {
            totalAmount: newTotalAmount,
            amountPaid: newAmountPaid,
            debtAmount: newDebtAmount,
            status: newStatus,
            notes: FieldValue.arrayUnion(`[System] Debt ${debtId} deleted by ${userName}`),
          });
        }
      }

      // WRITE 4: Update the Customer's balance
      // (FIX) The 'debtData' check is now implicit because we checked it at the top
      if (customerRef) {
        const currencyKey = `totalOwed.${debtData.currency}`;
        transaction.update(customerRef, {
          [currencyKey]: FieldValue.increment(-debtData.amountDue) // Subtract the outstanding debt
        });
      }
      // --- END OF WRITES ---
    }); // --- End of Transaction ---

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Debts API DELETE] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}