"use client";

import React from 'react';
import SubNavbar from '../../components/layout/SubNavbar';

const communicationNavLinks = [
  { id: 'messages', label: 'Messages / Chat', href: '/communication?view=messages' },
  { id: 'notifications', label: 'Notifications', href: '/communication?view=notifications' },
  { id: 'announcements', label: 'Announcements', href: '/communication?view=announcements' },
];

export default function CommunicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNavbar links={communicationNavLinks} />
      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}
