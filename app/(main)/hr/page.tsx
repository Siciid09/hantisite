// File: app/(main)/hr/page.tsx
// Description: Main HR & Staff page (MODIFIED)
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import { jsPDF } from "jspdf"; // For PDF generation
import {
  Users, UserPlus, DollarSign,
  Loader2, X, ChevronLeft, ChevronRight,
  Trash2, Edit, AlertTriangle, Briefcase,
  Printer, CreditCard, Calendar,
} from "lucide-react";

// -----------------------------------------------------------------------------
// 💰 API Fetcher
// -----------------------------------------------------------------------------
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function HRPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HRPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// 📝 Main HR Page Component (MODIFIED)
// -----------------------------------------------------------------------------

// --- Updated Nav Links ---
const hrNavLinks = [
  { id: "employees", label: "Employee List", icon: Users },
  { id: "payroll", label: "Payroll & Salaries", icon: DollarSign },
];

function HRPage() {
  const { user, loading: authLoading, subscription } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null); // For Edit Modal

  // --- State ---
  const view = searchParams.get("view") || "employees";
  const page = parseInt(searchParams.get("page") || "1");
  const userRole = (user as any)?.role; // Get current user's role

  // --- SWR Data Fetching ---
  const apiUrl = `/api/hr?view=${view}&page=${page}`;
  
  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
  } = useSWR(!authLoading && user ? apiUrl : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  // --- Handlers ---
  const handleTabChange = (newView: string) => {
    router.push(`/hr?view=${newView}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/hr?view=${view}&page=${newPage}`);
  };

  const handleOpenAddModal = () => {
    // Subscription check (simplified)
    const userCount = apiData?.data?.length || 0; // This is not accurate, but for demo
    const canAdd = (subscription?.planId === 'pro' && userCount < 10) || 
                   (subscription?.planId === 'unlimited') || 
                   (subscription?.planId === 'lifetime') ||
                   (userCount < 3); // Default
                   
    if (canAdd) {
      setIsAddModalOpen(true);
    } else {
      // Use a custom modal instead of alert
      console.error("User Limit Reached. Please upgrade your plan.");
      // You would set a state here to show a "limit reached" modal
      router.push("/subscription");
    }
  };

  // --- Open Edit Modal ---
  const handleOpenEditModal = (member: any) => {
    setEditingMember(member);
    setIsEditModalOpen(true);
  };
  
  const handleActionSuccess = () => {
    mutate(apiUrl); // Re-fetch data for the current view
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setEditingMember(null);
  };
  
  // Render loading state
  if (authLoading || !user) {
    return <LoadingSpinner />;
  }

  // Permission Check (from teamusers.dart)
  if (userRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Only administrators can manage this page.
        </p>
      </div>
    );
  }

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
      {/* --- Header --- */}
      <header className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold">HR & Staff</h1>
        {view === 'employees' && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </button>
        )}
      </header>

      {/* --- 📑 Tab Navigation (Updated) --- */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
        {hrNavLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => handleTabChange(link.id)}
            className={`flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
              ${
                view === link.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </button>
        ))}
      </div>

      {/* --- 🚦 Content Switcher (Updated) --- */}
      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <>
            {view === 'employees' && (
              <EmployeeList 
                data={apiData} 
                onPageChange={handlePageChange}
                onEdit={handleOpenEditModal} // Pass handler
                userRole={userRole} // Pass role
              />
            )}
            {view === 'payroll' && (
              <PayrollSalaries 
                data={apiData} 
                onPageChange={handlePageChange} 
                onSuccess={handleActionSuccess}
              />
            )}
          </>
        )}
      </div>
      
      {/* --- Modals --- */}
      {isAddModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleActionSuccess}
        />
      )}
      
      {isEditModalOpen && editingMember && (
        <EditEmployeeModal
          member={editingMember}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingMember(null);
          }}
          onSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Tab-Specific Components
// -----------------------------------------------------------------------------

// 1. Employee List (MODIFIED)
const EmployeeList = ({ data, onPageChange, onEdit, userRole }: { 
  data: any, 
  onPageChange: (p: number) => void,
  onEdit: (member: any) => void,
  userRole: string 
}) => {
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const handleDelete = async (id: string, name: string) => {
    // Custom confirm modal should be used here, but window.confirm for simplicity
    if (!window.confirm(`Are you sure you want to remove ${name}? This will delete their account permanently.`)) return;
    
    setIsDeleting(id);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/hr/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user.");
      }
      
      mutate((key) => typeof key === 'string' && key.startsWith('/api/hr')); // Re-fetch
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      // Show error modal
    } finally {
      setIsDeleting(null);
    }
  };
  
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Gender</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.data.map((member: any) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{member.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {member.role?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{member.gender || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {/* --- Permission Check for Actions --- */}
                  {(userRole === 'admin' || userRole === 'manager') && (
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onEdit(member)} 
                        className="p-2 text-gray-500 hover:text-blue-600"
                        disabled={!!isDeleting}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(member.id, member.name)} 
                        className="p-2 text-gray-500 hover:text-red-600 disabled:opacity-50"
                        disabled={!!isDeleting}
                      >
                        {isDeleting === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.data.length === 0 && <TableEmptyState message="No team members found." />}
      <Pagination
        currentPage={data.pagination.currentPage}
        hasMore={data.pagination.hasMore}
        onPageChange={onPageChange}
      />
    </Card>
  );
};

// 2. Roles & Permissions (REMOVED)
// 3. Attendance (REMOVED)

// 4. Payroll (MODIFIED)
const PayrollSalaries = ({ data, onPageChange, onSuccess }: { data: any, onPageChange: (p: number) => void, onSuccess: () => void }) => {
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<any>(null);

  const handleOpenPayModal = (entry: any) => {
    setPayingEntry(entry);
    setIsPayModalOpen(true);
  };
  
  const handlePaySuccess = () => {
    setIsPayModalOpen(false);
    setPayingEntry(null);
    onSuccess(); // Re-fetches all data
  };

  const handlePrint = (payment: any) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Payment Invoice", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Invoice ID: ${payment.id}`, 20, 40);
    doc.text(`Payment Date: ${dayjs(payment.payDate).format("DD MMM YYYY")}`, 20, 50);
    
    doc.text("Paid To:", 20, 70);
    doc.text(payment.userName, 20, 80);
    doc.text(`User ID: ${payment.userId}`, 20, 90);

    doc.text("Paid By:", 140, 70);
    doc.text(payment.processedBy, 140, 80);
    doc.text(`Processed: ${dayjs(payment.processedAt).format("DD MMM YYYY")}`, 140, 90);
    
    doc.setLineWidth(0.5);
    doc.line(20, 110, 190, 110);
    
    doc.text("Description", 20, 120);
    doc.text("Amount", 180, 120, { align: "right" });
    
    doc.text(`Salary Payment (${dayjs(payment.payDate).format("MMM YYYY")})`, 20, 130);
    doc.text(`${payment.amount.toFixed(2)} ${payment.currency}`, 180, 130, { align: "right" });

    if (payment.notes) {
      doc.text("Notes:", 20, 150);
      doc.text(payment.notes, 20, 160, { maxWidth: 170 });
    }
    
    doc.line(20, 200, 190, 200);
    
    doc.setFontSize(16);
    doc.text("Total Paid:", 20, 210);
    doc.text(`${payment.amount.toFixed(2)} ${payment.currency}`, 180, 210, { align: "right" });

    doc.save(`invoice-${payment.userName.replace(" ", "_")}-${payment.id.substring(0,5)}.pdf`);
  };

  return (
    <>
      {/* --- Section 1: Salary List --- */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Employee Salaries</h2>
        <p className="text-sm text-gray-600 mb-4">Manage base salaries and issue payments.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Base Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Frequency</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.data.salaries.map((entry: any) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{entry.userName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    ${entry.baseSalary.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.frequency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handleOpenPayModal(entry)}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700"
                    >
                      <CreditCard className="h-4 w-4" />
                      Pay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.data.salaries.length === 0 && <TableEmptyState message="No salary records found. Add employees to see them here." />}
        {/* We won't use pagination here as it complicates the dual-list */}
      </Card>

      {/* --- Section 2: Payment History --- */}
      <Card className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Payment History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Pay Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Processed By</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.data.history.map((payment: any) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{payment.userName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {payment.amount.toFixed(2)} {payment.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dayjs(payment.payDate).format("DD MMM YYYY")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.processedBy}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handlePrint(payment)}
                      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.data.history.length === 0 && <TableEmptyState message="No payment history found." />}
        <Pagination
          currentPage={data.pagination.currentPage}
          hasMore={data.pagination.hasMore}
          onPageChange={onPageChange}
        />
      </Card>

      {isPayModalOpen && payingEntry && (
        <PayModal
          entry={payingEntry}
          onClose={() => setIsPayModalOpen(false)}
          onSuccess={handlePaySuccess}
        />
      )}
    </>
  );
};


// 5. Performance (REMOVED)

// -----------------------------------------------------------------------------
// 🧩 Modals & Helpers
// -----------------------------------------------------------------------------

// --- Add Employee Modal (MODIFIED) ---
const AddEmployeeModal = ({ onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "", // Added
    phone: "",
    role: "user",
    address: "", // Added
    gender: "male", // Added
    baseSalary: "0",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      setError("Name, Email, and Role are required.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch("/api/hr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save employee.");
      }
      
      onSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title="Add New Team Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
        <FormInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
        <FormInput label="Password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Leave blank for default 'password123'" />
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
        <FormInput label="Address" name="address" value={formData.address} onChange={handleChange} />
        <FormSelect label="Gender" name="gender" value={formData.gender} onChange={handleChange}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </FormSelect>
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">Staff / User</option>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </FormSelect>
        <FormInput label="Base Salary (Monthly)" name="baseSalary" type="number" value={formData.baseSalary} onChange={handleChange} />
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Member"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

// --- (NEW) Edit Employee Modal ---
const EditEmployeeModal = ({ member, onClose, onSuccess }: { member: any, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    name: member.name || "",
    email: member.email || "",
    phone: member.phone || "",
    role: member.role || "user",
    address: member.address || "",
    gender: member.gender || "male",
    baseSalary: member.baseSalary || "0", // This needs to be fetched, placeholder
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Need to fetch baseSalary separately as it's not on the 'user' object
  useEffect(() => {
    const fetchSalary = async () => {
      try {
        // This is a bit inefficient, but needed.
        // A better way would be to join salary data in the main 'employees' GET
        const res = await fetcher(`/api/hr?view=payroll`);
        const salaryEntry = res.data.salaries.find((s: any) => s.userId === member.id);
        if (salaryEntry) {
          setFormData(prev => ({ ...prev, baseSalary: salaryEntry.baseSalary.toString() }));
        }
      } catch (err) {
        console.error("Failed to fetch salary for edit.");
      }
    };
    fetchSalary();
  }, [member.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role) {
      setError("Name, Email, and Role are required.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/hr/employees/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({...formData, storeId: member.storeId, userName: member.name }), // Pass storeId for salary lookup
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update employee.");
      }
      
      onSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title="Edit Team Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
        <FormInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
        <FormInput label="Address" name="address" value={formData.address} onChange={handleChange} />
        <FormSelect label="Gender" name="gender" value={formData.gender} onChange={handleChange}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </FormSelect>
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">Staff / User</option>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </FormSelect>
        <FormInput label="Base Salary (Monthly)" name="baseSalary" type="number" value={formData.baseSalary} onChange={handleChange} />
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[80px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};

// --- (NEW) Pay Modal ---
const PayModal = ({ entry, onClose, onSuccess }: { entry: any, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    amount: entry.baseSalary.toFixed(2),
    currency: "USD",
    payDate: dayjs().format("YYYY-MM-DD"),
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.payDate) {
      setError("Amount and Pay Date are required.");
      return;
    }
    
    setIsSaving(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const payload = {
        ...formData,
        userId: entry.userId,
        userName: entry.userName,
      };

      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment.");
      }
      
      onSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBase title={`Pay ${entry.userName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput label="Pay Date" name="payDate" type="date" value={formData.payDate} onChange={handleChange} required />
        <FormInput label="Amount" name="amount" type="number" value={formData.amount} onChange={handleChange} required />
        <FormSelect label="Currency" name="currency" value={formData.currency} onChange={handleChange}>
          <option value="USD">USD</option>
          <option value="SOS">SOS</option>
        </FormSelect>
        <FormTextarea label="Notes (Optional)" name="notes" value={formData.notes} onChange={handleChange} />
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex min-w-[120px] items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Payment"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
};


// --- Reusable Helper Components (Unchanged) ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    {children}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Data</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{message}</div>
);

const Pagination = ({ currentPage, hasMore, onPageChange }: any) => (
  <div className="mt-4 flex items-center justify-between">
    <button
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage <= 1}
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      <ChevronLeft className="h-4 w-4" /> Previous
    </button>
    <span className="text-sm text-gray-700 dark:text-gray-300">Page {currentPage}</span>
    <button
      onClick={() => onPageChange(currentPage + 1)}
      disabled={!hasMore}
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      Next <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

const ModalBase = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ margin: 0 }}>
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

const FormInput = ({ label, name, ...props }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    />
  </div>
);

const FormSelect = ({ label, name, children, ...props }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      id={name}
      name={name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    >
      {children}
    </select>
  </div>
);

const FormTextarea = ({ label, name, ...props }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      rows={3}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    />
  </div>
);