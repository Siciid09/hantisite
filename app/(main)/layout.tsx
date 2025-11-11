// File: app/(main)/layout.tsx (FIXED)

"use client";

// 1. IMPORT useEffect
import React, { useState, useEffect } from "react"; 
import { usePathname, useRouter } from "next/navigation";
import Sidebar from '@/app/components/layout/Sidebar';
import Header from "./header";
import { useAuth } from "@/app/contexts/AuthContext";
import SubscriptionWarning from "./SubscriptionWarning";
import dayjs from "dayjs";

// ... (isSubscriptionActive function and FullScreenSpinner are unchanged) ...
function isSubscriptionActive(subscription: any): boolean {
  if (!subscription) {
    return false;
  }
  let isStatusActive = false;
  if (subscription.status && typeof subscription.status === 'string') {
    const status = subscription.status.toLowerCase();
    isStatusActive = status === 'active' || status === 'trial' || status === 'trialing';
  }
  let isDateValid = false;
  const expiryDate = subscription.subscriptionExpiryDate;
  if (expiryDate && typeof expiryDate.toDate === 'function') {
    const expires = dayjs(expiryDate.toDate());
    isDateValid = expires.isAfter(dayjs()); 
  } else {
    console.error("Subscription Error: 'subscriptionExpiryDate' is missing or not a Timestamp.");
    isDateValid = false;
  }
  return isStatusActive && isDateValid;
}
const FullScreenSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
  </div>
);
// ... (End of hidden functions) ...


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDesktopSidebarClosed, setIsDesktopSidebarClosed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter(); 

  const { user, subscription, loading } = useAuth();

  // 2. THIS IS THE FIX 
  // We move the redirect logic into a useEffect hook.
  // This runs *after* render, so it doesn't cause the error.
  useEffect(() => {
    // Only run this check if loading is finished AND there is no user
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]); // Re-run when these values change

  // 3. Don't run this layout on public pages
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>;
  }

  // 4. Show a spinner while loading OR while the redirect is preparing
  if (loading || !user) {
    return <FullScreenSpinner />;
  }

  // 5. Check subscription (now that we know a user exists)
  if (!isSubscriptionActive(subscription)) {
    return <SubscriptionWarning />;
  }

  // 6. User is loaded, logged in, and subscribed. Show the app.
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