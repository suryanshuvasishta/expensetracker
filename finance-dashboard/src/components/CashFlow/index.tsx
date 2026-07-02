import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import {
  filterTxns, incomeTxns, totalIncome, totalSpend, byCategoryGroup,
  monthlyFlows, formatMonthLabel, fyOf, fyMonthsUpTo,
} from '../../services/selectors';
import type { Transaction } from '../../types';

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Greens for income sources — identity is also carried by row labels, not color alone.
const INCOME_COLORS = ['#22c55e', '#4ade80', '#86efac', '#16a34a', '#a7f3d0', '#059669'];

export function CashFlowPage() {
  const { transactions, categories, selectedMonth, selectedOwner } = useStore();

  const monthTxns = filterTxns(transactions, { month: selectedMonth, owner: selectedOwner });
  const fyMonths = fyMonthsUpTo(selectedMonth);
  const fyTxns = filterTxns(transactions, { owner: selectedOwner }).filter(t => fyMonths.includes(t.month));

  const income = totalIncome(monthTxns);
  const spend = totalSpend(monthTxns);

  // Income grouped by category for the selected month and FY-to-date
  const incomeByCategory = (txns: Transaction[]) => {
    const out: Record<string, number> = {};
    for (const t of incomeTxns(txns)) {
      const cat = t.category || 'Uncategorized';
      out[cat] = (out[cat] || 0) + t.amount;
    }
    return out;
  };
  const monthIncomeByCat = incomeByCategory(monthTxns);
  const fyIncomeByCat = incomeByCategory(fyTxns);
  const incomeCats = [...new Set([...Object.keys(monthIncomeByCat), ...Object.keys(fyIncomeByCat)])]
    .sort((a, b) => (fyIncomeByCat[b] || 0) - (fyIncomeByCat[a] || 0));

  // Spend by category group for the month
  const spendByGroup = Object.entries(byCategoryGroup(monthTxns, categories))
    .sort(([, a], [, b]) => b - a);
  const groupColor = (group: string) =>
    categories.find(c => (c.group || 'Miscellaneous') === group)?.color || '#94a3b8';

  // In-vs-out comparison: one row for money in (stacked income sources), one for money out (stacked spend groups)
  const inRow: Record<string, any> = { label: 'Money In' };
  incomeCats.forEach(cat => { if (monthIncomeByCat[cat]) inRow[cat] = Math.round(monthIncomeByCat[cat]); });
  const outRow: Record<string, any> = { label: 'Money Out' };
  spendByGroup.forEach(([g, v]) => { outRow[g] = Math.round(v); });
  const flowData = [inRow, outRow];
  const inKeys = incomeCats.filter(c => monthIncomeByCat[c]);
  const outKeys = spendByGroup.map(([g]) => g);

  // 12-month savings rate
  const flows = monthlyFlows(transactions, selectedMonth, 12, selectedOwner);
  const savingsData = flows
    .filter(f => f.income > 0)
    .map(f => ({
      month: formatMonthLabel(f.month),
      'Savings Rate': Math.round(((f.income - f.spend) / f.income) * 1000) / 10,
    }));

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Cash Flow" />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>

        {/* Headline */}
        <div className="card" style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Money In ({selectedMonth})</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>{fmt(income)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Money Out</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>{fmt(spend)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Saved</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: income - spend >= 0 ? '#4ade80' : '#f87171' }}>
              {income - spend >= 0 ? '+' : '-'}{fmt(Math.abs(income - spend))}
              {income > 0 && (
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#64748b', marginLeft: '0.5rem' }}>
                  ({(((income - spend) / income) * 100).toFixed(0)}% of income)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* In vs Out composition */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>
            Where money comes from → where it goes ({selectedMonth})
          </h3>
          {income === 0 && spend === 0 ? (
            <p style={{ color: '#475569', textAlign: 'center', padding: '2rem 0' }}>No transactions for this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={flowData} layout="vertical" barSize={36} margin={{ left: 10, right: 20 }}>
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                  axisLine={false} tickLine={false}
                />
                <YAxis type="category" dataKey="label" width={80} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any, name: any) => [fmt(Number(v)), name]}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
                />
                {inKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="flow" fill={INCOME_COLORS[i % INCOME_COLORS.length]} stroke="var(--bg-card, #1e293b)" strokeWidth={1} />
                ))}
                {outKeys.map(k => (
                  <Bar key={k} dataKey={k} stackId="flow" fill={groupColor(k)} stroke="var(--bg-card, #1e293b)" strokeWidth={1} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Direct labels below the chart (identity not by color alone) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            {inKeys.map((k, i) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: INCOME_COLORS[i % INCOME_COLORS.length] }} />
                {k}: {fmt(monthIncomeByCat[k])}
              </span>
            ))}
            {outKeys.map(k => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, borderRadius: '2px', background: groupColor(k) }} />
                {k}: {fmt(outRow[k])}
              </span>
            ))}
          </div>
        </div>

        {/* Income sources table */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Income Sources</h3>
          {incomeCats.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>
              No income recorded yet. Credits from your bank statements appear here — reclassify them
              (Salary, Dividends, Interest…) on the Transactions page if they show as something else.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>{selectedMonth}</th>
                    <th>{fyOf(selectedMonth)} to date</th>
                    <th>Monthly avg ({fyOf(selectedMonth)})</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeCats.map(cat => (
                    <tr key={cat}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: categories.find(c => c.name === cat)?.color || '#4ade80', flexShrink: 0 }} />
                          {cat}
                        </span>
                      </td>
                      <td className="credit">{monthIncomeByCat[cat] ? fmt(monthIncomeByCat[cat]) : '—'}</td>
                      <td style={{ color: '#94a3b8' }}>{fyIncomeByCat[cat] ? fmt(fyIncomeByCat[cat]) : '—'}</td>
                      <td style={{ color: '#64748b' }}>{fyIncomeByCat[cat] ? fmt(fyIncomeByCat[cat] / fyMonths.length) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 600 }}>
                    <td>Total</td>
                    <td className="credit">{fmt(income)}</td>
                    <td style={{ color: '#cbd5e1' }}>{fmt(Object.values(fyIncomeByCat).reduce((s, v) => s + v, 0))}</td>
                    <td style={{ color: '#94a3b8' }}>{fmt(Object.values(fyIncomeByCat).reduce((s, v) => s + v, 0) / fyMonths.length)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Savings rate trend */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Savings Rate — last 12 months</h3>
          {savingsData.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>Needs at least one month with recorded income.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={savingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, 'Savings rate']}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
                />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{v}</span>} />
                <Line type="monotone" dataKey="Savings Rate" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}
