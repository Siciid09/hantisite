import React from 'react';
import { Page, View, Text, Image, Document, StyleSheet, Font } from '@react-pdf/renderer';

// --- (Optional) Font Registration ---
// To use 'Inter' or 'Playfair Display', you must download the .ttf files
// and host them in your /public/fonts folder, then uncomment these lines.
// Font.register({ family: 'Inter', src: '/fonts/Inter-Regular.ttf' });
// Font.register({ family: 'Inter-Bold', src: '/fonts/Inter-Bold.ttf' });
// Font.register({ family: 'Playfair-Bold', src: '/fonts/PlayfairDisplay-Bold.ttf' });

// ===================================================================
// STYLESHEET
// This is the translation of your Tailwind CSS from pdf.txt
// ===================================================================
export const styles = StyleSheet.create({
  // --- Page Styles ---
  page: {
    fontFamily: 'Helvetica', // Use 'Inter' if registered
    fontSize: 10,
    backgroundColor: '#ffffff',
    color: '#1F2937',
    padding: 40,
  },
  pageModern: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#F8FAFF', // bg-gray-50
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
  // --- (NEW) Report Title (for non-invoice reports) ---
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
    backgroundColor: '#93C5FD', // bg-blue-300
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
    fontFamily: 'Helvetica-Bold', // Use 'Playfair-Bold'
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
    borderColor: '#D1D5DB', // border-gray-300
    borderCollapse: 'collapse',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6', // bg-gray-100
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', // border-gray-200
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
  tableModernHeader: {
    flexDirection: 'row',
    backgroundColor: '#374151', // bg-gray-700
    color: '#FFFFFF',
    borderBottomWidth: 0,
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
  },
  tableModernCell: {
    padding: 8,
  },
  
  // --- Premium Table Styles ---
  tablePremiumHeader: {
    flexDirection: 'row',
    backgroundColor: '#06265E',
    color: '#D6A94A',
  },
  tablePremiumColHeader: {
    padding: 8,
    fontFamily: 'Helvetica-Bold', // Use 'Playfair-Bold'
  },
  tablePremiumRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tablePremiumCell: {
    padding: 8,
  },
  
  // --- Misc ---
  h1: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  h3: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
  textGreen: { color: '#16A34A' },
  textRed: { color: '#DC2626' },
  textBlue: { color: '#0B61FF' },
  fontBold: { fontWeight: 'bold' },
  w50: { width: '50%' },
  w33: { width: '33.33%' },
});

// ===================================================================
// Reusable Layout Components
// ===================================================================

// --- Reusable INVOICE Header ---
// This is for Invoices, Purchases, etc. (Store | Recipient)
export const PdfHeader = ({ store, recipient }: { store: any, recipient?: any }) => {
  const planId = store.planId?.toLowerCase() || 'trial';
  const showLogo = store.logoUrl && ['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId);

  return (
    <View style={styles.headerContainer}>
      {/* Store Info (Left Side) */}
      <View style={styles.storeInfo}>
        {showLogo ? (
          <Image style={styles.logo} src={store.logoUrl} />
        ) : (
          <Text style={styles.storeName}>{store.name || 'My Store'}</Text>
        )}
        <Text style={styles.storeDetails}>{store.address || '123 Main St'}</Text>
        <Text style={styles.storeDetails}>{store.phone || '555-1234'}</Text>
      </View>
      
      {/* Recipient Info (Right Side) */}
      {recipient && (
        <View style={styles.recipientInfo}>
          <Text style={styles.recipientTitle}>{recipient.title || 'BILL TO'}</Text>
          <Text style={styles.recipientName}>{recipient.name || 'Customer'}</Text>
          <Text style={styles.storeDetails}>{recipient.phone}</Text>
          <Text style={styles.storeDetails}>{recipient.address}</Text>
        </View>
      )}
    </View>
  );
};

// --- (NEW) Reusable REPORT Header ---
// This is for Product Reports, Financials, etc. (Store | Report Title)
export const PdfReportHeader = ({ store, title }: { store: any, title: string }) => {
  const planId = store.planId?.toLowerCase() || 'trial';
  const showLogo = store.logoUrl && ['standard', 'business', 'pro', 'unlimited', 'lifetime'].includes(planId);

  return (
    <View style={styles.headerContainer}>
      {/* Store Info (Left Side) */}
      <View style={styles.storeInfo}>
        {showLogo ? (
          <Image style={styles.logo} src={store.logoUrl} />
        ) : (
          <Text style={styles.storeName}>{store.name || 'My Store'}</Text>
        )}
        <Text style={styles.storeDetails}>{store.address || '123 Main St'}</Text>
        <Text style={styles.storeDetails}>{store.phone || '555-1234'}</Text>
      </View>
      
      {/* Report Title (Right Side) */}
      <View style={styles.reportTitleContainer}>
        <Text style={styles.reportTitle}>{title}</Text>
      </View>
    </View>
  );
};

// --- Reusable Footer Component ---
export const PdfFooter = () => (
  <Text style={styles.footerDefault} fixed>
    Powered by Hantikaab — https://hantikaab.hiigsitech.com
  </Text>
);

// --- (FIXED) Moved all Footers to the top ---
export const ModernFooter = ({ storeName }: { storeName: string }) => (
  <View style={styles.footerModern} fixed>
    <Text style={{ color: '#6B7280' }}>{storeName}</Text>
    <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>Powered by Hantikaab</Text>
  </View>
);

export const PremiumFooter = ({ page = 1, totalPages = 1 }: { page?: number, totalPages?: number }) => (
  <View style={styles.footerPremium} fixed>
    <View style={styles.headerPremiumStripe} />
    <View style={styles.footerPremiumContent}>
      <Text style={{ color: '#D6A94A', fontWeight: 'bold', fontSize: 10 }}>Powered by Hantikaab</Text>
      <Text style={{ color: '#9CA3AF' }}>Page {page} of {totalPages}</Text>
    </View>
  </View>
);