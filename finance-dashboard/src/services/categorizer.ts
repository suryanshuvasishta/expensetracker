import type { Transaction, Category } from '../types';
import { DEFAULT_CATEGORIES } from '../db/database';

export function categorizeTransaction(narration: string, categories: Category[]): string {
  const lower = narration.toLowerCase();
  const cats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  for (const cat of cats) {
    if (cat.id === 'other') continue;
    for (const keyword of cat.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return cat.name;
      }
    }
  }

  return 'Other';
}

export function categorizeTransactions(
  transactions: Transaction[],
  categories: Category[]
): Transaction[] {
  return transactions.map(t => ({
    ...t,
    category: t.category || categorizeTransaction(t.narration, categories),
  }));
}
