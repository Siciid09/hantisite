// File: app/(main)/settings/page.tsx
// Description: The main UI for all store and profile settings. (CORRECTED)
"use client";

import React, { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import dayjs from "dayjs";
import { 
  User, Store, Palette, ShieldCheck, 
  Database, FileText, AlertTriangle, LogOut, 
  Loader2, Upload, Lock, Trash2, X,
  ChevronRight, Star, CheckCircle, Check, X as IconX,
  Calendar, RotateCcw, CloudUpload, CloudDownload, Filter,
  FileX // (FIX) Replaced FileTray with FileX
} from "lucide-react";
import { auth } from "@/lib/firebaseConfig";
import { Switch } from "@headlessui/react";
// --- (FIX) Imports for Date Range Picker ---
import { DateRangePicker, Range } from 'react-date-range'; // Import 'Range' type
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file

// -----------------------------------------------------------------------------
// 腸 API Fetcher
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
// ｧｩ Reusable Components
// (FIX: Moved all modals and helpers *before* the main page component)
// -----------------------------------------------------------------------------

const Card = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <h2 className="flex items-center gap-3 text-lg font-bold">
      <Icon className="h-5 w-5 text-blue-600" /> {title}
    </h2>
    <hr className="my-4 dark:border-gray-600" />
    {children}
  </div>
);

