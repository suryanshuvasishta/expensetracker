import type { Transaction, Category, CategoryRule } from '../types';
import { DEFAULT_CATEGORIES } from '../db/database';

export function categorizeTransaction(narration: string, categories: Category[], userRules: CategoryRule[] = []): string {
  const lower = narration.toLowerCase();

  // User-defined rules take priority
  for (const rule of userRules) {
    if (lower.includes(rule.keyword.toLowerCase())) return rule.category;
  }

  const cats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  for (const cat of cats) {
    if (cat.id === 'other') continue;
    for (const keyword of cat.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return cat.name;
      }
    }
  }

  return 'Other Expenses';
}

export function categorizeTransactions(
  transactions: Transaction[],
  categories: Category[],
  userRules: CategoryRule[] = []
): Transaction[] {
  return transactions.map(t => ({
    ...t,
    category: t.category || categorizeTransaction(t.narration, categories, userRules),
  }));
}
