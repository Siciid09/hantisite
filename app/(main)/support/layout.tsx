"use client";

import React from 'react';
import SubNavbar from '../../components/layout/SubNavbar';

const supportNavLinks = [
  { id: 'help', label: 'Help / Support', href: '/support?view=help' },
  // { id: 'docs', label: 'Documentation', href: '/support?view=docs' },
  { id: 'feedback', label: 'Feedback', href: '/support?view=feedback' },
  { id: 'profile', label: 'Profile', href: '/support?view=profile' },
];

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNavbar links={supportNavLinks} />
      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}
