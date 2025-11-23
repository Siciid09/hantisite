"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, Smartphone, Globe, ChevronRight, Search, 
  Moon, Sun, Menu, X, LayoutDashboard, ShoppingCart, 
  Package, DollarSign, Users, Settings, CreditCard, 
  Truck, FileText, Bell, ShieldCheck, Printer, WifiOff,
  History, AlertTriangle, ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// 1. HELPER COMPONENTS (Must be defined FIRST)
// =============================================================================

const StepCard = ({ number, title, text }: { number: string, title: string, text: string }) => (
  <div className="flex gap-4 p-5 rounded-xl bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md dark:bg-gray-800 dark:border-gray-700">
    <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold text-lg dark:bg-blue-900/50 dark:text-blue-300">
      {number}
    </div>
    <div>
      <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">{title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{text}</p>
    </div>
  </div>
);

const NoteCard = ({ type = "info", title, children }: { type?: "info" | "warning" | "success", title: string, children: React.ReactNode }) => {
  const colors = {
    info: "bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
    warning: "bg-orange-50 border-orange-100 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300",
    success: "bg-green-50 border-green-100 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
  };
  
  return (
    <div className={cn("p-4 rounded-lg border my-4", colors[type])}>
      <h4 className="font-bold text-sm flex items-center gap-2 mb-1">
        {type === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        {title}
      </h4>
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
};

const FeatureGrid = ({ items }: { items: { title: string, desc: string, icon: React.ElementType }[] }) => (
  <div className="grid gap-4 sm:grid-cols-2 mt-4">
    {items.map((item, idx) => (
      <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <item.icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
      </div>
    ))}
  </div>
);

// =============================================================================
// 2. DOCUMENTATION DATA
// =============================================================================

type DocSection = {
  id: string;
  title: string;
  icon: React.ElementType;
  path?: string;
  content: React.ReactNode;
};

// --- WEB DOCUMENTATION ---
const webSections: DocSection[] = [
  {
    id: "intro",
    title: "Introduction",
    icon: BookOpen,
    content: (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-900 p-8 text-white shadow-xl">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Hantikaab Platform</h1>
          <p className="text-blue-100 text-lg max-w-xl">
            The central nervous system of your business. A unified operating system ensuring transactional integrity across Sales, Inventory, and Finance.
          </p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            Welcome to Hantikaab. Unlike traditional tools that merely record data, Hantikaab enforces <strong>"Transactional Integrity"</strong>. This means every action you take—whether selling a product, paying a salary, or adjusting stock—simultaneously updates your financial ledgers, inventory counts, and customer profiles.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 my-8">
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-300 mb-3">
                <LayoutDashboard />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">The Hub</h3>
              <p className="text-sm text-gray-500 mt-1">The Dashboard acts as the central intelligence unit, aggregating real-time data.</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="h-10 w-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center text-green-600 dark:text-green-300 mb-3">
                <Settings />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">The Spokes</h3>
              <p className="text-sm text-gray-500 mt-1">Specialized modules (Sales, HR, Finance) feed accurate data back to the center.</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-300 mb-3">
                <ShieldCheck />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Integrity</h3>
              <p className="text-sm text-gray-500 mt-1">Double-entry accounting principles ensure your numbers always balance.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Command Center</h2>
          <p className="text-gray-500 mt-1">Your immediate business pulse.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-5 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-green-500" />
              <h4 className="font-bold text-gray-900 dark:text-white">Total Revenue</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This card displays the <strong>Gross Value</strong> of goods sold today. It includes sales made via Cash, Digital payments, and Credit. It reflects your sales performance, not just cash collection.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="text-blue-500" />
              <h4 className="font-bold text-gray-900 dark:text-white">Accounts (Holdings)</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Use the dropdown menu to toggle between accounts (Cash, Zaad, eDahab). This number represents the <strong>Real Liquid Cash</strong> available to you right now (All Time Income minus Expenses).
            </p>
          </div>
        </div>

        <NoteCard title="Understanding Net Profit" type="info">
          <p>Net Profit is calculated as <code>Total Sales Revenue - Total Expenses</code>. It reflects the true value generated by your business operations today, giving you a clearer picture than simple cash flow.</p>
        </NoteCard>
      </div>
    ),
  },
  {
    id: "pos",
    title: "Point of Sale",
    icon: ShoppingCart,
    path: "/sales/new",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Point of Sale (POS)</h2>
          <p className="text-gray-500 mt-1">The engine of your daily operations.</p>
        </div>

        <p className="text-gray-600 dark:text-gray-300">
          The POS module is designed for speed and accuracy, incorporating safeguards like negative stock prevention and automated currency checks.
        </p>

        <h3 className="text-lg font-semibold mt-6 mb-4">Workflow Guide</h3>
        <div className="space-y-4">
          <StepCard number="1" title="Select Currency" text="Choose the Invoice Currency (e.g., USD or SLSH). This locks the cart to ensure consistent pricing math and prevents exchange rate errors." />
          <StepCard number="2" title="Identify Customer" text="Search for an existing client or use 'Walk-in'. You can also create a new customer profile instantly from the search bar. The system checks phone numbers to prevent duplicates." />
          <StepCard number="3" title="Add Products" text="Search by name or SKU. If a product has variants (e.g., Size/Color), a modal will appear prompting you to make a selection." />
          <StepCard number="4" title="Process Payment" text="Record split payments (e.g., $50 Zaad + $20 Cash). If the total paid is less than the invoice amount, the system automatically records the difference as 'Customer Debt'." />
        </div>

        <NoteCard title="Automated Audit Trail" type="success">
          <p>Clicking "Save & Print" triggers multiple background actions: Stock is deducted, Income is logged to the ledger, Customer debt is updated, and a PDF invoice is generated.</p>
        </NoteCard>
      </div>
    ),
  },
  {
    id: "history",
    title: "Sales History",
    icon: History,
    path: "/sales?view=history",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice Management</h2>
          <p className="text-gray-500 mt-1">Your digital filing cabinet.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-bold mb-2 dark:text-white">Invoice Statuses</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"/> <strong>Paid:</strong> Full payment received.</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"/> <strong>Partial:</strong> Debt remains.</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"/> <strong>Unpaid:</strong> No payment received.</li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-500"/> <strong>Voided:</strong> Cancelled by Admin.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-2 dark:text-white">Key Actions</h4>
             <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-center gap-2"><Printer className="w-4 h-4" /> <strong>Reprint:</strong> Generate an identical copy of the original invoice.</li>
              <li className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> <strong>Return:</strong> Process refunds via the "New Return" modal to maintain ledger integrity.</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "products",
    title: "Inventory",
    icon: Package,
    path: "/products",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory Control</h2>
          <p className="text-gray-500 mt-1">Manage stock across multiple warehouses.</p>
        </div>

        <FeatureGrid items={[
          { title: "Product Definition", desc: "Set identity, categories, and multi-currency pricing.", icon: Package },
          { title: "Stock Adjustments", desc: "Write off damaged or expired goods. Creates a permanent record.", icon: AlertTriangle },
          { title: "Transfers", desc: "Move stock between warehouses. Validates source availability first.", icon: Truck },
          { title: "Low Stock Alerts", desc: "Automatic notifications when items hit reorder levels.", icon: Bell },
        ]} />
      </div>
    ),
  },
  {
    id: "finance",
    title: "Finance",
    icon: DollarSign,
    path: "/finance",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Management</h2>
          <p className="text-gray-500 mt-1">The "Truth Teller" of your business.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4 dark:text-white">The Ledger Logic</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            While Sales tracks revenue, Finance tracks liquid cash. Every penny entering or leaving is recorded here.
          </p>
          
          <div className="grid gap-6 md:grid-cols-2">
             <div>
               <h4 className="font-semibold text-green-600 mb-2">Incomes & Expenses</h4>
               <p className="text-sm text-gray-500 dark:text-gray-400">
                 Record manual incomes (e.g., capital injection) and operating expenses (rent, salaries, bills).
               </p>
             </div>
             <div>
               <h4 className="font-semibold text-blue-600 mb-2">Running Balances</h4>
               <p className="text-sm text-gray-500 dark:text-gray-400">
                 The "Payments" tab shows the exact holding balance of every account (Zaad, Cash). Calculated from "All-Time Income" minus "All-Time Expenses".
               </p>
             </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "purchases",
    title: "Purchasing",
    icon: Truck,
    path: "/purchases",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Supply Chain</h2>
          <p className="text-gray-500 mt-1">Manage suppliers and accounts payable.</p>
        </div>
        
        <div className="space-y-4">
          <StepCard number="PO" title="Purchase Orders" text="Create POs to order stock. Specify the destination warehouse and items." />
          <StepCard number="AP" title="Accounts Payable" text="If you pay 0 now, it's logged as a 'Pending Payable'. Stock is added immediately, but the debt is tracked." />
        </div>
      </div>
    ),
  },
  {
    id: "debts",
    title: "Debts (Caymis)",
    icon: CreditCard,
    path: "/debts",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Debt Management</h2>
          <p className="text-gray-500 mt-1">Track who owes you money.</p>
        </div>
        
        <ul className="list-disc pl-5 space-y-3 text-gray-600 dark:text-gray-300">
          <li><strong>Auto-Tracking:</strong> Sales marked "Partial" or "Unpaid" automatically create a record here.</li>
          <li><strong>Repayments:</strong> Use "Record Payment" to log cash received. This reduces the customer balance and updates your Income Ledger simultaneously.</li>
          <li><strong>Aging:</strong> See exactly how long a debt has been active to prioritize collections.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "hr",
    title: "HR & Staff",
    icon: Users,
    path: "/hr",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">HR Management</h2>
          <p className="text-gray-500 mt-1">Restricted to Admins & Managers.</p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
           <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
             <h4 className="font-bold dark:text-white">Employee Profiles</h4>
             <p className="text-sm text-gray-500 mt-1">Register staff, assign roles (Admin, Cashier, User), and set base salaries.</p>
           </div>
           <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
             <h4 className="font-bold dark:text-white">Payroll Processing</h4>
             <p className="text-sm text-gray-500 mt-1">Process monthly salaries. This creates an expense record and generates a printable Payment Voucher.</p>
           </div>
        </div>
      </div>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    path: "/settings",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">System Configuration</h2>
          <p className="text-gray-500 mt-1">Configure the DNA of your system.</p>
        </div>
        
        <div className="space-y-4">
           <StepCard number="1" title="Company Profile" text="Set Name, Phone, Address, and Logo. These details appear on every PDF." />
           <StepCard number="2" title="Business Logic" text="Configure operating Currencies and choose PDF Templates (Modern/Premium)." />
        </div>
      </div>
    ),
  },
];

