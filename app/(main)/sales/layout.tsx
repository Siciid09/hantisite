// File: app/(main)/sales/layout.tsx
// Description: Shared layout for all sales pages.
// --- UPDATES ---
// - Removed 'Quotations' from 'salesNavLinks'.

"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  Plus,
  Download,
  RefreshCw,
  LayoutDashboard,
  ShoppingCart,
  History,
  Undo,
  Receipt,
} from "lucide-react";

// --- Loading Spinner ---
const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
  </div>
);

// --- Sub-Navbar Links ---
// --- SOLUTION: Removed 'Quotations' ---
const salesNavLinks = [
  { id: "dashboard", label: "Dashboard", href: "/sales?view=dashboard", icon: LayoutDashboard, title: "View sales overview and KPIs" },
  { id: "pos", label: "POS / New Sale", href: "/sales/new", icon: ShoppingCart, title: "Create a new sale transaction" },
  { id: "history", label: "Sales History", href: "/sales?view=history", icon: History, title: "Browse all past sales" },
  { id: "returns", label: "Returns / Refunds", href: "/sales?view=returns", icon: Undo, title: "Manage customer returns and refunds" },
  { id: "invoices", label: "Invoices", href: "/sales?view=invoices", icon: Receipt, title: "View and manage sales invoices" },
];

const SubNavbar = ({ activeView }: { activeView: string }) => (
  <nav className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
    {salesNavLinks.map((link) => {
      const isPosLink = link.id === "pos";
      const isActive = isPosLink ? activeView === "pos" : activeView === link.id;

      return (
        <Link
          key={link.id}
          href={link.href}
          title={link.title}
          className={`flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
            ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
        >
          <link.icon className="h-4 w-4" />
          {link.label}
        </Link>
      );
    })}
  </nav>
);

// --- Main Layout Component ---
export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const view = searchParams.get("view") || "dashboard";
  const activeView = searchParams.get("activeView") || view;

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-gray-50 p-4 pt-6 text-gray-900 dark:bg-gray-900 dark:text-gray-100 md:p-8">
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Sales Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Overview of your sales performance</p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <Link
            href="/sales/new"
            title="Create a new sale"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 md:flex-none"
          >
            <Plus className="h-4 w-4" />
            New Sale
          </Link>
          <button 
            title="Download Report" 
            // This button is not wired up. It needs a client-side function.
            // onClick={() => exportDataToCsv(salesData)} 
            className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Download className="h-5 w-5" />
          </button>
          <button 
            onClick={() => router.refresh()} // This is fine, but useSWR 'mutate' is better
            title="Refresh Data"
            className="rounded-lg bg-white p-2.5 text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      <SubNavbar activeView={activeView} />
      
      <Suspense fallback={<LoadingSpinner />}>
        <div className="mt-5">
          {children}
        </div>
      </Suspense>
    </div>
  );
}