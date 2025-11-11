// File: app/contexts/AuthContext.tsx (CORRECTED)

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebaseConfig';
import Image from "next/image"; // Make sure imported

// Define the shape of the custom user object
interface AppUser {
  uid: string;
  email: string | null;
  name?: string;
  storeId?: string;
  // --- THIS IS THE FIX ---
  // Added all roles to the type
  role?: 'admin' | 'manager' | 'hr' | 'cashier' | 'user';
  firebaseUser: FirebaseUser;
}

// Define the shape of the context
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  storeId: string | null;
  subscription: any; // This will hold the 'stores' document data
}

// Create the context
const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  storeId: null, 
  subscription: null 
});

// --- Helper Functions (Unchanged) ---

async function createSession(idToken: string) {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    console.log("[AuthContext] Session cookie created.");
  } catch (error) {
    console.error("[AuthContext] FAILED to create session:", error);
  }
}

async function clearSession() {
  try {
    await fetch('/api/auth/session', {
      method: 'DELETE',
    });
    console.log("[AuthContext] Session cookie cleared.");
  } catch (error) {
    console.error("[AuthContext] FAILED to clear session:", error);
  }
}

// --- Provider Component (THIS IS THE FIX) ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null); // This will hold the store data
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthContext] Setting up onAuthStateChanged listener.");
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthContext] onAuthStateChanged fired. User:", firebaseUser?.uid || 'null');

      try {
        if (firebaseUser) {
          // --- User is logged in ---
          
          // 1. Get the User Document
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userStoreId = userData.storeId;

            if (!userStoreId) {
              throw new Error("User has no associated storeId.");
            }

            // 2. Get the Store Document (which has the subscription)
            const storeDocRef = doc(firestore, 'stores', userStoreId);
            const storeDoc = await getDoc(storeDocRef);

            if (!storeDoc.exists()) {
              throw new Error(`Store document not found for storeId: ${userStoreId}`);
            }
            
            const storeData = storeDoc.data();
            // --- END OF FIX ---

            // 3. Set all state
            const appUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name,
              storeId: userStoreId,
              role: userData.role,
              firebaseUser: firebaseUser,
            };

            setUser(appUser);
            setStoreId(userStoreId);
            setSubscription(storeData); // <-- SET SUB FROM STORE DOC
            
            console.log("[AuthContext] User and Subscription state updated.");

            // 4. Create session cookie
            const idToken = await firebaseUser.getIdToken();
            await createSession(idToken);

          } else {
            console.error("[AuthContext] Firestore doc MISSING for UID:", firebaseUser.uid);
            await auth.signOut();
          }
        } else {
          // --- User is signed out ---
          console.log("[AuthContext] User signed out.");
          setUser(null);
          setStoreId(null);
          setSubscription(null);
          await clearSession();
        }
      } catch (error) {
        console.error("[AuthContext] CRITICAL ERROR:", error);
        setUser(null);
        setStoreId(null);
        setSubscription(null);
        await clearSession();
      } finally {
        console.log("[AuthContext] Setting loading=false.");
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      console.log("[AuthContext] Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    }
  }, []);

  // Render children
  return (
    <AuthContext.Provider value={{ user, loading, storeId, subscription }}>
      {children}
    </AuthContext.Provider>
  );
}

// Create the hook (Unchanged)
export const useAuth = () => useContext(AuthContext);