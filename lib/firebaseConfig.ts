// lib/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";

// !! FIX: Read all config from environment variables (.env.local)
// This ensures your client-side config is always in sync.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Check for missing client-side keys ---
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("--- [FATAL] CLIENT-SIDE FIREBASE KEYS MISSING ---");
  console.error("Did you forget to add NEXT_PUBLIC_... keys to your .env.local file?");
  console.error("You MUST restart your dev server after creating .env.local");
  console.error("----------------------------------------------------");
} else {
  console.log("[Firebase Config] Client-side config loaded from .env.local");
  console.log(`[Firebase Config] Project ID: ${firebaseConfig.projectId}`);
}

// Initialize Firebase (prevents multiple initialization)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Analytics only runs on the client
let analytics;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.error("Firebase Analytics initialization error:", e);
  }
}

// Export all services
export { app, firestore, auth, storage, analytics, functions };