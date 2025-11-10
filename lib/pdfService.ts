// File: lib/pdfService.ts
//
// --- FINAL VERSION (FIXED) ---
// 1. (FIX) Removed the extra "}" at the end of the file that was
//    causing a syntax error and preventing the code from compiling.
// 2. (FIX) The 'didDrawPage' function correctly places the summary
//    dynamically below the table, no matter how many items.
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
    // --- (FIX) Add salesperson fields ---
    salespersonName: data.salespersonName || "N/A",
    salesperson: data.salesperson || "N/A",
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
  // ...
  doc.setFontSize(10);
  doc.text(`Invoice #: ${sale.invoiceId}`, 190, 30, { align: "right" }); // FIX
  doc.text(`Date: ${dayjs(sale.createdAt).format("DD MMMM, YYYY")}`, 190, 35, { align: "right" });
  // --- (FIX) Add Salesperson line ---
  doc.text(`Salesperson: ${sale.salespersonName || sale.salesperson || "N/A"}`, 190, 40, { align: "right" });

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
  autoTable(doc, {
    startY: 75,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: sale.items.map((item: any) => [
      item.productName || "",
      item.quantity || 0,
      formatCurrency(item.pricePerUnit, sale.invoiceCurrency),
      formatCurrency(item.subtotal, sale.invoiceCurrency),
    ]),
    headStyles: {
      fillColor: [11, 101, 221],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center', // Default for headers
    },
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 90 },     // Description (Content)
      1: { halign: 'center', cellWidth: 20 },   // Qty (Content)
      // --- FIX #1: Centered Unit Price content to match header ---
      2: { halign: 'center', cellWidth: 35 },  // Unit Price (Content)
      3: { halign: 'right', cellWidth: 35 },    // Total (Content)
    },
    tableWidth: 180,

    // --- FIX #2: Hook to align specific headers ---
    didParseCell: (data) => {
      // We only care about the header row
      if (data.row.section === 'head') {
        // Align "Description" header (col 0) to the left
        if (data.column.index === 0) {
          data.cell.styles.halign = 'left';
        }
        // Align "Total" header (col 3) to the right
        if (data.column.index === 3) {
          data.cell.styles.halign = 'right';
        }
        // Columns 1 (Qty) and 2 (Unit Price) will use the 'center'
        // alignment from 'headStyles' by default.
      }
    },

    // --- THIS IS THE AUTOMATED, FLEXIBLE PART ---
    didDrawPage: (data) => {
      // 1. Get the final Y position of the table (where it ends)
      const tableEndY = data.table.finalY || 80;
      const labelX = 140;
      const valueX = 190;
      
      // 2. Set the starting Y for the summary to be 25px BELOW the table
      let currentY = tableEndY + 25;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      doc.text(`Total Amount:`, labelX, currentY);
      doc.text(formatCurrency(sale.totalAmount, sale.invoiceCurrency), valueX, currentY, { align: 'right' });
      currentY += 8;

      doc.setFont("helvetica", "bold");
      doc.text("Paid:", labelX, currentY);
      currentY += 8;
      doc.setFont("helvetica", "normal");

      if (sale.paymentLines.length > 0) {
        for (const pm of sale.paymentLines) {
          doc.text(`Paid (${pm.method}):`, labelX, currentY);
          doc.text(formatCurrency(pm.amount, pm.currency), valueX, currentY, { align: 'right' });
          currentY += 7;
        }
      } else {
        doc.text(`No payment made`, labelX, currentY);
        currentY += 7;
      }

      // Box for Amount Due
      currentY += 7;
      const boxHeight = 16;
      const boxStartX = 115;
      const boxWidth = 75;

      doc.setFillColor(11, 101, 221);
      doc.rect(boxStartX, currentY, boxWidth, boxHeight, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);

      const textY = currentY + boxHeight / 2 + 3;
      doc.text(`AMOUNT DUE:`, boxStartX + 5, textY);
      doc.text(
        formatCurrency(sale.debtAmount, sale.invoiceCurrency),
        boxStartX + boxWidth - 5,
        textY,
        { align: 'right' }
      );

      // Footer
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const pageHeight = doc.internal.pageSize.height;
      doc.text("Thank you for your business!", doc.internal.pageSize.width / 2, pageHeight - 15, { align: "center" });
    },
  });

  // --- 6. Save the file ---
  doc.save(`Invoice-${sale.invoiceId}.pdf`);
};
// --- (FIX) REMOVED THE EXTRA "}" THAT WAS HERE ---