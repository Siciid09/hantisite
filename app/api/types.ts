// File: app/api/dashboard/types.ts
// Description: NEW file to hold the shared type for the dashboard.
// This allows both the client 'page.tsx' and the server 'route.ts'
// to import the same type, fixing the import error.

// This is the type from your route.ts file, moved here.
export interface DashboardSummary {
  // 1. KPIs
  todaysSales: number;
  totalIncomes: number;
  totalExpenses: number;
  netProfit: number;
  totalSalesCount: number;
  newDebtsAmount: number;
  lowStockCount: number;
  totalProducts: number;

  // 4. Income/Expense Trend
  incomeExpenseTrend: { date: string; income: number; expense: number }[];

  // 5. Expense Breakdown
  expenseBreakdown: { name: string; value: number }[];

  // 6. Sales by Payment Type
  salesByPaymentType: { name: string; value: number }[];

  // 7. Top Performing Products
  topSellingProducts: { name: string; unitsSold: number; revenue: number }[];

  // 8. Recent Sales
  recentSales: {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];

  // 9. Inventory Overview (Low/Out of Stock)
  stockOverview: { name: string; quantity: number; id: string }[];

  // 10. Activity Feed
  activityFeed: {
    id: string;
    description: string;
    userName: string;
    timestamp: string;
  }[];

  // 11. Performance Comparison
  performanceComparison: {
    salesChangePercent: number;
    profitChangePercent: number;
  };

  // 12. Smart Insight
  smartInsight: string;

  // Other
  timestamp: string;
}
