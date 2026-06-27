import { create } from 'zustand';
import { db, getCategories } from '../db/database';
import { correlateTransactions } from '../services/correlator';
import { categorizeTransactions } from '../services/categorizer';
import type { Transaction, Category, UploadedFile } from '../types';

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  uploadedFiles: UploadedFile[];
  selectedMonth: string; // YYYY-MM
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  addTransactions: (txns: Transaction[]) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteBySourceFile: (sourceFile: string) => Promise<void>;
  setSelectedMonth: (month: string) => void;
  setCategories: (cats: Category[]) => Promise<void>;
  addUploadedFile: (file: UploadedFile) => Promise<void>;
  updateUploadedFile: (id: string, patch: Partial<UploadedFile>) => Promise<void>;
  rerunCorrelation: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  transactions: [],
  categories: [],
  uploadedFiles: [],
  selectedMonth: new Date().toISOString().slice(0, 7),
  isLoading: false,
  error: null,

  async loadAll() {
    set({ isLoading: true });
    try {
      const [transactions, categories, uploadedFiles] = await Promise.all([
        db.transactions.orderBy('date').reverse().toArray(),
        getCategories(),
        db.uploadedFiles.toArray(),
      ]);
      set({ transactions, categories, uploadedFiles, isLoading: false });
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
}));
