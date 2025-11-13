// File: app/(main)/hr/page.tsx
// Description: Main HR & Staff page (MODIFIED)
// -----------------------------------------------------------------------------
"use client";
// --- (NEW) IMPORTS FOR PDF MODAL ---
import { PDFDownloadLink } from "@react-pdf/renderer";
import { getTemplateComponent, ReportType } from "@/lib/pdfService"; // Your "brain"
import { Download, FileText } from "lucide-react";
// --- END NEW IMPORTS ---
import React, { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from "firebase/auth";
import dayjs from "dayjs";
import { jsPDF } from "jspdf"; 
import {
  Users, UserPlus, DollarSign,
  Loader2, X, ChevronLeft, ChevronRight,
  Trash2, Edit, AlertTriangle, Briefcase,
  Printer, CreditCard, Calendar,
  Lock, Eye, User, History 
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
  const [editingMember, setEditingMember] = useState<any>(null);
  // --- (NEW) PDF MODAL STATE ---
  const [pdfData, setPdfData] = useState<any | null>(null);
  const [PdfComponent, setPdfComponent] = useState<React.ElementType | null>(null);
  // --- END NEW STATE ---
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<any>(null);
  const [isHRAccessGranted, setIsHRAccessGranted] = useState(false);

  const view = searchParams.get("view") || "employees";
  const page = parseInt(searchParams.get("page") || "1");
  const userRole = (user as any)?.role; 

  const apiUrl = `/api/hr?view=${view}&page=${page}`;
  
  const {
    data: apiData,
    error,
    isLoading: dataIsLoading,
  } = useSWR(
    !authLoading && user && isHRAccessGranted ? apiUrl : null, 
    fetcher
  );

  const isLoading = authLoading || (isHRAccessGranted && dataIsLoading);

  const handleTabChange = (newView: string) => {
    router.push(`/hr?view=${newView}`);
  };

  const handlePageChange = (newPage: number) => {
    router.push(`/hr?view=${view}&page=${newPage}`);
  };

  const handleOpenAddModal = () => {
    const userCount = apiData?.data?.length || 0; 
    const canAdd = (subscription?.planId === 'pro' && userCount < 10) || 
                   (subscription?.planId === 'unlimited') || 
                   (subscription?.planId === 'lifetime') ||
                   (userCount < 3); // Default
                   
    if (canAdd) {
      setIsAddModalOpen(true);
    } else {
      console.error("User Limit Reached. Please upgrade your plan.");
      router.push("/subscription");
    }
  };

  const handleOpenViewModal = (member: any) => {
    setViewingMember(member);
    setIsViewModalOpen(true);
  };
  
  const handleOpenEditModal = (member: any) => {
    setEditingMember(member);
    setIsEditModalOpen(true);
  };
  
  const handleActionSuccess = () => {
    mutate(apiUrl); 
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setEditingMember(null);
  };
  // --- (NEW) PDF MODAL HANDLER ---
  const handleShowPdfModal = (paymentData: any) => {
    // 1. Get store info from the subscription
    const storeInfo = {
      name: subscription?.storeName || "My Store",
      address: subscription?.storeAddress || "123 Main St",
      phone: subscription?.storePhone || "555-1234",
      logoUrl: subscription?.logoUrl,
      planId: subscription?.planId,
    };

    // 2. Get the correct template from the "brain"
    // We use 'payroll' for this HR voucher
    const Template = getTemplateComponent('payroll' as ReportType, subscription);

    // 3. Set the state to open the modal
    setPdfData({ data: paymentData, store: storeInfo });
    setPdfComponent(() => Template); // Store the component itself
  };
  if (authLoading || !user) {
    return <LoadingSpinner />;
  }
  
  if (!isHRAccessGranted) {
    return (
      <PasswordReAuthModal 
        onSuccess={() => setIsHRAccessGranted(true)} 
        userEmail={user.email || ""}
      />
    );
  }

  // --- (MODIFIED) Permission Check: 'admin', 'hr', or 'manager' ---
  if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Only Admin, HR, or Manager roles can manage this page.
        </p>
      </div>
    );
  }

  // ---------------------------------
  // 🎨 Main Render
  // ---------------------------------
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
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

      <div className="mt-5">
        {isLoading && <LoadingSpinner />}
        {error && <ErrorDisplay error={error} />}
        {apiData && (
          <>
            {view === 'employees' && (
              <EmployeeList 
                data={apiData} 
                onPageChange={handlePageChange}
                onEdit={handleOpenEditModal} 
                onView={handleOpenViewModal} 
                userRole={userRole}
              />
            )}
      
            {view === 'payroll' && (
              <PayrollSalaries 
                data={apiData} 
                onPageChange={handlePageChange} 
                onSuccess={handleActionSuccess}
                onPrintVoucher={handleShowPdfModal} // <-- (NEW) Pass the handler down
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

      {isViewModalOpen && viewingMember && (
        <ViewEmployeeModal
          member={viewingMember}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingMember(null);
          }}
        />
      )}

      
      {isViewModalOpen && viewingMember && (
        <ViewEmployeeModal
          member={viewingMember}
          onClose={() => {
            setIsViewModalOpen(false);
            setViewingMember(null);
          }}
        />
      )}
      
      {/* --- (NEW) PASTE THE PDF MODAL HERE --- */}
      {pdfData && PdfComponent && (
        <ModalBase title="PDF Ready for Download" onClose={() => setPdfData(null)}>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your payroll voucher ({pdfData.data.userName}) is ready.
            </p>
            
            <PDFDownloadLink
              document={<PdfComponent data={pdfData.data} store={pdfData.store} />}
              fileName={`voucher-${pdfData.data.userName.replace(" ", "_")}.pdf`}
              className="w-full flex justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {({ loading }) => 
                loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Now
                  </>
                )
              }
            </PDFDownloadLink>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
              onClick={() => setPdfData(null)}
            >
              Close
            </button>
          </div>
        </ModalBase>
      )}
      {/* --- END NEW MODAL --- */}
  
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🧩 Tab-Specific Components
// -----------------------------------------------------------------------------

