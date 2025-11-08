// File: app/(main)/Header.tsx (A NEW file you must create)
"use client";

import React from "react";
import { Menu } from "lucide-react"; // Using lucide like your other files
import Link from "next/link";

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  return (
    <header
      className="
        sticky top-0 z-40 
        flex md:hidden // <-- IMPORTANT: Only shows on mobile (hidden on md:)
        items-center justify-between 
        h-16 px-4 
        bg-white dark:bg-gray-800 
        border-b border-gray-200 dark:border-gray-700
      "
    >
      {/* Hamburger Icon Button */}
      <button
        onClick={onMenuToggle}
        className="text-gray-600 dark:text-gray-300"
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Your App Name */}
      <Link href="/dashboard" className="text-lg font-bold text-blue-500">
        Hantikaab
      </Link>

      {/* A placeholder to keep the title centered */}
      <div className="w-6"></div>
    </header>
  );
};

export default Header;