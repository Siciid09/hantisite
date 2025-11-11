// -----------------------------------------------------------------------------
// File: app/api/messages/route.ts
// Description: [THE FIX - PART 1]
// 1. FIXES THE CRASH: The 'notifications' tab query is now simple and
//    no longer requires a database index. It sorts in code.
// 2. FIXES THE DISCONNECT: The 'announcements' tab now correctly reads
//    from the "announcements" collection to match your page.tsx.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";

// Helper to safely convert Firebase Timestamps to ISO strings
const safeToISOString = (timestamp: any): string => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  // Fallback for data that might already be a string or is missing
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
};

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
    
    // 2. Get Query Params
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");

    let data;

    // 3. Route to correct data fetcher
    switch (tab) {
      
      // --- TAB 1: Personal Notifications ---
      // **CRASH FIX:** This query is now simple and does not require an index.
      case "notifications": {
        // 1. Get ALL notifications for this user (simple query, no sorting)
        const snapshot = await firestoreAdmin.collection("notifications")
          .where("userId", "==", uid)
          .limit(50) // Limit query for safety
          .get();
        
        // 2. Map and Convert timestamps
        let notifications = snapshot.docs.map(doc => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            createdAt: safeToISOString(docData.createdAt), // Convert to string
          };
        });

        // 3. Sort manually in code (avoids index crash)
        notifications.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        data = notifications;
        break;
      }

      // --- TAB 2: Admin Announcements ---
      // **CONNECTION FIX:** Now reads from "announcements" collection
      case "announcements": {
        const snapshot = await firestoreAdmin.collection("announcements")
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
                id: doc.id,
                ...docData,
                createdAt: safeToISOString(docData.createdAt), // Convert to string
            };
        });
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
// 🚀 PUT Handler (Mark Notifications as Read)
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const decodedToken = await authAdmin.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    const body = await request.json();
    const { type, notificationId } = body;

    if (type === "mark_notification_read") {
      if (!notificationId) {
        return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
      }
      
      const docRef = firestoreAdmin.collection("notifications").doc(notificationId);
      const doc = await docRef.get();
      
      if (!doc.exists || doc.data()?.userId !== uid) {
         return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
      }

      await docRef.update({ read: true, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid PUT type" }, { status: 400 });

  } catch (error: any) {
    console.error("[Messages API PUT] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to update item. ${error.message}` }, { status: 500 });
  }
}