// 1. Employee List (MODIFIED)
const EmployeeList = ({ data, onPageChange, onEdit, onView, userRole }: { 
  data: any, 
  onPageChange: (p: number) => void,
  onEdit: (member: any) => void,
  onView: (member: any) => void,
  userRole: string 
}) => {
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  // --- (NEW) State for modern delete modal ---
  const [memberToDelete, setMemberToDelete] = useState<any>(null);
  
  // --- (MODIFIED) Bug fix and split logic ---
  const handleDelete = async (member: any) => {
    // 1. Open the confirm modal
    setMemberToDelete(member);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete || !memberToDelete.id) {
      console.error("Delete failed: No employee ID provided.");
      setMemberToDelete(null);
      return;
    }

    const { id, name } = memberToDelete;
    
    setIsDeleting(id);
    setMemberToDelete(null); // Close modal
    
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
      
      mutate((key) => typeof key === 'string' && key.startsWith('/api/hr'));
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      // You can add a toast/notification here for the error
    } finally {
      setIsDeleting(null);
    }
  };
  
  return (
    <>
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
                    {/* --- (MODIFIED) Permission Check for Actions: 'admin', 'hr', 'manager' --- */}
                    {(userRole === 'admin' || userRole === 'hr' || userRole === 'manager') && (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => onView(member)} 
                          className="p-2 text-gray-500 hover:text-green-600"
                          disabled={!!isDeleting}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onEdit(member)} 
                          className="p-2 text-gray-500 hover:text-blue-600"
                          disabled={!!isDeleting}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {/* --- (MODIFIED) Call new handleDelete --- */}
                        <button 
                          onClick={() => handleDelete(member)} 
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

      {/* --- (NEW) Add the delete modal to the DOM --- */}
      {memberToDelete && (
        <DeleteConfirmModal
          memberName={memberToDelete.name}
          onClose={() => setMemberToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
};


// 4. Payroll
const PayrollSalaries = ({ data, onPageChange, onSuccess, onPrintVoucher }: { 
  data: any, 
  onPageChange: (p: number) => void, 
  onSuccess: () => void,
  onPrintVoucher: (payment: any) => void // <-- (NEW) Accept the prop
}) => {
//
const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingEntry, setPayingEntry] = useState<any>(null);

  const handleOpenPayModal = (entry: any) => {
    setPayingEntry(entry);
    setIsPayModalOpen(true);
  };
  
  const handlePaySuccess = () => {
    setIsPayModalOpen(false);
    setPayingEntry(null);
    onSuccess();
  };

  // --- (MODIFIED) PDF Print function (no changes, just copied) ---
  

  return (
    <>
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
      </Card>

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
                      onClick={() => onPrintVoucher(payment)}
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

// -----------------------------------------------------------------------------
// 🧩 Modals & Helpers
// -----------------------------------------------------------------------------

// --- (NEW) Modern Delete Confirmation Modal ---
const DeleteConfirmModal = ({ memberName, onClose, onConfirm }: { memberName: string, onClose: () => void, onConfirm: () => void }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ margin: 0 }}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Delete Employee?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to permanently delete **{memberName}**? This action will also delete their login account and cannot be undone.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Password Re-Auth Modal (Unchanged) ---
const PasswordReAuthModal = ({ onSuccess, userEmail }: { onSuccess: () => void, userEmail: string }) => {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }
    
    setIsVerifying(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not found.");

      const credential = EmailAuthProvider.credential(userEmail, password);
      await reauthenticateWithCredential(user, credential);
      
      onSuccess();
      
    } catch (err: any) {
      console.error(err);
      setError("Incorrect password. Please try again.");
    } finally {
      setIsVerifying(false);
      setPassword("");
    }
  };

  return (
    <ModalBase title="Confirm Access" onClose={() => {}}>
      <div className="flex flex-col items-center">
        <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
          <Lock className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">HR Section Secured</h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          For your security, please re-enter your password to access the HR & Staff management page.
        </p>
        <form onSubmit={handleSubmit} className="w-full space-y-4 pt-6">
          <FormInput label="Email" name="email" type="email" value={userEmail} disabled />
          <FormInput 
            label="Password" 
            name="password" 
            type="password" 
            value={password} 
            onChange={(e: any) => setPassword(e.target.value)} 
            required 
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-4">
            <button type="submit" disabled={isVerifying} className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Continue"}
            </button>
          </div>
        </form>
      </div>
    </ModalBase>
  );
};


// --- Add Employee Modal (MODIFIED) ---
const AddEmployeeModal = ({ onClose, onSuccess }: any) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "", 
    phone: "",
    role: "user",
    address: "", 
    gender: "male", 
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
        {/* --- (MODIFIED) Role Dropdown --- */}
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">Staff / User</option>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option> {/* <-- ADDED */}
          <option value="hr">HR</option> 
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

// --- Edit Employee Modal (MODIFIED) ---
const EditEmployeeModal = ({ member, onClose, onSuccess }: { member: any, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    name: member.name || "",
    email: member.email || "",
    phone: member.phone || "",
    role: member.role || "user",
    address: member.address || "",
    gender: member.gender || "male",
    baseSalary: member.baseSalary || "0", 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSalary = async () => {
      try {
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
        body: JSON.stringify({...formData, storeId: member.storeId, userName: member.name }),
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
        {/* --- (MODIFIED) Role Dropdown --- */}
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">Staff / User</option>
          <option value="cashier">Cashier</option>
          <option value="manager">Manager</option> {/* <-- ADDED */}
          <option value="hr">HR</option>
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

// --- Payment Methods Map (Unchanged) ---
const paymentMethodsByCurrency: { [key: string]: string[] } = {
  USD: ["Cash", "Bank", "Zaad", "EDahab", "Somnet", "EVC Plus", "Sahal", "Other"],
  SOS: ["Cash", "Bank", "Other"],
  SLSH: ["Cash", "Bank", "EDahab", "Zaad", "Other"],
  BIRR: ["Cash", "Bank", "eBirr", "Other"],
  KSH: ["Bank", "Cash", "M-Pesa", "Other"],
  EUR: ["Cash", "Bank", "Other"],
};

// --- Pay Modal (Unchanged) ---
const PayModal = ({ entry, onClose, onSuccess }: { entry: any, onClose: () => void, onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    amount: entry.baseSalary.toFixed(2),
    currency: "USD",
    payDate: dayjs().format("YYYY-MM-DD"),
    notes: "",
    paymentMethod: "", 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const currentPaymentMethods = paymentMethodsByCurrency[formData.currency] || ["Other"];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === "currency") {
      setFormData(prev => ({ ...prev, paymentMethod: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.payDate || !formData.paymentMethod) { 
      setError("Amount, Pay Date, and Payment Method are required.");
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
          <option value="SLSH">SLSH</option>
          <option value="EUR">EUR</option>
          <option value="KSH">KSH</option>
          <option value="BIRR">BIRR</option>
        </FormSelect>
        
        <FormSelect label="Payment Method" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} required>
          <option value="" disabled>Select a method</option>
          {currentPaymentMethods.map(method => (
            <option key={method} value={method}>{method}</option>
          ))}
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


// --- (MODIFIED) View Employee Modal ---
const ViewEmployeeModal = ({ member, onClose }: { member: any, onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState("info");
  
  // --- (MODIFIED) Fetch payroll data to filter ---
  const { 
    data: payrollData, 
    error, 
    isLoading 
  } = useSWR(`/api/hr?view=payroll`, fetcher);

  // Find the specific user's data from the full payroll fetch
  const salary = payrollData?.data?.salaries.find((s: any) => s.userId === member.id);
  const history = payrollData?.data?.history.filter((h: any) => h.userId === member.id);

  return (
    <ModalBase title={member.name} onClose={onClose}>
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "info"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          <User className="h-4 w-4" />
          Info
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-shrink-0 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          <History className="h-4 w-4" />
          Payment History
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6 min-h-[300px]">
        {/* --- (MODIFIED) Use the member prop for the info tab --- */}
        {activeTab === "info" && (
          <EmployeeInfoTab user={member} salary={salary} isLoading={isLoading} />
        )}
        {/* --- (MODIFIED) Use the filtered history --- */}
        {activeTab === "history" && (
          <EmployeeHistoryTab history={history || []} isLoading={isLoading} error={error} />
        )}
      </div>
    </ModalBase>
  );
};

// --- (MODIFIED) Tab for View Modal: Info ---
const EmployeeInfoTab = ({ user, salary, isLoading }: { user: any, salary: any, isLoading: boolean }) => (
  <div className="space-y-4">
    <InfoRow label="Full Name" value={user.name} />
    <InfoRow label="Email" value={user.email} />
    <InfoRow label="Phone" value={user.phone || 'N/A'} />
    <InfoRow label="Address" value={user.address || 'N/A'} />
    <InfoRow label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'N/A'} />
    <InfoRow label="Role" value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'} />
    <hr className="dark:border-gray-700"/>
    {isLoading ? (
      <InfoRow label="Base Salary" value="Loading..." />
    ) : (
      <InfoRow 
        label="Base Salary" 
        value={salary ? `$${salary.baseSalary.toFixed(2)} (${salary.frequency})` : 'Not Set'} 
        isHighlighted
      />
    )}
  </div>
);
const InfoRow = ({ label, value, isHighlighted = false }: { label: string, value: string, isHighlighted?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}:</span>
    <span className={`text-sm font-semibold ${isHighlighted ? 'text-green-600' : 'text-gray-800 dark:text-gray-200'}`}>
      {value}
    </span>
  </div>
);

// --- (MODIFIED) Tab for View Modal: History ---
const EmployeeHistoryTab = ({ history, isLoading, error }: { history: any[], isLoading: boolean, error: any }) => {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="overflow-x-auto">
      {history.length === 0 ? (
        <TableEmptyState message="No payment history found for this employee." />
      ) : (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase">Date</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase">Method</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((payment: any) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{dayjs(payment.payDate).format("DD MMM YYYY")}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{payment.amount.toFixed(2)} {payment.currency}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.paymentMethod}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{payment.processedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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