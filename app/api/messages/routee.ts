// -----------------------------------------------------------------------------
// File: app/api/messages/route.ts
// Description: SECURED API endpoint for the "Communication" module.
// **MODIFIED:**
// - Removed all Chat (chat_rooms, chat_messages) endpoints.
// - Removed POST endpoint for "new_announcement" (SAdmin posts from sadmin route).
// - GET "announcements" now reads from the 'notifications' collection
//   to show broadcasts from the SAdmin panel.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";

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
    const tab = searchParams.get("tab");

    let data;

    // 3. Route to correct data fetcher
    switch (tab) {
      // --- TAB 1: Messages / Chat ---
      // **REMOVED** 'chat_rooms' and 'chat_messages' cases

      // --- TAB 2: Notifications (Personal, Automated Messages) ---
      case "notifications": {
        const snapshot = await firestoreAdmin.collection("notifications")
          .where("userId", "==", uid) // Only get this user's *personal* notifications
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }

      // --- TAB 3: Announcements (Admin Broadcasts) ---
      case "announcements": {
        // **MODIFIED:** This now fetches from the 'notifications' collection,
        // which is where the SAdmin panel (routee.ts) sends broadcasts.
        
        // Query 1: Get global announcements sent to "all"
        const globalSnap = await firestoreAdmin.collection("notifications")
          .where("targetType", "==", "all")
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();
          
        // Query 2: Get announcements sent specifically to this user's store
        const specificSnap = await firestoreAdmin.collection("notifications")
          .where("targetStores", "array-contains", storeId)
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();

        // Merge and deduplicate results
        const announcementsMap = new Map();
        globalSnap.docs.forEach(doc => {
          announcementsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        specificSnap.docs.forEach(doc => {
          announcementsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        // Convert map to array and sort by creation date
        data = Array.from(announcementsMap.values())
          .sort((a: any, b: any) => b.createdAt.toDate() - a.createdAt.toDate());
          
        break;
      }

      default:
        return NextResponse.json({ error: `Invalid tab: ${tab}` }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("[Messages API GET] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to load data. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 POST Handler (REMOVED)
// -----------------------------------------------------------------------------
// **REMOVED:** The POST handler is no longer needed by this page,
// as chat is gone and announcements are posted from the SAdmin panel.
// We leave the PUT handler below for "mark_notification_read".

// -----------------------------------------------------------------------------
// 🚀 PUT Handler (Mark Notifications as Read)
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
    
    // 2. Get Request Body
    const body = await request.json();
    const { type, notificationId } = body;

    if (type === "mark_notification_read") {
      if (!notificationId) {
        return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
      }
      
      const docRef = firestoreAdmin.collection("notifications").doc(notificationId);
      const doc = await docRef.get();
      
      // Security Check: Make sure user owns this notification
      if (!doc.exists || doc.data()?.userId !== uid) {
         return NextResponse.json({ error: "Notification not found" }, { status: 404 });
      }

      await docRef.update({ read: true });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid PUT type" }, { status: 400 });

  } catch (error: any) {
    console.error("[Messages API PUT] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to update item. ${error.message}` }, { status: 500 });
  }
}