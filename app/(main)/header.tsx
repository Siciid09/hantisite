"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface HeaderProps {
  /** * The current state of the sidebar (true = open, false = closed).
   * Passed from parent to prevent the icon from getting stuck.
   */
  isOpen: boolean;
  /** Function to toggle the state in the parent */
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ isOpen, onMenuToggle }) => {
  return (
    <header
      className="
        sticky top-0 z-40 
        flex md:hidden 
        items-center justify-between 
        h-20 px-4 sm:px-6
        bg-white/95 dark:bg-gray-900/95 
        backdrop-blur-md
        border-b border-gray-200 dark:border-gray-800
        transition-all duration-300
      "
    >
      {/* ==============================
          1. LEFT: Modern Hamburger 
         ============================== */}
      <button
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="group flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none transition-colors"
      >
        <div className="flex flex-col items-end justify-center gap-1.5 w-6 h-6 overflow-hidden">
          {/* Top Line */}
          <span
            className={`
              h-0.5 rounded-full bg-gray-800 dark:bg-gray-200 
              transition-all duration-300 ease-out origin-center
              ${isOpen ? "w-6 translate-y-2 rotate-45" : "w-6 translate-y-0 rotate-0"}
            `}
          />
          
          {/* Middle Line (Shorter for modern look) */}
          <span
            className={`
              h-0.5 rounded-full bg-gray-800 dark:bg-gray-200 
              transition-all duration-300 ease-out
              ${isOpen ? "w-0 opacity-0 translate-x-4" : "w-4 opacity-100 translate-x-0"}
            `}
          />

          {/* Bottom Line */}
          <span
            className={`
              h-0.5 rounded-full bg-gray-800 dark:bg-gray-200 
              transition-all duration-300 ease-out origin-center
              ${isOpen ? "w-6 -translate-y-2 -rotate-45" : "w-6 translate-y-0 rotate-0"}
            `}
          />
        </div>
      </button>

      {/* ==============================
          2. CENTER: Logo 
         ============================== */}
      <Link 
        href="/dashboard" 
        className="flex-shrink-0 transform transition-transform active:scale-95"
      >
        <Image
          src="/mobile.png"
          alt="Hantikaab Logo"
          width={130}
          height={45}
          priority
          className="object-contain"
        />
      </Link>

      {/* ==============================
          3. RIGHT: Action Buttons 
         ============================== */}
      <div className="flex items-center gap-3">
        {/* Tutorial */}
        <Link 
          href="/tutorial" 
          aria-label="Watch Tutorial"
          className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
          </svg>
        </Link>

        {/* Documentation */}
        <Link 
          href="/documentation" 
          aria-label="Documentation"
          className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </Link>

        {/* Download App */}
        <Link 
          href="/download" 
          aria-label="Download App"
          className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </Link>
      </div>
    </header>
  );
};

export default Header;