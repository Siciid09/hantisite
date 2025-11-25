// File: app/api/drafts/route.ts

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Helper: Check Auth
async function checkAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized");
  
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  const userData = userDoc.data();
  
  if (!userData?.storeId) throw new Error("No Store ID");
  return { storeId: userData.storeId, uid, userName: userData.name };
}

// 1. GET: Fetch all drafts
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await checkAuth(request);
    
    const snapshot = await firestoreAdmin.collection("drafts")
      .where("storeId", "==", storeId)
      .orderBy("updatedAt", "desc")
      .get();

    const drafts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString()
    }));

    return NextResponse.json({ drafts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST: Create a draft
export async function POST(request: NextRequest) {
  try {
    const { storeId, uid, userName } = await checkAuth(request);
    const body = await request.json();

    const draftData = {
      storeId,
      uid,
      savedBy: userName,
      customer: body.customer,
      items: body.items,
      paymentLines: body.paymentLines,
      invoiceCurrency: body.invoiceCurrency,
      notes: body.notes,
      totalAmount: body.totalAmount,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If an ID is provided (updating existing draft), use it. Otherwise create new.
    if (body.id) {
        await firestoreAdmin.collection("drafts").doc(body.id).set(draftData, { merge: true });
        return NextResponse.json({ success: true, id: body.id });
    } else {
        const docRef = firestoreAdmin.collection("drafts").doc();
        await docRef.set(draftData);
        return NextResponse.json({ success: true, id: docRef.id });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. DELETE: Remove a draft
export async function DELETE(request: NextRequest) {
  try {
    await checkAuth(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await firestoreAdmin.collection("drafts").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}