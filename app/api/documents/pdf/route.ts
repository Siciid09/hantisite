// File: app/api/documents/pdf/route.ts
// Description: A single "Master" endpoint to generate ALL PDFs for the mobile app.

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.split("Bearer ")[1];
    await authAdmin.verifyIdToken(token);

    // 2. Get Parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'sale', 'purchase', 'return'
    const id = searchParams.get("id");

    if (!id || !type) return NextResponse.json({ error: "Missing type or id" }, { status: 400 });

    // 3. Fetch Data based on Type
    let docData: any = {};
    let storeId = "";
    let title = "";
    let tableHead: string[] = [];
    let tableBody: any[] = [];
    let totals: { label: string, value: string, isBold?: boolean }[] = [];

    if (type === 'sale') {
      const docSnap = await firestoreAdmin.collection("sales").doc(id).get();
      if (!docSnap.exists) throw new Error("Sale not found");
      docData = docSnap.data();
      storeId = docData.storeId;
      title = "INVOICE";
      
      // Build Sale Table
      tableHead = ["Item", "Qty", "Price", "Total"];
      tableBody = docData.items.map((item: any) => [
        item.productName,
        item.quantity,
        Number(item.pricePerUnit).toFixed(2),
        Number((item.quantity * item.pricePerUnit) || 0).toFixed(2)
      ]);
      
      // Build Sale Totals
      const curr = docData.invoiceCurrency || "USD";
      totals = [
        { label: "Total:", value: `${Number(docData.totalAmount).toFixed(2)} ${curr}` },
        { label: "Paid:", value: `${Number(docData.amountPaid || docData.totalPaid).toFixed(2)} ${curr}` },
        { label: "Due:", value: `${Number(docData.debtAmount).toFixed(2)} ${curr}`, isBold: true },
      ];

    } else if (type === 'purchase') {
      const docSnap = await firestoreAdmin.collection("purchases").doc(id).get();
      if (!docSnap.exists) throw new Error("Purchase not found");
      docData = docSnap.data();
      storeId = docData.storeId;
      title = "PURCHASE ORDER";

      tableHead = ["Item", "Qty", "Cost", "Total"];
      tableBody = docData.items.map((item: any) => [
        item.productName,
        item.quantity,
        Number(item.costPrice || 0).toFixed(2),
        Number(item.subtotal || 0).toFixed(2)
      ]);

      const curr = docData.currency || "USD";
      totals = [
        { label: "Total:", value: `${Number(docData.totalAmount).toFixed(2)} ${curr}` },
        { label: "Paid:", value: `${Number(docData.paidAmount).toFixed(2)} ${curr}` },
        { label: "Remaining:", value: `${Number(docData.remainingAmount).toFixed(2)} ${curr}`, isBold: true },
      ];

    } else if (type === 'return') {
      const docSnap = await firestoreAdmin.collection("returns").doc(id).get();
      if (!docSnap.exists) throw new Error("Return not found");
      docData = docSnap.data();
      storeId = docData.storeId;
      title = "CREDIT NOTE";

      tableHead = ["Item Returned", "Qty", "Refund Amt"];
      tableBody = docData.itemsReturned.map((item: any) => [
        item.productName,
        item.quantity,
        Number(item.pricePerUnit * item.quantity).toFixed(2)
      ]);

      const curr = docData.refundCurrency || "USD";
      totals = [
        { label: "Total Refunded:", value: `${Number(docData.refundAmount).toFixed(2)} ${curr}`, isBold: true },
      ];
    }

    // 4. Fetch Store Info (Shared)
    const storeDoc = await firestoreAdmin.collection("stores").doc(storeId).get();
    const store = storeDoc.data() as any;

    // 5. Generate PDF
    const doc = new jsPDF();

    // -- Common Header --
    doc.setFontSize(22); doc.setTextColor(44, 62, 80); doc.text(title, 150, 20);
    doc.setFontSize(14); doc.setTextColor(0, 0, 0);
    doc.text(store.name || "My Store", 14, 20);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(store.address || "", 14, 26);
    doc.text(store.phone || "", 14, 31);
    
    doc.setDrawColor(200, 200, 200); doc.line(14, 36, 196, 36);

    // -- Common Info --
    doc.setTextColor(0, 0, 0);
    const refId = docData.invoiceId || id.substring(0,6).toUpperCase();
    doc.text(`Ref #: ${refId}`, 14, 46);
    
    const dateVal = docData.createdAt?.toDate ? docData.createdAt.toDate() : new Date();
    doc.text(`Date: ${dayjs(dateVal).format("DD MMM YYYY")}`, 14, 52);

    // -- Table --
    autoTable(doc, {
      startY: 60,
      head: [tableHead],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] } // Professional Blue
    });

    // -- Totals --
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    let currentY = finalY;

    totals.forEach((row) => {
      doc.setFont("helvetica", row.isBold ? "bold" : "normal");
      doc.text(row.label, 140, currentY);
      doc.text(row.value, 190, currentY, { align: 'right' });
      currentY += 6;
    });

    // 6. Output
    const pdfBuffer = doc.output("arraybuffer");
    return new NextResponse(pdfBuffer, { 
      status: 200,
      headers: { "Content-Type": "application/pdf" } 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}