const ListTile = ({ title, subtitle, icon: Icon, onClick, color, href }: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  onClick?: () => void;
  color?: string;
  href?: string;
}) => {
  const content = (
    <div
      onClick={onClick}
      className={`flex items-center p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <Icon className={`h-6 w-6 ${color || 'text-blue-600'}`} />
      <div className="ml-4 flex-1">
        <p className={`font-semibold ${color || ''}`}>{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </div>
  );
  return href ? <Link href={href} passHref>{content}</Link> : content;
};

const FormInput = ({ label, ...props }: any) => (
  <div>
    <label htmlFor={props.name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      id={props.name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
    />
  </div>
);

const FormTextarea = ({ label, ...props }: any) => (
  <div>
    <label htmlFor={props.name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <textarea
      id={props.name}
      rows={3}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
    />
  </div>
);

const FormSelect = ({ label, children, ...props }: any) => (
  <div>
    <label htmlFor={props.name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <select
      id={props.name}
      {...props}
      className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
    >
      {children}
    </select>
  </div>
);

const FormButton = ({ isSaving, text }: { isSaving: boolean, text: string }) => (
  <button
    type="submit"
    disabled={isSaving}
    className="flex min-w-[120px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
  >
    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : text}
  </button>
);

const UpgradeNotice = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <div className="mt-2 text-sm text-blue-600">
    {text} <button type="button" onClick={onClick} className="font-bold underline">Upgrade Now</button>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex h-60 w-full items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
  </div>
);

const ErrorDisplay = ({ error, onRetry }: { error: Error, onRetry?: () => void }) => (
  <Card title="Error" icon={AlertTriangle}>
    <p className="text-red-600">{error.message}</p>
    {onRetry && (
      <button onClick={onRetry} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
        Retry
      </button>
    )}
  </Card>
);

const CurrencyCheckboxGroup = ({ selectedCurrencies, onChange, disabled }: {
  selectedCurrencies: string[];
  onChange: (currencies: string[]) => void;
  disabled: boolean;
}) => {
  const allCurrencies = ['USD', 'SLSH', 'SOS', 'KES', 'ETB'];
  const [error, setError] = useState("");

  const handleCheck = (currency: string, isChecked: boolean) => {
    setError("");
    let newCurrencies = [...selectedCurrencies];
    
    if (isChecked) {
      newCurrencies.push(currency);
    } else {
      if (newCurrencies.length > 1) {
        newCurrencies = newCurrencies.filter(c => c !== currency);
      } else {
        setError("Warning: No currency selected. USD will be used as default.");
        newCurrencies = newCurrencies.filter(c => c !== currency);
      }
    }
    onChange(newCurrencies);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        Store Currencies
      </label>
      <div className="mt-2 flex flex-wrap gap-4">
        {allCurrencies.map(currency => {
          const isSelected = selectedCurrencies.includes(currency);
          return (
            <label
              key={currency}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                  : 'border-gray-300 dark:border-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                checked={isSelected}
                disabled={disabled}
                onChange={(e) => handleCheck(currency, e.target.checked)}
              />
              <span className="font-medium">{currency}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-yellow-600">{error}</p>}
    </div>
  );
};

const ModalBase = ({ title, onClose, children, isDanger = false, maxWidth = "max-w-2xl" }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isDanger?: boolean;
  maxWidth?: string;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ margin: 0 }}>
    <div className={`w-full ${maxWidth} rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto`}>
      <div className={`flex items-center justify-between border-b pb-3 ${isDanger ? 'border-red-500' : 'dark:border-gray-700'}`}>
        <h2 className={`text-lg font-semibold ${isDanger ? 'text-red-700 dark:text-red-400' : ''}`}>{title}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </div>
);

const SubscriptionModal = ({ onClose, userName, storeName }: { 
  onClose: () => void,
  userName: string,
  storeName: string
}) => {
  const { subscription: currentSubscription } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  
  // *** (FIX #1) Changed planId to subscriptionType ***
  const dbPlan = currentSubscription?.subscriptionType?.toLowerCase() || 'trial';
  let planId;
  switch (dbPlan) {
    case 'pro':
    case 'standard':
      planId = 'standard';
      break;
    case 'plan3':
    case 'business':
      planId = 'business';
      break;
    default:
      planId = 'trial';
  }

  const plans = {
    standard: { name: "Standard", price: 5 },
    business: { name: "Business", price: 10 },
  };

  const features = [
    { name: "POS Registers", standard: "Unlimited", business: "Unlimited" },
    { name: "Products", standard: "Unlimited", business: "Unlimited" },
    { name: "Sales & Invoices", standard: "Unlimited", business: "Unlimited" },
    { name: "PDF Downloads", standard: "Classic layout", business: "Modern & customizable" },
    { name: "Real-time Inventory", standard: true, business: true },
    { name: "Purchase Order Management", standard: false, business: true },
    { name: "Supplier Management", standard: false, business: true },
    { name: "Customer CRM", standard: true, business: true },
    { name: "Debt (Caymis) Tracking", standard: true, business: true },
    { name: "Accounting Module", standard: "Basic ledger", business: "Full accounting system" },
    { name: "Analytics Dashboard", standard: "Standard charts", business: "Advanced analytics & reports" },
    { name: "HR & Payroll Management", standard: "Up to 5 employees", business: "Full HR + salary automation" },
    { name: "iOS & Android Apps", standard: true, business: true },
    { name: "Desktop & Web Access", standard: true, business: true },
    { name: "Offline POS Mode", standard: true, business: true },
    { name: "Expense Tracking", standard: "Basic", business: "Detailed + export options" },
    { name: "Barcode Scanning & Printing", standard: true, business: true },
    { name: "Employee Role Permissions", standard: true, business: true },
    { name: "Support", standard: "Chat support only", business: "24/7 Support (Chat, Call, WhatsApp)" },
    { name: "Custom Branding / Logo", standard: false, business: true },
    { name: "Data Backup", standard: false, business: true },
  ];

  const handleUpgrade = (planName: string, price: number) => {
    const period = isYearly ? "yearly" : "monthly";
    const text = `Hi Hantikaab, I want to upgrade to the *${planName}* plan (${period}).\n\n*Price:* $${price}/${period}\n*User:* ${userName}\n*Company:* ${storeName}`;
    const url = `https://wa.me/25265322084?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <ModalBase title="Manage Subscription" onClose={onClose} maxWidth="max-w-5xl">
      <div className="w-full">
        <div className="flex justify-center mb-6">
          <span className={`font-medium ${!isYearly ? 'text-blue-600' : 'text-gray-500'}`}>Monthly</span>
          <Switch
            checked={isYearly}
            onChange={setIsYearly}
            className={`${isYearly ? 'bg-blue-600' : 'bg-gray-200'}
              relative mx-4 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
          >
            <span
              aria-hidden="true"
              className={`${isYearly ? 'translate-x-5' : 'translate-x-0'}
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
            />
          </Switch>
          <span className={`font-medium ${isYearly ? 'text-blue-600' : 'text-gray-500'}`}>
            Yearly (Save 2 Months)
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Feature</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <span className="block text-lg font-bold text-gray-800 dark:text-white">Standard</span>
                  <span className="block text-xl font-bold text-blue-600">
                    ${isYearly ? plans.standard.price * 10 : plans.standard.price}
                  </span>
                  <span className="block text-xs">/{isYearly ? 'year' : 'mo'}</span>
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <span className="block text-lg font-bold text-gray-800 dark:text-white">Business</span>
                  <span className="block text-xl font-bold text-blue-600">
                    ${isYearly ? plans.business.price * 10 : plans.business.price}
                  </span>
                  <span className="block text-xs">/{isYearly ? 'year' : 'mo'}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {features.map((feature, idx) => (
                <tr key={feature.name} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{feature.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {typeof feature.standard === 'boolean' ? (
                      feature.standard ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <IconX className="h-5 w-5 text-red-500 mx-auto" />
                    ) : (
                      <span className="text-gray-600 dark:text-gray-300">{feature.standard}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {typeof feature.business === 'boolean' ? (
                      feature.business ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <IconX className="h-5 w-5 text-red-500 mx-auto" />
                    ) : (
                      <span className="text-gray-600 dark:text-gray-300">{feature.business}</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Footer row for buttons */}
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td className="px-6 py-4"></td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleUpgrade(plans.standard.name, isYearly ? plans.standard.price * 10 : plans.standard.price)}
                    disabled={planId === 'standard'}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {planId === 'standard' ? 'Current Plan' : 'Upgrade'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleUpgrade(plans.business.name, isYearly ? plans.business.price * 10 : plans.business.price)}
                    disabled={planId === 'business'}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {planId === 'business' ? 'Current Plan' : 'Upgrade'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ModalBase>
  );
};

const BackupModal = ({ onClose, lastBackupDate, onBackupSuccess }: { 
  onClose: () => void, 
  lastBackupDate: string | null,
  onBackupSuccess: () => void 
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [opError, setOpError] = useState("");

  const lastBackupDateObj = lastBackupDate ? new Date(lastBackupDate) : null;

  const handleBackup = async () => {
    setIsBackingUp(true);
    setOpError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      await fetch('/api/settings/backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      onBackupSuccess(); // Call the prop function to refetch settings
    } catch (err: any) {
      setOpError(err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("Are you sure? This will overwrite all current data. This action cannot be undone.")) {
      return;
    }
    
    setIsRestoring(true);
    setOpError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      
      await fetch('/api/settings/backup', {
        method: 'PUT', // Using PUT for restore
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.reload();
    } catch (err: any) {
      setOpError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <ModalBase title="Backup & Restore" onClose={onClose}>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-lg font-semibold">Cloud Backup</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Create a secure backup of all your data to the cloud.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Last Backup:</span>
            <span className="font-bold">
              {lastBackupDateObj ? dayjs(lastBackupDateObj).format('DD MMM YYYY, h:mm A') : 'No backup yet'}
            </span>
          </div>
          <button
            onClick={handleBackup}
            disabled={isBackingUp || isRestoring}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {isBackingUp ? "Backing up..." : "Back Up Now"}
          </button>
        </div>
        
        <div className="rounded-xl border border-red-500 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Restore Data</h3>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">
            Restoring will replace all current data. This cannot be undone.
          </p>
          <button
            onClick={handleRestore}
            disabled={isRestoring || isBackingUp || !lastBackupDateObj}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            {isRestoring ? "Restoring..." : "Restore from Last Backup"}
          </button>
        </div>
        {opError && <p className="text-sm text-red-600">{opError}</p>}
      </div>
    </ModalBase>
  );
};

const ActivityLogModal = ({ onClose }: { onClose: () => void }) => {
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState<Range[]>([
    {
      startDate: undefined,
      endDate: undefined,
      key: 'selection'
    }
  ]);
  
  const { data: teamData, error: teamError } = useSWR('/api/hr?view=employees', fetcher);
  
  const startDate = dateRange[0].startDate;
  const endDate = dateRange[0].endDate;
  const dateQuery = (startDate && endDate)
    ? `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    : "";
  const userQuery = filterUserId ? `&userId=${filterUserId}` : "";
  const { data: activities, error: activitiesError, mutate } = useSWR(
    `/api/settings/activity-log?limit=20${userQuery}${dateQuery}`, 
    fetcher
  );

  const handleDateSelect = (ranges: any) => {
    setDateRange([ranges.selection]);
  };
  
  return (
    <ModalBase title="Activity Log" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* --- Filter Bar --- */}
        <div className="flex flex-col md:flex-row gap-4">
          <FormSelect
            value={filterUserId || ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterUserId(e.target.value || null)}
            className="w-full"
          >
            <option value="">All Users</option>
            {teamData?.data?.map((user: any) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </FormSelect>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="flex-shrink-0 flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            <Calendar className="h-4 w-4" />
            <span>{startDate ? `${dayjs(startDate).format('MMM D')} - ${dayjs(endDate).format('MMM D')}` : "Filter by Date"}</span>
          </button>
        </div>

        {/* --- Date Picker --- */}
        {showDateFilter && (
          <div className="flex flex-col items-center">
            <DateRangePicker
              onChange={handleDateSelect}
              moveRangeOnFirstSelection={false}
              ranges={dateRange}
              rangeColors={['#0b65dd']}
            />
            <button
              onClick={() => {
                setShowDateFilter(false);
                mutate(); // Re-fetch data with new date range
              }}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Apply Dates
            </button>
          </div>
        )}

        {/* --- Activity List --- */}
        <div className="max-h-[400px] overflow-y-auto">
          {activitiesError && <ErrorDisplay error={activitiesError as Error} onRetry={mutate} />}
          {!activities && !activitiesError && <LoadingSpinner />}
          {activities?.logs?.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <FileX className="h-16 w-16" />
              <p className="mt-4 font-semibold">No Activity Found</p>
              <p className="text-sm">Try adjusting your filters.</p>
            </div>
          )}
          {activities?.logs?.map((log: any) => (
            <div key={log.id} className="flex gap-4 border-b py-4 dark:border-gray-700">
              <div className="flex-shrink-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <User className="h-5 w-5" />
                </span>
              </div>
              <div>
                <p className="font-medium dark:text-white">{log.description}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {log.userName} 窶｢ {dayjs(log.timestamp).format('DD MMM YYYY, h:mm A')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalBase>
  );
};

const DeleteStoreModal = ({ onClose }: { onClose: () => void }) => {
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const confirmString = "im deleting my account hantikaab";
  const canDelete = password.length > 0 && confirmText === confirmString;
  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();
      const res = await fetch('/api/settings', {
        method: 'DELETE',
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete store.");
      }
      await auth.signOut();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <ModalBase title="Confirm Account Deletion" onClose={onClose} isDanger={true}>
      <div className="space-y-4">
        <p className="font-bold text-red-600">WARNING: THIS ACTION IS PERMANENT AND CANNOT BE UNDONE.</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This will delete your store, subscription, all products, sales, customers, and employee accounts.
        </p>
        <FormInput 
          label="Confirm Your Password"
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type <strong className="text-red-600">{confirmString}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 shadow-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleDelete}
          disabled={!canDelete || isDeleting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {isDeleting ? "Deleting..." : "I Understand, Delete My Account"}
        </button>
      </div>
    </ModalBase>
  );
};

// -----------------------------------------------------------------------------
// 統 Main Settings Page Component
// -----------------------------------------------------------------------------
export default function SettingsPage() {
  const { user, subscription } = useAuth(); // 'subscription' is the main STORES doc
  const { mutate } = useSWRConfig();
  const [isSaving, setIsSaving] = useState(false);
  
  // State for all modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isActivityLogModalOpen, setIsActivityLogModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // 'settings' data is ONLY for currencies, template, and backup date
  const { 
    data: settings, 
    error, 
    isLoading 
  } = useSWR(
    user ? `/api/settings` : null, 
    fetcher
  );

  // State for forms
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [store, setStore] = useState({ storeName: "", storePhone: "", storeAddress: "" });
  const [business, setBusiness] = useState({ currencies: ["USD"], invoiceTemplate: "default" });

  // Populate forms once data is loaded
  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || "", phone: (user as any).phone || "" });
    }

    // *** (FIX) Populate store info from 'subscription' (the stores doc) ***
    // This is the "real" data
    if (subscription) {
      setStore({
        // Read from the fields you have, fallback to 'name'
        storeName: subscription.storeName || subscription.name || "", 
        storePhone: subscription.storePhone || "",
        storeAddress: subscription.storeAddress || "",
      });
    }

    // Populate business settings ONLY from the 'settings' doc
    if (settings) {
      setBusiness({
        currencies: settings.currencies || ["USD"],
        invoiceTemplate: settings.invoiceTemplate || "default",
      });
    }
    // *** (FIX) Add 'subscription' to dependency array
  }, [user, settings, subscription]);

  // Plan & Permission Logic
  // *** (FIX #2) Changed planId to subscriptionType ***
  const dbPlan = subscription?.subscriptionType?.toLowerCase() || 'trial';
  let planId;
  switch (dbPlan) {
    case 'pro':
    case 'standard':
      planId = 'standard';
      break;
    case 'plan3':
    case 'business':
      planId = 'business';
      break;
    default:
      planId = 'trial';
  }
  
  const canUploadLogo = ['standard', 'business'].includes(planId);
  
  // *** START CORRECTION 1 ***
  const availableTemplates: { [key: string]: string[] } = {
    trial: ['default'],
    standard: ['default', 'modern'], // Modern for Standard
    business: ['default', 'modern', 'premium'], // Premium for Business
  };
  // *** END CORRECTION 1 ***

  const userAllowedTemplates = availableTemplates[planId] || ['default'];
  const isAdmin = user?.role === 'admin';

  // Save Handler
  const handleSave = async (payload: any) => {
    setIsSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");
      const token = await user.getIdToken();

      await fetch('/api/settings', {
        method: 'PUT',
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      
      // Mutate settings to refetch currencies/template if they were saved
      if (payload.currencies || payload.invoiceTemplate) {
        mutate('/api/settings'); 
      }

      // If store info or profile name was changed, we must reload
      // to update the 'subscription' or 'user' object from useAuth
      if (payload.name || payload.storeName) {
         window.location.reload();
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error as Error} />;

  return (
    <div className="mx-auto max-w-7xl p-4 pt-6 md:p-8 space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* --- Card 1: My Profile --- */}
      <Card title="My Profile" icon={User}>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(profile); }} className="space-y-4">
          <FormInput 
            label="Your Name" 
            value={profile.name} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, name: e.target.value })} 
          />
          <FormInput 
            label="Your Phone" 
            value={profile.phone} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, phone: e.target.value })} 
          />
          <FormButton isSaving={isSaving} text="Save Profile" />
        </form>
      </Card>

      {/* --- Card 2: Company Information --- */}
      {/* This form now saves to the 'store' state, which is read from the 'subscription' doc */}
      {(isAdmin || user?.role === 'manager' || user?.role === 'hr') && (
        <Card title="Company Information" icon={Store}>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(store); }} className="space-y-4">
            <FormInput 
              label="Company Name" 
              value={store.storeName} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStore({ ...store, storeName: e.target.value })} 
              disabled={!isAdmin} 
            />
            <FormInput 
              label="Company Phone" 
              value={store.storePhone} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStore({ ...store, storePhone: e.target.value })} 
              disabled={!isAdmin} 
            />
            <FormTextarea 
              label="Company Address" 
              value={store.storeAddress} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStore({ ...store, storeAddress: e.target.value })} 
              disabled={!isAdmin} 
            />
            {isAdmin ? (
              <FormButton isSaving={isSaving} text="Save Company Info" />
            ) : (
              <p className="text-sm text-gray-500">Only the store admin can edit company information.</p>
            )}
          </form>
        </Card>
      )}

      {/* --- Card 3: Business Settings --- */}
      {/* This form saves to the 'business' state, which is read from the 'settings' doc */}
      {(isAdmin || user?.role === 'manager' || user?.role === 'hr') && (
        <Card title="Business Settings" icon={FileText}>
          <form onSubmit={(e) => { e.preventDefault(); handleSave(business); }} className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company Logo</label>
              <div className="flex items-center gap-4">
                <img src={settings?.logoUrl || '/logo2.png'} alt="Logo" className="h-16 w-16 rounded-full object-cover bg-gray-100" />
                <button type="button" disabled={!canUploadLogo || isSaving || !isAdmin} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
                  <Upload className="h-4 w-4" /> Upload Logo
                </button>
              </div>
              {!canUploadLogo && <UpgradeNotice text="Upgrade to Standard or Business to upload a custom logo." onClick={() => setIsSubscriptionModalOpen(true)} />}
            </div>
            
            {/* Currency Checkboxes */}
            <CurrencyCheckboxGroup
              selectedCurrencies={business.currencies}
              onChange={(newCurrencies) => setBusiness({ ...business, currencies: newCurrencies })}
              disabled={!isAdmin}
            />
            
            {/* *** START CORRECTION 2 *** */}
            <FormSelect 
              label="PDF Invoice Template" 
              value={business.invoiceTemplate} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBusiness({ ...business, invoiceTemplate: e.target.value })} 
              disabled={!isAdmin}
            >
              <option value="default">Default</option>
              <option value="modern" disabled={!userAllowedTemplates.includes('modern')}>Modern (Standard+)</option>
              <option value="premium" disabled={!userAllowedTemplates.includes('premium')}>Premium (Business)</option>
            </FormSelect>
            {/* *** END CORRECTION 2 *** */}
            
            {!userAllowedTemplates.includes(business.invoiceTemplate) && (
              <UpgradeNotice text="Your plan does not include this template. It will revert to Default." onClick={() => setIsSubscriptionModalOpen(true)} />
            )}

            {isAdmin ? (
              <FormButton isSaving={isSaving} text="Save Business Settings" />
            ) : (
              <p className="text-sm text-gray-500">Only the store admin can edit business settings.</p>
            )}
          </form>
        </Card>
      )}

      {/* --- Modern Account & Data Card --- */}
      <Card title="Account & Data" icon={Database}>
        <div className="divide-y dark:divide-gray-700">
          <ListTile
            title="Manage Subscription"
            subtitle={`Your current plan is: ${planId.toUpperCase()}`}
            icon={Star}
            onClick={() => setIsSubscriptionModalOpen(true)}
          />
          <Link href="/hr?view=employees" passHref>
            <ListTile
              title="Manage Team & Roles"
              subtitle="Add or remove employees and change permissions"
              icon={ShieldCheck}
            />
          </Link>
          <ListTile
            title="Backup & Restore"
            subtitle={settings?.lastBackupDate ? `Last backup: ${dayjs(settings.lastBackupDate).format('DD MMM YYYY')}` : "Create or restore a cloud backup"}
            icon={RotateCcw}
            onClick={() => setIsBackupModalOpen(true)}
          />
          <ListTile
            title="View Activity Logs"
            subtitle="See a log of all actions taken by users"
            icon={Database}
            onClick={() => setIsActivityLogModalOpen(true)}
          />
          <ListTile
            title="Log Out"
            subtitle="Sign out of your account"
            icon={LogOut}
            onClick={() => auth.signOut()}
            color="text-red-600 dark:text-red-500"
          />
        </div>
      </Card>

      {/* --- Danger Zone --- */}
      {isAdmin && (
        <div className="mt-8 rounded-xl border border-red-500 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
          <h2 className="flex items-center gap-3 text-lg font-bold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </h2>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300">
            This action is permanent and cannot be undone. This will permanently delete your entire store, including all products, sales, customers, and employee data.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" /> Delete This Store
          </button>
        </div>
      )}

      {/* --- Modals --- */}
      {showDeleteModal && (
        <DeleteStoreModal onClose={() => setShowDeleteModal(false)} />
      )}
      
      {isSubscriptionModalOpen && (
        <SubscriptionModal 
          onClose={() => setIsSubscriptionModalOpen(false)}
          userName={profile.name}
          storeName={store.storeName}
        />
      )}

      {isActivityLogModalOpen && (
        <ActivityLogModal onClose={() => setIsActivityLogModalOpen(false)} />
      )}

      {isBackupModalOpen && (
        <BackupModal 
          onClose={() => setIsBackupModalOpen(false)} 
          lastBackupDate={settings?.lastBackupDate || null}
          onBackupSuccess={() => mutate('/api/settings')} // Re-fetch settings
        />
      )}
    </div>
  );
}