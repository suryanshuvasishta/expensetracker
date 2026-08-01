import { create } from 'zustand';
import { db, getCategories, getGoals } from '../db/database';
import { correlateTransactions } from '../services/correlator';
import { categorizeTransactions } from '../services/categorizer';
import type { Transaction, Category, UploadedFile, MonthlyBudget, Investment, Liability, Owner, CategoryRule, Goal } from '../types';

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  uploadedFiles: UploadedFile[];
  budgets: MonthlyBudget[];
  investments: Investment[];
  liabilities: Liability[];
  categoryRules: CategoryRule[];
  goals: Goal[];
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
  deleteTransactionsForMonth: (month: string) => Promise<number>;
  setSelectedMonth: (month: string) => void;
  setSelectedOwner: (owner: Owner | 'All') => void;
  setTheme: (t: 'dark' | 'light') => void;
  setCategories: (cats: Category[]) => Promise<void>;
  addCategory: (cat: Category) => Promise<void>;
  addUploadedFile: (file: UploadedFile) => Promise<void>;
  updateUploadedFile: (id: string, patch: Partial<UploadedFile>) => Promise<void>;
  rerunCorrelation: () => Promise<void>;
  recategorizeUncategorized: () => Promise<number>;
  saveBudget: (budget: MonthlyBudget) => Promise<void>;
  getBudget: (owner: Owner, month: string) => MonthlyBudget | undefined;
  saveInvestment: (inv: Investment) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  deleteInvestments: (ids: string[]) => Promise<void>;
  bulkSaveInvestments: (invs: Investment[]) => Promise<void>;
  addGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  saveLiability: (l: Liability) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
  saveCategoryRule: (rule: CategoryRule) => Promise<void>;
  deleteCategoryRule: (id: string) => Promise<void>;
  applyRuleToAll: (keyword: string, category: string) => Promise<number>;
}

