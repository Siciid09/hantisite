// File: app/api/suppliers/route.ts
//
// --- LATEST UPDATE ---
// 1. (FIX) REMOVED all real-time aggregation logic (reading the 'purchases'
//    collection, all Maps, etc.).
// 2. (FIX) The 'GET' handler now *only* reads the 'suppliers' collection.
// 3. (FIX) It relies on the new Cloud Function to pre-calculate and save
//    'totalOwed' and 'totalSpent' directly onto the supplier documents.
// 4. (FIX) This makes the API instant, solving the scaling problem.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// Helper function to get the user's storeId (unchanged)
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
  
  const storeId = userDoc.data()?.storeId;
  if (!storeId) throw new Error("User has no store.");
  
  return { storeId, uid };
}

// -----------------------------------------------------------------------------
// 📊 GET - Fetch All Suppliers (Now Fast)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await getAuth(request);
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;
    const searchQuery = searchParams.get("searchQuery") || "";

    // --- 1. Fetch Paginated Suppliers ---
    let suppliersQuery = firestoreAdmin.collection("suppliers")
      .where("storeId", "==", storeId)
      .orderBy("name")
      .limit(limit)
      .offset((page - 1) * limit);

    if (searchQuery) {
      suppliersQuery = suppliersQuery
        .where("name", ">=", searchQuery)
        .where("name", "<=", searchQuery + "\uf8ff");
    }
    
    const suppliersSnapshot = await suppliersQuery.get();
    
    // --- 2. Format Data ---
    // (All aggregation logic is GONE!)
    // The totalOwed and totalSpent fields are now read directly from
    // the document, courtesy of the Cloud Function.
    const suppliersWithStats = suppliersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        // Ensure stats exist, defaulting to 0
        totalOwed: data.totalOwed || 0,
        totalSpent: data.totalSpent || 0,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      data: suppliersWithStats,
      pagination: {
        currentPage: page,
        hasMore: suppliersWithStats.length === limit,
      },
    });

  } catch (error: any) {
    console.error("[Suppliers API GET] Error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to load suppliers. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ➕ POST - Create New Supplier (Unchanged)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await getAuth(request);
    const body = await request.json();

    const newSupplier = {
      storeId,
      name: body.name,
      contactPerson: body.contactPerson || null,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      createdAt: Timestamp.now(),
      // (NEW) Initialize stats so they appear immediately
      totalOwed: 0,
      totalSpent: 0,
    };

    const docRef = await firestoreAdmin.collection("suppliers").add(newSupplier);

    return NextResponse.json({ success: true, id: docRef.id, ...newSupplier }, { status: 201 });

  } catch (error: any) {
    console.error("[Suppliers API POST] Error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create supplier. ${error.message}` }, { status: 500 });
  }
}