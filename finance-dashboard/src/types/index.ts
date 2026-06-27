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

export type ParsedTransaction = Omit<Transaction, 'id' | 'createdAt' | 'month' | 'correlatedIds' | 'isCorrelationPair'>;
