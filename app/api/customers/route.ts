// -----------------------------------------------------------------------------
// File: app/api/customers/route.ts
//
// --- LATEST FIX (Query & Date) ---
// 1. (CRITICAL FIX) Replaced the double "not-equal" query in "balances"
//    with a correct "in" query. This fixes the 'INVALID_ARGUMENT' error.
// 2. (FIXED) All timestamps (`createdAt`) are now converted to ISO strings
//    to prevent "Invalid Date" errors on the frontend.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";

// -----------------------------------------------------------------------------
// 🚀 GET Handler (Fetch Data for Tabs)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    // 1. Authenticate User
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    const storeId = userDoc.data()?.storeId;
    if (!storeId) return NextResponse.json({ error: "User has no store." }, { status: 403 });

    // 2. Get Query Params
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "list";

    let data;

    // 3. Route to correct data fetcher
    switch (tab) {
      // --- TAB 1: All Customers ---
      case "list": {
        const snapshot = await firestoreAdmin.collection("customers")
          .where("storeId", "==", storeId)
          .orderBy("name", "asc")
          .get();
        data = snapshot.docs.map(doc => {
          const docData = doc.data();
          return { 
            id: doc.id, 
            ...docData,
            createdAt: (docData.createdAt as Timestamp)?.toDate().toISOString() || null
          };
        });
        break;
      }

      // --- TAB 2: Customer Balances / Credits ---
      case "balances": {
        const snapshot = await firestoreAdmin.collection("debits")
          .where("storeId", "==", storeId)
          // --- (CRITICAL FIX) Use "in" instead of multiple "not-equal" ---
          .where("status", "in", ["unpaid", "partial"])
          .orderBy("createdAt", "desc")
          .get();
          
        data = snapshot.docs.map(doc => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            // --- (FIX) Convert timestamp to string before sending ---
            createdAt: (docData.createdAt as Timestamp).toDate().toISOString()
          };
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Invalid tab: ${tab}` }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error: any)
  {
    console.error("[Customers API GET] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to load data. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 POST Handler (Create New Customers)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    // 1. Authenticate User
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    const storeId = userDoc.data()?.storeId;
    if (!storeId) return NextResponse.json({ error: "User has no store." }, { status: 403 });

    // 2. Get Request Body
    const body = await request.json();
    
    // 3. Create a new Customer
    const { name, phone, email, address } = body;
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and Phone are required" }, { status: 400 });
    }
    
    const docRef = await firestoreAdmin.collection("customers").add({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      storeId,
      createdAt: Timestamp.now(),
      totalSpent: {}, // Initialize KPI
      totalOwed: {}, // Initialize KPI
    });
    return NextResponse.json({ id: docRef.id, ...body }, { status: 201 });

  } catch (error: any) {
    console.error("[Customers API POST] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create item. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 PUT Handler (Update Customers, Pay Balances)
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    // 1. Authenticate User
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    const storeId = userDoc.data()?.storeId;
    if (!storeId) return NextResponse.json({ error: "User has no store." }, { status: 403 });

    // 2. Get Request Body
    const body = await request.json();
    const type = body.type;

    // 3. Route to correct update logic
    switch (type) {
      // --- Update a Customer ---
      case "update_customer": {
        const { id, name, phone, email, address } = body;
        if (!id || !name) return NextResponse.json({ error: "ID and Name are required" }, { status: 400 });
        
        const docRef = firestoreAdmin.collection("customers").doc(id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data()?.storeId !== storeId) {
          return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        await docRef.update({ name, phone, email, address });
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // --- Mark a Debit (Balance) as Paid ---
      case "pay_balance": {
        const { debitId } = body;
        if (!debitId) return NextResponse.json({ error: "Debit ID is required" }, { status: 400 });

        const docRef = firestoreAdmin.collection("debits").doc(debitId);
        
        // --- (FIX) Use a transaction to update debit and customer ---
        await firestoreAdmin.runTransaction(async (transaction) => {
          const doc = await transaction.get(docRef);
          if (!doc.exists || doc.data()?.storeId !== storeId) {
            throw new Error("Debit not found");
          }

          const debtData = doc.data();
          if (!debtData) throw new Error("Debit data is missing");

          // 1. Update the debit
          transaction.update(docRef, {
            isPaid: true,
            status: "paid",
            amountDue: 0,
            paidAt: Timestamp.now(),
          });

          // 2. Update the customer's balance
          if (debtData.customerId) {
            const customerRef = firestoreAdmin.collection("customers").doc(debtData.customerId);
            const currencyKey = `totalOwed.${debtData.currency}`;
            transaction.update(customerRef, {
              [currencyKey]: FieldValue.increment(-debtData.amountDue)
            });
          }
        });
        // --- End Fix ---
        
        return NextResponse.json({ success: true }, { status: 200 });
      }

      default:
        return NextResponse.json({ error: "Invalid PUT type" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Customers API PUT] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to update item. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 DELETE Handler (Delete Customers)
// -----------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
    if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    // 1. Authenticate User
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
    const storeId = userDoc.data()?.storeId;
    if (!storeId) return NextResponse.json({ error: "User has no store." }, { status: 403 });

    // 2. Get Query Params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    
    // 3. Verify item belongs to user's store
    const docRef = firestoreAdmin.collection("customers").doc(id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.storeId !== storeId) {
      return NextResponse.json({ error: "Item not found or access denied" }, { status: 404 });
    }

    // 4. Delete item
    await docRef.delete();
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("[Customers API DELETE] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to delete item. ${error.message}` }, { status: 500 });
  }
}