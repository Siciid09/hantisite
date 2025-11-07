// File: app/(main)/settings/page.tsx
// Description: Main System & Settings page.
// Implements a "hub-and-spoke" model using ?view=... query param.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import {
  Settings,
  Building,
  Users,
  CreditCard,
  Sliders,
  Bell,
  Database,
  Palette,
  Plug,
  Shield,
  History,
  ArrowLeft,
  Loader2,
  Save,
  UploadCloud,
} from "lucide-react";

// -----------------------------------------------------------------------------
// 💰 API Fetcher & Saver
// -----------------------------------------------------------------------------
const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User is not authenticated.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || `API Error: ${res.status}`);
  }
  return res.json();
};

const saveSettings = async (type: "company" | "settings", payload: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated.");
  const token = await user.getIdToken();

  const res = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, payload }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to save settings.");
  }
  return res.json();
};

// -----------------------------------------------------------------------------
// 🎁 Main Page & Suspense Wrapper
// -----------------------------------------------------------------------------
export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SettingsPage />
    </Suspense>
  );
}

// -----------------------------------------------------------------------------
// ⚙️ Main Settings Page Component
// -----------------------------------------------------------------------------
function SettingsPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const { user, loading: authLoading } = useAuth();

  const {
    data,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(user ? "/api/settings" : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  // This function is passed to sub-components to handle saving
  const handleSave = async (
    type: "company" | "settings",
    payload: any
  ) => {
    try {
      await saveSettings(type, payload);
      await mutate(); // Re-fetch data to show updated state
      // You can add a success toast notification here
      alert("Settings saved successfully!");
    } catch (err: any) {
      // You can add an error toast notification here
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 pt-6 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">System & Settings</h1>
      </header>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorDisplay error={error} />}

      {data && (
        <>
          {!view ? (
            <SettingsHub />
          ) : (
            <SettingsSpoke
              view={view}
              data={data}
              onSave={handleSave}
            />
          )}
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 🏠 Settings Hub (The main grid)
// -----------------------------------------------------------------------------
const hubItems = [
  { id: "company", title: "1. Company Settings", icon: Building, desc: "Manage address, logo, and branches." },
  { id: "users", title: "2. User & Role Management", icon: Users, desc: "Add/edit users, manage permissions." },
  { id: "payments", title: "3. Payment & Currency", icon: CreditCard, desc: "Configure payment methods, currencies." },
  { id: "preferences", title: "4. System Preferences", icon: Sliders, desc: "Language, date formats, defaults." },
  { id: "notifications", title: "5. Notifications & Alerts", icon: Bell, desc: "Set up SMS, email, and app alerts." },
  { id: "backup", title: "6. Backup & Data", icon: Database, desc: "Manage system backups and data." },
  { id: "appearance", title: "7. Appearance & Theme", icon: Palette, desc: "Customize colors and layout." },
  { id: "integrations", title: "8. Integrations & APIs", icon: Plug, desc: "Connect third-party services." },
  { id: "security", title: "9. Security & Permissions", icon: Shield, desc: "Set 2FA, password policies." },
  { id: "logs", title: "10. Logs & Activity", icon: History, desc: "View system and user activity logs." },
];

const SettingsHub = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {hubItems.map((item) => (
      <Link
        key={item.id}
        href={`/settings?view=${item.id}`}
        className="group"
      >
        <Card className="flex h-full flex-col transition-all group-hover:border-blue-500 group-hover:shadow-lg">
          <div className="flex items-center gap-4">
            <item.icon className="h-8 w-8 text-blue-600" />
            <h3 className="text-lg font-semibold">{item.title}</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-gray-600 dark:text-gray-400">
            {item.desc}
          </p>
        </Card>
      </Link>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// ↔️ Settings Spoke (The sub-page renderer)
// -----------------------------------------------------------------------------
const SettingsSpoke = ({ view, data, onSave }: any) => {
  const router = useRouter();
  const item = hubItems.find((i) => i.id === view);

  const renderView = () => {
    switch (view) {
      case "company":
        return <CompanySettings data={data.company} onSave={onSave} />;
      case "users":
        return <UserManagement data={data} onSave={onSave} />;
      case "payments":
        return <PaymentCurrency data={data.settings} onSave={onSave} />;
      case "preferences":
        return <SystemPreferences data={data.settings} onSave={onSave} />;
      case "notifications":
        return <Notifications data={data.settings} onSave={onSave} />;
      case "backup":
        return <BackupData />;
      case "appearance":
        return <AppearanceTheme data={data.settings} onSave={onSave} />;
      case "integrations":
        return <Integrations />;
      case "security":
        return <Security data={data.settings} onSave={onSave} />;
      case "logs":
        return <Logs />;
      default:
        return <p>Setting not found.</p>;
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/settings")}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to All Settings
      </button>
      <Card>
        <h2 className="mb-4 border-b pb-4 text-2xl font-bold dark:border-gray-700">
          {item?.title || "Settings"}
        </h2>
        {renderView()}
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 🧩 All 10 Sub-Components
// -----------------------------------------------------------------------------

// 1. Company Settings
const CompanySettings = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("company", formData);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <FormInput
        label="Company Name"
        name="name"
        value={formData.name}
        onChange={handleChange}
      />
      <FormInput
        label="Address"
        name="address"
        value={formData.address}
        onChange={handleChange}
      />
      <FormInput
        label="Phone"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
      />
      <FormInput
        label="Email"
        name="email"
        value={formData.email}
        onChange={handleChange}
      />
      <div>
        <label className="mb-1 block text-sm font-medium">Logo</label>
        <div className="flex items-center gap-4">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt="Logo" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <Building className="h-8 w-8 text-gray-400" />
            </div>
          )}
          <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            <UploadCloud className="h-4 w-4" />
            Upload Logo
          </button>
        </div>
      </div>
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 2. User & Role Management
const UserManagement = ({ data, onSave }: any) => {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Users List</h3>
      <p>User management table goes here. (Add / Edit / Delete users)</p>
      {/* Placeholder Table */}
      <table className="mt-4 w-full min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap">Mubarik Osman</td>
            <td className="px-6 py-4 whitespace-nowrap">Admin</td>
            <td className="px-6 py-4 whitespace-nowrap"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Active</span></td>
          </tr>
          <tr>
            <td className="px-6 py-4 whitespace-nowrap">Ahmed Ali</td>
            <td className="px-6 py-4 whitespace-nowrap">Cashier</td>
            <td className="px-6 py-4 whitespace-nowrap"><span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Active</span></td>
          </tr>
        </tbody>
      </table>
      <div className="my-8 h-px bg-gray-200 dark:bg-gray-700" />
      <h3 className="mb-4 text-lg font-semibold">Roles & Permissions</h3>
      <p>UI to manage roles (Admin, Cashier, Staff) goes here.</p>
    </div>
  );
};

// 3. Payment & Currency
const PaymentCurrency = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data);
  const [isSaving, setIsSaving] = useState(false);

  const handlePaymentToggle = (method: string) => {
    setFormData((prev: any) => ({
      ...prev,
      paymentMethods: {
        ...prev.paymentMethods,
        [method]: !prev.paymentMethods[method],
      },
    }));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", formData);
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <h3 className="mb-2 text-lg font-semibold">Payment Methods</h3>
      <FormToggle label="Zaad" enabled={formData.paymentMethods.zaad} onChange={() => handlePaymentToggle("zaad")} />
      <FormToggle label="eDahab" enabled={formData.paymentMethods.edahab} onChange={() => handlePaymentToggle("edahab")} />
      <FormToggle label="Cash" enabled={formData.paymentMethods.cash} onChange={() => handlePaymentToggle("cash")} />
      
      <div className="my-8 h-px bg-gray-200 dark:bg-gray-700" />
      <h3 className="mb-2 text-lg font-semibold">Currencies</h3>
      <p>Currency management (add, edit rates) goes here.</p>
      <div className="mt-2 flex gap-2">
        {formData.currencies.map((c: string) => (
          <span key={c} className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">{c}</span>
        ))}
      </div>

      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 4. System Preferences
const SystemPreferences = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", formData);
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <FormSelect label="Default Language" name="language" value={formData.language} onChange={handleChange}>
        <option value="en">English</option>
        <option value="so">Somali</option>
      </FormSelect>
      <FormSelect label="Date Format" name="dateFormat" value={formData.dateFormat || "dd/mm/yyyy"} onChange={handleChange}>
        <option value="dd/mm/yyyy">DD/MM/YYYY</option>
        <option value="mm/dd/yyyy">MM/DD/YYYY</option>
      </FormSelect>
      <FormSelect label="Auto-Logout Time" name="autoLogout" value={formData.autoLogout || "30"} onChange={handleChange}>
        <option value="10">10 Minutes</option>
        <option value="30">30 Minutes</option>
        <option value="60">1 Hour</option>
      </FormSelect>
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 5. Notifications
const Notifications = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data.notifications || {});
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", { notifications: formData });
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <h3 className="mb-2 text-lg font-semibold">Email & SMS Config</h3>
      <p>Inputs for SMTP and SMS API settings go here.</p>
      <div className="my-8 h-px bg-gray-200 dark:bg-gray-700" />
      <h3 className="mb-2 text-lg font-semibold">System Alerts</h3>
      <FormToggle label="Notify on new sale" enabled={formData.onNewSale} onChange={() => handleToggle("onNewSale")} />
      <FormToggle label="Notify on low stock" enabled={formData.onLowStock} onChange={() => handleToggle("onLowStock")} />
      <FormToggle label="Notify on debt updates" enabled={formData.onDebtUpdate} onChange={() => handleToggle("onDebtUpdate")} />
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 6. Backup & Data
const BackupData = () => (
  <div className="space-y-4">
    <p>Ensure data safety and recovery.</p>
    <div className="flex flex-wrap gap-4">
      <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <Database className="h-4 w-4" />
        Manual Backup
      </button>
      <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
        <UploadCloud className="h-4 w-4" />
        Import Data
      </button>
    </div>
  </div>
);

// 7. Appearance & Theme
const AppearanceTheme = ({ data, onSave }: any) => {
  const [isDarkMode, setIsDarkMode] = useState(data.isDarkMode);
  const [primaryColor, setPrimaryColor] = useState(data.primaryColor);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", { isDarkMode, primaryColor });
    // This will cause a page reload or theme context update in a real app
    document.documentElement.classList.toggle("dark", isDarkMode);
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <FormToggle label="Dark Mode" enabled={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
      <FormInput
        label="Primary Color"
        type="color"
        name="primaryColor"
        value={primaryColor}
       onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrimaryColor(e.target.value)}
        className="h-12 w-24" // Specific style for color picker
      />
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 8. Integrations
const Integrations = () => (
  <div>
    <p>Connect third-party services to your system.</p>
    <div className="mt-4 space-y-2">
      <p>• POS API</p>
      <p>• Accounting (QuickBooks / Xero)</p>
      <p>• Payment Gateway (Zaad / eDahab APIs)</p>
      <p>• Google Sheets</p>
      <p>• WhatsApp API</p>
    </div>
  </div>
);

// 9. Security
const Security = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data.security || {});
  const [isSaving, setIsSaving] = useState(false);
  
  const handleToggle = (key: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", { security: formData });
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <FormToggle label="Enable 2-Factor Auth (2FA)" enabled={formData.enable2FA} onChange={() => handleToggle("enable2FA")} />
      <FormToggle label="Force strong passwords" enabled={formData.forceStrongPassword} onChange={() => handleToggle("forceStrongPassword")} />
      <FormSelect label="Session Timeout" name="sessionTimeout" value={formData.sessionTimeout || "30"} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, sessionTimeout: e.target.value})}>
        <option value="15">15 Minutes</option>
        <option value="30">30 Minutes</option>
        <option value="60">1 Hour</option>
        <option value="never">Never</option>
      </FormSelect>
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 10. Logs
const Logs = () => (
  <div>
    <p>Full record of what happened in the system.</p>
    {/* Placeholder Log Table */}
    <table className="mt-4 w-full min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead className="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">User</th>
          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        <tr>
          <td className="px-6 py-4 whitespace-nowrap">30 Oct 2025</td>
          <td className="px-6 py-4 whitespace-nowrap">Mubarik Osman</td>
          <td className="px-6 py-4 whitespace-nowrap">Updated Settings: Currency</td>
        </tr>
        <tr>
          <td className="px-6 py-4 whitespace-nowrap">30 Oct 2025</td>
          <td className="px-6 py-4 whitespace-nowrap">Ahmed Ali</td>
          <td className="px-6 py-4 whitespace-nowrap">Added Sale: #1245</td>
        </tr>
      </tbody>
    </table>
  </div>
);

// -----------------------------------------------------------------------------
// 🛠️ Reusable Helper Components
// -----------------------------------------------------------------------------

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
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Settings</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

const FormInput = ({ label, name, value, onChange, type = "text", className = "" }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 ${className}`}
    />
  </div>
);

const FormSelect = ({ label, name, value, onChange, children }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
    >
      {children}
    </select>
  </div>
);

const FormToggle = ({ label, enabled, onChange }: { label: string, enabled: boolean, onChange: () => void }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

const SaveButton = ({ onClick, isSaving }: { onClick: () => void, isSaving: boolean }) => (
  <div className="mt-8 flex justify-end">
    <button
      onClick={onClick}
      disabled={isSaving}
      className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
    >
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {isSaving ? "Saving..." : "Save Changes"}
    </button>
  </div>
);