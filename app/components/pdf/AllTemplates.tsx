import React from 'react';
import dayjs from 'dayjs';
import { Page, View, Text, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// --- (Optional) Font Registration ---
// Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' });
// Font.register({ family: 'Inter-Bold', src: '/fonts/Inter-Bold.ttf' });
// Font.register({ family: 'Playfair-Bold', src: '/fonts/PlayfairDisplay-Bold.ttf' });

// --- Props Interface ---
interface DocProps {
  data: any; // The data for the report (sale, product list, etc.)
  store: any; // Store info (name, address, phone, logoUrl, planId)
}

// --- Reusable Currency Formatter ---
const formatCurrency = (amount: number | null | undefined, currency: string) => {
  if (amount == null) amount = 0;
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatter.format(amount)}`;
};

// ===================================================================
// STYLESHEET (Combined from all your files)
// ===================================================================
const styles = StyleSheet.create({
  // --- Page Styles ---
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
    color: '#1F2937',
    padding: 40,
  },
  pageModern: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#F8FAFF',
    color: '#1F2937',
  },
  pagePremium: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    height: '100%',
  },
  
  // --- Font Styles ---
  fontSerif: {
    fontFamily: 'Helvetica-Bold', // Use 'Playfair-Bold' if registered
  },
  
  // --- Reusable Layout Components ---
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  storeInfo: {
    flex: 1,
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 5,
  },
  storeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  storeDetails: {
    fontSize: 9,
    color: '#4B5563',
  },
  recipientInfo: {
    flex: 1,
    textAlign: 'right',
  },
  recipientTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 2,
  },
  recipientName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportTitleContainer: {
    flex: 1,
    textAlign: 'right',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0B61FF',
  },
  footerDefault: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#6B7280',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 5,
  },
  
  // --- Modern Design Components ---
  headerModern: {
    padding: 40,
    backgroundColor: '#0B61FF',
    color: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerModernTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerModernStripe: {
    height: 6,
    backgroundColor: '#93C5FD',
  },
  footerModern: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 8,
  },
  
  // --- Premium Design Components ---
  headerPremium: {
    padding: 40,
    backgroundColor: '#06265E',
    color: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerPremiumTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
  },
  headerPremiumStripe: {
    height: 6,
    backgroundColor: '#D6A94A',
  },
  footerPremium: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#06265E',
    color: '#FFFFFF',
  },
  footerPremiumStripe: {
    height: 6,
    backgroundColor: '#D6A94A',
  },
  footerPremiumContent: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 8,
  },
  
  // --- Table Styles ---
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableColHeader: {
    padding: 5,
    fontWeight: 'bold',
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  tableCell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  
  // --- Modern Table Styles ---
  tableModern: {
    width: '100%',
  },
  tableModernHeader: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    color: '#FFFFFF',
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tableModernColHeader: {
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableModernRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tableModernCell: {
    padding: 8,
  },
  
  // --- Premium Table Styles ---
  tablePremium: {
    width: '100%',
  },
  tablePremiumHeader: {
    flexDirection: 'row',
    backgroundColor: '#06265E',
    color: '#D6A94A',
  },
  tablePremiumColHeader: {
    padding: 8,
    fontFamily: 'Helvetica-Bold',
  },
  tablePremiumRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tablePremiumCell: {
    padding: 8,
  },
  
  // --- Misc & Helpers ---
  h1: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  h3: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
  textGreen: { color: '#16A34A' },
  textRed: { color: '#DC2626' },
  textBlue: { color: '#0B61FF' },
  fontBold: { fontWeight: 'bold' },
  
  // --- Totals Section ---
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  totalsBox: {
    width: '40%', // Used for generic reports
  },
  totalsBoxInvoice: {
    width: '100%', // When inside the 2-column layout, take full width of the column
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 5,
  },
  
  // --- Modern/Premium Totals ---
  totalsBoxModern: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
  },
  totalsBoxPremium: {
    width: '100%',
  },
});

// ===================================================================
// New Helper Functions
// ===================================================================

// --- Helper: Render Variants under Product Name ---
const renderVariants = (selectedVariants: any) => {
  if (!selectedVariants || Object.keys(selectedVariants).length === 0) return null;
  return (
    <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>
      {Object.entries(selectedVariants).map(([key, val]) => `${key}: ${val}`).join(' | ')}
    </Text>
  );
};

// --- Helper: Render Payment Breakdown ---
const PaymentBreakdown = ({ lines, currency }: { lines: any[], currency: string }) => {
  if (!lines || lines.length === 0) return null;
  return (
    <View style={{ marginTop: 5 }}>
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>
        Payment Details:
      </Text>
      {lines.map((line: any, i: number) => (
        <Text key={i} style={{ fontSize: 8, color: '#4B5563', marginBottom: 1 }}>
          • {line.method ? line.method.replace(/_/g, ' ') : 'Payment'}: {formatCurrency(line.amount, line.currency)}
          {line.currency !== currency && ` (approx ${formatCurrency(line.valueInInvoiceCurrency, currency)})`}
        </Text>
      ))}
    </View>
  );
};

// ===================================================================
// Reusable Layout Components
// ===================================================================

const PdfHeader = ({ store, recipient }: { store: any, recipient?: any }) => {
  const planId = store.planId?.toLowerCase() || 'trial';
  const showLogo = store.logoUrl && ['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.storeInfo}>
        {showLogo ? (
          <Image style={styles.logo} src={store.logoUrl} />
        ) : (
          <Text style={styles.storeName}>{store.name || 'My Store'}</Text>
        )}
        <Text style={styles.storeDetails}>{store.address || '123 Main St'}</Text>
        <Text style={styles.storeDetails}>{store.phone || '555-1234'}</Text>
      </View>
      {recipient && (
        <View style={styles.recipientInfo}>
          <Text style={styles.recipientTitle}>{recipient.title || 'BILL TO'}</Text>
          <Text style={styles.recipientName}>{recipient.name || 'Customer'}</Text>
          {/* Use optional chaining or empty string checks to prevent crashes */}
          <Text style={styles.storeDetails}>{recipient.phone || ''}</Text>
          <Text style={styles.storeDetails}>{recipient.address || ''}</Text>
        </View>
      )}
    </View>
  );
};

const PdfReportHeader = ({ store, title }: { store: any, title: string }) => {
  const planId = store.planId?.toLowerCase() || 'trial';
  const showLogo = store.logoUrl && ['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.storeInfo}>
        {showLogo ? (
          <Image style={styles.logo} src={store.logoUrl} />
        ) : (
          <Text style={styles.storeName}>{store.name || 'My Store'}</Text>
        )}
        <Text style={styles.storeDetails}>{store.address || '123 Main St'}</Text>
        <Text style={styles.storeDetails}>{store.phone || '555-1234'}</Text>
      </View>
      <View style={styles.reportTitleContainer}>
        <Text style={styles.reportTitle}>{title}</Text>
      </View>
    </View>
  );
};

const PdfFooter = () => (
  <Text style={styles.footerDefault} fixed>
    Powered by Hantikaab — https://hantikaab.hiigsitech.com
  </Text>
);

const ModernFooter = ({ storeName }: { storeName: string }) => (
  <View style={styles.footerModern} fixed>
    <Text style={{ color: '#6B7280' }}>{storeName}</Text>
    <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>Powered by Hantikaab</Text>
  </View>
);

const PremiumFooter = () => (
  <View style={styles.footerPremium} fixed>
    <View style={styles.headerPremiumStripe} />
    <View style={styles.footerPremiumContent}>
      <Text style={{ color: '#D6A94A', fontWeight: 'bold', fontSize: 10 }}>Powered by Hantikaab</Text>
    </View>
  </View>
);

// --- Helper Component: Just the Totals Box content (No Container) ---
// This is used inside the Invoice columns to ensure layout separation
const InvoiceTotalsBox = ({ sale, style = 'default' }: { sale: any, style?: 'default' | 'modern' | 'premium' }) => {
  const currency = sale.invoiceCurrency;
  const isModern = style === 'modern';
  const isPremium = style === 'premium';

  const boxStyle = isModern ? styles.totalsBoxModern : (isPremium ? styles.totalsBoxPremium : styles.totalsBoxInvoice);

  return (
    <View style={boxStyle}>
      <View style={styles.totalsRow}>
        <Text>Subtotal</Text>
        <Text style={styles.textRight}>{formatCurrency(sale.totalAmount, currency)}</Text>
      </View>
      <View style={styles.totalsRow}>
        <Text style={styles.textGreen}>Total Paid</Text>
        <Text style={{...styles.textRight, ...styles.textGreen}}>{formatCurrency(sale.totalPaid, currency)}</Text>
      </View>
      <View style={styles.totalsRowBold}>
        <Text>Amount Due</Text>
        <Text style={{...styles.textRight, ...styles.textRed}}>{formatCurrency(sale.debtAmount, currency)}</Text>
      </View>
    </View>
  );
};

// --- Legacy Component: Wrapper for other reports ---
// Keeps the 'totalsContainer' logic for non-invoice reports (Purchase etc)
const InvoiceTotals = ({ sale, style = 'default' }: { sale: any, style?: 'default' | 'modern' | 'premium' }) => {
  return (
    <View style={styles.totalsContainer}>
       <View style={{ width: '40%' }}>
          <InvoiceTotalsBox sale={sale} style={style} />
       </View>
    </View>
  );
};

// ===================================================================
// 1. INVOICE TEMPLATES
// ===================================================================

export const InvoiceDefault = ({ data: sale, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfHeader 
        store={store} 
        recipient={{ 
            // --- FIX: Check nested customer object for phone/address ---
            name: sale.customer?.name || sale.customerName || 'Walk-in Customer',
            phone: sale.customer?.phone || sale.customerPhone || '',
            address: sale.customer?.address || sale.customerAddress || '',
            title: 'BILL TO' 
        }} 
      />
      <View>
        <Text style={{...styles.h1, color: '#0B61FF', textAlign: 'center', marginBottom: 20 }}>INVOICE</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{...styles.tableColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
            <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Unit Price</Text>
            <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Amount</Text>
          </View>
          {sale.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <View style={{...styles.tableCell, flex: 3}}>
                <Text>{item.productName}</Text>
                {renderVariants(item.selectedVariants)}
              </View>
              <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
              <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.pricePerUnit, sale.invoiceCurrency)}</Text>
              <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{formatCurrency(item.subtotal || (item.quantity * item.pricePerUnit), sale.invoiceCurrency)}</Text>
            </View>
          ))}
        </View>

        {/* --- FIX: Strict 2-Column Layout for Separation --- */}
        <View style={{ flexDirection: 'row', marginTop: 20, alignItems: 'flex-start' }}>
           {/* Left Column: Payments (60%) */}
           <View style={{ width: '60%', paddingRight: 20 }}>
               <PaymentBreakdown lines={sale.paymentLines} currency={sale.invoiceCurrency} />
           </View>
           
           {/* Right Column: Totals (40%) */}
           <View style={{ width: '40%' }}>
               <InvoiceTotalsBox sale={sale} style="default" />
           </View>
        </View>

      </View>
      <PdfFooter />
    </Page>
  </Document>
);

export const InvoiceModern = ({ data: sale, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>INVOICE</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        <PdfHeader 
            store={store} 
            recipient={{ 
                // --- FIX: Check nested customer object ---
                name: sale.customer?.name || sale.customerName || 'Walk-in Customer',
                phone: sale.customer?.phone || sale.customerPhone || '',
                address: sale.customer?.address || sale.customerAddress || '',
                title: 'BILL TO' 
            }} 
        />
        <View style={styles.tableModern}>
          <View style={styles.tableModernHeader}>
            <Text style={{...styles.tableModernColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Unit Price</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Amount</Text>
          </View>
          {sale.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableModernRow}>
              <View style={{...styles.tableModernCell, flex: 3}}>
                <Text>{item.productName}</Text>
                {renderVariants(item.selectedVariants)}
              </View>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.pricePerUnit, sale.invoiceCurrency)}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.subtotal || (item.quantity * item.pricePerUnit), sale.invoiceCurrency)}</Text>
            </View>
          ))}
        </View>
        
        {/* --- FIX: Strict 2-Column Layout --- */}
        <View style={{ flexDirection: 'row', marginTop: 20, alignItems: 'flex-start' }}>
           <View style={{ width: '60%', paddingRight: 20 }}>
               <PaymentBreakdown lines={sale.paymentLines} currency={sale.invoiceCurrency} />
           </View>
           <View style={{ width: '40%' }}>
               <InvoiceTotalsBox sale={sale} style="modern" />
           </View>
        </View>
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);

export const InvoicePremium = ({ data: sale, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>INVOICE</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <PdfHeader 
            store={store} 
            recipient={{ 
                // --- FIX: Check nested customer object ---
                name: sale.customer?.name || sale.customerName || 'Walk-in Customer',
                phone: sale.customer?.phone || sale.customerPhone || '',
                address: sale.customer?.address || sale.customerAddress || '',
                title: 'BILL TO' 
            }} 
        />
        <View style={styles.tablePremium}>
          <View style={styles.tablePremiumHeader}>
            <Text style={{...styles.tablePremiumColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Unit Price</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Amount</Text>
          </View>
          {sale.items.map((item: any, i: number) => (
            <View key={i} style={styles.tablePremiumRow}>
              <View style={{...styles.tablePremiumCell, flex: 3}}>
                <Text>{item.productName}</Text>
                {renderVariants(item.selectedVariants)}
              </View>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.pricePerUnit, sale.invoiceCurrency)}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.subtotal || (item.quantity * item.pricePerUnit), sale.invoiceCurrency)}</Text>
            </View>
          ))}
        </View>
        
        {/* --- FIX: Strict 2-Column Layout --- */}
        <View style={{ flexDirection: 'row', marginTop: 20, alignItems: 'flex-start' }}>
           <View style={{ width: '60%', paddingRight: 20 }}>
               <PaymentBreakdown lines={sale.paymentLines} currency={sale.invoiceCurrency} />
           </View>
           <View style={{ width: '40%' }}>
               <InvoiceTotalsBox sale={sale} style="premium" />
           </View>
        </View>
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 2. PRODUCT REPORT TEMPLATES
// ===================================================================

export const ProductReportDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Product Report" />
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Product Name</Text>
          <Text style={{...styles.tableColHeader, flex: 2}}>Category</Text>
          <Text style={{...styles.tableColHeader, flex: 1}}>Stock</Text>
          <Text style={{...styles.tableColHeader, flex: 1, borderRightWidth: 0}}>Price</Text>
        </View>
        {data.products.map((p: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{p.Name}</Text>
            <Text style={{...styles.tableCell, flex: 2}}>{p.Category}</Text>
            <Text style={{...styles.tableCell, flex: 1}}>{p.Quantity}</Text>
            <Text style={{...styles.tableCell, flex: 1, borderRightWidth: 0}}>{p.Price}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);

export const ProductReportModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Product Catalog</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        <View style={styles.tableModern}>
          <View style={styles.tableModernHeader}>
            <Text style={{...styles.tableModernColHeader, flex: 3}}>Product Name</Text>
            <Text style={{...styles.tableModernColHeader, flex: 2}}>Category</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1}}>Stock</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1}}>Price</Text>
          </View>
          {data.products.map((p: any, i: number) => (
            <View key={i} style={styles.tableModernRow}>
              <Text style={{...styles.tableModernCell, flex: 3}}>{p.Name}</Text>
              <Text style={{...styles.tableModernCell, flex: 2}}>{p.Category}</Text>
              <Text style={{...styles.tableModernCell, flex: 1}}>{p.Quantity}</Text>
              <Text style={{...styles.tableModernCell, flex: 1}}>{p.Price}</Text>
            </View>
          ))}
        </View>
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);

export const ProductReportPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Product Portfolio</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <View style={styles.tablePremium}>
          <View style={styles.tablePremiumHeader}>
            <Text style={{...styles.tablePremiumColHeader, flex: 3}}>Product Name</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 2}}>Category</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1}}>Stock</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1}}>Price</Text>
          </View>
          {data.products.map((p: any, i: number) => (
            <View key={i} style={styles.tablePremiumRow}>
              <Text style={{...styles.tablePremiumCell, flex: 3}}>{p.Name}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 2}}>{p.Category}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1}}>{p.Quantity}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1}}>{p.Price}</Text>
            </View>
          ))}
        </View>
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 3. PAYROLL TEMPLATES
// ===================================================================

export const PayrollDefault = ({ data, store }: DocProps) => {
  const currency = data.currency || 'USD';
  const paidAmount = formatCurrency(data.amount, currency);
  const paymentDate = data.payDate?.toDate ? data.payDate.toDate() : data.payDate;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader 
          store={store} 
          recipient={{ 
            name: data.userName, 
            title: 'PAID TO',
            phone: `Employee ID: ${data.userId ? data.userId.substring(0, 8) : 'N/A'}...`
          }} 
        />
        <Text style={{...styles.h1, color: '#0B61FF', textAlign: 'center', marginBottom: 20 }}>
          PAYMENT VOUCHER
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <View>
            <Text style={styles.recipientTitle}>Payment Date</Text>
            <Text>{dayjs(paymentDate).format("DD MMM YYYY")}</Text>
          </View>
          <View style={{textAlign: 'right'}}>
            <Text style={styles.recipientTitle}>Voucher ID</Text>
            <Text>{data.id.substring(0, 10)}...</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{...styles.tableColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tableColHeader, flex: 2}}>Payment Method</Text>
            <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>
              Salary Payment ({dayjs(paymentDate).format("MMMM YYYY")})
            </Text>
            <Text style={{...styles.tableCell, flex: 2}}>{data.paymentMethod || 'N/A'}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0, ...styles.fontBold}}>
              {paidAmount}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
          <View style={{ width: '40%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 5 }}>
              <Text style={styles.fontBold}>Total Paid</Text>
              <Text style={{...styles.fontBold, ...styles.textRight}}>{paidAmount}</Text>
            </View>
          </View>
        </View>
        {data.notes && (
          <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10 }}>
            <Text style={styles.fontBold}>Notes:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}
        <PdfFooter />
      </Page>
    </Document>
  );
};
export const PayrollModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Payslip</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        <PdfHeader store={store} recipient={{ name: data.userName, title: 'PAID TO' }} />
        {/* You can reuse the default table/totals here or create new ones */}
        <Text style={styles.h2}>Payment Details</Text>
        <View style={styles.tableModern}>
          <View style={styles.tableModernHeader}>
            <Text style={{...styles.tableModernColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Amount</Text>
          </View>
          <View style={styles.tableModernRow}>
            <Text style={{...styles.tableModernCell, flex: 3}}>Salary Payment</Text>
            <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(data.amount, data.currency)}</Text>
          </View>
        </View>
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const PayrollPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Payment Voucher</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <PdfHeader store={store} recipient={{ name: data.userName, title: 'PAID TO' }} />
        <View style={styles.tablePremium}>
          <View style={styles.tablePremiumHeader}>
            <Text style={{...styles.tablePremiumColHeader, flex: 3}}>Description</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Amount</Text>
          </View>
          <View style={styles.tablePremiumRow}>
            <Text style={{...styles.tablePremiumCell, flex: 3}}>Salary Payment</Text>
            <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(data.amount, data.currency)}</Text>
          </View>
        </View>
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 4. PURCHASE TEMPLATES
// ===================================================================

export const PurchaseDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfHeader store={store} recipient={{ name: data.supplierName, title: 'SUPPLIER' }} />
      <Text style={{...styles.h1, color: '#0B61FF', textAlign: 'center', marginBottom: 20 }}>PURCHASE ORDER</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Item</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Cost</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Subtotal</Text>
        </View>
        {data.items.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{item.productName}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.costPrice, data.currency)}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{formatCurrency(item.subtotal, data.currency)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalsContainer}>
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Total Amount</Text>
            <Text style={styles.textRight}>{formatCurrency(data.totalAmount, data.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.textGreen}>Paid</Text>
            <Text style={{...styles.textRight, ...styles.textGreen}}>{formatCurrency(data.paidAmount, data.currency)}</Text>
          </View>
          <View style={styles.totalsRowBold}>
            <Text>Amount Due</Text>
            <Text style={{...styles.textRight, ...styles.textRed}}>{formatCurrency(data.remainingAmount, data.currency)}</Text>
          </View>
        </View>
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const PurchaseModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Purchase Order</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        <PdfHeader store={store} recipient={{ name: data.supplierName, title: 'SUPPLIER' }} />
        <View style={styles.tableModern}>
          <View style={styles.tableModernHeader}>
            <Text style={{...styles.tableModernColHeader, flex: 3}}>Item</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Cost</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Subtotal</Text>
          </View>
          {data.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableModernRow}>
              <Text style={{...styles.tableModernCell, flex: 3}}>{item.productName}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.costPrice, data.currency)}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.subtotal, data.currency)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBoxModern}>
            <View style={styles.totalsRowBold}>
              <Text>Total Due</Text>
              <Text style={{...styles.textRight, ...styles.textRed}}>{formatCurrency(data.remainingAmount, data.currency)}</Text>
            </View>
          </View>
        </View>
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const PurchasePremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Purchase Order</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <PdfHeader store={store} recipient={{ name: data.supplierName, title: 'SUPPLIER' }} />
        <View style={styles.tablePremium}>
          <View style={styles.tablePremiumHeader}>
            <Text style={{...styles.tablePremiumColHeader, flex: 3}}>Item</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Cost</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Subtotal</Text>
          </View>
          {data.items.map((item: any, i: number) => (
            <View key={i} style={styles.tablePremiumRow}>
              <Text style={{...styles.tablePremiumCell, flex: 3}}>{item.productName}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.costPrice, data.currency)}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(item.subtotal, data.currency)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBoxPremium}>
            <View style={styles.totalsRowBold}>
              <Text>Total Due</Text>
              <Text style={{...styles.textRight, ...styles.textRed}}>{formatCurrency(data.remainingAmount, data.currency)}</Text>
            </View>
          </View>
        </View>
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 5. REFUND TEMPLATES
// ===================================================================
export const RefundDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfHeader store={store} recipient={{name: data.customerName, title: 'CUSTOMER'}} />
      <Text style={{...styles.h1, color: '#DC2626', textAlign: 'center', marginBottom: 20 }}>REFUND VOUCHER</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Item Returned</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Qty</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Amount</Text>
        </View>
        {data.itemsReturned.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{item.productName}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{item.quantity}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{formatCurrency(item.quantity * item.pricePerUnit, data.refundCurrency)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.totalsContainer}>
        <View style={styles.totalsBox}>
          <View style={styles.totalsRowBold}>
            <Text>Total Refunded</Text>
            <Text style={{...styles.textRight, ...styles.textRed}}>{formatCurrency(data.refundAmount, data.refundCurrency)}</Text>
          </View>
        </View>
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const RefundModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={{...styles.headerModern, backgroundColor: '#DC2626'}}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Refund</Text>
      </View>
      <View style={{...styles.headerModernStripe, backgroundColor: '#FCA5A5'}} />
      <View style={{ padding: 40 }}>
        <PdfHeader store={store} recipient={{name: data.customerName, title: 'CUSTOMER'}} />
        {/* ... (Table and Totals for Modern Refund) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const RefundPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={{...styles.headerPremium, backgroundColor: '#DC2626'}}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Credit Note</Text>
      </View>
      <View style={{...styles.headerPremiumStripe, backgroundColor: '#FCA5A5'}} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <PdfHeader store={store} recipient={{name: data.customerName, title: 'CUSTOMER'}} />
        {/* ... (Table and Totals for Premium Refund) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 6. FINANCIAL P&L TEMPLATES
// ===================================================================
export const FinancialDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Financial Report" />
      <Text style={styles.h2}>Key Metrics</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {data.kpis.map((kpi: any, i: number) => (
          <View key={i} style={{ flex: 1, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 4 }}>
            <Text style={styles.recipientTitle}>{kpi.title}</Text>
            <Text style={styles.h3}>{kpi.value}</Text>
          </View>
        ))}
      </View>
      
      <Text style={styles.h2}>Profit & Loss</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Item</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Amount</Text>
        </View>
        {data.tables.profitAndLoss.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3, fontWeight: row.isBold ? 'bold' : 'normal'}}>{row.item}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0, fontWeight: row.isBold ? 'bold' : 'normal'}}>{row.amount}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const FinancialModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Financial Report</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        {/* ... (Modern P&L Table) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const FinancialPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>P&L Statement</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        {/* ... (Premium P&L Table) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 7. HR STAFF TEMPLATES
// ===================================================================
export const HrDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="HR Report" />
      <Text style={styles.h2}>Staff Incomes Logged</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 2}}>Staff Name</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Amount</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Transactions</Text>
        </View>
        {data.tables.staffIncomes.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 2}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{row.total}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{row.count}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const HrModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Staff Report</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        {/* ... (Modern HR Tables) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const HrPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>HR Activity</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        {/* ... (Premium HR Tables) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 8. MAIN BUSINESS TEMPLATES
// ===================================================================
export const MainBusinessDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Business Summary" />
      <Text style={styles.h2}>Summary KPIs</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {data.kpis.map((kpi: any, i: number) => (
          <View key={i} style={{ width: '48%', borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 4, marginBottom: 10 }}>
            <Text style={styles.recipientTitle}>{kpi.title}</Text>
            <Text style={styles.h3}>{kpi.value}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const MainBusinessModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Business Summary</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        {/* ... (Modern Business KPIs) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const MainBusinessPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Dashboard Report</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        {/* ... (Premium Business KPIs) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 9. DEBTS & CREDITS TEMPLATES
// ===================================================================
export const DebtsCreditsDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Debts Report" />
      <Text style={styles.h2}>Top Debtors</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 2}}>Customer</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Amount Due</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Debts</Text>
        </View>
        {data.tables.topDebtors.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 2}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{row.total}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{row.count}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const DebtsCreditsModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Debts Report</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        {/* ... (Modern Debts Table) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const DebtsCreditsPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>A/R Report</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        {/* ... (Premium Debts Table) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 10. CUSTOMER & SUPPLIER TEMPLATES
// ===================================================================
export const CustomerSupplierDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Client Report" />
      <Text style={styles.h2}>Top Customers</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 2}}>Customer</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Total Spent</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Sales</Text>
        </View>
        {data.tables.topCustomers.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 2}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{row.total}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{row.count}</Text>
          </View>
        ))}
      </View>
      <Text style={{...styles.h2, marginTop: 20}}>Top Suppliers</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 2}}>Supplier</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Total Supplied</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Amount Owed</Text>
        </View>
        {data.tables.topSuppliers.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 2}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{row.total}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{row.owed}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);
export const CustomerSupplierModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Client Report</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        {/* ... (Modern Customer/Supplier Tables) ... */}
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);
export const CustomerSupplierPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>CRM Report</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        {/* ... (Premium Customer/Supplier Tables) ... */}
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 11. SALES SUMMARY REPORT (NEW)
// ===================================================================
export const SalesSummaryReportDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Sales Report" />

      {/* --- (NEW) KPIs Section --- */}
      <Text style={styles.h2}>Key Metrics</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {data.kpis.map((kpi: any, i: number) => (
          <View key={i} style={{ width: '48%', borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 4, marginBottom: 10 }}>
            <Text style={styles.recipientTitle}>{kpi.title}</Text>
            <Text style={styles.h3}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {/* --- (NEW) Top Products Table --- */}
      <Text style={styles.h2}>Top-Selling Products</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Product Name</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Units Sold</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Total Revenue</Text>
        </View>
        {data.tables.topProducts.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{row.units}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{row.revenue}</Text>
          </View>
        ))}
      </View>

      {/* --- (NEW) Sales by Category Table --- */}
      <Text style={{...styles.h2, marginTop: 20}}>Sales by Category</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Category</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Units Sold</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight, borderRightWidth: 0}}>Total Revenue</Text>
        </View>
        {data.tables.salesByCategory.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{row.units}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, borderRightWidth: 0}}>{row.revenue}</Text>
          </View>
        ))}
      </View>
      
      <PdfFooter />
    </Page>
  </Document>
);
// ===================================================================
// 11. PURCHASE REPORT (LIST) TEMPLATES
// ===================================================================

export const PurchaseReportDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Purchase Report" />
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Supplier</Text>
          <Text style={{...styles.tableColHeader, flex: 2}}>Date</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Total</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textRight}}>Remaining</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Status</Text>
        </View>
        {data.purchases.map((po: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{po.supplierName}</Text>
            <Text style={{...styles.tableCell, flex: 2}}>{dayjs(po.purchaseDate).format("DD MMM YYYY")}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight}}>{formatCurrency(po.totalAmount, po.currency)}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textRight, ...styles.textRed}}>{formatCurrency(po.remainingAmount, po.currency)}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{po.status}</Text>
          </View>
        ))}
      </View>
      <PdfFooter />
    </Page>
  </Document>
);

export const PurchaseReportModern = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pageModern}>
      <View style={styles.headerModern}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.headerModernTitle}>Purchase Report</Text>
      </View>
      <View style={styles.headerModernStripe} />
      <View style={{ padding: 40 }}>
        <View style={styles.tableModern}>
          <View style={styles.tableModernHeader}>
            <Text style={{...styles.tableModernColHeader, flex: 3}}>Supplier</Text>
            <Text style={{...styles.tableModernColHeader, flex: 2}}>Date</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Total</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textRight}}>Remaining</Text>
            <Text style={{...styles.tableModernColHeader, flex: 1, ...styles.textCenter}}>Status</Text>
          </View>
          {data.purchases.map((po: any, i: number) => (
            <View key={i} style={styles.tableModernRow}>
              <Text style={{...styles.tableModernCell, flex: 3}}>{po.supplierName}</Text>
              <Text style={{...styles.tableModernCell, flex: 2}}>{dayjs(po.purchaseDate).format("DD MMM YYYY")}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight}}>{formatCurrency(po.totalAmount, po.currency)}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textRight, ...styles.textRed}}>{formatCurrency(po.remainingAmount, po.currency)}</Text>
              <Text style={{...styles.tableModernCell, flex: 1, ...styles.textCenter}}>{po.status}</Text>
            </View>
          ))}
        </View>
      </View>
      <ModernFooter storeName={store.name} />
    </Page>
  </Document>
);

export const PurchaseReportPremium = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.pagePremium}>
      <View style={styles.headerPremium}>
        <Text style={[styles.storeName, styles.fontSerif, {color: '#FFFFFF'}]}>{store.name}</Text>
        <Text style={[styles.headerPremiumTitle, styles.fontSerif]}>Purchases Ledger</Text>
      </View>
      <View style={styles.headerPremiumStripe} />
      <View style={{ padding: 40, flexGrow: 1 }}>
        <View style={styles.tablePremium}>
          <View style={styles.tablePremiumHeader}>
            <Text style={{...styles.tablePremiumColHeader, flex: 3}}>Supplier</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 2}}>Date</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Total</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textRight}}>Remaining</Text>
            <Text style={{...styles.tablePremiumColHeader, flex: 1, ...styles.textCenter}}>Status</Text>
          </View>
          {data.purchases.map((po: any, i: number) => (
            <View key={i} style={styles.tablePremiumRow}>
              <Text style={{...styles.tablePremiumCell, flex: 3}}>{po.supplierName}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 2}}>{dayjs(po.purchaseDate).format("DD MMM YYYY")}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight}}>{formatCurrency(po.totalAmount, po.currency)}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textRight, ...styles.textRed}}>{formatCurrency(po.remainingAmount, po.currency)}</Text>
              <Text style={{...styles.tablePremiumCell, flex: 1, ...styles.textCenter}}>{po.status}</Text>
            </View>
          ))}
        </View>
      </View>
      <PremiumFooter />
    </Page>
  </Document>
);

// ===================================================================
// 12. INVENTORY SUMMARY REPORT (NEW)
// ===================================================================
export const InventorySummaryReportDefault = ({ data, store }: DocProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <PdfReportHeader store={store} title="Inventory Report" />

      {/* --- KPIs Section --- */}
      <Text style={styles.h2}>Key Metrics</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {data.kpis.map((kpi: any, i: number) => (
          <View key={i} style={{ width: '48%', borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 4, marginBottom: 10 }}>
            <Text style={styles.recipientTitle}>{kpi.title}</Text>
            <Text style={styles.h3}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {/* --- Low Stock Table --- */}
      <Text style={styles.h2}>Low Stock Items</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Product Name</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Current Qty</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Threshold</Text>
        </View>
        {data.tables.lowStock.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{row.qty}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{row.threshold}</Text>
          </View>
        ))}
      </View>

      {/* --- Fast Moving Table --- */}
      <Text style={{...styles.h2, marginTop: 20}}>Fast-Moving Products</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{...styles.tableColHeader, flex: 3}}>Product Name</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter}}>Units Sold</Text>
          <Text style={{...styles.tableColHeader, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>Current Qty</Text>
        </View>
        {data.tables.fastMoving.map((row: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{...styles.tableCell, flex: 3}}>{row.name}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter}}>{row.unitsSold}</Text>
            <Text style={{...styles.tableCell, flex: 1, ...styles.textCenter, borderRightWidth: 0}}>{row.qty}</Text>
          </View>
        ))}
      </View>
      
      <PdfFooter />
    </Page>
  </Document>
);