// File: app/api/sadmin/route.ts
// Description: [V4] PUSH ENABLED - Fully dynamic with FCM Push Notifications.
// Reads/writes 'subscriptionExpiryDate', 'subscriptionType', 'contactInfo'.
// Reads from 'support' collection.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
// 👇 NEW IMPORT for sending Push Notifications
import { getMessaging } from "firebase-admin/messaging"; 

// --- Super Admin Auth Helper ---
async function checkSuperAdminAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("401 - Unauthorized: No token provided.");
  }
  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("401 - Unauthorized: User record not found.");

  const userData = userDoc.data()!;
  if (userData.role !== "sadmin") {
    console.warn(`[SADMIN_AUTH] FAILED attempt by user ${uid} (Role: ${userData.role})`);
    throw new Error("403 - Forbidden: Access denied.");
  }
  
  return {
    uid: uid,
    role: userData.role,
    name: userData.name || "Super Admin",
    email: userData.email,
  };
}

// Helper to safely convert timestamps
const convertTimestamps = (data: any) => {
  if (!data) return data;
  const newObj: { [key: string]: any } = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value && typeof value.toDate === 'function') {
      newObj[key] = value.toDate().toISOString();
    } else {
      newObj[key] = value;
    }
  }
  return newObj;
};

// =============================================================================
// 📋 GET - Fetch all Super Admin data
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    await checkSuperAdminAuth(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // --- 🏠 Action: Get Dashboard Stats ---
    if (action === "getDashboardStats") {
      const [storesSnap, paymentsSnap, ticketsSnap] = await Promise.all([
        firestoreAdmin.collection('stores').get(),
        firestoreAdmin.collection('payments').where('status', '==', 'paid').get(),
        firestoreAdmin.collection('support').where('status', '==', 'open').get(),
      ]);

      const allStores = storesSnap.docs.map(doc => doc.data());
      const totalRevenue = paymentsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      
      const stats = {
        totalStores: storesSnap.size,
        activeStores: allStores.filter(s => s.status === 'active').length,
        totalRevenue: totalRevenue,
        pendingTickets: ticketsSnap.size,
      };
      return NextResponse.json({ success: true, stats });
    }

    // --- 🏪 Action: Get All Stores (for list) ---
    if (action === "getAllStores") {
      const storesSnap = await firestoreAdmin.collection('stores')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
      
      const stores = storesSnap.docs.map(doc => {
        const data = doc.data();
        return convertTimestamps({
          id: doc.id,
          name: data.name,
          ownerEmail: data.contactInfo, 
          plan: data.subscriptionType,
          status: data.status,
          expiryDate: data.subscriptionExpiryDate,
        });
      });
      return NextResponse.json({ success: true, stores });
    }
    
    // --- 🏬 Action: Get Full Store View ---
    if (action === "getStoreDetails") {
        const storeId = searchParams.get("storeId");
        if (!storeId) throw new Error("storeId is required");
        
        const [storeSnap, usersSnap, salesSnap, productsSnap] = await Promise.all([
            firestoreAdmin.collection('stores').doc(storeId).get(),
            firestoreAdmin.collection('users').where('storeId', '==', storeId).get(),
            firestoreAdmin.collection('sales').where('storeId', '==', storeId).count().get(),
            firestoreAdmin.collection('products').where('storeId', '==', storeId).count().get()
        ]);

        if (!storeSnap.exists) throw new Error("Store not found");
        
        const storeData = storeSnap.data()!;
        const adminUser = usersSnap.docs.map(doc => doc.data()).find(u => u.role === 'admin');

        const fullStoreDetails = {
            id: storeSnap.id,
            name: storeData.name,
            status: storeData.status,
            ownerName: adminUser?.name || 'N/A',
            ownerEmail: storeData.contactInfo || adminUser?.email || 'N/A',
            plan: storeData.subscriptionType,
            expiryDate: storeData.subscriptionExpiryDate ? storeData.subscriptionExpiryDate.toDate().toISOString() : null,
            users: usersSnap.docs.map(doc => doc.data()),
            activity: {
                totalSales: salesSnap.data().count,
                totalProducts: productsSnap.data().count,
            }
        };
        return NextResponse.json({ success: true, store: fullStoreDetails });
    }

    // --- 💳 Action: Get Payments ---
    if (action === "getPayments") {
        const paymentsSnap = await firestoreAdmin.collection('payments')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        const payments = paymentsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ success: true, payments });
    }

    // --- 📢 Action: Get Notifications ---
    if (action === "getNotifications") {
        const snap = await firestoreAdmin.collection('notifications')
            .orderBy('createdAt', 'desc').get();
        const items = snap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ success: true, notifications: items });
    }
    
    // --- 💬 Action: Get Support Tickets ---
    if (action === "getSupportTickets") {
        const ticketsSnap = await firestoreAdmin.collection('support')
            .orderBy('createdAt', 'desc').get();
        const tickets = ticketsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ success: true, tickets });
    }
    
    // --- 💬 Action: Get Ticket Details ---
    if (action === "getTicketDetails") {
        const ticketId = searchParams.get("ticketId");
        if (!ticketId) throw new Error("ticketId is required");
        
        const ticketRef = firestoreAdmin.collection('support').doc(ticketId);
        const [ticketSnap, messagesSnap] = await Promise.all([
            ticketRef.get(),
            ticketRef.collection('messages').orderBy('sentAt', 'asc').get()
        ]);
        
        if (!ticketSnap.exists) throw new Error("Ticket not found");
        
        const ticket = convertTimestamps({ id: ticketSnap.id, ...ticketSnap.data() });
        const messages = messagesSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
        
        return NextResponse.json({ success: true, ticket, messages });
    }

    return NextResponse.json({ error: "Invalid GET action" }, { status: 400 });

  } catch (error: any) {
    console.error("[SADMIN API GET] Error:", error.message);
    const status = error.message.startsWith("401") ? 401 : error.message.startsWith("403") ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}


