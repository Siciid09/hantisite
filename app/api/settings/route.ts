// File: app/api/settings/route.ts
// Description: API for managing ALL settings (GET, PUT) and deletion (DELETE).
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

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
  if (!role) throw new Error("Permission Denied.");

  return { storeId, uid, email: userData.email, role };
}

// Helper to get or create the settings doc
async function getSettingsRef(storeId: string) {
    const settingsQuery = firestoreAdmin.collection('settings').where('storeId', '==', storeId).limit(1);
    const settingsSnap = await settingsQuery.get();
    
    if (!settingsSnap.empty) {
        return settingsSnap.docs[0].ref;
    } else {
        const storeDoc = await firestoreAdmin.collection('stores').doc(storeId).get();
        const storeData = storeDoc.data();
        
        const newSettingsRef = firestoreAdmin.collection('settings').doc();
        await newSettingsRef.set({
            storeId: storeId,
            storeName: storeData?.name || "My Store",
            storePhone: storeData?.phone || "",
            storeAddress: storeData?.address || "",
            currencies: storeData?.currencies || ["USD"], 
            invoiceTemplate: "default",
            createdAt: FieldValue.serverTimestamp(),
        });
        return newSettingsRef;
    }
}

// -----------------------------------------------------------------------------
// 📋 GET - Get Store Settings
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await getAuth(request);

    // --- (FIX) Only fetch settings. Plans are static in the UI. ---
    const settingsRef = await getSettingsRef(storeId);
    const settingsDoc = await settingsRef.get();
    const settings = settingsDoc.data();
    
    return NextResponse.json(settings);

  } catch (error: any) {
    console.error("[SETTINGS API GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// -----------------------------------------------------------------------------
// ✏️ PUT - Update Store OR Profile Settings
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const { storeId, uid, role } = await getAuth(request);
    const body = await request.json();

    // --- Part 1: Handle Profile Update (name, phone) ---
    if (body.name !== undefined || body.phone !== undefined) {
      const { name, phone } = body;
      const userRef = firestoreAdmin.collection("users").doc(uid);
      
      const profileUpdate: any = {};
      if (name !== undefined) profileUpdate.name = name;
      if (phone !== undefined) profileUpdate.phone = phone;

      await userRef.update(profileUpdate);
      
      if (name) {
        await authAdmin.updateUser(uid, { displayName: name });
      }
      return NextResponse.json({ success: true, ...profileUpdate });
    }

    // --- Part 2: Handle Store/Business Settings ---
    if (role !== "admin") {
      return NextResponse.json({ error: "Permission Denied: Admin role required to update settings." }, { status: 403 });
    }

    // --- (MODIFIED) Added 'currencies' ---
    const { storeName, storePhone, storeAddress, currencies, invoiceTemplate } = body;
    const settingsRef = await getSettingsRef(storeId);
    
    const settingsUpdate: any = { updatedAt: FieldValue.serverTimestamp() };
    if (storeName !== undefined) settingsUpdate.storeName = storeName;
    if (storePhone !== undefined) settingsUpdate.storePhone = storePhone;
    if (storeAddress !== undefined) settingsUpdate.storeAddress = storeAddress;
    // --- (MODIFIED) Save 'currencies' array ---
    if (currencies !== undefined) {
       // (FIX) Ensure at least one currency, default to USD if array is empty
       settingsUpdate.currencies = Array.isArray(currencies) && currencies.length > 0 ? currencies : ["USD"];
    }
    if (invoiceTemplate !== undefined) settingsUpdate.invoiceTemplate = invoiceTemplate;
    
    await settingsRef.update(settingsUpdate);
    
    // Also update the main 'stores' doc if name/currencies changed
    const storeUpdate: any = {};
    if (storeName !== undefined) storeUpdate.name = storeName;
    if (settingsUpdate.currencies) storeUpdate.currencies = settingsUpdate.currencies;
    
    if (Object.keys(storeUpdate).length > 0) {
        await firestoreAdmin.collection('stores').doc(storeId).update(storeUpdate);
    }
    
    return NextResponse.json({ success: true, ...settingsUpdate });

  } catch (error: any) {
    console.error("[SETTINGS API PUT] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🗑️ DELETE - Delete Store
// -----------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const { storeId, uid, role } = await getAuth(request);

    if (role !== "admin") {
      return NextResponse.json({ error: "Permission Denied: Only the store admin can delete the store." }, { status: 403 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // We trust the client's re-authentication.

    const batch = firestoreAdmin.batch();
    
    // Delete all users in the store
    const usersSnap = await firestoreAdmin.collection('users').where('storeId', '==', storeId).get();
    const userIds = usersSnap.docs.map(doc => doc.id);
    
    for (const userId of userIds) {
      batch.delete(firestoreAdmin.collection('users').doc(userId));
      await authAdmin.deleteUser(userId); 
    }
    
    // (TODO): This MUST be handled by a Firebase Cloud Function for sub-collections.
    
    const settingsRef = await getSettingsRef(storeId);
    batch.delete(settingsRef);
    batch.delete(firestoreAdmin.collection('stores').doc(storeId));
    
    await batch.commit();

    const response = NextResponse.json({ success: true, message: "Store deleted." });
    response.cookies.set('session', '', { maxAge: -1 }); // Delete cookie
    return response;

  } catch (error: any) {
    console.error("[SETTINGS API DELETE] Error:", error.message);
    return NextResponse.json({ error: "Incorrect password or server error." }, { status: 500 });
  }
}