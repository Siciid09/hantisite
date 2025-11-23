"use client";

import React, { useState, useEffect } from "react";
import { 
  Moon, Sun, Menu, ChevronRight, 
  LayoutDashboard, ShoppingCart, Package, 
  Wallet, Users, Settings, Smartphone, 
  Wifi, FileText, AlertTriangle, 
  CheckCircle2, HelpCircle, CornerDownRight,
  Printer
} from "lucide-react";

// --- COMPONENTS ---

// 1. Step-by-Step Instruction Block
const StepBlock = ({ number, title, children }: any) => (
  <div className="flex gap-4 mb-6">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm border border-blue-200 dark:border-blue-800">
      {number}
    </div>
    <div className="pt-1">
      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-2">{title}</h4>
      <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  </div>
);

// 2. Info/Warning Callout
const Callout = ({ type = "info", title, children }: any) => {
  const styles = {
    info: "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200",
    danger: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
  };

  return (
    <div className={`p-4 rounded-lg border text-sm my-4 flex gap-3 ${styles[type as keyof typeof styles]}`}>
      <div className="shrink-0 mt-0.5">
        {type === 'warning' ? <AlertTriangle size={18} /> : type === 'danger' ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
      </div>
      <div>
        <strong className="block mb-1 font-semibold">{title}</strong>
        <div className="opacity-90 leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

// 3. Navigation Link
const NavItem = ({ active, onClick, label, indent = false }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-200
      ${indent ? "pl-8 text-xs" : "font-medium"}
      ${active 
        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-semibold" 
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}
    `}
  >
    {label}
  </button>
);

// --- MAIN PAGE ---

export default function HantikaabTutorial() {
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to Light Mode
  const [activeSection, setActiveSection] = useState("intro");
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Force toggle logic
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      // On mobile, close sidebar after click
      if (window.innerWidth < 768) setSidebarOpen(false);
    }
  };

  return (
    // This outer div controls the theme manually
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors duration-300">
        
        {/* TOP HEADER */}
        <header className="fixed top-0 w-full h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-50 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 md:hidden">
               <Menu size={20} />
             </button>
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">H</div>
               <span className="font-bold text-lg hidden sm:block">Hantikaab<span className="text-slate-400 font-normal">.Training</span></span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-400 hidden sm:block">v2.4 User Guide</span>
            <button 
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium transition-all"
            >
              {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-blue-600" />}
              <span className="text-xs font-bold uppercase tracking-wider">{isDarkMode ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>

        <div className="pt-16 flex relative">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className={`
            fixed md:sticky top-16 h-[calc(100vh-4rem)] w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-y-auto
            transition-transform duration-300 z-40 pb-10
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:hidden"}
          `}>
            <div className="p-4 space-y-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-4">Getting Started</div>
              <NavItem active={activeSection === "intro"} onClick={() => scrollTo("intro")} label="System Overview" />
              <NavItem active={activeSection === "dashboard"} onClick={() => scrollTo("dashboard")} label="Reading the Dashboard" />
              
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Core Operations</div>
              <NavItem active={activeSection === "sales"} onClick={() => scrollTo("sales")} label="Processing a Sale (POS)" />
              <NavItem active={activeSection === "returns"} onClick={() => scrollTo("returns")} label="Handling Returns" />
              <NavItem active={activeSection === "inventory"} onClick={() => scrollTo("inventory")} label="Inventory & Stock" />
              <NavItem active={activeSection === "finance"} onClick={() => scrollTo("finance")} label="Finance & Expenses" />
              
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 mt-6">Mobile App</div>
              <NavItem active={activeSection === "mobile-pos"} onClick={() => scrollTo("mobile-pos")} label="Mobile POS Tutorial" />
              <NavItem active={activeSection === "mobile-sync"} onClick={() => scrollTo("mobile-sync")} label="Sync & Offline Mode" />
            </div>
          </aside>

          {/* MAIN TUTORIAL CONTENT */}
          <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 min-h-screen">
            
            {/* 1. INTRODUCTION */}
            <section id="intro" className="mb-20 pt-4">
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-6">System Overview</h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                This is the official operating manual for the Hantikaab Platform. This guide is written for <strong>Store Managers, Cashiers, and Admins</strong>. It focuses on the specific workflows you will use daily.
              </p>
              
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-xl">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <CheckCircle2 size={18}/> Core Concept: Transactional Integrity
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Hantikaab is an integrated system. When you make a sale, three things happen instantly and automatically:
                </p>
                <ul className="list-disc pl-5 mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <li><strong>Inventory:</strong> The item count decreases.</li>
                  <li><strong>Finance:</strong> The cash balance increases (or Debt increases).</li>
                  <li><strong>Customer:</strong> The customer's purchase history is updated.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 2. DASHBOARD */}
            <section id="dashboard" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <LayoutDashboard className="text-blue-600" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">How to Read the Dashboard</h2>
              </div>
              
              <p className="mb-8 text-slate-600 dark:text-slate-400">
                The Dashboard is not just pretty charts; it is your daily status report. It answers two different questions depending on where you look.
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                   <h4 className="font-bold text-lg mb-4 text-emerald-600 dark:text-emerald-400">1. "Total Revenue" Card</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                     <strong>What it tells you:</strong> "How much business value did we generate today?"
                   </p>
                   <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-xs font-mono mb-2">
                     Formula: Cash Sales + Credit Sales (Zaad/eDahab) + Unpaid Invoices
                   </div>
                   <p className="text-xs text-slate-500">
                     *Note: Even if a customer took an item on debt, it counts as Revenue here because the item left the store.
                   </p>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                   <h4 className="font-bold text-lg mb-4 text-blue-600 dark:text-blue-400">2. "Accounts" Card</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                     <strong>What it tells you:</strong> "How much liquid money do I actually have?"
                   </p>
                   <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-xs font-mono mb-2">
                     Action: Use the Dropdown to switch between 'Cash', 'Zaad', 'Bank'.
                   </div>
                   <p className="text-xs text-slate-500">
                     *Note: This number is calculated from the beginning of time. It should match the balance on your physical phone or cash drawer.
                   </p>
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 3. SALES POS */}
            <section id="sales" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <ShoppingCart className="text-purple-600" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Step-by-Step: Creating a Sale</h2>
              </div>

              <Callout title="Prerequisite" type="info">
                Ensure you have opened the correct <strong>Register</strong> (Shift) before starting sales. Go to <code>/sales/new</code>.
              </Callout>

              <div className="space-y-2 mt-8">
                <StepBlock number="1" title="Select Currency First">
                  <p>Before scanning items, look at the top-left toggle. Select <strong>USD</strong> or <strong>SLSH</strong>.</p>
                  <p className="text-xs text-slate-500">Why? Once you add an item, the currency locks to prevent mathematical errors with exchange rates.</p>
                </StepBlock>

                <StepBlock number="2" title="Attach a Customer">
                  <p>Click the search bar labeled "Select Customer".</p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 mt-2 space-y-1">
                    <li><strong>Option A:</strong> Type a name to find an existing client.</li>
                    <li><strong>Option B:</strong> Click "Walk-in Customer" for quick retail sales.</li>
                    <li><strong>Option C:</strong> Type a new name and click "Create New" to register them instantly.</li>
                  </ul>
                </StepBlock>

                <StepBlock number="3" title="Add Products & Variants">
                  <p>Scan the barcode or type the product name. If the product has variants (like Size: XL, Color: Red), a pop-up will appear.</p>
                  <p className="text-xs font-bold text-red-500 mt-1">
                    Wait! If the system beeps and shows "Stock Error", it means that specific warehouse is empty. You cannot sell what the system thinks you don't have.
                  </p>
                </StepBlock>

                <StepBlock number="4" title="Process Payment (Split Logic)">
                  <p>This is the most critical step. Enter how the customer is paying.</p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded mt-2">
                    <p className="font-semibold text-sm mb-2">Example: Total Bill is $100</p>
                    <ul className="text-sm space-y-2">
                      <li>• <strong>Scenario A (Full Cash):</strong> Enter $100 in Cash field.</li>
                      <li>• <strong>Scenario B (Split):</strong> Enter $50 in Cash, $50 in Zaad.</li>
                      <li>• <strong>Scenario C (Debt):</strong> Enter $40 in Cash. Leave the rest. The system calculates $60 remaining and marks it as <strong>DEBT</strong> automatically.</li>
                    </ul>
                  </div>
                </StepBlock>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 4. RETURNS */}
            <section id="returns" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <Printer className="text-red-500" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Handling Returns</h2>
              </div>

              <Callout title="CRITICAL RULE" type="danger">
                <strong>NEVER DELETE A SALE.</strong> Deleting a sale destroys the audit trail. Always use the Return function.
              </Callout>

              <h4 className="font-bold text-lg mt-8 mb-4">The Return Workflow</h4>
              <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-8">
                <li className="mb-10 ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white dark:ring-slate-950 dark:bg-blue-900">
                    <CornerDownRight size={14} />
                  </span>
                  <h3 className="font-medium text-slate-900 dark:text-white">1. Locate the Invoice</h3>
                  <p className="text-sm text-slate-500">Go to <code>Sales &gt; History</code>. Search for the Invoice ID (e.g., INV-0023).</p>
                </li>
                <li className="mb-10 ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white dark:ring-slate-950 dark:bg-blue-900">
                    <CornerDownRight size={14} />
                  </span>
                  <h3 className="font-medium text-slate-900 dark:text-white">2. Open Return Modal</h3>
                  <p className="text-sm text-slate-500">Click the eye icon to view details, then click "Return Items". Select the specific items being returned.</p>
                </li>
                <li className="ml-6">
                  <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white dark:ring-slate-950 dark:bg-blue-900">
                    <CornerDownRight size={14} />
                  </span>
                  <h3 className="font-medium text-slate-900 dark:text-white">3. System Processing</h3>
                  <p className="text-sm text-slate-500">Once confirmed, the system creates a <strong>Negative Expense</strong> (money leaving the drawer) and adds the item back to the <strong>Inventory Count</strong>.</p>
                </li>
              </ol>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 5. INVENTORY */}
            <section id="inventory" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <Package className="text-amber-500" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory Management</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl">
                   <h4 className="font-bold text-slate-900 dark:text-white mb-2">Stock Transfer</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Use this when moving items from Main Warehouse to a Branch.</p>
                   <ul className="text-xs space-y-2 text-slate-500">
                     <li>1. Go to <code>Products &gt; Transfers</code></li>
                     <li>2. Select Source (Main) and Destination (Shop A).</li>
                     <li>3. Enter quantity. System will deduct from Source and add to Destination.</li>
                   </ul>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl">
                   <h4 className="font-bold text-slate-900 dark:text-white mb-2">Stock Adjustment (Write-off)</h4>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Use this for damaged, expired, or stolen goods.</p>
                   <ul className="text-xs space-y-2 text-slate-500">
                     <li>1. Go to <code>Products &gt; Adjustments</code></li>
                     <li>2. Select the item and choose "Subtraction".</li>
                     <li>3. Reason is Mandatory (e.g., "Expired"). This is crucial for the P&L report.</li>
                   </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 6. FINANCE */}
            <section id="finance" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <Wallet className="text-green-600" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Finance & Expenses</h2>
              </div>
              
              <StepBlock number="!" title="Recording an Expense">
                <p>Did you pay for lunch, electricity, or cleaning? You must record it.</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Navigate to <code>Finance &gt; Expenses &gt; New</code>. Select the category.
                  <br/>
                  <strong>Important:</strong> Select the "Source Account". If you paid Cash, select Cash. If you paid via Zaad, select Zaad. This ensures your balances match at the end of the day.
                </p>
              </StepBlock>

              <StepBlock number="?" title="How is Net Profit Calculated?">
                <div className="p-4 bg-slate-900 text-white rounded-lg font-mono text-sm shadow-lg">
                  (Total Sales Revenue)<br/>
                  - (Cost of Goods Sold)<br/>
                  - (Operating Expenses)<br/>
                  -----------------------<br/>
                  = NET PROFIT
                </div>
              </StepBlock>
            </section>

            <hr className="border-slate-200 dark:border-slate-800 mb-20" />

            {/* 7. MOBILE APP */}
            <section id="mobile-pos" className="mb-20 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <Smartphone className="text-purple-600" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Mobile POS Tutorial</h2>
              </div>
              
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                The mobile app is designed for speed. Use it when walking the floor or when the electricity is out.
              </p>

              <div className="border-l-4 border-purple-500 pl-6 py-2 mb-8 bg-purple-50 dark:bg-purple-900/10">
                <h4 className="font-bold text-purple-700 dark:text-purple-300">How to Share a Receipt</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  After finishing a sale on mobile, you will see a "Success" screen. Tap the <strong>Share Icon</strong>. 
                  Select WhatsApp to send the PDF invoice directly to the customer's phone number. No printing required.
                </p>
              </div>
            </section>

            <section id="mobile-sync" className="mb-32 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <Wifi className="text-slate-400" size={28} />
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Sync & Offline Mode</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <Callout title="What works Offline?" type="info">
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    <li>Viewing Product Prices</li>
                    <li>Searching Inventory</li>
                    <li>Adding items to Cart</li>
                  </ul>
                </Callout>
                
                <Callout title="What needs Internet?" type="warning">
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    <li><strong>Finalizing a Credit Sale:</strong> To prevent debt duplication.</li>
                    <li><strong>Syncing Stock Counts:</strong> To update the main server.</li>
                  </ul>
                </Callout>
              </div>
            </section>

          </main>
        </div>
        
        {/* FOOTER */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-12 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; 2025 Hantikaab Training Manual. <br className="md:hidden"/> Created for Internal Staff Use Only.
          </p>
        </footer>

      </div>
    </div>
  );
}