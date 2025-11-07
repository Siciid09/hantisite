// -----------------------------------------------------------------------------
// File: app/api/messages/route.ts
// Description: SECURED API endpoint for the "Communication" module.
// HANDLES GLOBAL ANNOUNCEMENTS from SAAS SUPER ADMIN.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";

// --- CONFIGURATION ---
// !! IMPORTANT: Set this to YOUR Firebase UID to be the Super Admin
const SAAS_SUPER_ADMIN_UID = "YOUR_FIREBASE_UID_HERE"; 
// ---------------------

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
    const roomId = searchParams.get("roomId"); // For fetching specific chat messages

    let data;

    // 3. Route to correct data fetcher
    switch (tab) {
      // --- TAB 1: Messages / Chat (Get Rooms) ---
      case "chat_rooms": {
        const snapshot = await firestoreAdmin.collection("chatRooms")
          .where("storeId", "==", storeId)
          .where("members", "array-contains", uid) // Only get chats the user is in
          .orderBy("lastMessageAt", "desc")
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }
      
      // --- TAB 1: Messages / Chat (Get Messages for one Room) ---
      case "chat_messages": {
        if (!roomId) {
          return NextResponse.json({ error: "Room ID is required" }, { status: 400 });
        }
        // Security Check: Verify user is in this room before fetching messages
        const roomRef = firestoreAdmin.collection("chatRooms").doc(roomId);
        const roomDoc = await roomRef.get();
        if (!roomDoc.exists || !roomDoc.data()?.members.includes(uid)) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        
        const snapshot = await roomRef.collection("messages")
          .orderBy("sentAt", "asc")
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }

      // --- TAB 2: Notifications (Automated Messages) ---
      case "notifications": {
        const snapshot = await firestoreAdmin.collection("notifications")
          .where("userId", "==", uid) // Only get this user's notifications
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }

      // --- TAB 3: Announcements (Admin Broadcasts) ---
      case "announcements": {
        // **MODIFIED:** Removed storeId filter. Fetches ALL announcements.
        const snapshot = await firestoreAdmin.collection("announcements")
          .orderBy("createdAt", "desc")
          .limit(20)
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
// 🚀 POST Handler (Send Messages, Create Announcements)
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
    const userName = userDoc.data()?.name || "User";
    if (!storeId) return NextResponse.json({ error: "User has no store." }, { status: 403 });

    // 2. Get Request Body
    const body = await request.json();
    const type = body.type;
    const now = Timestamp.now();

    // 3. Route to correct create logic
    switch (type) {
      // --- Send a new Chat Message ---
      case "new_chat_message": {
        const { roomId, text } = body;
        if (!roomId || !text) {
          return NextResponse.json({ error: "Room ID and text are required" }, { status: 400 });
        }

        const roomRef = firestoreAdmin.collection("chatRooms").doc(roomId);
        
        // Security Check
        const roomDoc = await roomRef.get();
        if (!roomDoc.exists || !roomDoc.data()?.members.includes(uid)) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        
        // Use a batch write
        const batch = firestoreAdmin.batch();

        // 1. Add new message to sub-collection
        const messageRef = roomRef.collection("messages").doc();
        batch.set(messageRef, {
          senderId: uid,
          senderName: userName,
          text: text,
          sentAt: now,
        });

        // 2. Update the parent room's last message
        batch.update(roomRef, {
          lastMessage: text,
          lastMessageAt: now,
        });

        await batch.commit();
        return NextResponse.json({ success: true }, { status: 201 });
      }

      // --- Create a new Announcement (Admin) ---
      case "new_announcement": {
        // **MODIFIED:** Check if the user is the Super Admin
        if (uid !== SAAS_SUPER_ADMIN_UID) {
          return NextResponse.json({ error: "Unauthorized: Not Super Admin" }, { status: 403 });
        }
        
        const { title, body } = body;
        if (!title || !body) {
          return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
        }
        
        await firestoreAdmin.collection("announcements").add({
          // **REMOVED:** storeId (this is a global announcement)
          title,
          body,
          authorName: "Hantikaab Admin", // Posted by you
          createdAt: now,
        });
        return NextResponse.json({ success: true }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: "Invalid POST type" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Messages API POST] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create item. ${error.message}` }, { status: 500 });
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