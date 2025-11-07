// File: app/(main)/auth/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebaseConfig';
// !! NOTE: We no longer need 'useRouter' or 'usePathname' here!

// Define the shape of the custom user object
interface AppUser {
  uid: string;
  email: string | null;
  name?: string;
  storeId?: string;
  role?: 'admin' | 'manager' | 'user';
  firebaseUser: FirebaseUser;
}

// Define the shape of the context
interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  storeId: string | null;
}

// Create the context
const AuthContext = createContext<AuthContextType>({ user: null, loading: true, storeId: null });

// --- Helper Functions to call our new API ---

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

// --- Provider Component ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthContext] Setting up onAuthStateChanged listener.");
    setLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthContext] onAuthStateChanged fired. User:", firebaseUser?.uid || 'null');

      try {
        if (firebaseUser) {
          // User is logged in
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const appUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name,
              storeId: userData.storeId,
              role: userData.role,
              firebaseUser: firebaseUser,
            };

            setUser(appUser);
            setStoreId(userData.storeId);
            console.log("[AuthContext] User state updated. Store ID:", userData.storeId);

            // !! NEW: Get ID token and create session cookie
            const idToken = await firebaseUser.getIdToken();
            await createSession(idToken);

          } else {
            // Auth user exists but no Firestore data.
            console.error("[AuthContext] Firestore doc MISSING for UID:", firebaseUser.uid);
            await auth.signOut(); // This will re-trigger onAuthStateChanged
          }
        } else {
          // User is signed out
          console.log("[AuthContext] User signed out.");
          setUser(null);
          setStoreId(null);
          
          // !! NEW: Clear the session cookie
          await clearSession();
        }
      } catch (error) {
        console.error("[AuthContext] CRITICAL ERROR inside onAuthStateChanged:", error);
        setUser(null);
        setStoreId(null);
        await clearSession(); // Clear session on error too
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

  // Global loading screen
  // !! This now only shows on initial load, not during redirects
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-background dark:bg-background-dark">
        <div className="text-primary dark:text-primary-light animate-pulse">Loading Hantikaab...</div>
      </div>
    );
  }

  // Render children (Middleware handles non-logged-in state)
  return (
    <AuthContext.Provider value={{ user, loading, storeId }}>
      {children}
    </AuthContext.Provider>
  );
}

// Create the hook
export const useAuth = () => useContext(AuthContext);