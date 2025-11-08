// File: app/(main)/layout.tsx (COMPLETE AND FINAL FIX)

"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from '@/app/components/layout/Sidebar'; // Your original path
import Header from "./header";   // Your original path
import { useAuth } from "@/app/contexts/AuthContext"; // Import useAuth
import SubscriptionWarning from "./SubscriptionWarning"; // The warning component
import dayjs from "dayjs"; // <-- This import is critical

/**
 * THIS IS THE NEW, CORRECTED FUNCTION.
 * It now checks BOTH the 'status' AND the 'subscriptionExpiryDate'.
 */
function isSubscriptionActive(subscription: any): boolean {
  if (!subscription) {
    return false; // No subscription object
  }

  // --- 1. Check the Status (from subscribtion.dart & database) ---
  let isStatusActive = false;
  if (subscription.status && typeof subscription.status === 'string') {
    const status = subscription.status.toLowerCase();
    // Allowed statuses are 'active', 'trial', or 'trialing'
    isStatusActive = status === 'active' || status === 'trial' || status === 'trialing';
  }

  // --- 2. Check the Expiry Date (from database) ---
  let isDateValid = false;
  const expiryDate = subscription.subscriptionExpiryDate; // e.g., "4 November 2025..."

  if (expiryDate && typeof expiryDate.toDate === 'function') {
    // This is a Firestore Timestamp
    const expires = dayjs(expiryDate.toDate());
    
    // Check if the expiry date is *after* right now.
    // If it expires today at 7:50 AM, at 7:51 AM this will be false.
    isDateValid = expires.isAfter(dayjs()); 
  } else {
    // If the date field is missing or not a timestamp, they are not valid
    console.error("Subscription Error: 'subscriptionExpiryDate' is missing or not a Timestamp.");
    isDateValid = false;
  }

  // --- 3. Both must be true to be active ---
  // The user is active ONLY IF their status is good AND their date is in the future.
  return isStatusActive && isDateValid;
}


// --- Loading Component ---
const FullScreenSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
  </div>
);


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDesktopSidebarClosed, setIsDesktopSidebarClosed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Get user, subscription, AND loading state from your AuthContext
  const { user, subscription, loading } = useAuth();

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  // 1. Don't show this layout on public pages like /login
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>;
  }

  // 2. Show a full-screen spinner while auth is being checked
  // This prevents all "flashing" bugs.
  if (loading) {
    return <FullScreenSpinner />;
  }

  // 3. (FIX for Logged-out users)
  // If loading is done and there is NO user.
  if (!user) {
    return (
      <main className="h-screen w-full bg-gray-50 p-8 dark:bg-gray-900">
        {/* This will render the "Please log in to view..." message */}
        {children}
      </main>
    );
  }

  // 4. (FIX for Active users)
  // A `user` EXISTS. Now we safely check their subscription
  // using the CORRECT 'status' AND 'date' logic.
  if (!isSubscriptionActive(subscription)) {
    // User is logged in, but status is 'expired' OR date has passed.
    // Show *only* the warning screen.
    return <SubscriptionWarning />;
  }

  // 5. If we are here, the user is logged in AND subscribed.
  // Show the full app layout.
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isClosed={isDesktopSidebarClosed}
        toggleSidebar={() => setIsDesktopSidebarClosed(!isDesktopSidebarClosed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        
        <Header onMenuToggle={() => setIsMobileSidebarOpen(true)} />

        <main
          className={`
            flex-grow
            transition-all duration-300 ease-in-out
            ${isDesktopSidebarClosed ? "md:pl-[72px]" : "md:pl-[250px]"}
          `}
        >
          {children}
        </main>
      </div>
    </div>
  );
}