// --- MOBILE DOCUMENTATION ---
const mobileSections: DocSection[] = [
  {
    id: "m-intro",
    title: "Mobile Overview",
    icon: Smartphone,
    content: (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white shadow-xl">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Hantikaab Mobile</h1>
          <p className="text-purple-100 text-lg max-w-xl">
            Power in your pocket. Designed for "On-the-Floor" operations, focusing on speed and essential tasks.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {["Real-Time Sync", "Offline Mode", "Bluetooth Print", "Secure Auth"].map((feat, i) => (
             <div key={i} className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center border border-gray-200 dark:border-gray-700 shadow-sm">
               <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{feat}</span>
             </div>
           ))}
        </div>
      </div>
    ),
  },
  {
    id: "m-dash",
    title: "Mobile Dashboard",
    icon: LayoutDashboard,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Streamlined Insights</h2>
        <p className="text-gray-600 dark:text-gray-300">
          The mobile dashboard is stripped down for clarity on small screens.
        </p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <strong>Today's Revenue:</strong> <span className="text-gray-500">Total sales value for the current day.</span>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <strong>Quick Actions:</strong> <span className="text-gray-500">One-tap access to "Start Sale," "Check Stock," and "Debts."</span>
            </div>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "m-pos",
    title: "Mobile POS",
    icon: CreditCard,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Touch-Optimized POS</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Sell from anywhere.
        </p>
        <div className="space-y-4">
          <StepCard number="1" title="Cart Building" text="Add products via tap or camera barcode scan. Large buttons for easy quantity adjustments." />
          <StepCard number="2" title="Dynamic Search" text="Instantly find products by name or SKU." />
          <StepCard number="3" title="Checkout" text="Simplified flow. Select Customer and Payment Method in seconds." />
          <StepCard number="4" title="Digital Receipts" text="Share PDF receipts directly via WhatsApp, Email, or other apps." />
        </div>
      </div>
    ),
  },
  {
    id: "m-inventory",
    title: "Inventory Tools",
    icon: Package,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Floor Management</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-2 dark:text-white">Stock Check</h4>
            <p className="text-sm text-gray-500">Verify physical stock against system records while walking the aisles.</p>
          </div>
          <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-2 dark:text-white">Quick Adjustments</h4>
            <p className="text-sm text-gray-500">Correct discrepancies instantly. Enter adjustment amount (-1) and reason.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "m-debt",
    title: "Debt Manager",
    icon: Users,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Collection Tool</h2>
        <p className="text-gray-600 dark:text-gray-300">
          A dedicated tool for agents visiting clients.
        </p>
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
          <h4 className="font-bold mb-2">Field Workflow</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Open "Debts" tab to see outstanding balances.</li>
            <li>Collect Cash or Mobile Money.</li>
            <li>Tap "Record Payment" to log it instantly.</li>
            <li>System updates "Cash on Hand" in real-time.</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "m-offline",
    title: "Offline Mode",
    icon: WifiOff,
    content: (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Offline Capability</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Designed for unstable internet environments.
        </p>
        <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> View cached data without internet.</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-green-500" /> Automatic sync when connectivity returns.</li>
          <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Critical actions (credit sales) require internet to prevent data conflicts.</li>
        </ul>
      </div>
    ),
  }
];


