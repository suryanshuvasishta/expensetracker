import Dexie, { type Table } from 'dexie';
import type { Transaction, Category, UploadedFile, AppSettings } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  uploadedFiles!: Table<UploadedFile>;
  settings!: Table<AppSettings & { id: number }>;

  constructor() {
    super('FinanceDashboard');
    this.version(1).stores({
      transactions: 'id, date, month, account, category, paymentMethod, type, sourceFile',
      categories: 'id, name',
      uploadedFiles: 'id, account, month, status',
      settings: 'id',
    });
  }
}

export const db = new FinanceDB();

export async function getOrCreateSettings(): Promise<AppSettings & { id: number }> {
  const existing = await db.settings.get(1);
  if (existing) return existing;
  const defaults: AppSettings & { id: number } = {
    id: 1,
    defaultCategories: DEFAULT_CATEGORIES,
  };
  await db.settings.put(defaults);
  return defaults;
}

export async function getCategories(): Promise<Category[]> {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
  }
  return db.categories.toArray();
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food-dining', name: 'Food & Dining', keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'pizza', 'burger', 'blinkit', 'instamart', 'dunzo', 'bigbasket'], color: '#f97316', icon: '🍔' },
  { id: 'groceries', name: 'Groceries', keywords: ['grocery', 'supermarket', 'dmart', 'reliance fresh', 'more', 'star bazar', 'jiomart', 'zepto', 'blinkit', 'instamart'], color: '#84cc16', icon: '🛒' },
  { id: 'transport', name: 'Transport', keywords: ['uber', 'ola', 'rapido', 'metro', 'petrol', 'fuel', 'irctc', 'makemytrip', 'goibibo', 'redbus'], color: '#06b6d4', icon: '🚗' },
  { id: 'shopping', name: 'Shopping', keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal'], color: '#8b5cf6', icon: '🛍️' },
  { id: 'utilities', name: 'Utilities', keywords: ['electricity', 'water', 'gas', 'airtel', 'jio', 'vi ', 'bsnl', 'broadband', 'internet', 'recharge'], color: '#64748b', icon: '💡' },
  { id: 'health', name: 'Health & Medical', keywords: ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'apollo', 'practo', 'netmeds', 'medlife', '1mg'], color: '#ef4444', icon: '🏥' },
  { id: 'entertainment', name: 'Entertainment', keywords: ['netflix', 'prime', 'hotstar', 'spotify', 'youtube', 'bookmyshow', 'pvr', 'inox', 'gaming'], color: '#ec4899', icon: '🎬' },
  { id: 'education', name: 'Education', keywords: ['udemy', 'coursera', 'byju', 'unacademy', 'school', 'college', 'tuition', 'books'], color: '#0ea5e9', icon: '📚' },
  { id: 'investment', name: 'Investments', keywords: ['zerodha', 'groww', 'sip', 'mutual fund', 'nps', 'ppf', 'fd', 'stock', 'ipo'], color: '#10b981', icon: '📈' },
  { id: 'insurance', name: 'Insurance', keywords: ['lic', 'insurance', 'hdfc life', 'icici pru', 'sbi life', 'term plan', 'policy'], color: '#0d9488', icon: '🛡️' },
  { id: 'transfer', name: 'Transfers', keywords: ['imps', 'neft', 'rtgs', 'transfer', 'upi'], color: '#94a3b8', icon: '↔️' },
  { id: 'cc-payment', name: 'Credit Card Payment', keywords: ['credit card', 'cc payment', 'card payment', 'amex', 'hdfc cc', 'icici cc', 'axis cc', 'sbi cc'], color: '#6366f1', icon: '💳' },
  { id: 'rent', name: 'Rent & Housing', keywords: ['rent', 'nobroker', 'society', 'maintenance', 'housing'], color: '#d97706', icon: '🏠' },
  { id: 'salary', name: 'Salary', keywords: ['salary', 'payroll', 'ctc', 'compensation'], color: '#22c55e', icon: '💰' },
  { id: 'other', name: 'Other', keywords: [], color: '#9ca3af', icon: '📌' },
];
