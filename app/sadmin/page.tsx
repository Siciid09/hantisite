"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from '@/lib/firebaseConfig';

// --- Icon Imports ---
import { 
  LayoutDashboard, Store, CreditCard, Megaphone, LifeBuoy, LogOut,
  ChevronLeft, X, Trash2, Send, Loader2, Check, User, DollarSign,
  Package, ArrowRight, Send as SendIcon, Calendar, CheckSquare, Square,
  MoreHorizontal, RefreshCw
} from 'lucide-react';

// --- Helper Functions ---
const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};
const formatDate = (dateString?: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  // FIX: Check if the date is valid before converting
  if (isNaN(date.getTime())) return ""; 
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD for input
};
const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
};

// --- API Helper ---
async function sadminFetch(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  const token = await user.getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`/api/sadmin${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
  return data;
}

// =============================================================================
// 1. LOGIN COMPONENT
// =============================================================================
function SAdminLogin({ onLoginSuccess, setError, error }: {
  onLoginSuccess: (user: FirebaseUser) => void;
  setError: (err: string | null) => void;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(firestore, 'users', userCredential.user.uid));
      
      if (userDoc.exists() && userDoc.data().role === 'sadmin') {
        userCredential.user.getIdToken().then(token => {
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
        });
        onLoginSuccess(userCredential.user);
      } else {
        await signOut(auth);
        setError("Access Denied. You do not have Super Admin privileges.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-6 dark:text-white">Super Admin</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <input
            type="email"
            placeholder="sadmin@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
            required
          />
          <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center disabled:opacity-50" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// 2. MAIN PAGE LAYOUT & TABS
// =============================================================================
const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { key: 'storeManagement', label: 'Store Management', icon: <Store className="w-5 h-5" /> },
  { key: 'payments', label: 'Payments', icon: <CreditCard className="w-5 h-5" /> },
  { key: 'notifications', label: 'Notifications', icon: <Megaphone className="w-5 h-5" /> },
  { key: 'support', label: 'Support', icon: <LifeBuoy className="w-5 h-5" /> },
];

export default function SuperAdminPage() {
  const [sadmin, setSadmin] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState('dashboard');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'sadmin') {
            setSadmin(user);
          } else {
            await signOut(auth); setError("Access Denied."); setSadmin(null);
          }
        } catch (err) {
          await signOut(auth); setSadmin(null);
        }
      } else {
        setSadmin(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const handleLogout = async () => {
    await signOut(auth);
    await fetch('/api/auth/session', { method: 'DELETE' });
    setSadmin(null);
    setView('dashboard');
  };

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center dark:bg-gray-900"><Loader2 className="h-10 w-10 animate-spin dark:text-white"/></div>;
  }

  if (!sadmin) {
    return <SAdminLogin onLoginSuccess={setSadmin} setError={setError} error={error} />;
  }
  
  const renderView = () => {
    switch (view) {
      case 'dashboard': return <ViewDashboard />;
      case 'storeManagement': return <ViewStoreManagement setView={setView} setSelectedStoreId={setSelectedStoreId} />;
      case 'fullStoreView': return <ViewFullStore storeId={selectedStoreId} setView={setView} />;
      case 'payments': return <ViewPayments />;
      case 'notifications': return <ViewNotifications />;
      case 'support': return <ViewSupport />;
      default: return <ViewDashboard />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <nav className="w-64 bg-white dark:bg-gray-800 flex flex-col flex-shrink-0 border-r dark:border-gray-700">
        <div className="p-4 text-2xl font-bold border-b dark:border-gray-700">S-Admin</div>
        <div className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`flex items-center space-x-3 p-3 w-full text-left rounded-lg ${
                view === item.key 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => { setView(item.key); setSelectedStoreId(''); }}
            >
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="p-2 border-t dark:border-gray-700">
          <button className="flex items-center space-x-3 p-3 w-full text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" onClick={handleLogout}>
            <LogOut className="w-5 h-5" /> <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white dark:bg-gray-800 p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-semibold capitalize">{view.replace(/([A-Z])/g, ' $1')}</h1>
          <div>Welcome, {sadmin.email}</div>
        </header>
        
        <div className="p-4 md:p-6 lg:p-8 flex-1">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

// --- Loading & Error Components ---
function FullPageLoader() {
  return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin"/></div>;
}
function ErrorDisplay({ message }: { message: string }) {
  return <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">{message}</div>;
}

// --- Reusable Card & Table ---
function Card({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>{children}</div>;
}
function CardHeader({ title, children }: { title: string, children?: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex justify-between items-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
function CardContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}
function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {children}
      </table>
    </div>
  );
}
function TableTh({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${className}`}>{children}</th>;
}
function TableTd({ children, className = "", ...props }: React.TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td 
      className={`px-6 py-4 whitespace-nowrap text-sm ${className}`} 
      {...props}
    >
      {children}
    </td>
  );
}

// =============================================================================
// 3. PAGE COMPONENTS
// =============================================================================

// --- 匠 View: Dashboard ---
function ViewDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sadminFetch('?action=getDashboardStats')
      .then(data => setStats(data.stats))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  const statItems = [
    { title: "Total Stores", value: stats?.totalStores || 0, icon: <Store className="text-blue-500" /> },
    { title: "Active Stores", value: stats?.activeStores || 0, icon: <Check className="text-green-500" /> },
    { title: "Total Revenue", value: formatCurrency(stats?.totalRevenue || 0), icon: <DollarSign className="text-yellow-500" /> },
    { title: "Pending Tickets", value: stats?.pendingTickets || 0, icon: <LifeBuoy className="text-red-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map(item => (
          <Card key={item.title}>
            <CardContent className="flex items-center space-x-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">{item.icon}</div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.title}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- 宵 View: Store Management (UPDATED) ---
function ViewStoreManagement({ setSelectedStoreId, setView }: {
  setSelectedStoreId: (id: string) => void;
  setView: (view: string) => void;
}) {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null); // To show spinner on specific row
  
  const fetchStores = () => {
    setLoading(true);
    sadminFetch('?action=getAllStores')
      .then(data => setStores(data.stores))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // --- Inline Update Handlers ---
  const handleInlineUpdate = async (storeId: string, action: string, data: any) => {
    setUpdatingId(storeId);
    try {
      await sadminFetch('', {
        method: 'PUT',
        body: JSON.stringify({ action, data: { storeId, ...data } })
      });
      // Update local state without refetching for speed
      setStores(prev => prev.map(s => {
         if (s.id !== storeId) return s;
         if (action === 'changePlan') return { ...s, plan: data.newPlan };
         if (action === 'updateStoreStatus') return { ...s, status: data.status };
         if (action === 'updateExpiryDate') return { ...s, expiryDate: data.newExpiryDate };
         return s;
      }));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // --- Bulk Selection Handlers ---
  const toggleSelectAll = () => {
    if (selectedIds.size === stores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stores.map(s => s.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (actionType: 'status' | 'plan' | 'expiry' | 'delete', value?: string) => {
    if (!window.confirm(`Apply to ${selectedIds.size} stores?`)) return;
    setLoading(true);
    
    try {
      const promises = Array.from(selectedIds).map(id => {
        if (actionType === 'delete') {
            return sadminFetch(`?action=deleteStore&id=${id}`, { method: 'DELETE' });
        }
        
        let action = '';
        let data: any = { storeId: id };

        if (actionType === 'status') { action = 'updateStoreStatus'; data.status = value; }
        if (actionType === 'plan') { action = 'changePlan'; data.newPlan = value; }
        if (actionType === 'expiry') { action = 'updateExpiryDate'; data.newExpiryDate = new Date(value!).toISOString(); }

        return sadminFetch('', { method: 'PUT', body: JSON.stringify({ action, data }) });
      });

      await Promise.all(promises);
      fetchStores();
      setSelectedIds(new Set()); // Clear selection
    } catch (err: any) {
      alert(`Bulk action failed: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading && stores.length === 0) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-4">
      {/* --- BULK ACTION BAR --- */}
      {selectedIds.size > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-wrap items-center gap-4 transition-all animate-in slide-in-from-top-2">
          <span className="font-bold text-blue-800 dark:text-blue-200">{selectedIds.size} Selected</span>
          <div className="h-6 w-px bg-blue-200 dark:bg-blue-700 mx-2 hidden md:block"></div>
          
          <select 
            className="px-3 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
            onChange={(e) => { if(e.target.value) handleBulkAction('status', e.target.value); e.target.value = ''; }}
          >
            <option value="">Set Status...</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </select>

          <select 
            className="px-3 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
            onChange={(e) => { if(e.target.value) handleBulkAction('plan', e.target.value); e.target.value = ''; }}
          >
            <option value="">Set Plan...</option>
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="business">Business</option>
          </select>
          
          <div className="flex items-center gap-2">
            <span className="text-sm">Set Expiry:</span>
            <input 
              type="date" 
              className="px-3 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
              onChange={(e) => { if(e.target.value) handleBulkAction('expiry', e.target.value); }}
            />
          </div>

          <button 
            onClick={() => handleBulkAction('delete')}
            className="ml-auto px-4 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Selected
          </button>
        </div>
      )}

      <Card>
        <CardHeader title="Store Management">
            <button onClick={fetchStores} className="p-2 hover:bg-gray-100 rounded-full"><RefreshCw className="w-5 h-5"/></button>
        </CardHeader>
        <TableWrapper>
          <thead>
            <tr>
              <TableTh className="w-10 text-center">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === stores.length && stores.length > 0} 
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </TableTh>
              <TableTh>Store Info</TableTh>
              <TableTh>Plan</TableTh>
              <TableTh>Status</TableTh>
              <TableTh>Expiry Date</TableTh>
              <TableTh>Actions</TableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {stores.map((store) => (
              <tr key={store.id} className={selectedIds.has(store.id) ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                {/* Checkbox */}
                <TableTd className="text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(store.id)} 
                    onChange={() => toggleSelectOne(store.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </TableTd>

                {/* Store Info */}
                <TableTd>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{store.name}</div>
                    <div className="text-xs text-gray-500">{store.ownerEmail}</div>
                    <div className="text-xs text-gray-400 font-mono">{store.id}</div>
                  </div>
                </TableTd>

                {/* Plan Dropdown */}
                <TableTd>
                  {updatingId === store.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : (
                    <select
                      value={store.plan || 'trial'}
                      onChange={(e) => handleInlineUpdate(store.id, 'changePlan', { newPlan: e.target.value })}
                      className="block w-full py-1 pl-2 pr-6 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-transparent dark:bg-gray-800 dark:border-gray-600"
                    >
                      <option value="trial">Trial</option>
                      <option value="standard">Standard</option>
                      <option value="business">Business</option>
                    </select>
                  )}
                </TableTd>

                {/* Status Dropdown */}
                <TableTd>
                  <select
                    value={store.status || 'active'}
                    onChange={(e) => handleInlineUpdate(store.id, 'updateStoreStatus', { status: e.target.value })}
                    className={`block w-full py-1 pl-2 pr-6 text-sm font-medium rounded-md border-0 ring-1 ring-inset focus:ring-2 
                      ${store.status === 'active' ? 'text-green-700 bg-green-50 ring-green-600/20' : 
                        store.status === 'suspended' ? 'text-red-700 bg-red-50 ring-red-600/20' : 
                        'text-gray-700 bg-gray-50 ring-gray-600/20'}`}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="closed">Closed</option>
                  </select>
                </TableTd>

                {/* Date Picker */}
                <TableTd>
                   <input
                    type="date"
                    value={formatDate(store.expiryDate)}
                    onChange={(e) => handleInlineUpdate(store.id, 'updateExpiryDate', { newExpiryDate: new Date(e.target.value).toISOString() })}
                    className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-transparent dark:bg-gray-800 dark:border-gray-600"
                  />
                </TableTd>

                {/* View Button */}
                <TableTd>
                  <button 
                    onClick={() => { setSelectedStoreId(store.id); setView('fullStoreView'); }} 
                    className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="View Full Details"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </TableTd>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </Card>
    </div>
  );
}

// --- 小 View: Full Store Details ---
function ViewFullStore({ storeId, setView }: {
  storeId: string;
  setView: (view: string) => void;
}) {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [newPlan, setNewPlan] = useState('');

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    sadminFetch(`?action=getStoreDetails&storeId=${storeId}`)
      .then(data => {
        setStore(data.store);
        setNewExpiry(data.store.expiryDate ? data.store.expiryDate.split('T')[0] : '');
        setNewPlan(data.store.plan || '');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [storeId]);
  
  const handleUpdate = (action: string, data: any) => {
    sadminFetch('', {
        method: 'PUT',
        body: JSON.stringify({ action, data: { storeId, ...data } })
    }).then(() => alert('Store updated!'))
      .catch(err => alert(`Error: ${err.message}`));
  };
  
  const handleDeleteStore = () => {
    if (!window.confirm(`!!! DESTRUCTIVE ACTION !!!\nAre you sure you want to delete store: ${store.name} (${store.id})?`)) return;
    
    sadminFetch(`?action=deleteStore&id=${storeId}`, { method: 'DELETE' })
      .then(() => {
        alert('Store deleted successfully.');
        setView('storeManagement');
      })
      .catch(err => alert(`Failed to delete store: ${err.message}`));
  };

  if (loading) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;
  if (!store) return <p>Store not found.</p>;

  const statItems = [
    { title: "Total Sales", value: store.activity.totalSales, icon: <DollarSign /> },
    { title: "Total Products", value: store.activity.totalProducts, icon: <Package /> },
    { title: "Total Users", value: store.users.length, icon: <User /> },
  ];

  return (
    <div className="space-y-6">
      <button onClick={() => setView('storeManagement')} className="text-blue-500 mb-4 flex items-center text-sm font-medium">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to all stores
      </button>

      <Card>
        <CardHeader title={store.name}>
          <span className={`px-2 py-1 rounded-full text-sm font-medium ${
            store.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>{store.status}</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p><strong>Owner:</strong> {store.ownerName}</p>
              <p><strong>Email:</strong> {store.ownerEmail}</p>
              <p><strong>Store ID:</strong> {store.id}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {statItems.map(item => (
                <div key={item.title} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  {item.icon}
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader title="Admin Actions" />
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Set Expiry Date</label>
            <input 
                type="date" 
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button onClick={() => handleUpdate('updateExpiryDate', { newExpiryDate: new Date(newExpiry).toISOString() })} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Update Expiry</button>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Change Plan</label>
            <select 
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="trial">Trial</option>
              <option value="standard">Standard</option>
              <option value="business">Business</option>
            </select>
            <button onClick={() => handleUpdate('changePlan', { newPlan })} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Update Plan</button>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-red-600">Danger Zone</label>
             <button onClick={handleDeleteStore} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Delete This Store</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- 諜 View: Payments ---
function ViewPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sadminFetch('?action=getPayments')
      .then(data => setPayments(data.payments))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <Card>
      <CardHeader title="Payments & Subscriptions" />
      <TableWrapper>
        <thead>
          <tr>
            <TableTh>Date</TableTh>
            <TableTh>Store ID</TableTh>
            <TableTh>Amount</TableTh>
            <TableTh>Plan</TableTh>
            <TableTh>Method</TableTh>
            <TableTh>Status</TableTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {payments.length === 0 ? (
            <tr><TableTd colSpan={6} className="text-center text-gray-500">No payments found.</TableTd></tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id}>
                <TableTd>{formatDate(p.createdAt)}</TableTd>
                <TableTd>{p.storeId}</TableTd>
                <TableTd>{formatCurrency(p.amount, p.currency)}</TableTd>
                <TableTd>{p.planId || 'N/A'}</TableTd>
                <TableTd>{p.method || 'N/A'}</TableTd>
                <TableTd><span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">{p.status}</span></TableTd>
              </tr>
            ))
          )}
        </tbody>
      </TableWrapper>
    </Card>
  );
}

// --- 討 View: Notifications ---
function ViewNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchNotifications = () => {
    sadminFetch('?action=getNotifications')
      .then(data => setNotifications(data.notifications))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  
  useEffect(() => {
    fetchNotifications();
    sadminFetch('?action=getAllStores').then(data => setStores(data.stores));
  }, []);

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this notification?")) return;
    sadminFetch(`?action=deleteNotification&id=${id}`, { method: 'DELETE' })
      .then(() => fetchNotifications())
      .catch(err => alert(`Error: ${err.message}`));
  };

  if (loading && notifications.length === 0) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Send Notification">
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            Create New
          </button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create a new notification to send to all or specific stores. 
            This saves to the database. True push notifications (FCM) require a separate setup.
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader title="Sent Notifications" />
        <TableWrapper>
          <thead><tr>
            <TableTh>Title</TableTh>
            <TableTh>Target</TableTh>
            <TableTh>Date</TableTh>
            <TableTh>Actions</TableTh>
          </tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((item) => (
              <tr key={item.id}>
                <TableTd className="font-medium">{item.title}</TableTd>
                <TableTd>{item.targetType === 'all' ? 'All Stores' : `${item.targetStores.length} stores`}</TableTd>
                <TableTd>{formatDateTime(item.createdAt)}</TableTd>
                <TableTd>
                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </TableTd>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </Card>
      
      {showModal && (
        <NotificationForm 
          stores={stores}
          onClose={() => setShowModal(false)}
          onSave={() => { fetchNotifications(); setShowModal(false); }}
        />
      )}
    </div>
  );
}

function NotificationForm({ stores, onClose, onSave }: {
  stores: any[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState('all'); // 'all' or 'specific'
  const [targetStores, setTargetStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCheckbox = (storeId: string) => {
    setTargetStores(prev => 
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sadminFetch('', {
        method: 'POST',
        body: JSON.stringify({
          action: 'createNotification',
          data: { title, message, targetType, targetStores }
        })
      });
      onSave();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-bold">Create Notification</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 min-h-[100px]" required />
            </div>
            <div>
              <label className="block text-sm font-medium">Target</label>
              <div className="flex space-x-4 mt-1">
                <label><input type="radio" name="targetType" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} /> All Stores</label>
                <label><input type="radio" name="targetType" value="specific" checked={targetType === 'specific'} onChange={() => setTargetType('specific')} /> Specific Stores</label>
              </div>
            </div>
            
            {targetType === 'specific' && (
              <div className="h-40 overflow-y-auto border rounded-lg p-2 dark:border-gray-600 space-y-1">
                {stores.map(store => (
                  <label key={store.id} className="flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <input type="checkbox" checked={targetStores.includes(store.id)} onChange={() => handleCheckbox(store.id)} />
                    <span>{store.name}</span>
                  </label>
                ))}
              </div>
            )}
            
            <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center disabled:opacity-50" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Notification
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


// --- 町 View: Support ---
function ViewSupport() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (selectedTicketId) {
    return <ViewTicketDetails ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }
  return <ViewTicketList onSelectTicket={setSelectedTicketId} />;
}

function ViewTicketList({ onSelectTicket }: { onSelectTicket: (id: string) => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sadminFetch('?action=getSupportTickets')
      .then(data => setTickets(data.tickets))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <Card>
      <CardHeader title="Support Tickets" />
      <TableWrapper>
        <thead>
          <tr>
            <TableTh>User</TableTh>
            <TableTh>Subject</TableTh>
            <TableTh>Status</TableTh>
            <TableTh>Last Update</TableTh>
            <TableTh>Actions</TableTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {tickets.length === 0 ? (
            <tr><TableTd colSpan={5} className="text-center text-gray-500">No support tickets found.</TableTd></tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id}>
                <TableTd>{ticket.userName || 'N/A'}</TableTd>
                <TableTd className="font-medium">{ticket.subject}</TableTd>
                <TableTd><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">{ticket.status}</span></TableTd>
                <TableTd>{formatDateTime(ticket.updatedAt || ticket.createdAt)}</TableTd>
                <TableTd>
                  <button onClick={() => onSelectTicket(ticket.id)} className="text-blue-600 hover:underline text-sm font-medium">View</button>
                </TableTd>
              </tr>
            ))
          )}
        </tbody>
      </TableWrapper>
    </Card>
  );
}

function ViewTicketDetails({ ticketId, onBack }: { ticketId: string, onBack: () => void }) {
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const fetchTicket = () => {
    setLoading(true);
    sadminFetch(`?action=getTicketDetails&ticketId=${ticketId}`)
      .then(data => {
        setTicket(data.ticket);
        setMessages(data.messages);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(fetchTicket, [ticketId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setReplying(true);
    
    try {
      const data = await sadminFetch('', {
        method: 'POST',
        body: JSON.stringify({ action: 'createTicketResponse', data: { ticketId, message: reply } })
      });
      // The API returns a non-timestamped object, let's create a client version
      const optimisticMessage = {
        ...data.message,
        text: reply,
        senderName: 'S-Admin',
        senderId: auth.currentUser?.uid,
        sentAt: new Date().toISOString() 
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setTicket((prev:any) => ({ ...prev, status: 'in_progress' }));
      setReply("");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setReplying(false);
    }
  };
  
  const handleUpdateStatus = async (status: 'closed' | 'open') => {
    sadminFetch('', {
      method: 'PUT',
      body: JSON.stringify({ action: 'updateTicketStatus', data: { ticketId, status } })
    }).then(() => setTicket((prev:any) => ({ ...prev, status })))
      .catch(err => alert(`Error: ${err.message}`));
  };

  if (loading) return <FullPageLoader />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <Card>
      <div className="p-4 border-b dark:border-gray-700">
        <button onClick={onBack} className="text-blue-500 mb-2 flex items-center text-sm font-medium">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to all tickets
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-1">{ticket.subject}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">From: {ticket.userName || 'N/A'}</p>
          </div>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">{ticket.status}</span>
        </div>
      </div>
      
      {/* Messages Thread */}
      <div className="h-96 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-lg ${msg.senderId === auth.currentUser?.uid ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
              <p className="text-sm font-medium">{msg.senderName}</p>
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs opacity-70 mt-1 text-right">{formatDateTime(msg.sentAt)}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t dark:border-gray-700 space-y-4">
        <form onSubmit={handleReply} className="flex space-x-2">
          <input 
            type="text" value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            disabled={replying}
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center disabled:opacity-50" disabled={replying}>
            {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
          </button>
        </form>
        
        <div className="flex justify-end">
          {ticket.status !== 'closed' ? (
            <button onClick={() => handleUpdateStatus('closed')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Close Ticket</button>
          ) : (
            <button onClick={() => handleUpdateStatus('open')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Re-open Ticket</button>
          )}
        </div>
      </div>
    </Card>
  );
}