export const useStore = create<AppState>((set, get) => ({
  transactions: [],
  categories: [],
  uploadedFiles: [],
  budgets: [],
  investments: [],
  liabilities: [],
  categoryRules: [],
  goals: [],
  selectedMonth: new Date().toISOString().slice(0, 7),
  selectedOwner: 'Suryanshu',
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
  isLoading: false,
  error: null,

  async loadAll() {
    set({ isLoading: true });
    try {
      const [transactions, categories, uploadedFiles, budgets, investments, liabilities, categoryRules, goals] = await Promise.all([
        db.transactions.orderBy('date').reverse().toArray(),
        getCategories(),
        db.uploadedFiles.toArray(),
        db.budgets.toArray(),
        db.investments.toArray(),
        db.liabilities.toArray(),
        db.categoryRules.toArray(),
        getGoals(),
      ]);
      set({ transactions, categories, uploadedFiles, budgets, investments, liabilities, categoryRules, goals, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  async addTransactions(newTxns: Transaction[]) {
    const { categories, transactions, categoryRules } = get();

    // Categorize
    const categorized = categorizeTransactions(newTxns, categories, categoryRules);

    // Merge with existing and re-run correlation
    const allTxns = [...transactions, ...categorized];
    const correlated = correlateTransactions(allTxns);

    await db.transactions.bulkPut(correlated);
    set({ transactions: correlated });
  },

  async updateTransaction(id, patch) {
    const stamped = { ...patch, updatedAt: new Date().toISOString() };
    await db.transactions.update(id, stamped);
    set(state => ({
      transactions: state.transactions.map(t => t.id === id ? { ...t, ...stamped } : t),
    }));
  },

  async deleteTransaction(id) {
    await db.transactions.delete(id);
    await db.tombstones.put({ id, deletedAt: new Date().toISOString() });
    set(state => ({
      transactions: state.transactions.filter(t => t.id !== id),
    }));
  },

  async deleteBySourceFile(sourceFile) {
    const ids = (await db.transactions.where('sourceFile').equals(sourceFile).toArray()).map(t => t.id);
    await db.transactions.bulkDelete(ids);
    const deletedAt = new Date().toISOString();
    await db.tombstones.bulkPut(ids.map(id => ({ id, deletedAt })));
    await db.uploadedFiles.where('name').equals(sourceFile).delete();
    set(state => ({
      transactions: state.transactions.filter(t => t.sourceFile !== sourceFile),
      uploadedFiles: state.uploadedFiles.filter(f => f.name !== sourceFile),
    }));
  },

  async deleteTransactionsForMonth(month) {
    const ids = (await db.transactions.where('month').equals(month).toArray()).map(t => t.id);
    if (ids.length === 0) return 0;
    await db.transactions.bulkDelete(ids);
    const deletedAt = new Date().toISOString();
    await db.tombstones.bulkPut(ids.map(id => ({ id, deletedAt })));
    // Tombstoning (not just deleting) is what makes this stick across Drive sync —
    // a plain delete would get silently pulled back in from the device's own last
    // backup on the next sync, which is what "Clear all data" used to do wrong.
    await db.uploadedFiles.where('month').equals(month).delete();
    set(state => ({
      transactions: state.transactions.filter(t => t.month !== month),
      uploadedFiles: state.uploadedFiles.filter(f => f.month !== month),
    }));
    return ids.length;
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

  async addCategory(cat: Category) {
    await db.categories.put(cat);
    set(state => ({ categories: [...state.categories.filter(c => c.id !== cat.id), cat] }));
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
    const { transactions, categories, categoryRules } = get();
    const categorized = categorizeTransactions(transactions, categories, categoryRules);
    const correlated = correlateTransactions(categorized);
    await db.transactions.bulkPut(correlated);
    set({ transactions: correlated });
  },

  // Re-runs keyword matching on transactions that never got a real category
  // ('Other Expenses' fallback or empty). Manual corrections are never touched,
  // so editing keywords in Settings safely propagates to existing data.
  async recategorizeUncategorized() {
    const { transactions, categories, categoryRules } = get();
    const cleared = transactions.map(t =>
      t.category === 'Other Expenses' || !t.category ? { ...t, category: '' } : t
    );
    const categorized = categorizeTransactions(cleared, categories, categoryRules);
    const changed = categorized.filter((t, i) => t.category !== transactions[i].category);
    if (changed.length > 0) {
      await db.transactions.bulkPut(changed);
      set({ transactions: categorized });
    }
    return changed.length;
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

  async deleteInvestments(ids: string[]) {
    if (ids.length === 0) return;
    await db.investments.bulkDelete(ids);
    const idSet = new Set(ids);
    set(state => ({ investments: state.investments.filter(i => !idSet.has(i.id)) }));
  },

  async bulkSaveInvestments(invs: Investment[]) {
    await db.investments.bulkPut(invs);
    const ids = new Set(invs.map(i => i.id));
    set(state => ({
      investments: [...state.investments.filter(i => !ids.has(i.id)), ...invs],
    }));
  },

  async addGoal(goal: Goal) {
    await db.goals.put(goal);
    set(state => ({ goals: [...state.goals.filter(g => g.id !== goal.id), goal] }));
  },

  async deleteGoal(id: string) {
    await db.goals.delete(id);
    set(state => ({ goals: state.goals.filter(g => g.id !== id) }));
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

  async saveCategoryRule(rule: CategoryRule) {
    await db.categoryRules.put(rule);
    set(state => ({
      categoryRules: [...state.categoryRules.filter(r => r.id !== rule.id), rule],
    }));
  },

  async deleteCategoryRule(id: string) {
    await db.categoryRules.delete(id);
    set(state => ({ categoryRules: state.categoryRules.filter(r => r.id !== id) }));
  },

  async applyRuleToAll(keyword: string, category: string) {
    const lower = keyword.toLowerCase();
    const { transactions } = get();
    const matches = transactions.filter(t =>
      t.narration.toLowerCase().includes(lower) && t.category !== category
    );
    if (matches.length === 0) return 0;
    const patched = matches.map(t => ({ ...t, category }));
    await db.transactions.bulkPut(patched);
    set(state => ({
      transactions: state.transactions.map(t => {
        const p = patched.find(x => x.id === t.id);
        return p ? p : t;
      }),
    }));
    return matches.length;
  },
}));
