"use client";

import React, { useState, useEffect } from "react"; 
import { usePathname, useRouter } from "next/navigation";
import Sidebar from '@/app/components/layout/Sidebar';
import Header from "./header";
import { useAuth } from "@/app/contexts/AuthContext";
import SubscriptionWarning from "./SubscriptionWarning";
import dayjs from "dayjs";

// Check subscription function
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

// Spinner component
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
  const router = useRouter(); 

  const { user, subscription, loading } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Don't wrap login/register pages
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>;
  }

  // Show spinner while loading or redirect preparing
  if (loading || !user) {
    return <FullScreenSpinner />;
  }

  // Show subscription warning if not active
  if (!isSubscriptionActive(subscription)) {
    return <SubscriptionWarning />;
  }

  // Layout for logged in & subscribed users
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isClosed={isDesktopSidebarClosed}
        toggleSidebar={() => setIsDesktopSidebarClosed(!isDesktopSidebarClosed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        
        {/* ================== FIXED HEADER PROP ================== */}
        <Header 
          isOpen={isMobileSidebarOpen} 
          onMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} 
        />

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
