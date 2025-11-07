// File: app/api/debts/[id]/route.ts
//
// --- LATEST FIX ---
// 1. (CRITICAL) Rewrote the `PUT` handler to use a `firestore.runTransaction`
//    for data safety, replacing the less-safe `batch`.
// 2. (FIX) The transaction now *finds* the `relatedSaleId` from the debt.
// 3. (FIX) It reads the corresponding `sale` document.
// 4. (FIX) It updates the `sale` document's `amountPaid`, `debtAmount`, and
//    `status` fields based on the new payment.
// 5. (FIX) This ensures the Sales dashboard and Debts module stay in sync.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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
// --- (REWRITTEN TO USE A TRANSACTION AND UPDATE SALES) ---
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // <-- FIX 1: Changed signature
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId, uid, userName } = await getAuth(request);
    const { id: debtId } = await params; // <-- FIX 2: Awaited params
    const body = await request.json();

    const { amountPaid, paymentMethod } = body;
    const paidAmount = parseFloat(amountPaid);

    if (!debtId) {
      return NextResponse.json({ error: "Debt ID missing." }, { status: 400 });
    }
    if (isNaN(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }

    const debtRef = firestoreAdmin.collection("debits").doc(debtId);
    let newStatus = "partial"; // Default

    // --- (FIX) Use a Transaction for safety ---
    await firestoreAdmin.runTransaction(async (transaction) => {
      const debtDoc = await transaction.get(debtRef);

      if (!debtDoc.exists) {
        throw new Error("Debt not found.");
      }

      const debtData = debtDoc.data()!;
      if (debtData.storeId !== storeId) {
        throw new Error("Access denied.");
      }

      const newTotalPaid = (debtData.totalPaid || 0) + paidAmount;
      const newAmountDue = debtData.totalAmount - newTotalPaid;
      newStatus = newAmountDue <= 0.01 ? "paid" : "partial"; // Use 0.01 for float precision

      if (newAmountDue < -0.01) {
        throw new Error("Payment exceeds amount due.");
      }

      // 1. Update the debt document
      transaction.update(debtRef, {
        totalPaid: newTotalPaid,
        amountDue: newAmountDue,
        status: newStatus,
        isPaid: newStatus === "paid", // Keep isPaid for compatibility
        paymentHistory: FieldValue.arrayUnion({
          amount: paidAmount,
          date: Timestamp.now(),
          method: paymentMethod || "Cash",
          recordedBy: uid,
        }),
        updatedAt: Timestamp.now(),
      });

      // 2. Create an income record for this payment
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

      // 3. Create activity log
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

      // 4. --- (NEW) Update the related Sale document ---
      const relatedSaleId = debtData.relatedSaleId;
      if (relatedSaleId) {
        const saleRef = firestoreAdmin.collection("sales").doc(relatedSaleId);
        const saleDoc = await transaction.get(saleRef);

        if (saleDoc.exists) {
          const saleData = saleDoc.data()!;

          // Recalculate the sale's financial status
          const newSaleAmountPaid = (saleData.amountPaid || 0) + paidAmount;
          const newSaleDebtAmount = saleData.totalAmount - newSaleAmountPaid;
          const newSaleStatus = newSaleDebtAmount <= 0.01 ? "paid" : "partial";

          transaction.update(saleRef, {
            amountPaid: newSaleAmountPaid,
            debtAmount: newSaleDebtAmount,
            status: newSaleStatus,
            updatedAt: Timestamp.now(),
          });
        } else {
          // If the sale was deleted, just log a warning but don't fail
          console.warn(`Could not find related sale ${relatedSaleId} for debt ${debtId}`);
        }
      }
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
  { params }: { params: Promise<{ id: string }> } // <-- FIX 1: Changed signature
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const { storeId, uid, userName } = await getAuth(request);
    const { id: debtId } = await params; // <-- FIX 2: Awaited params

    if (!debtId) {
      return NextResponse.json({ error: "Debt ID missing." }, { status: 400 });
    }

    const debtRef = firestoreAdmin.collection("debits").doc(debtId);
    const debtDoc = await debtRef.get();

    if (!debtDoc.exists) {
      return NextResponse.json({ error: "Debt not found." }, { status: 404 });
    }

    const debtData = debtDoc.data()!;
    if (debtData.storeId !== storeId) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
   }

    // --- (FIX) This must also be a transaction to handle the sale update ---
    const batch = firestoreAdmin.batch(); // A batch is fine for deletion

    // 1. Delete the debt
    batch.delete(debtRef);

    // 2. Create activity log
    const logRef = firestoreAdmin.collection("activity_logs").doc();
    batch.set(logRef, {
      storeId,
      userId: uid,
      userName,
      timestamp: Timestamp.now(),
      actionType: "DELETE",
      collectionAffected: "debits",
      details: `Deleted debt for ${
        debtData.clientName
      } (${formatCurrency(debtData.totalAmount, debtData.currency)})`,
      in: "DELETED", // This was in your original file, keeping it
      Tender: "DELETED", // This was in your original file, keeping it
    });

    // 3. --- (NEW) Re-calculate the related Sale ---
    // Deleting a debt implies the money is no longer owed.
    // We must find the related sale and adjust its totals.
    const relatedSaleId = debtData.relatedSaleId;
    if (relatedSaleId) {
      const saleRef = firestoreAdmin.collection("sales").doc(relatedSaleId);
      const saleDoc = await saleRef.get(); // Get outside batch

      if (saleDoc.exists) {
        const saleData = saleDoc.data()!;

        // This is tricky. If we delete a $30 debt,
        // we should reduce the sale's totalAmount and debtAmount.
        // This assumes deleting a debt is a "correction".
        const newTotalAmount = saleData.totalAmount - debtData.totalAmount;
      const newDebtAmount = saleData.debtAmount - debtData.totalAmount;
        const newStatus = newDebtAmount <= 0.01 ? "paid" : "partial";

        batch.update(saleRef, {
          totalAmount: newTotalAmount,
        debtAmount: newDebtAmount,
          status: newStatus,
          notes: FieldValue.arrayUnion(`[System] Debt ${debtId} deleted by ${userName}`),
        });
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Debts API DELETE] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}