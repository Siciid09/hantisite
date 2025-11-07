"use client";

// -----------------------------------------------------------------------------
// File: app/(main)/messages/page.tsx
// Description: The main "Communication" page.
// Features a 3-part tabbed interface for Chat, Notifications, and Announcements.
// -----------------------------------------------------------------------------

import React, { useState, FormEvent, Fragment } from "react";
import useSWR, { useSWRConfig } from "swr";
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
  Send,
  Loader2,
  AlertTriangle,
  List,
  CheckCircle,
  RefreshCw,
  X,
  CreditCard,
  AlertCircle,
} from "lucide-react";

// --- CONFIGURATION ---
// !! IMPORTANT: Set this to YOUR Firebase UID to be the Super Admin
const SAAS_SUPER_ADMIN_UID = "YOUR_FIREBASE_UID_HERE"; 
// ---------------------


// --- (A) API Fetcher ---
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

// --- (B) Main Messages Page Component ---
export default function MessagesModulePage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("Messages / Chat");

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return <div className="p-6">Please log in to view messages.</div>;
  }
  
  const isSuperAdmin = user.uid === SAAS_SUPER_ADMIN_UID;

  // --- Render UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Communications</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Internal chat, notifications, and announcements.
        </p>
      </header>

      {/* --- Tab Navigation --- */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* --- Tab Content --- */}
      <div className="mt-6">
        {activeTab === "Messages / Chat" && <ChatTab user={user} />}
        {activeTab === "Notifications" && <NotificationsTab />}
        {activeTab === "Announcements" && <AnnouncementsTab isSuperAdmin={isSuperAdmin} />}
      </div>
    </div>
  );
}

// --- (C) Tab Navigation Component ---

const TABS = [
  { name: "Messages / Chat", icon: MessageSquare },
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

// --- (D) Tab Content Components ---

// --- TAB 1: Messages / Chat ---
function ChatTab({ user }: { user: any }) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const { data: rooms, error, isLoading } = useSWR("/api/messages?tab=chat_rooms", fetcher);
  
  if (isLoading) return <TableLoader />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <Card className="h-[70vh]">
      <div className="flex h-full">
        {/* Left Pane: Chat Room List */}
        <div className="flex h-full w-full flex-col border-r dark:border-gray-700 md:w-1/3">
          <h3 className="p-4 text-lg font-semibold">Conversations</h3>
          <div className="flex-1 space-y-2 overflow-y-auto px-2">
            {rooms?.map((room: any) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`w-full rounded-lg p-3 text-left ${
                  selectedRoomId === room.id ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <p className="font-semibold">{room.name || room.id.substring(0, 6)}</p>
                <p className="truncate text-sm text-gray-500">{room.lastMessage}</p>
                <p className="text-xs text-gray-400">
                  {dayjs(room.lastMessageAt.toDate()).fromNow()}
                </p>
              </button>
            ))}
            {rooms?.length === 0 && <TableEmptyState message="No chat rooms found." />}
          </div>
        </div>
        
        {/* Right Pane: Chat Window */}
        <div className="hidden h-full w-2/3 flex-col md:flex">
          {selectedRoomId ? (
            <ChatWindow roomId={selectedRoomId} user={user} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <MessageSquare className="h-16 w-16" />
              <p className="mt-2">Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* --- Modal for Mobile Chat Window --- */}
      {selectedRoomId && (
         <div className="absolute inset-0 z-10 bg-white dark:bg-gray-800 md:hidden">
            <button 
              onClick={() => setSelectedRoomId(null)} 
              className="p-4 text-blue-600 dark:text-blue-400"
            >
              &larr; Back to conversations
            </button>
           <ChatWindow roomId={selectedRoomId} user={user} />
         </div>
      )}
    </Card>
  );
}

function ChatWindow({ roomId, user }: { roomId: string, user: any }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/messages?tab=chat_messages&roomId=${roomId}`,
    fetcher,
    { refreshInterval: 5000 } // Poll for new messages every 5 seconds
  );
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text) return;
    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "new_chat_message",
          roomId,
          text,
        }),
      });
      setText("");
      mutate(); // Re-fetch messages
    } catch (err: any) {
      alert(`Error sending message: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((msg: any) => {
          const isUser = msg.senderId === user.uid;
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                isUser ? 'rounded-br-none bg-blue-600 text-white' : 'rounded-bl-none bg-gray-200 dark:bg-gray-700'
              }`}>
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs opacity-70 ${isUser ? 'text-blue-200' : 'text-gray-500'} mt-1`}>
                  {msg.senderName} &bull; {dayjs(msg.sentAt.toDate()).fromNow()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t p-4 dark:border-gray-700">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
        />
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50">
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}

// --- TAB 2: Notifications ---
function NotificationsTab() {
  const { data, error, isLoading, mutate } = useSWR("/api/messages?tab=notifications", fetcher);
  const { mutate: globalMutate } = useSWRConfig();

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
      <h3 className="text-lg font-semibold">Your Notifications</h3>
      <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((n: any) => (
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
                {dayjs(n.createdAt.toDate()).fromNow()}
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
        {!isLoading && data?.length === 0 && <TableEmptyState message="No notifications found." />}
      </div>
    </Card>
  );
}

// --- TAB 3: Announcements ---
function AnnouncementsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { data, error, isLoading, mutate } = useSWR("/api/messages?tab=announcements", fetcher);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // This form is now submitted by the super admin
  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "new_announcement", title, body }),
      });
      setTitle("");
      setBody("");
      mutate();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`grid grid-cols-1 gap-6 ${isSuperAdmin ? 'lg:grid-cols-2' : ''}`}>
      {/* **MODIFIED:** This card is now only visible to you */}
      {isSuperAdmin && (
        <Card>
          <h3 className="text-lg font-semibold">Post New Announcement</h3>
          <p className="text-sm text-gray-500">(Super Admin Only)</p>
          <form onSubmit={handlePost} className="mt-4 space-y-4">
            <FormInput label="Title" value={title} onChange={setTitle} required />
            <FormTextarea label="Body" value={body} onChange={setBody} required />
            <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50">
              {isSubmitting ? <Loader2 className="mx-auto animate-spin" /> : "Post Announcement"}
            </button>
          </form>
        </Card>
      )}
      
      <Card className={`${!isSuperAdmin ? 'lg:col-span-2' : ''}`}>
        <h3 className="text-lg font-semibold">Recent Announcements</h3>
        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto">
          {isLoading && <TableLoader />}
          {error && <ErrorDisplay error={error} />}
          {data?.map((a: any) => (
            <div key={a.id} className="rounded-lg border p-3 dark:border-gray-700">
              <p className="font-semibold">{a.title}</p>
              <p className="my-1 text-sm">{a.body}</p>
              <p className="text-xs text-gray-500">
                by {a.authorName} &bull; {dayjs(a.createdAt.toDate()).fromNow()}
              </p>
            </div>
          ))}
          {!isLoading && data?.length === 0 && <TableEmptyState message="No announcements found." />}
        </div>
      </Card>
    </div>
  );
}

// --- (E) Helper Components ---

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

const FormInput = ({ label, value, onChange, ...props }: {
  label: string,
  value: string,
  onChange: (val: string) => void,
  [key: string]: any
}) => (
  <div>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
      {...props}
    />
  </div>
);

const FormTextarea = ({ label, value, onChange, ...props }: {
  label: string,
  value: string,
  onChange: (val: string) => void,
  [key: string]: any
}) => (
  <div>
    <label className="mb-1 block text-sm font-medium">{label}</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-28 w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
      {...props}
    />
  </div>
);