// =============================================================================
// ➕ POST - Create new entities (WITH PUSH NOTIFICATIONS)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const sadminUser = await checkSuperAdminAuth(request);
    const body = await request.json();
    const action = body.action;

    // --- 📢 Action: Create Notification ---
    if (action === "createNotification") {
      const { title, message, targetType, targetStores = [] } = body.data;
      
      if (!title || !message || !targetType) {
        throw new Error("Missing fields for notification");
      }
      
      // 1. SAVE TO DATABASE (Preserves Admin Dashboard View)
      const newNotifRef = firestoreAdmin.collection('notifications').doc();
      const newData = {
        id: newNotifRef.id,
        title,
        message,
        targetType, // 'all', 'specific'
        targetStores, // array of store IDs
        status: 'sent',
        createdAt: FieldValue.serverTimestamp(),
      };
      await newNotifRef.set(newData);

      // 2. SEND PUSH NOTIFICATION (New Logic)
      // We wrap this in try/catch so DB save isn't affected if FCM fails
      try {
        let userTokens: string[] = [];

        if (targetType === 'all') {
          // A. Send to everyone with a token
          const usersSnap = await firestoreAdmin.collection('users')
            .where('fcmToken', '!=', null)
            .get();
          usersSnap.docs.forEach(doc => {
             const t = doc.data().fcmToken;
             if (t) userTokens.push(t);
          });

        } else if (targetStores.length > 0) {
          // B. Send to specific stores
          // Note: Firestore 'in' limit is 10. We slice to be safe.
          const safeTargetStores = targetStores.slice(0, 10);
          const usersSnap = await firestoreAdmin.collection('users')
            .where('storeId', 'in', safeTargetStores)
            .get();
          
          usersSnap.docs.forEach(doc => {
             const data = doc.data();
             if (data.fcmToken) userTokens.push(data.fcmToken);
          });
        }

        // C. Blast the Message
        if (userTokens.length > 0) {
          // Remove duplicate tokens
          const uniqueTokens = [...new Set(userTokens)];
          
          const messagePayload = {
            notification: {
              title: title,
              body: message,
            },
            data: {
              route: "/notifications", 
              click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            tokens: uniqueTokens,
          };

          const response = await getMessaging(firestoreAdmin.app).sendEachForMulticast(messagePayload);
          console.log(`[FCM] Successfully sent: ${response.successCount}, Failed: ${response.failureCount}`);
        }
      } catch (pushError) {
        console.error("[FCM] Failed to send push notification:", pushError);
        // Continue execution to return success for the DB save
      }

      return NextResponse.json({ success: true, notification: convertTimestamps(newData) });
    }
    
    // --- 💬 Action: Create Ticket Response ---
    if (action === "createTicketResponse") {
        const { ticketId, message } = body.data;
        if (!ticketId || !message) throw new Error("ticketId and message are required");
        
        const ticketRef = firestoreAdmin.collection('support').doc(ticketId);
        const newMessageRef = ticketRef.collection('messages').doc();
        
        const newMessage = {
          id: newMessageRef.id,
            text: message,
            senderId: sadminUser.uid,
            senderName: sadminUser.name,
            sentAt: FieldValue.serverTimestamp(),
        };
        
        await newMessageRef.set(newMessage);
        await ticketRef.update({
            status: 'in_progress',
            updatedAt: FieldValue.serverTimestamp()
        });
        
        return NextResponse.json({ success: true, message: convertTimestamps(newMessage) });
    }

    return NextResponse.json({ error: "Invalid POST action" }, { status: 400 });

  } catch (error: any) {
    console.error("[SADMIN API POST] Error:", error.message);
    const status = error.message.startsWith("401") ? 401 : error.message.startsWith("403") ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// =============================================================================
// ✏️ PUT - Update store settings
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    await checkSuperAdminAuth(request);
    const body = await request.json();
    const action = body.action;

    // --- 🏪 Action: Update Store Status ---
    if (action === "updateStoreStatus") {
      const { storeId, status } = body.data; 
      if (!storeId || !status) throw new Error("storeId and status are required");
      
      await firestoreAdmin.collection('stores').doc(storeId)
        .update({ status: status, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true, storeId, status });
    }

    // --- 🏪 Action: Update Expiry Date ---
    if (action === "updateExpiryDate") {
      const { storeId, newExpiryDate } = body.data; 
      if (!storeId || !newExpiryDate) throw new Error("storeId and newExpiryDate are required");
      
      await firestoreAdmin.collection('stores').doc(storeId).update({ 
        subscriptionExpiryDate: new Date(newExpiryDate), 
        updatedAt: FieldValue.serverTimestamp() 
      });
      return NextResponse.json({ success: true, storeId, newExpiryDate });
    }
    
    // --- 🏪 Action: Change Plan ---
    if (action === "changePlan") {
      const { storeId, newPlan } = body.data; 
      if (!storeId || !newPlan) throw new Error("storeId and newPlan are required");
      
      await firestoreAdmin.collection('stores').doc(storeId).update({ 
        subscriptionType: newPlan, 
        updatedAt: FieldValue.serverTimestamp() 
      });
      return NextResponse.json({ success: true, storeId, newPlan });
    }
    
    // --- 💬 Action: Update Ticket Status ---
    if (action === "updateTicketStatus") {
        const { ticketId, status } = body.data;
        if (!ticketId || !status) throw new Error("ticketId and status are required");
        
        await firestoreAdmin.collection('support').doc(ticketId).update({
            status: status,
            updatedAt: FieldValue.serverTimestamp()
        });
        return NextResponse.json({ success: true, ticketId, status });
    }

    return NextResponse.json({ error: "Invalid PUT action" }, { status: 400 });

  } catch (error: any) {
    console.error("[SADMIN API PUT] Error:", error.message);
    const status = error.message.startsWith("401") ? 401 : error.message.startsWith("403") ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}


