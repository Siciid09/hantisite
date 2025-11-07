import { NextResponse } from "next/server";
import admin from "firebase-admin";

// --- Initialize Admin SDK only once ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// --- Recursive fetch ---
async function getAllCollections(ref: FirebaseFirestore.Firestore | FirebaseFirestore.DocumentReference) {
  const result: any = {};
  const collections = await ref.listCollections();

  for (const col of collections) {
    result[col.id] = {};
    const snapshot = await col.get();

    for (const doc of snapshot.docs) {
      result[col.id][doc.id] = doc.data();

      const subcollections = await doc.ref.listCollections();
      if (subcollections.length > 0) {
        result[col.id][doc.id]._subcollections = await getAllCollections(doc.ref);
      }
    }
  }

  return result;
}

// --- API route handler ---
export async function GET() {
  try {
    const data = await getAllCollections(db);
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}