// File: app/api/settings/route.ts
// Description: API route to GET and POST system-wide settings.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Helper function to get the user's storeId from their auth token
async function getStoreIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized.");
  }
  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new Error("User not found.");
  }
  const storeId = userDoc.data()?.storeId;
  if (!storeId) {
    throw new Error("User has no store.");
  }
  return storeId;
}

// -----------------------------------------------------------------------------
// 🚀 GET - Fetch All Settings
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const storeId = await getStoreIdFromRequest(request);

    // Fetch the main settings document
    const settingsRef = firestoreAdmin.collection("settings").doc(storeId);
    const settingsDoc = await settingsRef.get();

    // Fetch store/company info
    const storeRef = firestoreAdmin.collection("stores").doc(storeId);
    const storeDoc = await storeRef.get();

    if (!settingsDoc.exists || !storeDoc.exists) {
      // Create default settings if they don't exist
      const defaultSettings = {
        language: "en",
        isDarkMode: false,
        primaryColor: "#0057FF",
        currencies: ["USD", "SLSH"],
        paymentMethods: { zaad: true, edahab: true, cash: true },
        // ... other defaults
      };
      const defaultStoreInfo = {
        name: "Your Company Name",
        address: "Your Address",
        phone: "+252 63 000000",
        // ... other defaults
      };
      
      await settingsRef.set(defaultSettings, { merge: true });
      await storeRef.set(defaultStoreInfo, { merge: true });

      return NextResponse.json({
        settings: defaultSettings,
        company: defaultStoreInfo,
      });
    }

    return NextResponse.json({
      settings: settingsDoc.data(),
      company: storeDoc.data(),
    });

  } catch (error: any) {
    console.error("[Settings API GET] Error:", error.stack || error.message);
    return NextResponse.json(
      { error: `Failed to load settings. ${error.message}` },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// 💾 POST - Update Settings (Partial)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json(
      { error: "Internal server error: Admin SDK not configured." },
      { status: 500 }
    );
  }

  try {
    const storeId = await getStoreIdFromRequest(request);
    const { type, payload } = await request.json();

    if (!type || !payload) {
      return NextResponse.json(
        { error: "Invalid request body. 'type' and 'payload' are required." },
        { status: 400 }
      );
    }

    let docRef;

    // We update different documents based on the 'type'
    if (type === "company") {
      docRef = firestoreAdmin.collection("stores").doc(storeId);
    } else if (type === "settings") {
      docRef = firestoreAdmin.collection("settings").doc(storeId);
    } else {
      return NextResponse.json(
        { error: "Invalid settings type." },
        { status: 400 }
      );
    }

    // Update the document with the partial payload
    await docRef.update(payload);

    return NextResponse.json(
      { success: true, message: `${type} settings updated.` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Settings API POST] Error:", error.stack || error.message);
    return NextResponse.json(
      { error: `Failed to save settings. ${error.message}` },
      { status: 500 }
    );
  }
}