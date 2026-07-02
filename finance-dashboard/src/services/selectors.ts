import type { Transaction, Category, Owner } from '../types';
import { isNonBudgetGroup } from '../types';
import { CC_ACCOUNTS } from './correlator';

// Canonical definitions of "spend" and "income" — every page/chart must go through
// these so totals agree everywhere. Correlation pairs (the bank-side duplicate of a
// CC payment or Paytm wallet spend) are never counted; internal-movement categories
// (Transfers, Credit Card Payment, Investments) are money moving between our own
// accounts, not income.
const INTERNAL_CATEGORIES = new Set(['Credit Card Payment', 'Transfers', 'Investments']);

export function filterTxns(
  txns: Transaction[],
  opts: { month?: string; owner?: Owner | 'All' }
): Transaction[] {
  return txns.filter(t => {
    if (opts.month && t.month !== opts.month) return false;
    if (opts.owner && opts.owner !== 'All' && t.owner !== opts.owner) return false;
    return true;
  });
}

export function isSpend(t: Transaction): boolean {
  return t.type === 'debit' && !t.isCorrelationPair && !INTERNAL_CATEGORIES.has(t.category);
}

export function isIncome(t: Transaction): boolean {
  return t.type === 'credit' && !t.isCorrelationPair && !INTERNAL_CATEGORIES.has(t.category);
}

export function spendTxns(txns: Transaction[]): Transaction[] {
  return txns.filter(isSpend);
}

export function incomeTxns(txns: Transaction[]): Transaction[] {
  return txns.filter(isIncome);
}

export function totalSpend(txns: Transaction[]): number {
  return spendTxns(txns).reduce((s, t) => s + t.amount, 0);
}

export function totalIncome(txns: Transaction[]): number {
  return incomeTxns(txns).reduce((s, t) => s + t.amount, 0);
}

export function ccSpend(txns: Transaction[]): number {
  return txns
    .filter(t => t.type === 'debit' && !t.isCorrelationPair && CC_ACCOUNTS.includes(t.account))
    .reduce((s, t) => s + t.amount, 0);
}

export function byCategory(txns: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of spendTxns(txns)) {
    const cat = t.category || 'Uncategorized';
    out[cat] = (out[cat] || 0) + t.amount;
  }
  return out;
}

export function byPaymentMethod(txns: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of spendTxns(txns)) {
    const m = t.paymentMethod || 'Other';
    out[m] = (out[m] || 0) + t.amount;
  }
  return out;
}

/** Spend grouped by the category's group (Housing, Food, …) using the live category list. */
export function byCategoryGroup(txns: Transaction[], categories: Category[]): Record<string, number> {
  const groupByName = new Map(categories.map(c => [c.name, c.group || 'Miscellaneous']));
  const out: Record<string, number> = {};
  for (const t of spendTxns(txns)) {
    const g = groupByName.get(t.category) || 'Miscellaneous';
    out[g] = (out[g] || 0) + t.amount;
  }
  return out;
}

/** True if the transaction's category belongs to a budgetable spend group. */
export function isBudgetableSpend(t: Transaction, categories: Category[]): boolean {
  if (!isSpend(t)) return false;
  const cat = categories.find(c => c.name === t.category);
  return !isNonBudgetGroup(cat?.group);
}

/** Previous calendar month of a YYYY-MM string. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** % change of a metric vs the previous month; null when there's no baseline. */
export function momDelta(
  txns: Transaction[],
  month: string,
  owner: Owner | 'All',
  metric: (txns: Transaction[]) => number
): number | null {
  const prev = metric(filterTxns(txns, { month: previousMonth(month), owner }));
  if (prev === 0) return null;
  const cur = metric(filterTxns(txns, { month, owner }));
  return ((cur - prev) / prev) * 100;
}

/** The last `n` months ending at `endMonth` (inclusive), as YYYY-MM strings. */
export function lastNMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export interface MonthlyFlow {
  month: string; // YYYY-MM
  income: number;
  spend: number;
  net: number;
}

/** Income/spend/net per month for the last `n` months, owner-filtered. */
export function monthlyFlows(
  txns: Transaction[],
  endMonth: string,
  n: number,
  owner: Owner | 'All'
): MonthlyFlow[] {
  const ownerTxns = filterTxns(txns, { owner });
  const byMonth = new Map<string, { income: number; spend: number }>();
  for (const t of ownerTxns) {
    let e = byMonth.get(t.month);
    if (!e) { e = { income: 0, spend: 0 }; byMonth.set(t.month, e); }
    if (isSpend(t)) e.spend += t.amount;
    else if (isIncome(t)) e.income += t.amount;
  }
  return lastNMonths(endMonth, n).map(month => {
    const e = byMonth.get(month) || { income: 0, spend: 0 };
    return { month, income: e.income, spend: e.spend, net: e.income - e.spend };
  });
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTHS_SHORT[parseInt(m) - 1]} '${y.slice(2)}`;
}

/** Financial year (Apr–Mar) containing the given YYYY-MM, e.g. "FY25-26". */
export function fyOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `FY${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

/** All YYYY-MM months of the FY containing `month`, up to and including `month`. */
export function fyMonthsUpTo(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  const months: string[] = [];
  let cy = startYear, cm = 4;
  while (cy < y || (cy === y && cm <= m)) {
    months.push(`${cy}-${String(cm).padStart(2, '0')}`);
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }
  return months;
}
