// File: app/api/settings/activity-log/route.ts
// Description: API for fetching activity logs.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

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
  // Any user (manager, hr, admin) can view logs
  if (!role || role === 'user') throw new Error("Permission Denied."); 

  return { storeId };
}

// -----------------------------------------------------------------------------
// 📋 GET - Get Activity Logs (with filters)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await getAuth(request);
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get("limit") || "20");
    const filterByUserId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query: FirebaseFirestore.Query = firestoreAdmin
        .collection('activities')
        .where('storeId', '==', storeId)
        .orderBy('timestamp', 'desc');

    if (filterByUserId) {
      query = query.where('userId', '==', filterByUserId);
    }
    
    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      // Add 1 day to the end date to include the whole day
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.where('timestamp', '<', end);
    }

    query = query.limit(limit);
    const snapshot = await query.get();

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
      };
    });
    
    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    console.error("[ACTIVITY LOG API GET] Error:", error.message);
    // This often fails if an index is missing in Firestore
    if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
      return NextResponse.json({ error: "Query failed: A Firestore index is required. Check the console for the link to create it." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}