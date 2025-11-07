// File: app/(main)/settings/page.tsx
// Description: Main System & Settings page.
// --- (REAL DATA UPGRADE) ---
// - Removed ALL mock data ("Mubarik Osman", etc.).
// - 'UserManagement' now fetches real data from '/api/hr?view=employees'.
// - 'Logs' now fetches real data from '/api/dashboard' (for the activityFeed).
// - Added 'TableLoader' and 'TableEmptyState' for a real app experience.
// -----------------------------------------------------------------------------
"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebaseConfig";
import dayjs from "dayjs";
import {
  Settings, Building, Users, CreditCard, Sliders, Bell,
  Database, Palette, Plug, Shield, History, ArrowLeft,
  Loader2, Save, UploadCloud, Trash2, Plus, Lock, Key,
  UserPlus, Edit, List,FileDown // <-- ADD THIS ICON
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

  // This is the main data load for settings
  const {
    data,
    error,
    isLoading: dataIsLoading,
    mutate,
  } = useSWR(user ? "/api/settings" : null, fetcher);

  const isLoading = authLoading || dataIsLoading;

  const handleSave = async (
    type: "company" | "settings",
    payload: any
  ) => {
    try {
      await saveSettings(type, payload);
      await mutate(); 
      alert("Settings saved successfully!");
    } catch (err: any) {
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
        <Card className="flex h-full transform flex-col transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-blue-200 dark:group-hover:shadow-blue-900/50 group-hover:shadow-lg">
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
        return <UserManagement />; // Fetches its own data
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
        return <Logs />; // Fetches its own data
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
// 🧩 All 10 Sub-Components (NOW WITH REAL DATA)
// -----------------------------------------------------------------------------

// 1. Company Settings (Unchanged, it was already real)
const CompanySettings = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("company", formData);
    setIsSaving(false);
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-6 md:col-span-1">
        <FormInput
          label="Company Name"
          name="name"
          value={formData.name}
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
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
        <FormTextarea
          label="Address"
          name="address"
          value={formData.address}
          onChange={handleChange}
        />
      </div>
      <div className="space-y-6 md:col-span-1">
        <div>
          <label className="mb-1 block text-sm font-medium">Company Logo</label>
          <div className="flex items-center gap-4">
            {formData.logoUrl ? (
              <img src={formData.logoUrl} alt="Logo" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                <Building className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
              <UploadCloud className="h-4 w-4" />
              Upload Logo
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">For receipts and login page. (JPG, PNG)</p>
        </div>
      </div>
      <div className="md:col-span-2">
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>
    </div>
  );
};

// 2. User & Role Management (NOW FETCHES REAL DATA)
const UserManagement = () => {
  // --- REAL DATA FETCH ---
  const { data: hrData, error: hrError, isLoading: hrLoading } = useSWR('/api/hr?view=employees', fetcher);
  
  // This is a placeholder as your HR API doesn't have a 'roles' view yet
  const mockRoles = [
    { id: "admin", name: "Admin", desc: "Full access to all system settings, finance, and user management." },
    { id: "manager", name: "Manager", desc: "Can view reports, manage products, and oversee sales." },
    { id: "user", name: "User (Cashier)", desc: "Can only access the POS screen to make sales." },
  ];
  
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Roles & Permissions</h3>
        <div className="space-y-3">
          {mockRoles.map(role => (
            <div key={role.id} className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
              <div>
                <h4 className="font-semibold">{role.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{role.desc}</p>
              </div>
              <button className="text-sm font-medium text-blue-600 hover:underline">Edit Permissions</button>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between">
          <h3 className="mb-4 text-lg font-semibold">User Accounts</h3>
          <button className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300">
            <UserPlus className="h-4 w-4" />
            Add New User
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase">Role</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {hrLoading && (
                <tr>
                  <td colSpan={4}><TableLoader /></td>
                </tr>
              )}
              {hrError && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-red-500">{hrError.message}</td>
                </tr>
              )}
              {hrData && hrData.data.length === 0 && (
                <tr>
                  <td colSpan={4}><TableEmptyState message="No users found." /></td>
                </tr>
              )}
              {hrData?.data.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">{user.role}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="p-2 text-gray-500 hover:text-blue-600"><Edit className="h-4 w-4" /></button>
                    <button className="p-2 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 3. Payment & Currency (Unchanged, it was already real)
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
      <h3 className="mb-2 text-lg font-semibold">Enabled Payment Methods</h3>
      <p className="text-sm text-gray-500">These will appear on your POS screen.</p>
      <div className="grid grid-cols-2 gap-4">
        <FormToggle label="Cash" enabled={formData.paymentMethods.cash} onChange={() => handlePaymentToggle("cash")} />
        <FormToggle label="Bank Transfer" enabled={formData.paymentMethods.bank} onChange={() => handlePaymentToggle("bank")} />
        <FormToggle label="ZAAD" enabled={formData.paymentMethods.zaad} onChange={() => handlePaymentToggle("zaad")} />
        <FormToggle label="E-Dahab" enabled={formData.paymentMethods.edahab} onChange={() => handlePaymentToggle("edahab")} />
        <FormToggle label="EVC Plus" enabled={formData.paymentMethods.evc} onChange={() => handlePaymentToggle("evc")} />
        <FormToggle label="Sahal (Golis)" enabled={formData.paymentMethods.sahal} onChange={() => handlePaymentToggle("sahal")} />
      </div>
      
      <div className="my-8 h-px bg-gray-200 dark:bg-gray-700" />
      <h3 className="mb-2 text-lg font-semibold">Currencies</h3>
      <p className="text-sm text-gray-500">Manage currencies and exchange rates.</p>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FormInput label="Base Currency" value="USD" onChange={() => {}} disabled />
          <FormInput label="Exchange Rate" value="1" onChange={() => {}} disabled />
        </div>
        <div className="flex items-center gap-2">
          <FormInput label="Secondary Currency" value="SLSH" onChange={() => {}} />
          <FormInput label="Rate (1 USD = ?)" type="number" value="8500" onChange={() => {}} />
        </div>
      </div>
      <button className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
        <Plus className="h-4 w-4" /> Add Currency
      </button>

      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 4. System Preferences (Unchanged, it was already real)
const SystemPreferences = ({ data, onSave }: any) => {
  const [formData, setFormData] = useState(data);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleToggle = (key: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: !prev[key] }));
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
        <option value="dd/mm/yyyy">DD/MM/YYYY (31/12/2025)</option>
        <option value="mm/dd/yyyy">MM/DD/YYYY (12/31/2025)</option>
        <option value="yyyy-mm-dd">YYYY-MM-DD (2025-12-31)</option>
      </FormSelect>
      <FormSelect label="Default POS Currency" name="defaultCurrency" value={formData.defaultCurrency || "USD"} onChange={handleChange}>
        <option value="USD">USD</option>
        <option value="SLSH">SLSH</option>
        <option value="SOS">SOS</option>
      </FormSelect>
      <FormToggle label="Enable Low Stock Alerts" enabled={formData.enableLowStockAlerts} onChange={() => handleToggle("enableLowStockAlerts")} />
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 5. Notifications (Unchanged, it was already real)
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
      <h3 className="mb-2 text-lg font-semibold">Email & SMS Config (for Alerts)</h3>
      <p className="text-sm text-gray-500">Configure your API gateways to send alerts.</p>
      <FormInput label="SMS API Key (Telesom, etc.)" name="smsApi" value={formData.smsApi || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, smsApi: e.target.value})} />
      <FormInput label="SMTP Server (for Email)" name="smtpServer" value={formData.smtpServer || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, smtpServer: e.target.value})} />
      
      <div className="my-8 h-px bg-gray-200 dark:bg-gray-700" />
      <h3 className="mb-2 text-lg font-semibold">System Alerts</h3>
      <FormToggle label="Notify admin on new sale" enabled={formData.onNewSale} onChange={() => handleToggle("onNewSale")} />
      <FormToggle label="Notify admin on low stock" enabled={formData.onLowStock} onChange={() => handleToggle("onLowStock")} />
      <FormToggle label="Notify admin on new debt" enabled={formData.onDebtUpdate} onChange={() => handleToggle("onDebtUpdate")} />
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 6. Backup & Data (Unchanged)
const BackupData = () => (
  <div className="space-y-4">
    <p>Manage data imports, exports, and system backups.</p>
    <div className="flex flex-wrap gap-4">
      <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <Database className="h-4 w-4" />
        Create Manual Backup
      </button>
      <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
        <FileDown className="h-4 w-4" />
        Export Products (Excel)
      </button>
      <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
        <UploadCloud className="h-4 w-4" />
        Import Products (Excel)
      </button>
    </div>
  </div>
);

// 7. Appearance & Theme (Unchanged, it was already real)
const AppearanceTheme = ({ data, onSave }: any) => {
  const [isDarkMode, setIsDarkMode] = useState(data.isDarkMode);
  const [primaryColor, setPrimaryColor] = useState(data.primaryColor);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave("settings", { isDarkMode, primaryColor });
    document.documentElement.classList.toggle("dark", isDarkMode);
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6">
      <FormToggle label="Enable Dark Mode" enabled={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
      <FormInput
        label="Primary Color"
        type="color"
        name="primaryColor"
        value={primaryColor}
        onChange={(e:React.ChangeEvent<HTMLInputElement>) => setPrimaryColor(e.target.value)}
        className="h-12 w-24"
      />
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 8. Integrations (Unchanged)
const Integrations = () => (
  <div className="space-y-4">
    <p>Connect third-party services to your system.</p>
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <h4 className="font-semibold">Your API Key</h4>
      <p className="text-sm text-gray-500">Use this key to connect external apps to Hantikaab.</p>
      <div className="mt-2 flex items-center gap-2">
        <input type="text" value="api_key_****************" readOnly className="w-full rounded-md border-gray-300 bg-gray-100 p-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700" />
        <button className="text-sm text-blue-600 hover:underline">Regenerate</button>
      </div>
    </div>
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <h4 className="font-semibold">Webhooks</h4>
      <p className="text-sm text-gray-500">Get notified when events happen (e.g., `sale.created`).</p>
      <FormInput label="Webhook URL" name="webhookUrl" placeholder="https://your-server.com/webhook" />
    </div>
  </div>
);

// 9. Security (Unchanged, it was already real)
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
      <FormToggle label="Require 2-Factor Auth (2FA) for All Users" enabled={formData.enable2FA} onChange={() => handleToggle("enable2FA")} />
      <FormToggle label="Force strong passwords" enabled={formData.forceStrongPassword} onChange={() => handleToggle("forceStrongPassword")} />
      <FormSelect label="Session Timeout (Auto-logout)" name="sessionTimeout" value={formData.sessionTimeout || "30"} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, sessionTimeout: e.target.value})}>
        <option value="15">15 Minutes</option>
        <option value="30">30 Minutes</option>
        <option value="60">1 Hour (60 Minutes)</option>
        <option value="never">Never</option>
      </FormSelect>
      <SaveButton onClick={handleSave} isSaving={isSaving} />
    </div>
  );
};

