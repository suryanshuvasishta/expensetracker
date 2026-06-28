import type { Transaction, MonthlyBudget, Investment, Liability, Category } from '../types';
import { db } from '../db/database';

export interface SnapshotMeta {
  version: '2.0';
  exportedAt: string;
  filterType: 'month' | 'fy' | 'all';
  filterLabel: string;
}

export interface Snapshot extends SnapshotMeta {
  transactions: Transaction[];
  budgets: MonthlyBudget[];
  investments: Investment[];
  liabilities: Liability[];
  categories: Category[];
}

export function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

export function getFYMonthRange(fy: string): { start: string; end: string } {
  const [startYear] = fy.split('-');
  return {
    start: `${startYear}-04`,
    end: `${parseInt(startYear) + 1}-03`,
  };
}

export async function exportSnapshot(
  transactions: Transaction[],
  budgets: MonthlyBudget[],
  investments: Investment[],
  liabilities: Liability[],
  categories: Category[],
  filterType: 'month' | 'fy' | 'all',
  filterValue: string // month 'YYYY-MM', fy '2025-26', or '' for all
): Promise<void> {
  let filteredTxns = transactions;
  let filteredBudgets = budgets;
  let filterLabel = 'All Time';

  if (filterType === 'month') {
    filteredTxns = transactions.filter(t => t.month === filterValue);
    filteredBudgets = budgets.filter(b => b.month === filterValue);
    filterLabel = filterValue;
  } else if (filterType === 'fy') {
    const { start, end } = getFYMonthRange(filterValue);
    filteredTxns = transactions.filter(t => t.month >= start && t.month <= end);
    filteredBudgets = budgets.filter(b => b.month >= start && b.month <= end);
    filterLabel = `FY ${filterValue}`;
  }

  const snapshot: Snapshot = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    filterType,
    filterLabel,
    transactions: filteredTxns,
    budgets: filteredBudgets,
    investments,
    liabilities,
    categories,
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-snapshot-${filterLabel.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importSnapshot(file: File): Promise<{ imported: number; type: string }> {
  const text = await file.text();
  const snapshot: Snapshot = JSON.parse(text);

  if (!snapshot.version || !snapshot.transactions) {
    throw new Error('Invalid snapshot file format');
  }

  // Merge (upsert by id — existing records with same id are overwritten)
  await db.transactions.bulkPut(snapshot.transactions);
  if (snapshot.budgets?.length) await db.budgets.bulkPut(snapshot.budgets);
  if (snapshot.investments?.length) await db.investments.bulkPut(snapshot.investments);
  if (snapshot.liabilities?.length) await db.liabilities.bulkPut(snapshot.liabilities);
  if (snapshot.categories?.length) await db.categories.bulkPut(snapshot.categories);

  return {
    imported: snapshot.transactions.length,
    type: snapshot.filterLabel || 'Unknown',
  };
}
