import { create } from 'zustand';
import { db, getCategories } from '../db/database';
import { correlateTransactions } from '../services/correlator';
import { categorizeTransactions } from '../services/categorizer';
import type { Transaction, Category, UploadedFile, MonthlyBudget, Investment, Liability, Owner } from '../types';

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  uploadedFiles: UploadedFile[];
  budgets: MonthlyBudget[];
  investments: Investment[];
  liabilities: Liability[];
  selectedMonth: string; // YYYY-MM
  selectedOwner: Owner | 'All'; // persona filter
  theme: 'dark' | 'light';
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  addTransactions: (txns: Transaction[]) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteBySourceFile: (sourceFile: string) => Promise<void>;
  setSelectedMonth: (month: string) => void;
  setSelectedOwner: (owner: Owner | 'All') => void;
  setTheme: (t: 'dark' | 'light') => void;
  setCategories: (cats: Category[]) => Promise<void>;
  addUploadedFile: (file: UploadedFile) => Promise<void>;
  updateUploadedFile: (id: string, patch: Partial<UploadedFile>) => Promise<void>;
  rerunCorrelation: () => Promise<void>;
  saveBudget: (budget: MonthlyBudget) => Promise<void>;
  getBudget: (owner: Owner, month: string) => MonthlyBudget | undefined;
  saveInvestment: (inv: Investment) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  bulkSaveInvestments: (invs: Investment[]) => Promise<void>;
  saveLiability: (l: Liability) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  transactions: [],
  categories: [],
  uploadedFiles: [],
  budgets: [],
  investments: [],
  liabilities: [],
  selectedMonth: new Date().toISOString().slice(0, 7),
  selectedOwner: 'Suryanshu',
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  isLoading: false,
  error: null,

  async loadAll() {
    set({ isLoading: true });
    try {
      const [transactions, categories, uploadedFiles, budgets, investments, liabilities] = await Promise.all([
        db.transactions.orderBy('date').reverse().toArray(),
        getCategories(),
        db.uploadedFiles.toArray(),
        db.budgets.toArray(),
        db.investments.toArray(),
        db.liabilities.toArray(),
      ]);
      set({ transactions, categories, uploadedFiles, budgets, investments, liabilities, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  async addTransactions(newTxns: Transaction[]) {
    const { categories, transactions } = get();

    // Categorize
    const categorized = categorizeTransactions(newTxns, categories);

    // Merge with existing and re-run correlation
    const allTxns = [...transactions, ...categorized];
    const correlated = correlateTransactions(allTxns);

    await db.transactions.bulkPut(correlated);
    set({ transactions: correlated });
  },

  async updateTransaction(id, patch) {
    await db.transactions.update(id, patch);
    set(state => ({
      transactions: state.transactions.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  },

  async deleteTransaction(id) {
    await db.transactions.delete(id);
    set(state => ({
      transactions: state.transactions.filter(t => t.id !== id),
    }));
  },

  async deleteBySourceFile(sourceFile) {
    const ids = (await db.transactions.where('sourceFile').equals(sourceFile).toArray()).map(t => t.id);
    await db.transactions.bulkDelete(ids);
    await db.uploadedFiles.where('name').equals(sourceFile).delete();
    set(state => ({
      transactions: state.transactions.filter(t => t.sourceFile !== sourceFile),
      uploadedFiles: state.uploadedFiles.filter(f => f.name !== sourceFile),
    }));
  },

  setSelectedMonth(month) {
    set({ selectedMonth: month });
  },

  setSelectedOwner(owner) {
    set({ selectedOwner: owner });
  },

  setTheme(t) {
    localStorage.setItem('theme', t);
    set({ theme: t });
  },

  async setCategories(cats: Category[]) {
    await db.categories.clear();
    await db.categories.bulkPut(cats);
    set({ categories: cats });
  },

  async addUploadedFile(file: UploadedFile) {
    await db.uploadedFiles.put(file);
    set(state => ({ uploadedFiles: [...state.uploadedFiles.filter(f => f.id !== file.id), file] }));
  },

  async updateUploadedFile(id, patch) {
    await db.uploadedFiles.update(id, patch);
    set(state => ({
      uploadedFiles: state.uploadedFiles.map(f => f.id === id ? { ...f, ...patch } : f),
    }));
  },

  async rerunCorrelation() {
    const { transactions, categories } = get();
    const categorized = categorizeTransactions(transactions, categories);
    const correlated = correlateTransactions(categorized);
    await db.transactions.bulkPut(correlated);
    set({ transactions: correlated });
  },

  async saveBudget(budget: MonthlyBudget) {
    await db.budgets.put(budget);
    set(state => ({
      budgets: [...state.budgets.filter(b => b.id !== budget.id), budget],
    }));
  },

  getBudget(owner: Owner, month: string) {
    return get().budgets.find(b => b.owner === owner && b.month === month);
  },

  async saveInvestment(inv: Investment) {
    await db.investments.put(inv);
    set(state => ({
      investments: [...state.investments.filter(i => i.id !== inv.id), inv],
    }));
  },

  async deleteInvestment(id: string) {
    await db.investments.delete(id);
    set(state => ({ investments: state.investments.filter(i => i.id !== id) }));
  },

  async bulkSaveInvestments(invs: Investment[]) {
    await db.investments.bulkPut(invs);
    const ids = new Set(invs.map(i => i.id));
    set(state => ({
      investments: [...state.investments.filter(i => !ids.has(i.id)), ...invs],
    }));
  },

  async saveLiability(l: Liability) {
    await db.liabilities.put(l);
    set(state => ({
      liabilities: [...state.liabilities.filter(x => x.id !== l.id), l],
    }));
  },

  async deleteLiability(id: string) {
    await db.liabilities.delete(id);
    set(state => ({ liabilities: state.liabilities.filter(x => x.id !== id) }));
  },
}));
