import Dexie, { type Table } from 'dexie';
import type { Transaction, Category, UploadedFile, AppSettings, MonthlyBudget, Investment, Liability } from '../types';

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  uploadedFiles!: Table<UploadedFile>;
  settings!: Table<AppSettings & { id: number }>;
  budgets!: Table<MonthlyBudget>;
  investments!: Table<Investment>;
  liabilities!: Table<Liability>;

  constructor() {
    super('FinanceDashboard');
    this.version(1).stores({
      transactions: 'id, date, month, account, category, paymentMethod, type, sourceFile',
      categories: 'id, name',
      uploadedFiles: 'id, account, month, status',
      settings: 'id',
    });
    this.version(2).stores({
      transactions: 'id, date, month, account, category, paymentMethod, type, sourceFile',
      categories: 'id, name',
      uploadedFiles: 'id, account, month, status',
      settings: 'id',
      budgets: 'id, month',
    });
    this.version(3).stores({
      transactions: 'id, date, month, account, category, paymentMethod, type, sourceFile, owner',
      categories: 'id, name',
      uploadedFiles: 'id, account, month, status, owner',
      settings: 'id',
      budgets: 'id, month, owner',
      investments: 'id, owner, assetClass, goal',
    });
    this.version(4).stores({
      transactions: 'id, date, month, account, category, paymentMethod, type, sourceFile, owner',
      categories: 'id, name',
      uploadedFiles: 'id, account, month, status, owner',
      settings: 'id',
      budgets: 'id, month, owner',
      investments: 'id, owner, assetClass, goal',
      liabilities: 'id, owner, type',
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
  // Housing
  { id: 'rent', name: 'Rent', keywords: ['rent', 'nobroker', 'housing rent'], color: '#d97706', icon: '🏠' },
  { id: 'electricity', name: 'Electricity', keywords: ['electricity', 'msedcl', 'bescom', 'torrent power', 'tpddl', 'electric bill'], color: '#facc15', icon: '⚡' },
  { id: 'gas', name: 'Gas', keywords: ['lpg', 'gas', 'cylinder', 'indane', 'hp gas', 'bharat gas', 'piped gas'], color: '#fb923c', icon: '🔥' },
  { id: 'water', name: 'Water', keywords: ['water', 'bmc water', 'municipal water'], color: '#60a5fa', icon: '💧' },
  { id: 'garbage', name: 'Garbage', keywords: ['garbage', 'waste', 'swachh'], color: '#94a3b8', icon: '🗑️' },
  { id: 'internet-phone', name: 'Internet & Phone', keywords: ['airtel', 'jio', 'vi ', 'bsnl', 'broadband', 'internet', 'recharge', 'postpaid', 'prepaid'], color: '#818cf8', icon: '📶' },
  { id: 'home-maintenance', name: 'Home Maintenance', keywords: ['plumber', 'electrician', 'carpenter', 'repair', 'maintenance', 'painting', 'pest control'], color: '#a78bfa', icon: '🔧' },
  { id: 'house-help', name: 'House Help', keywords: ['maid', 'cook', 'iron', 'ironing', 'cleaning lady', 'bai', 'helper'], color: '#c084fc', icon: '🧹' },
  { id: 'cac', name: 'CAC', keywords: ['common area charges', 'cac', 'society maintenance', 'society charges', 'society fee'], color: '#e879f9', icon: '🏢' },
  { id: 'cae', name: 'CAE', keywords: ['common area electricity', 'cae', 'society electricity'], color: '#f0abfc', icon: '💡' },

  // Food
  { id: 'groceries', name: 'Groceries', keywords: ['grocery', 'supermarket', 'dmart', 'reliance fresh', 'more store', 'star bazar', 'jiomart', 'zepto', 'blinkit', 'instamart', 'bigbasket', 'nature basket'], color: '#84cc16', icon: '🛒' },
  { id: 'ordering-in', name: 'Ordering In', keywords: ['swiggy', 'zomato', 'dunzo food', 'food order', 'magicpin'], color: '#f97316', icon: '🛵' },
  { id: 'eating-out', name: 'Eating Out', keywords: ['restaurant', 'cafe', 'hotel', 'dhaba', 'pizza', 'burger', 'mcdonald', 'kfc', 'starbucks', 'dominos', 'subway', 'dining'], color: '#ef4444', icon: '🍽️' },

  // Transportation
  { id: 'fuel', name: 'Fuel', keywords: ['petrol', 'fuel', 'hp petrol', 'iocl', 'bpcl', 'shell', 'diesel', 'cng', 'indian oil'], color: '#06b6d4', icon: '⛽' },
  { id: 'car-maintenance', name: 'Car Maintenance', keywords: ['car service', 'car repair', 'car wash', 'tyre', 'battery', 'maruti', 'honda service', 'hyundai service', 'automobile'], color: '#0ea5e9', icon: '🔩' },
  { id: 'car-cleaner', name: 'Car Cleaner', keywords: ['car clean', 'car cleaner', 'car valet'], color: '#67e8f9', icon: '🧽' },
  { id: 'public-transport', name: 'Public Transport', keywords: ['uber', 'ola', 'rapido', 'metro', 'bus', 'auto', 'rickshaw', 'taxi', 'redbus', 'irctc', 'train', 'flight', 'makemytrip', 'goibibo', 'indigo', 'air india'], color: '#22d3ee', icon: '🚌' },
  { id: 'tolls-parking', name: 'Tolls & Parking', keywords: ['toll', 'parking', 'fastag'], color: '#a5f3fc', icon: '🛣️' },

  // Education
  { id: 'school-fee', name: 'School Fee', keywords: ['school fee', 'tuition fee', 'school', 'daycare', 'preschool', 'nursery fee'], color: '#0ea5e9', icon: '🏫' },
  { id: 'books-courses', name: 'Books & Courses', keywords: ['udemy', 'coursera', 'byju', 'unacademy', 'books', 'kindle', 'course', 'training', 'certification'], color: '#38bdf8', icon: '📚' },
  { id: 'software-services', name: 'Software & Services', keywords: ['github', 'aws', 'google cloud', 'notion', 'dropbox', 'adobe', 'microsoft 365', 'domain', 'hosting', 'software'], color: '#7dd3fc', icon: '💻' },
  { id: 'subscriptions', name: 'Subscriptions', keywords: ['netflix', 'prime', 'hotstar', 'spotify', 'youtube premium', 'apple', 'disney', 'zee5'], color: '#bae6fd', icon: '📺' },
  { id: 'office-supplies', name: 'Office Supplies', keywords: ['stationery', 'pen', 'notebook', 'printer', 'ink', 'office supply'], color: '#93c5fd', icon: '📎' },

  // Healthcare
  { id: 'child-healthcare', name: 'Child Healthcare', keywords: ['pediatric', 'children hospital', 'child doctor', 'vaccination', 'baby', 'kids medicine'], color: '#f472b6', icon: '👶' },
  { id: 'personal-healthcare', name: 'Personal & Spousal Healthcare', keywords: ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'apollo', 'practo', 'netmeds', 'medlife', '1mg', 'medibuddy', 'health checkup', 'dentist', 'lab test', 'diagnostic'], color: '#ec4899', icon: '🏥' },
  { id: 'parental-healthcare', name: 'Parental Healthcare', keywords: ['parental healthcare', 'parent hospital', 'parent doctor'], color: '#f9a8d4', icon: '👴' },

  // Insurance
  { id: 'life-insurance', name: 'Life Insurance', keywords: ['lic', 'life insurance', 'term plan', 'hdfc life', 'icici pru', 'sbi life', 'max life', 'bajaj life'], color: '#10b981', icon: '🛡️' },
  { id: 'health-insurance', name: 'Health Insurance', keywords: ['health insurance', 'mediclaim', 'star health', 'care insurance', 'niva bupa', 'hdfc ergo health'], color: '#34d399', icon: '💊' },
  { id: 'car-insurance', name: 'Car Insurance', keywords: ['car insurance', 'vehicle insurance', 'motor insurance', 'bajaj allianz', 'icici lombard car', 'tata aig'], color: '#6ee7b7', icon: '🚗' },
  { id: 'parental-health-insurance', name: 'Parental Health Insurance', keywords: ['parental health insurance', 'parent mediclaim'], color: '#a7f3d0', icon: '👵' },

  // Miscellaneous
  { id: 'clothes', name: 'Clothes', keywords: ['clothes', 'clothing', 'myntra', 'ajio', 'h&m', 'zara', 'fabindia', 'fashion', 'dress', 'shirt', 'dryclean', 'dry clean', 'laundry', 'nykaa fashion'], color: '#8b5cf6', icon: '👕' },
  { id: 'entertainment', name: 'Movies & Entertainment', keywords: ['bookmyshow', 'pvr', 'inox', 'movie', 'cinema', 'gaming', 'concert', 'event', 'amusement', 'water park'], color: '#ec4899', icon: '🎬' },
  { id: 'petty-expenses', name: 'Petty Expenses', keywords: ['petty', 'miscellaneous', 'misc', 'cash withdrawal', 'atm'], color: '#94a3b8', icon: '💰' },
  { id: 'gifts', name: 'Gifts', keywords: ['gift', 'present', 'amazon gift', 'flowers', 'bouquet', 'igp', 'ferns and petals'], color: '#fb7185', icon: '🎁' },
  { id: 'toys-joyrides', name: 'Toys & Joy Rides', keywords: ['toy', 'firstcry', 'hopscotch', 'lego', 'joy ride', 'kids', 'hamleys'], color: '#fdba74', icon: '🧸' },
  { id: 'online-shopping', name: 'Other Online Shopping', keywords: ['amazon', 'flipkart', 'meesho', 'snapdeal', 'tata cliq', 'nykaa', 'mamaearth', 'boat ', 'croma', 'vijay sales', 'reliance digital'], color: '#fcd34d', icon: '🛍️' },
  { id: 'contingency', name: 'Contingency', keywords: ['contingency', 'emergency fund', 'rainy day'], color: '#fbbf24', icon: '🆘' },
  { id: 'other-expenses', name: 'Other Expenses', keywords: [], color: '#9ca3af', icon: '📌' },

  // One Time
  { id: 'one-time', name: 'One Time Large Expenses', keywords: [], color: '#f59e0b', icon: '⚡' },
  { id: 'car-shopping', name: 'Car Shopping', keywords: ['car purchase', 'car booking', 'car down payment', 'car emi'], color: '#d97706', icon: '🚙' },
  { id: 'home-improvement', name: 'Home Improvement Shopping', keywords: ['ikea', 'urban ladder', 'pepperfry', 'home improvement', 'renovation', 'interior', 'furniture', 'appliance'], color: '#b45309', icon: '🏗️' },
  { id: 'income-tax', name: 'Income Tax', keywords: ['income tax', 'advance tax', 'self assessment tax', 'tds payment', 'challan 280'], color: '#92400e', icon: '📋' },

  // System (not shown in budget)
  { id: 'salary', name: 'Salary', keywords: ['salary', 'payroll', 'ctc', 'compensation', 'wages'], color: '#22c55e', icon: '💰' },
  { id: 'investment-txn', name: 'Investments', keywords: ['zerodha', 'groww', 'sip', 'mutual fund', 'nps', 'ppf', 'fd', 'stock', 'ipo', 'demat', 'smallcase', 'coin by zerodha', 'mf'], color: '#10b981', icon: '📈' },
  { id: 'cc-payment', name: 'Credit Card Payment', keywords: ['credit card payment', 'cc payment', 'card payment outstanding', 'bill payment card', 'cc bill'], color: '#6366f1', icon: '💳' },
  { id: 'transfer', name: 'Transfers', keywords: ['transfer to', 'self transfer', 'own account'], color: '#475569', icon: '↔️' },
];
