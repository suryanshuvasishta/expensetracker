import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { TrendChart } from '../Dashboard/TrendChart';
import { filterTxns, spendTxns, isSpend, formatMonthLabel } from '../../services/selectors';
import type { Category, Transaction } from '../../types';

export function TrendsPage() {
  const { transactions, categories, selectedOwner } = useStore();
  const [view, setView] = useState<'category' | 'account' | 'method'>('category');

  const ownerTxns = filterTxns(transactions, { owner: selectedOwner });
  const months = [...new Set(ownerTxns.map(t => t.month))].sort().slice(-12);

  const topCategories = getTopN(spendTxns(ownerTxns), t => t.category || 'Other', 6);

  const stackedData = months.map(m => {
    const row: Record<string, any> = { month: formatMonthLabel(m) };
    const mTxns = spendTxns(ownerTxns.filter(t => t.month === m));

    if (view === 'category') {
      for (const cat of topCategories) {
        row[cat] = Math.round(mTxns.filter(t => (t.category || 'Other') === cat).reduce((s, t) => s + t.amount, 0));
      }
    } else if (view === 'account') {
      const accounts = [...new Set(ownerTxns.map(t => t.account))];
      for (const acc of accounts) {
        row[acc] = Math.round(mTxns.filter(t => t.account === acc).reduce((s, t) => s + t.amount, 0));
      }
    } else {
      const methods = [...new Set(ownerTxns.map(t => t.paymentMethod))];
      for (const m2 of methods) {
        row[m2] = Math.round(mTxns.filter(t => t.paymentMethod === m2).reduce((s, t) => s + t.amount, 0));
      }
    }
    return row;
  });

  const keys = view === 'category' ? topCategories :
    view === 'account' ? [...new Set(ownerTxns.map(t => t.account))] :
    [...new Set(ownerTxns.map(t => t.paymentMethod))];

  const FALLBACK_COLORS = ['#818cf8', '#f472b6', '#fb923c', '#34d399', '#22d3ee', '#a78bfa', '#60a5fa', '#fbbf24', '#f87171'];
  // Category view reuses the same DB-backed colors as the Dashboard donut, so a
  // category is the same color on every page.
  const colorFor = (key: string, i: number) =>
    view === 'category'
      ? (categories.find(c => c.name === key)?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length])
      : FALLBACK_COLORS[i % FALLBACK_COLORS.length];

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Trends" />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>

        {/* 12-month income vs expenses */}
        <TrendChart transactions={ownerTxns} />

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['category', 'account', 'method'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={view === v ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', textTransform: 'capitalize' }}
            >
              By {v}
            </button>
          ))}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem', fontSize: '0.9375rem', fontWeight: 600 }}>
            Monthly Expenses — Stacked by {view}
          </h3>
          {months.length === 0 ? (
            <p style={{ color: '#475569', textAlign: 'center', padding: '3rem 0' }}>Upload statements to see trends</p>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
                />
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{v}</span>} />
                {keys.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={colorFor(k, i)} radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category summary table */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Category Summary (All Time)</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Spent</th>
                  <th>Transactions</th>
                  <th>Avg per Transaction</th>
                </tr>
              </thead>
              <tbody>
                {getCategorySummary(ownerTxns, categories).map(row => (
                  <tr key={row.name}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        {row.name}
                      </span>
                    </td>
                    <td className="debit">₹{Math.round(row.total).toLocaleString('en-IN')}</td>
                    <td style={{ color: '#94a3b8' }}>{row.count}</td>
                    <td style={{ color: '#94a3b8' }}>₹{Math.round(row.total / row.count).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTopN(txns: Transaction[], keyFn: (t: Transaction) => string, n: number): string[] {
  const totals: Record<string, number> = {};
  for (const t of txns) {
    const k = keyFn(t);
    totals[k] = (totals[k] || 0) + t.amount;
  }
  return Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, n).map(([k]) => k);
}

function getCategorySummary(transactions: Transaction[], categories: Category[]) {
  const debits = transactions.filter(isSpend);
  const summary: Record<string, { total: number; count: number; color: string }> = {};
  for (const t of debits) {
    const cat = t.category || 'Other';
    if (!summary[cat]) {
      const color = categories.find(c => c.name === cat)?.color || '#94a3b8';
      summary[cat] = { total: 0, count: 0, color };
    }
    summary[cat].total += t.amount;
    summary[cat].count++;
  }
  return Object.entries(summary)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
}
