// File: app/api/dashboard/types.ts
// (FIXED) Added 'accountBalances' to resolve the TypeScript error.

export interface DashboardSummary {
  // --- Standard KPIs ---
  todaysSales: number;
  totalIncomes: number; // This is 'Total Revenue'
  totalExpenses: number;
  netProfit: number;
  totalSalesCount: number;
  newDebtsAmount: number; // This is 'New Debts' for the period
  lowStockCount: number;
  totalProducts: number;

  // --- Liability/Asset KPIs ---
  outstandingInvoices: number; // Total unpaid from customers
  totalPayables: number; // Total owed to suppliers
  cashBalance: number; // Legacy field (can be kept for safety)
  profitMargin: number; // Percentage

  // --- (NEW) Dynamic Account Balances ---
  // This fixes the error: "Property 'accountBalances' does not exist..."
  accountBalances: { 
    name: string; 
    value: number; 
  }[];

  // --- Charts & Lists ---
  incomeExpenseTrend: { 
    date: string; 
    income: number; 
    expense: number; 
  }[];
  
  expenseBreakdown: { 
    name: string; 
    value: number; 
  }[];
  
  salesByPaymentType: { 
    name: string; 
    value: number; 
  }[];
  
  topSellingProducts: { 
    name: string; 
    unitsSold: number; 
    revenue: number; 
  }[];
  
  recentSales: {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
  
  stockOverview: { 
    id: string; 
    name: string; 
    quantity: number; 
  }[];
  
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