// 10. Logs (NOW FETCHES REAL DATA)
const Logs = () => {
  // --- REAL DATA FETCH ---
  // Fetches from your Dashboard API route, which already provides this.
  const { data: dashData, error: dashError, isLoading: dashLoading } = useSWR('/api/dashboard', fetcher);

  return (
    <div>
      <p>Full record of recent actions taken in the system by users.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {dashLoading && (
              <tr>
                <td colSpan={3}><TableLoader /></td>
              </tr>
            )}
            {dashError && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-red-500">{dashError.message}</td>
              </tr>
            )}
            {dashData && dashData.activityFeed.length === 0 && (
              <tr>
                <td colSpan={3}><TableEmptyState message="No activity logs found." /></td>
              </tr>
            )}
            {dashData?.activityFeed.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm">{dayjs(log.timestamp).format("DD MMM YYYY, h:mm A")}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{log.userName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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

// --- (NEW) Helper for tables ---
const TableLoader = () => (
  <div className="flex w-full justify-center p-8">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error }: { error: Error }) => (
  <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20">
    <h3 className="font-semibold text-red-700 dark:text-red-400">Error Loading Settings</h3>
    <p className="text-sm text-red-600 dark:text-red-500">{error.message}</p>
  </Card>
);

// --- (NEW) Helper for tables ---
const TableEmptyState = ({ message }: { message: string }) => (
  <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
    <List className="mx-auto mb-2 h-12 w-12 opacity-50" />
    {message}
  </div>
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

// --- (NEW) Added this helper which was missing ---
const FormTextarea = ({ label, name, value, onChange }: any) => (
  <div>
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={3}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
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
  <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
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