"use client";

import React from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

interface NavLink {
  id: string; // Used to identify the view
  label: string;
  href: string; // Could be simple href or include query params like '?view=...'
}

interface SubNavbarProps {
  links: NavLink[];
}

const SubNavbar: React.FC<SubNavbarProps> = ({ links }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentView = searchParams.get('view') || links[0]?.id; // Default to first link's id

  return (
    <nav className="sub-navbar flex items-center p-2.5 bg-sidebar dark:bg-sidebar-dark rounded-lg mb-5 flex-wrap gap-2.5 shadow-sm dark:shadow-md dark:shadow-gray-800">
      {links.map((link) => {
        const isActive = currentView === link.id;
        // Construct the full href including current pathname if needed,
        // or just use the href provided if it already contains the path and query.
        const href = link.href.startsWith('/') ? link.href : `${pathname}${link.href}`;

        return (
          <Link
            key={link.id}
            href={href} // Use the provided href which might include query params
            // Alternatively, use onClick to update state in the parent page.tsx
            // onClick={(e) => { e.preventDefault(); onLinkClick(link.id); }}
            className={`subnav-link text-decoration-none text-sm font-medium px-4 py-2 rounded-md transition-all duration-200 ease-in-out relative overflow-hidden ${
              isActive
                ? 'bg-primary dark:bg-primary-dark text-white dark:text-text-dark shadow-inner' // Active styles
                : 'text-text dark:text-text-dark hover:bg-primary-light dark:hover:bg-primary-dark hover:-translate-y-0.5' // Default and hover styles
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default SubNavbar;
