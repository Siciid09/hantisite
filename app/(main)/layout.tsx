"use client"; // CRITICAL: This layout manages state and renders client components

import React, { useState } from 'react';
import Sidebar from '@/app/components/layout/Sidebar'; // Correct path assumed

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State for sidebar lives entirely within this Client Component
  const [isSidebarClosed, setIsSidebarClosed] = useState(true);

  // Function to toggle state also lives here
  const toggleSidebar = () => {
    setIsSidebarClosed(!isSidebarClosed);
  };

  return (
    // Use `div` or fragments, but ensure styles allow Sidebar and main to coexist
    // The body tag is already in the RootLayout
    <div className="flex min-h-screen bg-body dark:bg-body-dark">
      {/* Sidebar is rendered here, passing state and the toggle function */}
      <Sidebar isClosed={isSidebarClosed} toggleSidebar={toggleSidebar} />

      {/* Main content area adjusts margin based on sidebar state */}
      <main
        className={`flex-grow transition-all duration-500 ease-in-out ${
          isSidebarClosed ? 'ml-[88px]' : 'ml-[250px]'
        } w-full`} // w-full might not be strictly needed if flex-grow works
      >
        <div className="p-4 md:p-7 lg:p-10">
           {children} {/* Renders the actual page content */}
        </div>
      </main>
    </div>
  );
}
