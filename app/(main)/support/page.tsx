"use client";

// -----------------------------------------------------------------------------
// File: app/(main)/settings/page.tsx
// Description: The main "Settings" page.
// Features a 3-part tabbed interface for Profile, Help, and Feedback.
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
  User,
  MessageSquare,
  Star,
  LogOut,
  Send,
  Loader2,
  AlertTriangle,
  List,
  CheckCircle,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

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

// --- (B) Main Settings Page Component ---
export default function SettingsModulePage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");

  if (authLoading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    // This shouldn't happen on a protected route, but good to have
    return <div className="p-6">Please log in to view settings.</div>;
  }

  // --- Render UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Settings & Support</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your profile, get help, and send us feedback.
        </p>
      </header>

      {/* --- Tab Navigation --- */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* --- Tab Content --- */}
      <div className="mt-6">
        {activeTab === "Profile" && <ProfileTab user={user} />}
        {activeTab === "Help & Support" && <HelpSupportTab />}
        {activeTab === "Feedback" && <FeedbackTab />}
      </div>
    </div>
  );
}

// --- (C) Tab Navigation Component ---

const TABS = [
  { name: "Profile", icon: User },
  { name: "Help & Support", icon: MessageSquare },
  { name: "Feedback", icon: Star },
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

// --- TAB 1: Profile ---
function ProfileTab({ user }: { user: any }) {
  const [name, setName] = useState(user.displayName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Implement a POST/PUT to '/api/users' to update the name
    // in auth and Firestore
    alert("Profile update logic not yet implemented.");
    setIsSubmitting(false);
  };

  return (
    <Card className="max-w-2xl">
      <h3 className="text-lg font-semibold">Your Profile</h3>
      <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
        <FormInput label="Display Name" value={name} onChange={setName} />
        <FormInput label="Email Address" value={user.email} onChange={() => {}} disabled />
        
        <div className="flex justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => auth.signOut()}
            className="flex items-center gap-2 rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}

// --- TAB 2: Help & Support ---
function HelpSupportTab() {
  const [view, setView] = useState("list"); // 'list' or 'chat'
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (view === "chat" && selectedTicketId) {
    return (
      <TicketChatView
        ticketId={selectedTicketId}
        onBack={() => {
          setSelectedTicketId(null);
          setView("list");
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <NewTicketForm onSuccess={(newTicketId) => {
        setSelectedTicketId(newTicketId);
        setView("chat");
      }} />
      <SupportTicketList onSelectTicket={(ticketId) => {
        setSelectedTicketId(ticketId);
        setView("chat");
      }} />
    </div>
  );
}

function NewTicketForm({ onSuccess }: { onSuccess: (ticketId: string) => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { mutate } = useSWRConfig();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "new_support_ticket", subject, message }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create ticket");
      }
      
      const newTicket = await res.json();
      mutate("/api/support?tab=tickets"); // Refresh ticket list
      setSubject("");
      setMessage("");
      onSuccess(newTicket.id); // Switch to chat view

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold">Create New Support Ticket</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormInput label="Subject" value={subject} onChange={setSubject} required />
        <FormTextarea label="Message" value={message} onChange={setMessage} required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50">
          {isSubmitting ? <Loader2 className="mx-auto animate-spin" /> : "Submit Ticket"}
        </button>
      </form>
    </Card>
  );
}

function SupportTicketList({ onSelectTicket }: { onSelectTicket: (ticketId: string) => void }) {
  const { data, error, isLoading } = useSWR("/api/support?tab=tickets", fetcher);

  return (
    <Card>
      <h3 className="text-lg font-semibold">Your Past Tickets</h3>
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {isLoading && <TableLoader />}
        {error && <ErrorDisplay error={error} />}
        {data?.map((ticket: any) => (
          <button
            key={ticket.id}
            onClick={() => onSelectTicket(ticket.id)}
            className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <div>
              <p className="font-semibold">{ticket.subject}</p>
              <p className="text-sm text-gray-500">
                {dayjs(ticket.createdAt.toDate()).fromNow()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                ticket.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {ticket.status}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </button>
        ))}
        {!isLoading && data?.length === 0 && <TableEmptyState message="No support tickets found." />}
      </div>
    </Card>
  );
}

function TicketChatView({ ticketId, onBack }: { ticketId: string, onBack: () => void }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/support?tab=messages&ticketId=${ticketId}`,
    fetcher
  );
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useAuth().user;

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText) return;
    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "new_support_reply",
          ticketId,
          text: replyText,
        }),
      });
      setReplyText("");
      mutate(); // Re-fetch messages
    } catch (err: any) {
      alert(`Error sending reply: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to all tickets
      </button>
      
      <div className="flex h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading && <TableLoader />}
          {error && <ErrorDisplay error={error} />}
          {data?.map((msg: any) => {
            const isUser = msg.senderId === user.uid;
            // Admin senderId might be different, e.g., 'admin_user_id'
            // For now, we assume if it's not the user, it's admin/support
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
        <form onSubmit={handleReply} className="flex gap-2 border-t p-4 dark:border-gray-700">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className="flex-1 rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
          />
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </Card>
  );
}


// --- TAB 3: Feedback ---
function FeedbackTab() {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "new_feedback", rating, message }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit feedback");
      }
      
      setSuccess(true);
      setRating(0);
      setMessage("");

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (success) {
    return (
      <Card className="max-w-lg text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-4 text-lg font-semibold">Thank You!</h3>
        <p className="mt-1 text-gray-500">Your feedback has been submitted successfully.</p>
        <button onClick={() => setSuccess(false)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-7GitCompare">
          Submit More Feedback
        </button>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <h3 className="text-lg font-semibold">Submit Feedback</h3>
      <p className="mt-1 text-sm text-gray-500">
        Tell us what you think about the app.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Your Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                className="text-gray-300"
              >
                <Star className={`h-8 w-8 ${rating >= star ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} fill={rating >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>
        
        <FormTextarea label="Your Message (Optional)" value={message} onChange={setMessage} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50">
          {isSubmitting ? <Loader2 className="mx-auto animate-spin" /> : "Submit Feedback"}
        </button>
      </form>
    </Card>
  );
}

// --- (E) Helper & Modal Components ---

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