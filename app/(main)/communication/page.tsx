"use client";

// -----------------------------------------------------------------------------
// File: app/(main)/communication/page.tsx
// Description: This is your frontend page. It correctly connects
// to the /api/messages route.
// -----------------------------------------------------------------------------

import React, { useState, Fragment } from "react";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// --- Icons ---
import {
  MessageSquare,
  Bell,
  Megaphone,
  Loader2,
  AlertTriangle,
  List,
  CreditCard,
  AlertCircle,
} from "lucide-react";

// --- (A) Type Definitions ---

// Type for personal notifications (billing, support, etc.)
interface PersonalNotification {
  id: string;
  read: boolean;
  type: string;
  message: string;
  createdAt: string; // ISO date string from JSON
  userId: string;
}

// Type for global announcements (from SAdmin panel)
interface Announcement {
  id: string;
  title: string;
  message: string;
  targetType: string;
  targetStores: string[];
  status: string;
  createdAt: string; // ISO date string from JSON
}


// --- (B) API Fetcher ---
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// --- (C) Main Messages Page Component ---
export default function MessagesModulePage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("Notifications");

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return <div className="p-6">Please log in to view messages.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Communications</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Internal notifications and company announcements.
        </p>
      </header>

      {/* --- Tab Navigation --- */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* --- Tab Content --- */}
      <div className="mt-6">
        {activeTab === "Notifications" && <NotificationsTab />}
        {activeTab === "Announcements" && <AnnouncementsTab />}
      </div>
    </div>
  );
}

// --- (D) Tab Navigation Component ---

const TABS = [
  { name: "Notifications", icon: Bell },
  { name: "Announcements", icon: Megaphone },
];

const TabNav = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (tab: string) => void }) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          onClick={() => onTabChange(tab.name)}
          className={`
            group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium
            ${
              activeTab === tab.name
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
            }
          `}
        >
          <tab.icon className={`h-5 w-5 ${activeTab === tab.name ? "text-blue-500 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-500"}`} />
          {tab.name}
        </button>
      ))}
    </nav>
  </div>
);

// --- (E) Tab Content Components ---

// --- TAB 1: Notifications ---
function NotificationsTab() {
  // Provided the PersonalNotification[] type to useSWR
  const { data, error, isLoading, mutate } = useSWR<PersonalNotification[]>(
    "/api/messages?tab=notifications", 
    fetcher
  );

  const handleMarkAsRead = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "mark_notification_read", notificationId: id }),
      });
      mutate(); // Re-fetch
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };
  
  const getIconForType = (type: string) => {
    switch (type) {
      case 'billing': return <CreditCard className="h-5 w-5 text-red-500" />;
      case 'support': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'stock': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card className="max-w-3xl">
      <h3 className="text-lg font-semibold">Your Personal Notifications</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Alerts related to billing, support tickets, and your account.
      </p>
      <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-lg border p-3 dark:border-gray-700 ${
              !n.read ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'
            }`}
          >
            <span className="mt-1">
              {getIconForType(n.type)}
            </span>
            <div className="flex-1">
              <p className="font-medium">{n.message}</p>
              <p className="text-sm text-gray-500">
                {/* createdAt is now a string, so this is correct */}
                {dayjs(n.createdAt).fromNow()}
              </p>
            </div>
            {n.read === false && (
              <button
                onClick={() => handleMarkAsRead(n.id)}
                className="flex-shrink-0 rounded-lg border px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Mark as Read
              </button>
            )}
          </div>
        ))}
        {!isLoading && data?.length === 0 && <TableEmptyState message="No personal notifications found." />}
      </div>
    </Card>
  );
}

// --- TAB 2: Announcements ---
function AnnouncementsTab() {
  // Provided the Announcement[] type to useSWR
  const { data, error, isLoading } = useSWR<Announcement[]>(
    "/api/messages?tab=announcements", 
    fetcher
  );

  return (
    <Card>
      <h3 className="text-lg font-semibold">Company Announcements</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Updates and broadcasts from the Hantikaab Admin team.
      </p>
      <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((a) => (
          <div key={a.id} className="rounded-lg border p-3 dark:border-gray-700">
            <p className="font-semibold">{a.title}</p>
            <p className="my-1 text-sm">{a.message}</p>
            <p className="text-xs text-gray-500">
              by Hantikaab Admin &bull; {/* createdAt is now a string */}
              {dayjs(a.createdAt).fromNow()}
            </p>
          </div>
        ))}
        {!isLoading && data?.length === 0 && <TableEmptyState message="No announcements found." />}
      </div>
    </Card>
  );
}

// --- (F) Helper Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const TableLoader = () => (
  <div className="flex w-full justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5" />
      <div>
        <h3 className="font-semibold">Error Loading Data</h3>
        <p className="text-sm">{error.message}</p>
      </div>
    </div>
  </div>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
    <List className="mx-auto mb-2 h-12 w-12 opacity-50" />
    {message}
  </div>
);