// File: lib/pdfService.ts
//
// --- FINAL VERSION (FIXED) ---
// 1. (FIX) Added nullish coalescing (e.g., 'sale.customerName || "N/A"')
//    to all 'doc.text()' calls. This prevents the 'Invalid arguments'
//    error if a value is null or undefined.
// 2. (FIX) Updated 'generateInvoicePdf' to read the new data structure:
//    - 'invoiceCurrency' instead of 'primaryCurrency'
//    - 'paymentLines' instead of 'paymentMethods'
// -----------------------------------------------------------------------------

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

// You must extend the jsPDF type to include the autoTable plugin
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Helper function to format currency
const formatCurrency = (amount: number | undefined | null, currency: string): string => {
  if (amount == null || amount === 0) {
     amount = 0;
  }
  const style = (currency === "USD" || currency === "EURO") ? "currency" : "decimal";
  const options: Intl.NumberFormatOptions = {
    style: style,
    minimumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
    maximumFractionDigits: (currency === "SLSH" || currency === "SOS" || currency === "BIRR") ? 0 : 2,
  };
  if (style === "currency") {
    options.currency = currency;
    options.currencyDisplay = "symbol";
  }
  const formatter = new Intl.NumberFormat("en-US", options);
  let formatted = formatter.format(amount);
  if (style === "decimal") {
    formatted = `${currency} ${formatted}`;
  }
  return formatted;
};

/**
 * Generates a PDF invoice.
 */
export const generateInvoicePdf = (data: any, storeInfo?: any) => {
  if (!data) return;

  const doc = new jsPDF();
  
  const business = storeInfo || {
    name: "HantiKaab Inc.",
    address: "Hargeisa, Somalia",
    phone: "+252 63 4000000",
  };
  
  // Use the new sale data structure
  const sale = {
    ...data,
    customerName: data.customerName || "Walk-in Customer",
    customerPhone: data.customerPhone || "N/A",
    invoiceId: data.invoiceId || `INV-N/A`,
    createdAt: data.createdAt || new Date().toISOString(),
    invoiceCurrency: data.invoiceCurrency || "USD",
    totalAmount: data.totalAmount || 0,
    totalPaid: data.totalPaid || 0,
    debtAmount: data.debtAmount || 0,
    paymentLines: data.paymentLines || [],
    items: data.items || [],
  };
  
  // --- 1. Header (FIXED with null checks) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("INVOICE", 190, 20, { align: "right" });

  doc.setFontSize(14);
  doc.text(business.name || "HantiKaab Inc.", 20, 20); // FIX
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(business.address || "Hargeisa, Somalia", 20, 27); // FIX
  doc.text(business.phone || "N/A", 20, 32); // FIX
  
  doc.setFontSize(10);
  doc.text(`Invoice #: ${sale.invoiceId}`, 190, 30, { align: "right" }); // FIX
  doc.text(`Date: ${dayjs(sale.createdAt).format("DD MMMM, YYYY")}`, 190, 35, { align: "right" });

  // --- 2. Bill To (FIXED with null checks) ---
  doc.setLineWidth(0.5);
  doc.line(20, 45, 190, 45); // Horizontal line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO:", 20, 52);
  doc.setFont("helvetica", "normal");
  doc.text(sale.customerName || "Walk-in Customer", 20, 57); // FIX
  doc.text(sale.customerPhone || "N/A", 20, 62); // FIX
  doc.line(20, 70, 190, 70); // Horizontal line

  // --- 3. Items Table (FIXED for new data structure) ---
  const tableHead = [["Description", "Qty", "Unit Price", "Total"]];
  const tableBody = sale.items.map((item: any) => [
    item.productName,
    item.quantity,
    formatCurrency(item.pricePerUnit, sale.invoiceCurrency), // Use invoiceCurrency
    formatCurrency(item.subtotal, sale.invoiceCurrency), // Use pre-calculated subtotal
  ]);

  autoTable(doc, {
    startY: 75,
    head: tableHead,
    body: tableBody,
    headStyles: {
      fillColor: [11, 101, 221],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 10,
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    didDrawPage: (data) => {
      // --- 4. Totals (FIXED for new data structure) ---
      const tableEndY = data.table.finalY || 80;
      const rightAlignX = 190;
      let currentY = tableEndY + 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // Subtotal (TotalAmount is the subtotal)
      doc.text(`Total Amount:`, 150, currentY, { align: 'right' });
      doc.text(formatCurrency(sale.totalAmount, sale.invoiceCurrency), rightAlignX, currentY, { align: 'right' });
      currentY += 7;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Paid:", 150, currentY, { align: 'right' });
      currentY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      // Payments (actual currencies received)
      if (sale.paymentLines.length > 0) {
        for (const pm of sale.paymentLines) {
          doc.text(`Paid (${pm.method}):`, 150, currentY, { align: 'right' });
          doc.text(formatCurrency(pm.amount, pm.currency), rightAlignX, currentY, { align: 'right' });
          currentY += 5;
        }
      } else {
        doc.text(`No payment made`, 150, currentY, { align: 'right' });
        currentY += 5;
      }
      
      // Total Due
      currentY += 5;
      const boxHeight = 14; // Simpler box
      
      doc.setFillColor(11, 101, 221); // Blue color
      doc.rect(120, currentY, 70, boxHeight, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      
      currentY += 9; // Center text in box
      doc.text(`AMOUNT DUE:`, 148, currentY, { align: 'right' });
      doc.text(formatCurrency(sale.debtAmount, sale.invoiceCurrency), rightAlignX, currentY, { align: 'right' });


      // --- 5. Footer ---
      doc.setTextColor(0, 0, 0); // Reset text color
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const pageHeight = doc.internal.pageSize.height;
      doc.text("Thank you for your business!", doc.internal.pageSize.width / 2, pageHeight - 15, { align: "center" });
    }
  });

  // --- 6. Save the file ---
  doc.save(`Invoice-${sale.invoiceId}.pdf`);
};