"use client";

import React from 'react';
import SubNavbar from '../../components/layout/SubNavbar';

const supplierNavLinks = [
  { id: 'all', label: 'All Suppliers', href: '/suppliers?view=all' },
  { id: 'payments', label: 'Supplier Payments / Debts', href: '/suppliers?view=payments' },
];

export default function SuppliersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubNavbar links={supplierNavLinks} />
      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}
