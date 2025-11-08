"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image"; // ✅ For logo
import { usePathname, useRouter } from "next/navigation";
import {
  BiChevronRight,
  BiLogOut,
  BiSolidDashboard,
  BiShoppingBag,
  BiPackage,
  BiCart,
  BiUser,
  BiUserVoice,
  BiLineChart,
  BiBarChartSquare,
  BiGroup,
  BiChat,
  BiCog,
  BiHelpCircle,
  BiWallet,
} from "react-icons/bi";
import { X } from "lucide-react";
import { auth } from "@/lib/firebaseConfig";
import { signOut } from "firebase/auth";

const menuItems = [
  { name: "Dashboard", icon: BiSolidDashboard, href: "/dashboard", targetId: "dashboard" },
  { name: "Sales Management", icon: BiShoppingBag, href: "/sales", targetId: "sales" },
  { name: "Product & Inventory", icon: BiPackage, href: "/products", targetId: "product" },
  { name: "Purchases", icon: BiCart, href: "/purchases", targetId: "purchases" },
  { name: "Customers", icon: BiUser, href: "/customers", targetId: "customers" },
  { name: "Suppliers", icon: BiUserVoice, href: "/suppliers", targetId: "suppliers" },
  { name: "Income & Finance", icon: BiLineChart, href: "/finance", targetId: "finance" },
  { name: "Reports & Analytics", icon: BiBarChartSquare, href: "/reports", targetId: "reports" },
  { name: "HR & Staff", icon: BiGroup, href: "/hr", targetId: "hr" },
  { name: "Communication", icon: BiChat, href: "/communication", targetId: "communication" },
  { name: "System & Settings", icon: BiCog, href: "/settings", targetId: "settings" },
  { name: "Support & Profile", icon: BiHelpCircle, href: "/support", targetId: "support" },
  { name: "Debts", icon: BiWallet, href: "/debts", targetId: "debts" },
];

interface SidebarProps {
  isClosed: boolean;
  toggleSidebar: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isClosed,
  toggleSidebar,
  isMobileOpen,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => setShowLogoutConfirm(true);
  const cancelLogout = () => setShowLogoutConfirm(false);
  const confirmLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
    setShowLogoutConfirm(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        ></div>
      )}

      <nav
        className={`
          sidebar fixed top-0 left-0 h-full z-50 
          bg-white dark:bg-gray-800 
          text-gray-900 dark:text-white 
          transition-all duration-300 ease-in-out 
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 
          ${isClosed ? "w-[72px]" : "w-[250px]"}
        `}
      >
        {/* --- HEADER WITH LOGO --- */}
        <header className="relative py-[10px] px-[10px] border-b border-gray-200 dark:border-gray-700">
          <div className="image-text flex items-center">
            {/* ✅ Logo image with white bg and rounded corners */}
            <span className="image flex items-center justify-center min-w-[50px] px-1">
              <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center shadow-sm transition-colors duration-300">
                <Image
                  src="/logo1.png"
                  alt="Hantikaab Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
            </span>

            <div
              className={`text logo-text flex flex-col transition-all duration-300 ease-in-out ${
                isClosed ? "opacity-0 scale-0 w-0" : "opacity-100 scale-100 w-auto"
              }`}
            >
              <span className="name text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                HantiKaab
              </span>
              <span className="profession text-xs font-normal text-gray-600 dark:text-gray-400 block -mt-0.5 whitespace-nowrap">
                BizPOS System
              </span>
            </div>
          </div>

          {/* Desktop toggle */}
          <BiChevronRight
            className={`
              toggle absolute top-1/2 -right-[25px] transform -translate-y-1/2 
              h-[25px] w-[25px] bg-blue-500 text-white rounded-full 
              cursor-pointer transition-transform duration-300 ease-in-out
              hidden md:block
              ${isClosed ? "rotate-0" : "rotate-180"}
            `}
            onClick={toggleSidebar}
          />

          {/* Mobile close button */}
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        {/* --- Menu --- */}
        <div className="menu-bar h-[calc(100%-70px)] flex flex-col justify-between overflow-y-hidden pt-2.5">
          <div className="flex-grow flex flex-col min-h-0">
            <div className="menu flex-grow overflow-y-auto mt-5 px-[10px]">
              <ul className="menu-links p-0">
                {menuItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <li key={item.name} title={isClosed ? item.name : ""}>
                      <Link
                        href={item.href}
                        className={`h-[50px] flex items-center rounded-md transition-all duration-300 ease-in-out group relative overflow-hidden hover:bg-blue-500 ${
                          isActive ? "bg-blue-500 text-white" : ""
                        }`}
                      >
                        <div className="flex items-center transition-transform duration-300 ease-in-out group-hover:translate-x-2">
                          <item.icon
                            className={`icon min-w-[50px] text-lg flex items-center justify-center ${
                              isActive
                                ? "text-white"
                                : "text-gray-900 dark:text-gray-300"
                            }`}
                          />
                          <span
                            className={`text text-base font-medium whitespace-nowrap ml-1 transition-colors duration-300 ease-in-out ${
                              isActive
                                ? "text-white"
                                : "text-gray-900 dark:text-gray-300"
                            } ${isClosed ? "opacity-0 w-0" : "opacity-100"}`}
                          >
                            {item.name}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="bottom-content pt-2.5 border-t border-gray-200 dark:border-gray-700 px-[10px]">
            <ul className="p-0">
              <li className="logout-link list-none mb-1.25" title={isClosed ? "Logout" : ""}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleLogout();
                  }}
                  className="h-[50px] flex items-center w-full rounded-md bg-red-500 hover:bg-red-600 transition-all duration-300 ease-in-out"
                >
                  <BiLogOut className="icon min-w-[50px] text-lg text-white flex items-center justify-center" />
                  <span
                    className={`text text-base font-medium whitespace-nowrap text-white transition-opacity duration-300 ease-in-out ${
                      isClosed ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    Logout
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* --- Logout modal moved outside sidebar for full-screen --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 transform transition-all duration-300 scale-100">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Logout
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to log out?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
