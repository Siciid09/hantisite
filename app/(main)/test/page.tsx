"use client";

import { useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  limit,
} from "firebase/firestore";

// ✅ Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
};

// ✅ Safe Initialization (avoids duplicate app error)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ All your Firestore collections
const collectionsList = [
  "activities",
  "activity_logs",
  "branches",
  "businesses",
  "cash_registers",
  "categories",
  "counters",
  "debits",
  "discounts",
  "examm",
  "expenses",
  "feedback",
  "incomes",
  "inventory_alerts",
  "invoices",
  "links",
  "notes",
  "notifications",
  "payments",
  "plans",
  "products",
  "purchases",
  "refunds",
  "reports_cache",
  "returns",
  "roles_permissions",
  "sales",
  "settings",
  "stores",
  "subscriptions",
  "suppliers",
  "support",
  "transactions_summary",
  "users",
  "warehouses",
];

// ✅ Fetch only one sample document per collection and extract field names
async function fetchSampleStructure(db, onProgress) {
  const structure = {};
  let processed = 0;

  for (const name of collectionsList) {
    onProgress(`Checking collection: ${name}...`);
    try {
      const colRef = collection(db, name);
      const sampleQuery = query(colRef, limit(1));
      const sampleSnap = await getDocs(sampleQuery);

      if (!sampleSnap.empty) {
        const docSnap = sampleSnap.docs[0];
        const fieldNames = Object.keys(docSnap.data());
        structure[name] = fieldNames;
      } else {
        structure[name] = [];
      }
    } catch (err) {
      console.error(`Error reading collection ${name}:`, err);
      structure[name] = ["⚠️ Error fetching fields"];
    }

    processed++;
    onProgress(`Processed ${processed}/${collectionsList.length} collections`);
  }

  return structure;
}

// ✅ Main Page Component
export default function Page() {
  const [status, setStatus] = useState("Idle");
  const [loading, setLoading] = useState(false);
  const [jsonData, setJsonData] = useState(null);

  const handleFetch = async () => {
    try {
      setLoading(true);
      setStatus("Scanning Firestore structure...");
      const structure = await fetchSampleStructure(db, setStatus);

      setStatus("Converting to JSON...");
      const jsonString = JSON.stringify(structure, null, 2);
      setJsonData(jsonString);
      setStatus("✅ Done! Ready to download.");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error fetching structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!jsonData) return;
    const blob = new Blob([jsonData], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "firestore-sample-structure.json";
    link.click();
  };

  return (
    <div className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-4">Firestore Structure Export</h1>

      <button
        onClick={handleFetch}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Fetching..." : "Analyze Structure"}
      </button>

      <p className="mt-4 text-gray-700">{status}</p>

      {loading && (
        <div className="mt-4 flex justify-center">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {jsonData && (
        <button
          onClick={handleDownload}
          className="mt-5 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
        >
          Download JSON
        </button>
      )}
    </div>
  );
}
