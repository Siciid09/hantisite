// File: app/api/products/export/route.ts
//
// --- LATEST UPDATE ---
// 1. (FIX) Added a 'Product' interface to properly type the data.
// 2. (FIX) Casting the fetched data to this 'Product' type.
// 3. (FIX) This resolves all TypeScript errors like 'Property 'name'
//    does not exist'.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- Helper: checkAuth ---
async function checkAuth(request: NextRequest) {
  if (!authAdmin) throw new Error("Auth Admin is not initialized.");
  if (!firestoreAdmin) throw new Error("Firestore Admin is not initialized.");

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) throw new Error("Unauthorized.");
  
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  const storeId = userDoc.data()?.storeId;
  if (!storeId) throw new Error("User has no store.");
  
  return { uid, storeId, userName: userDoc.data()?.name || "System User" };
}

// --- Helper: Format Currency ---
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null) return "N/A";
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  };
  if (["USD", "EUR", "KES"].includes(currency)) {
    options.maximumFractionDigits = 2;
  }
  try {
    return new Intl.NumberFormat("en-US", options).format(amount);
  } catch (e) {
    return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
  }
};

// =============================================================================
// 🚀 GET - Generate and Stream a Report File
// =============================================================================
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await checkAuth(request);
    const { searchParams } = new URL(request.url);

    // 1. Get Filters from Query Params
    const format = searchParams.get("format") || "excel"; // 'excel' or 'pdf'
    const category = searchParams.get("category");
    const currency = searchParams.get("currency") || "USD";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 2. Build Firestore Query
    let query = firestoreAdmin.collection("products")
      .where("storeId", "==", storeId);

    if (category) {
      query = query.where("category", "==", category);
    }
    if (startDate) {
      query = query.where("createdAt", ">=", Timestamp.fromDate(dayjs(startDate).startOf('day').toDate()));
    }
    if (endDate) {
      query = query.where("createdAt", "<=", Timestamp.fromDate(dayjs(endDate).endOf('day').toDate()));
    }

    // --- THIS IS THE FIX ---
    // Define a type for the product to help TypeScript
    interface Product {
      id: string;
      name: string;
      category: string;
      quantity: number;
      salePrices?: { [key: string]: number };
      costPrices?: { [key: string]: number };
      createdAt: any; // Using 'any' for simplicity with Firestore Timestamps
    }

    // 3. Fetch ALL matching products (This is safe on the server)
    const snapshot = await query.get();
    
    // We must include the document 'id' and cast the data to our Product type
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Product)); // <-- Cast to the Product interface
    // --- END FIX ---

    if (products.length === 0) {
      return NextResponse.json({ error: "No products found for the selected filters." }, { status: 404 });
    }

    const fileName = `products_report_${currency}_${dayjs().format("YYYYMMDD")}`;

    // 4. Generate the file based on the requested format
    
    if (format === "excel") {
      // --- Generate Excel ---
      const dataToExport = products.map(p => ({
        ID: p.id,
        Name: p.name,
        Category: p.category,
        Quantity: p.quantity,
        [`Sale_${currency}`]: p.salePrices?.[currency] || 0,
        [`Cost_${currency}`]: p.costPrices?.[currency] || 0,
        CreatedAt: dayjs(p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt).format("YYYY-MM-DD")
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = [
        { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      
      // Generate the file buffer in memory
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      // 5. Return the file as a response
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
        },
      });

    } else {
      // --- Generate PDF ---
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Product Report", 14, 22);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${dayjs().format("MMM D, YYYY")}`, 14, 30);
      
      const tableColumns = ["ID", "Name", "Category", "Qty", `Sale (${currency})`, `Cost (${currency})`];
      const tableRows = products.map(p => [
        p.id.substring(0, 10) + "...",
        p.name,
        p.category || "N/A",
        p.quantity,
        formatCurrency(p.salePrices?.[currency], currency),
        formatCurrency(p.costPrices?.[currency], currency)
      ]);
      
      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      });
      
      // Generate the file buffer in memory
      const buffer = doc.output("arraybuffer");
      
      // 5. Return the file as a response
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
        },
      });
    }

  } catch (error: any) {
    console.error("[Products Export API GET] Error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to generate report. ${error.message}` }, { status: 500 });
  }
}