// =============================================================================
// 🗑️ DELETE - Delete entities
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    await checkSuperAdminAuth(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // --- 🏪 Action: Delete Store ---
    if (action === "deleteStore") {
        const storeId = searchParams.get("id");
        if (!storeId) throw new Error("storeId is required");
        
        console.warn(`[SADMIN API DELETE] Initiating deletion for storeId: ${storeId}`);
        const batch = firestoreAdmin.batch();

        const usersSnap = await firestoreAdmin.collection('users').where('storeId', '==', storeId).get();
        const userIds: string[] = [];
        usersSnap.docs.forEach(doc => {
            userIds.push(doc.id);
            batch.delete(doc.ref);
        });
        
        const settingsSnap = await firestoreAdmin.collection('settings').where('storeId', '==', storeId).get();
        settingsSnap.docs.forEach(doc => batch.delete(doc.ref));
        
        batch.delete(firestoreAdmin.collection('stores').doc(storeId));
        await batch.commit();
        
        for (const userId of userIds) {
            try { await authAdmin.deleteUser(userId); } catch (e) { console.error(e); }
        }
        
        return NextResponse.json({ success: true, message: "Store doc and users deleted." });
    }
    
    // --- 📢 Action: Delete Notification ---
    if (action === "deleteNotification") {
        const id = searchParams.get("id");
        if (!id) throw new Error("Notification ID is required");
        
        await firestoreAdmin.collection('notifications').doc(id).delete();
        return NextResponse.json({ success: true, id: id });
    }

    return NextResponse.json({ error: "Invalid DELETE action" }, { status: 400 });

  } catch (error: any) {
    console.error("[SADMIN API DELETE] Error:", error.message);
    const status = error.message.startsWith("401") ? 401 : error.message.startsWith("403") ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}