// File: app/api/dashboard/types.ts
// (FIX) Ku dar 4-ta qaybood ee cusub si aad u xalliso ciladda TypeScript

export interface DashboardSummary {
  // 8-dii hore
  todaysSales: number;
  totalIncomes: number; // This is 'Total Revenue'
  totalExpenses: number;
  netProfit: number;
  totalSalesCount: number;
  newDebtsAmount: number; // This is 'New Debts' for the period
  lowStockCount: number;
  totalProducts: number;

  // --- (NEW) 4-ta cusub ---
  outstandingInvoices: number; // Total unpaid from customers
  totalPayables: number; // Total owed to suppliers
  cashBalance: number; // Net cash flow for the period
  profitMargin: number; // Percentage
  // --- (END NEW) ---

  // Xogta kale (charts iyo lists)
  incomeExpenseTrend: { date: string; income: number; expense: number }[];
  expenseBreakdown: { name: string; value: number }[];
  salesByPaymentType: { name: string; value: number }[];
  topSellingProducts: { name: string; unitsSold: number; revenue: number }[];
  recentSales: {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
  stockOverview: { name: string; quantity: number; id: string }[];
  activityFeed: {
    id: string;
    description: string;
    userName: string;
    timestamp: string;
  }[];
  performanceComparison: {
    salesChangePercent: number;
    profitChangePercent: number;
  };
  smartInsight: string;
  timestamp: string;
}