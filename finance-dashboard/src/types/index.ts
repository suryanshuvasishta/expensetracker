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
  | 'Paytm Wallet'
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
  linkedAccount?: string; // for wallet txns: the funding source reported by the statement (e.g. "UPI Lite" or a bank account)
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
  group?: string;
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

// Default group display order. Any group not listed here (e.g. a user-created group)
// is appended at the end, alphabetically, before the non-budget groups.
export const GROUP_ORDER: string[] = [
  'Housing',
  'Food',
  'Transportation',
  'Education & Self Improvement',
  'Healthcare',
  'Insurance',
  'Miscellaneous',
  'One Time / Non-Budgeted',
];

// Groups that represent money in/internal movement rather than budgeted spend —
// excluded from Budget actuals and from the "spend" category dropdowns' regular sections.
export const NON_BUDGET_GROUPS = ['Income', 'System'];

export function isNonBudgetGroup(group: string | undefined): boolean {
  return !!group && NON_BUDGET_GROUPS.includes(group);
}

const FALLBACK_GROUP = 'Miscellaneous';

/** Builds category groups dynamically from the live (DB-backed, user-editable) category list. */
export function buildCategoryGroups(categories: Category[]): { group: string; categories: string[] }[] {
  const byGroup = new Map<string, string[]>();
  for (const c of categories) {
    const g = c.group || FALLBACK_GROUP;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(c.name);
  }
  const groups = [...byGroup.keys()];
  groups.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (isNonBudgetGroup(a) !== isNonBudgetGroup(b)) return isNonBudgetGroup(a) ? 1 : -1;
    return a.localeCompare(b);
  });
  return groups.map(group => ({ group, categories: byGroup.get(group)! }));
}

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
