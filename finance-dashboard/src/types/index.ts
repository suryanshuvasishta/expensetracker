export type Owner = 'Suryanshu' | 'Khushboo' | 'Joint';
export const OWNERS: Owner[] = ['Suryanshu', 'Khushboo', 'Joint'];

export type AssetClass = 'FD' | 'Debt/Liquid MF' | 'Equity MF' | 'ETF' | 'Stocks' | 'Real Estate' | 'Gold' | 'NPS' | 'PPF/SSY' | 'Other';
export const ASSET_CLASSES: AssetClass[] = ['FD', 'Debt/Liquid MF', 'Equity MF', 'ETF', 'Stocks', 'Real Estate', 'Gold', 'NPS', 'PPF/SSY', 'Other'];

export interface Investment {
  id: string;
  owner: Owner;
  name: string;
  assetClass: AssetClass;
  institution: string;
  units?: number;
  nav?: number;
  principal?: number;
  interestRate?: number;
  maturityDate?: string;
  currentValue: number;
  purchaseCost?: number;
  goal?: string;
  updatedAt: string;
  notes?: string;
}

export type AccountType =
  | 'HDFC Bank'
  | 'ICICI Bank'
  | 'Axis Credit Card'
  | 'SBI Credit Card'
  | 'ICICI Credit Card'
  | 'Unknown';

export type PaymentMethod =
  | 'UPI'
  | 'NEFT'
  | 'IMPS'
  | 'RTGS'
  | 'Credit Card'
  | 'Debit Card'
  | 'Cash'
  | 'Net Banking'
  | 'EMI'
  | 'Cheque'
  | 'Other';

export type TransactionType = 'debit' | 'credit';

export interface Transaction {
  id: string;
  owner: Owner;
  date: string; // ISO date string
  account: AccountType;
  amount: number;
  narration: string;
  category: string;
  paymentMethod: PaymentMethod;
  type: TransactionType;
  sourceFile: string;
  balance?: number;
  refNumber?: string;
  correlatedIds?: string[];
  isCorrelationPair?: boolean; // true if this is a CC payment that matches a CC statement
  month: string; // YYYY-MM for easy grouping
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  color: string;
  icon?: string;
}

export interface UploadedFile {
  id: string;
  owner: Owner;
  name: string;
  account: AccountType;
  uploadedAt: string;
  transactionCount: number;
  month: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

export interface MonthlyStats {
  month: string;
  totalDebit: number;
  totalCredit: number;
  netFlow: number;
  transactionCount: number;
  categoryBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  accountBreakdown: Record<string, number>;
}

export interface AppSettings {
  googleSheetId?: string;
  googleAccessToken?: string;
  categoriesLastSync?: string;
  defaultCategories: Category[];
}

export interface InvestmentLine {
  id: string;
  label: string;
  amount: number;
  goal: 'Retirement' | "Children's Fund" | 'Home Ownership' | 'Emergency' | 'Consumer Durables' | 'Other';
}

export interface MonthlyBudget {
  id: string; // owner:YYYY-MM
  owner: Owner;
  month: string;

  // Income
  grossSalary: number;
  tds: number;
  employerHealthInsurance: number;
  epf: number;
  nps: number;
  professionalTax: number;
  otherDeductions: number;

  // Investments (planned, named line items)
  investments: InvestmentLine[];

  // Fixed liabilities
  homeLoanEmi: number;
  otherFixedLiabilities: number;

  // Per-category budgets (category name → budgeted amount)
  categoryBudgets: Record<string, number>;
}

export const CATEGORY_GROUPS: { group: string; categories: string[] }[] = [
  {
    group: 'Housing',
    categories: ['Rent', 'Electricity', 'Gas', 'Water', 'Garbage', 'Internet & Phone', 'Home Maintenance', 'House Help', 'CAC', 'CAE'],
  },
  {
    group: 'Food',
    categories: ['Groceries', 'Ordering In', 'Eating Out'],
  },
  {
    group: 'Transportation',
    categories: ['Fuel', 'Car Maintenance', 'Car Cleaner', 'Public Transport', 'Tolls & Parking'],
  },
  {
    group: 'Education & Self Improvement',
    categories: ['School Fee', 'Books & Courses', 'Software & Services', 'Subscriptions', 'Office Supplies'],
  },
  {
    group: 'Healthcare',
    categories: ['Child Healthcare', 'Personal & Spousal Healthcare', 'Parental Healthcare'],
  },
  {
    group: 'Insurance',
    categories: ['Life Insurance', 'Health Insurance', 'Car Insurance', 'Parental Health Insurance'],
  },
  {
    group: 'Miscellaneous',
    categories: ['Clothes', 'Movies & Entertainment', 'Petty Expenses', 'Gifts', 'Toys & Joy Rides', 'Other Online Shopping', 'Other Expenses', 'Contingency'],
  },
  {
    group: 'One Time / Non-Budgeted',
    categories: ['One Time Large Expenses', 'Car Shopping', 'Home Improvement Shopping', 'Income Tax'],
  },
];

export type ParsedTransaction = Omit<Transaction, 'id' | 'owner' | 'createdAt' | 'month' | 'correlatedIds' | 'isCorrelationPair'> & { owner?: Owner };

export interface CategoryRule {
  id: string;
  keyword: string;    // substring to match (case-insensitive) in narration
  category: string;  // display name to assign
  createdAt: string;
}

export type LiabilityType = 'Home Loan' | 'Car Loan' | 'Personal Loan' | 'Credit Card' | 'Other';

export interface Liability {
  id: string;
  owner: Owner;
  name: string;
  type: LiabilityType;
  outstandingAmount: number;
  emi?: number;
  interestRate?: number;
  updatedAt: string;
  notes?: string;
}
