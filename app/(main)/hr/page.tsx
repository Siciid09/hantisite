// File: app/(main)/hr/page.tsx
// Description: Main HR & Staff page with 5-tab navigation.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Users, UserPlus, Shield, UserCheck, Calendar, DollarSign,
  Award, Loader2, Search, X, ChevronLeft, ChevronRight,
  Trash2, Edit, AlertTriangle, Briefcase,
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
// 📝 Main HR Page Component
// -----------------------------------------------------------------------------
const hrNavLinks = [
  { id: "employees", label: "Employee List", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "payroll", label: "Payroll & Salaries", icon: DollarSign },
  { id: "performance", label: "Performance", icon: Award },
];

function HRPage() {
  const { user, loading: authLoading, subscription } = useAuth(); //
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // --- State ---
  const view = searchParams.get("view") || "employees";
  const page = parseInt(searchParams.get("page") || "1");

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
    // Replicating subscription check from teamusers.dart
    const userCount = apiData?.data?.length || 0; // This is naive, ideally API returns count
    const canAdd = (subscription?.planId === 'pro' && userCount < 10) || 
                   (subscription?.planId === 'unlimited') || 
                   (subscription?.planId === 'lifetime') ||
                   (userCount < 3); // Default trial/basic limit
                   
    if (canAdd) {
      setIsAddModalOpen(true);
    } else {
      // Replicating dialog from teamusers.dart
      alert("User Limit Reached. Please upgrade your plan to add more team members.");
      router.push("/subscription"); //
    }
  };
  
  const handleActionSuccess = () => {
    mutate(apiUrl); // Re-fetch data for the current view
    setIsAddModalOpen(false);
  };
  
  // Render loading state if user role is not yet determined
  if (authLoading || !user) {
    return <LoadingSpinner />;
  }

  // Permission Check from teamusers.dart
  if ((user as any).role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Only administrators can manage team members.
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

      {/* --- 📑 Tab Navigation --- */}
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

      {/* --- 🚦 Content Switcher --- */}
      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <>
            {view === 'employees' && <EmployeeList data={apiData} onPageChange={handlePageChange} />}
            {view === 'roles' && <RolesPermissions data={apiData} />}
            {view === 'attendance' && <AttendanceTracking data={apiData} onPageChange={handlePageChange} />}
            {view === 'payroll' && <PayrollSalaries data={apiData} onPageChange={handlePageChange} />}
            {view === 'performance' && <PerformanceReviews data={apiData} onPageChange={handlePageChange} />}
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
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Tab-Specific Components
// -----------------------------------------------------------------------------

// 1. Employee List
const EmployeeList = ({ data, onPageChange }: { data: any, onPageChange: (p: number) => void }) => {
  const { mutate } = useSWRConfig();
  
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name}? This will delete their account.`)) return;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      const res = await fetch(`/api/hr/employees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete user.");
      
      mutate((key) => typeof key === 'string' && key.startsWith('/api/hr')); // Re-fetch all HR data
    } catch (err) {
      alert(`Error: ${err}`);
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    member.status === 'approved' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {member.status?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button className="p-2 text-gray-500 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(member.id, member.name)} className="p-2 text-gray-500 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
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

// 2. Roles & Permissions
const RolesPermissions = ({ data }: { data: any }) => (
  <Card>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {data.data.map((role: any) => (
        <div key={role.id} className="rounded-lg border p-4 dark:border-gray-700">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Briefcase className="h-5 w-5 text-blue-600" />
            {role.name}
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{role.desc}</p>
          <button className="mt-4 text-sm font-medium text-blue-600 hover:underline">
            Edit Permissions
          </button>
        </div>
      ))}
    </div>
  </Card>
);

// 3. Attendance
const AttendanceTracking = ({ data, onPageChange }: { data: any, onPageChange: (p: number) => void }) => (
  <Card>
    <p>This is a log of employee check-ins and check-outs.</p>
    {/* This component would ideally have a "Check-in" button */}
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Employee</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Check-in</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Check-out</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Hours</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.data.map((att: any) => (
            <tr key={att.id}>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{att.userName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {dayjs(att.checkIn).format("DD MMM YYYY, h:mm A")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {att.checkOut ? dayjs(att.checkOut).format("h:mm A") : "Still clocked in"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {att.checkOut ? `${dayjs(att.checkOut).diff(dayjs(att.checkIn), 'hour', true).toFixed(1)} hrs` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {data.data.length === 0 && <TableEmptyState message="No attendance records found." />}
    <Pagination
      currentPage={data.pagination.currentPage}
      hasMore={data.pagination.hasMore}
      onPageChange={onPageChange}
    />
  </Card>
);

// 4. Payroll
const PayrollSalaries = ({ data, onPageChange }: { data: any, onPageChange: (p: number) => void }) => (
  <Card>
    <p>Manage employee salaries and run payroll.</p>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Employee</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Base Salary</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Pay Frequency</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.data.map((entry: any) => (
            <tr key={entry.id}>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{entry.userName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                ${entry.baseSalary.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.frequency}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button className="p-2 text-sm font-medium text-blue-600 hover:underline">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {data.data.length === 0 && <TableEmptyState message="No salary records found." />}
    <Pagination
      currentPage={data.pagination.currentPage}
      hasMore={data.pagination.hasMore}
      onPageChange={onPageChange}
    />
  </Card>
);

// 5. Performance
const PerformanceReviews = ({ data, onPageChange }: { data: any, onPageChange: (p: number) => void }) => (
  <Card>
    <p>Track employee evaluations and reviews.</p>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Employee</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Review Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Rating (1-5)</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.data.map((review: any) => (
            <tr key={review.id}>
              <td className="px-6 py-4 whitespace-nowrap font-medium">{review.userName}</td>
              <td className="px-6 py-4 whitespace-nowGrap text-sm text-gray-500">
                {dayjs(review.reviewDate).format("DD MMM YYYY")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{review.rating}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{review.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {data.data.length === 0 && <TableEmptyState message="No performance reviews found." />}
    <Pagination
      currentPage={data.pagination.currentPage}
      hasMore={data.pagination.hasMore}
      onPageChange={onPageChange}
    />
  </Card>
);

// -----------------------------------------------------------------------------
// 🧩 Modals & Helpers
// -----------------------------------------------------------------------------

// Add Employee Modal (from teamusers.dart)
const AddEmployeeModal = ({ onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      
      alert("Team member added! A password setup email has been sent.");
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
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">Staff / User</option>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </FormSelect>
        
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

// --- Reusable Helper Components ---

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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
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