"use client";

import React from 'react';
import SubNavbar from '../../components/layout/SubNavbar';

const hrNavLinks = [
  { id: 'employees', label: 'Employees', href: '/hr?view=employees' },
  { id: 'attendance', label: 'Attendance', href: '/hr?view=attendance' },
  { id: 'payroll', label: 'Payroll / Salary', href: '/hr?view=payroll' },
  // Add other links: 'roles', 'logs'
];

export default function HRLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNavbar links={hrNavLinks} />
      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}
