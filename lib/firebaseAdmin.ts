// File: lib/firebaseAdmin.ts
// Description: Production-ready Firebase Admin initialization

import * as admin from "firebase-admin";

// --- Load credentials from environment variables ---
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
// --- (FIX 1) ADD the storageBucket from your .env.local ---
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// --- Fail fast if any required env var is missing ---
// --- (FIX 2) ADD storageBucket to the check ---
if (!projectId || !clientEmail || !privateKey || !storageBucket) {
  throw new Error(
    `[FATAL] Firebase Admin SDK ENV VARS missing.
Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET are set in .env.local`
  );
}

// --- Initialize Firebase Admin if not already initialized ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    // --- (FIX 3) ADD the storageBucket to the config ---
    storageBucket: storageBucket,
  });
  console.log("[Firebase Admin] SDK Initialized SUCCESSFULLY.");
}

// --- Export services ---
export const firestoreAdmin: FirebaseFirestore.Firestore = admin.firestore();
export const authAdmin: admin.auth.Auth = admin.auth();
// --- (FIX 4) ADD and export storageAdmin ---
export const storageAdmin: admin.storage.Storage = admin.storage();
// --- (FIX 5) ADD and export messagingAdmin ---
export const messagingAdmin: admin.messaging.Messaging = admin.messaging();