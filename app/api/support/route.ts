// -----------------------------------------------------------------------------
// File: app/api/support/route.ts
// Description: SECURED API endpoint for the "Help / Support" and "Feedback" modules.
// Handles GET and POST for tickets, replies, and feedback.
// -----------------------------------------------------------------------------
import { NextResponse, NextRequest } from "next/server";
import { DocumentData, Timestamp, FieldValue } from "firebase-admin/firestore";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import dayjs from "dayjs";

// -----------------------------------------------------------------------------
// 🚀 GET Handler (Fetch User's Tickets & Messages)
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
    const ticketId = searchParams.get("ticketId");

    let data;

    // 3. Route to correct data fetcher
    switch (tab) {
      // --- Fetch all support tickets for the logged-in user ---
      case "tickets": {
        const snapshot = await firestoreAdmin.collection("support")
          .where("userId", "==", uid)
          .orderBy("createdAt", "desc")
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }

      // --- Fetch all messages for a single support ticket ---
      case "messages": {
        if (!ticketId) {
          return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 });
        }
        
        // Security Check: Ensure the user owns this ticket before fetching messages
        const ticketRef = firestoreAdmin.collection("support").doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists || ticketDoc.data()?.userId !== uid) {
          return NextResponse.json({ error: "Access denied or ticket not found" }, { status: 403 });
        }

        const snapshot = await ticketRef.collection("messages")
          .orderBy("sentAt", "asc")
          .get();
        data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        break;
      }

      default:
        return NextResponse.json({ error: `Invalid tab: ${tab}` }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("[Support API GET] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to load data. ${error.message}` }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🚀 POST Handler (Create Tickets, Replies, Feedback)
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
      // --- Create a new Support Ticket ---
      case "new_support_ticket": {
        const { subject, message } = body;
        if (!subject || !message) {
          return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
        }

        // Use a batch write to create the ticket and its first message
        const batch = firestoreAdmin.batch();
        
        // 1. Create the main ticket document
        const ticketRef = firestoreAdmin.collection("support").doc();
        batch.set(ticketRef, {
          userId: uid,
          userName: userName,
          storeId: storeId,
          subject,
          message, // Storing first message for quick preview
          status: "open",
          createdAt: now,
        });

        // 2. Create the first message in the sub-collection
        const messageRef = ticketRef.collection("messages").doc();
        batch.set(messageRef, {
          senderId: uid,
          senderName: userName,
          text: message,
          sentAt: now,
        });
        
        await batch.commit();
        return NextResponse.json({ id: ticketRef.id, status: "open" }, { status: 201 });
      }
      
      // --- Add a reply to an existing ticket ---
      case "new_support_reply": {
        const { ticketId, text } = body;
        if (!ticketId || !text) {
          return NextResponse.json({ error: "Ticket ID and text are required" }, { status: 400 });
        }
        
        // Security Check: Ensure the user owns this ticket
        const ticketRef = firestoreAdmin.collection("support").doc(ticketId);
        const ticketDoc = await ticketRef.get();
        
        if (!ticketDoc.exists || ticketDoc.data()?.userId !== uid) {
          return NextResponse.json({ error: "Access denied or ticket not found" }, { status: 403 });
        }

        // Add the new message
        await ticketRef.collection("messages").add({
          senderId: uid,
          senderName: userName,
          text: text,
          sentAt: now,
        });
        
        // Re-open the ticket if it was closed
        if (ticketDoc.data()?.status === "closed") {
          await ticketRef.update({ status: "open" });
        }

        return NextResponse.json({ success: true }, { status: 201 });
      }

      // --- Submit new Feedback ---
      case "new_feedback": {
        const { rating, message } = body;
        if (!rating) {
          return NextResponse.json({ error: "Rating is required" }, { status: 400 });
        }

        await firestoreAdmin.collection("feedback").add({
          userId: uid,
          userName: userName,
          storeId: storeId,
          rating: Number(rating),
          message: message || "",
          createdAt: now,
        });
        return NextResponse.json({ success: true }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: "Invalid POST type" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Support API POST] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create item. ${error.message}` }, { status: 500 });
  }
}