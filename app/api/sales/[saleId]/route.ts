// File: app/api/sales/[saleId]/route.ts
//
// --- SOLVED ---
// 1. (CRITICAL FIX) 'DELETE' function: The transaction is rebuilt.
//    - It now performs a "Read Phase" (getting the sale,
//      all related products, and the associated debit).
//    - THEN it performs a "Write Phase" (voiding the sale,
//      restocking products, creating an expense, and voiding the debit).
//    - This fixes the "reads must be before writes" error.
// 2. (FIX) Includes Zod and TS '?' fixes from your original file.
// 3. (FIX) Applied Next.js 16 `await params` fix to GET, PUT, and DELETE.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const UpdateSaleSchema = z.object({
  notes: z.string().optional(),
  // Add any other fields you allow to be updated via PUT
});


// --- Helper: checkAuth ---
async function checkAuth(
  request: NextRequest,
  allowedRoles: ('admin' | 'manager' | 'user')[]
) {
  if (!authAdmin) throw new Error("Auth Admin is not initialized.");
  if (!firestoreAdmin) throw new Error("Firestore Admin is not initialized.");

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized: No token provided.");
  
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new Error("Unauthorized: User data not found.");
  }
  
  const userData = userDoc.data();
  const storeId = userData?.storeId;
  const role = userData?.role; 
  if (!storeId) throw new Error("Unauthorized: User has no store.");
  
  if (!role || !allowedRoles.includes(role)) {
    console.warn(`[Auth] User ${uid} (Role: ${role}) tried to access a resource restricted to roles: [${allowedRoles.join(', ')}]`);
    throw new Error("Forbidden: You do not have permission to perform this action.");
  }
  
  return { 
    uid, 
    storeId, 
    role, 
    userName: userData?.name || "System User" 
  };
}

// =============================================================================
// 📦 GET - Get a single sale by ID
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ saleId: string }> } // <-- FIX 1
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }
  
  try {
    // All users can VIEW a sale
    const { storeId } = await checkAuth(request, ['admin', 'manager', 'user']);
    const { saleId } = await params; // <-- FIX 2

    const docRef = firestoreAdmin.collection("sales").doc(saleId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Sale not found." }, { status: 404 });
    }

    const data = doc.data();
    return NextResponse.json({
      id: doc.id,
      ...data,
      createdAt: data?.createdAt.toDate().toISOString(),
    });

  } catch (error: any) {
    console.error("[SaleId API GET] Error:", error.message);
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// 📝 PUT - Update a sale (e.g., add notes)
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ saleId: string }> } // <-- FIX 1
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }
  
  try {
    // Only 'admin' and 'manager' can UPDATE a sale
    const { storeId } = await checkAuth(request, ['admin', 'manager']);
    const { saleId } = await params; // <-- FIX 2
    
    // Validate body
    const body = await request.json();
    const validation = UpdateSaleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid data.", issues: validation.error.issues }, { status: 400 });
    }

    const docRef = firestoreAdmin.collection("sales").doc(saleId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Sale not found." }, { status: 404 });
    }

    await docRef.update(validation.data);

    return NextResponse.json({ success: true, id: saleId, ...validation.data });

  } catch (error: any) {
    console.error("[SaleId API PUT] Error:", error.message);
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// ❌ DELETE - Void a sale (SOLVED)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ saleId: string }> } // <-- FIX 1
) {
  if (!firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }
  
  try {
    // Only 'admin' and 'manager' can DELETE (void) a sale
    const { storeId, uid, userName } = await checkAuth(request, ['admin', 'manager']);
    const { saleId } = await params; // <-- FIX 2

    const saleRef = firestoreAdmin.collection("sales").doc(saleId);

    await firestoreAdmin.runTransaction(async (transaction) => {
      
      // --- 1. READ PHASE ---
      // Get the sale, all products, and the debit doc first.

      // a. Get the Sale
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists || saleDoc.data()?.storeId !== storeId) {
        throw new Error("Sale not found.");
      }
      const saleData = saleDoc.data();
      
      if (saleData?.status === 'voided') {
        throw new Error("Sale is already voided.");
      }

      // b. Get all Product refs from the sale
      const productRefsToFetch = [];
      for (const item of saleData?.items || []) {
        if (!item.productId.startsWith("manual_")) {
          productRefsToFetch.push({
            ref: firestoreAdmin.collection("products").doc(item.productId),
            item: item
          });
        }
      }
      // Read all product docs
      const productDocs = await Promise.all(
        productRefsToFetch.map(p => transaction.get(p.ref))
      );

      // c. Find the outstanding Debit
      const debitQuery = firestoreAdmin.collection("debits")
          .where("relatedSaleId", "==", saleId)
          .where("isPaid", "==", false);
      const debitSnapshot = await transaction.get(debitQuery);

      // --- 2. WRITE PHASE ---
      // All reads are done. Now we can write.

      // a. Mark sale as 'voided'
      transaction.update(saleRef, {
        status: "voided",
        paymentStatus: "voided", // --- ADDED THIS LINE for the filter fix ---
        voidedAt: FieldValue.serverTimestamp(),
        voidedBy: uid,
      });

      // b. Restock items (using the docs we read)
      for (let i = 0; i < productDocs.length; i++) {
        const prodDoc = productDocs[i];
        const { ref, item } = productRefsToFetch[i];
        
        if (prodDoc.exists) {
          transaction.update(ref, {
            quantity: FieldValue.increment(item.quantity || 0),
          });
        }
      }

      // c. Reverse income (create a negative income/expense)
      for (const payment of saleData?.paymentLines || []) {
        if (payment.amount > 0) {
          const expenseRef = firestoreAdmin.collection("expenses").doc();
          transaction.set(expenseRef, {
            amount: payment.amount, // The actual amount received
            currency: payment.currency, // The actual currency received
            description: `Voided Sale ${saleData?.invoiceId}`,
            category: "Voided Sale",
            createdAt: FieldValue.serverTimestamp(),
            storeId: storeId,
            userId: uid,
            relatedSaleId: saleId,
            method: payment.method,
          });
        }
      }
      
      // d. Cancel any outstanding debit
      debitSnapshot.docs.forEach(doc => {
        console.log(`[Void Sale] Voiding debit doc ${doc.id}`);
        transaction.update(doc.ref, { 
          isPaid: true, // Mark as paid to remove from totals
          status: "voided" // Set status to voided
        });
      });
    }); // End of Transaction

    return NextResponse.json({ success: true, id: saleId, status: "voided" });

  } catch (error: any) {
    console.error("[SaleId API DELETE] Error:", error.message);
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}