// =============================================================================
// 3. MAIN COMPONENT
// =============================================================================

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<"web" | "mobile">("web");
  const [activeSectionId, setActiveSectionId] = useState(webSections[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync sections based on tab
  const currentSections = activeTab === "web" ? webSections : mobileSections;
  
  // Find current content, default to first if not found (e.g. switching tabs)
  const activeContent = currentSections.find(s => s.id === activeSectionId) || currentSections[0];

  // Handle Tab Switch
  const handleTabSwitch = (tab: "web" | "mobile") => {
    setActiveTab(tab);
    // Reset to first section of new tab
    setActiveSectionId(tab === "web" ? webSections[0].id : mobileSections[0].id);
  };

  // Theme Toggle Effect
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-gray-900 dark:text-gray-100 font-sans">
      
      {/* --- Header --- */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30">
                H
              </div>
              <span className="text-xl font-bold tracking-tight hidden sm:block">Hantikaab Docs</span>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="flex items-center rounded-full bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => handleTabSwitch("web")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "web" 
                  ? "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-white" 
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
              )}
            >
              Web Platform
            </button>
            <button
              onClick={() => handleTabSwitch("mobile")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "mobile" 
                  ? "bg-white text-purple-600 shadow-sm dark:bg-gray-700 dark:text-white" 
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
              )}
            >
              Mobile App
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsDarkMode(!isDarkMode)}
               className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
             >
               {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
             </button>
          </div>
        </div>
      </header>

      {/* --- Main Layout --- */}
      <div className="mx-auto w-full max-w-7xl flex-1 flex">
        
        {/* --- Sidebar (Desktop) --- */}
        <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:block h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto no-scrollbar">
          <div className="p-6">
            <h5 className="mb-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {activeTab === "web" ? "Modules" : "Screens"}
            </h5>
            <nav className="space-y-1">
              {currentSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    activeSectionId === section.id
                      ? activeTab === "web" 
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  <section.icon className={cn("h-4 w-4", activeSectionId === section.id ? "opacity-100" : "opacity-70")} />
                  {section.title}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* --- Mobile Menu Drawer --- */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 z-50 h-full w-3/4 max-w-xs bg-white p-6 shadow-2xl dark:bg-gray-900 md:hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Menu</span>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                    <X className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
                <nav className="space-y-2">
                  {currentSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => { setActiveSectionId(section.id); setIsMobileMenuOpen(false); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        activeSectionId === section.id
                          ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                      )}
                    >
                      <section.icon className="h-5 w-5" />
                      {section.title}
                    </button>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* --- Content Area --- */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6 md:p-10 lg:p-16 scroll-smooth">
            <div className="max-w-3xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSectionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {/* Breadcrumbs */}
                  <div className="mb-8 flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <span>Docs</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{activeTab === 'web' ? 'Web Platform' : 'Mobile App'}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className={cn(activeTab === 'web' ? "text-blue-600" : "text-purple-600")}>
                      {activeContent.title}
                    </span>
                  </div>

                  {/* Dynamic Content */}
                  {activeContent.content}
                  
                </motion.div>
              </AnimatePresence>
              
              {/* Footer spacer */}
              <div className="h-20" />
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}