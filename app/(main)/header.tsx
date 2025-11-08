"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => {
    setOpen(!open);
    onMenuToggle();
  };

  return (
    <header
      className="
        sticky top-0 z-40 
        flex md:hidden 
        items-center justify-between 
        h-16 px-4 
        bg-white dark:bg-gray-900 
        border-b border-gray-200 dark:border-gray-800
      "
    >
      {/* --- Animated Hamburger Icon --- */}
      <button
        onClick={toggleMenu}
        aria-label="Toggle menu"
        className="relative flex flex-col justify-center w-8 h-8 focus:outline-none group"
      >
        <span
          className={`h-0.5 w-6 rounded bg-gray-700 dark:bg-gray-200 transform transition duration-300 ease-in-out ${
            open ? "rotate-45 translate-y-1.5" : ""
          }`}
        />
        <span
          className={`h-0.5 w-6 rounded bg-gray-700 dark:bg-gray-200 my-1 transition-all duration-300 ease-in-out ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`h-0.5 w-6 rounded bg-gray-700 dark:bg-gray-200 transform transition duration-300 ease-in-out ${
            open ? "-rotate-45 -translate-y-1.5" : ""
          }`}
        />
      </button>

      {/* --- Logo (from /public/mobile.png) --- */}
      <Link href="/dashboard" className="flex items-center justify-center">
        <Image
          src="/mobile.png"
          alt="Hantikaab Logo"
          width={120}
          height={40}
          priority
          className="object-contain"
        />
      </Link>

      {/* Placeholder to keep logo centered */}
      <div className="w-8"></div>
    </header>
  );
};

export default Header;
