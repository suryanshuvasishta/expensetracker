import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function TrendChart({ transactions }: Props) {
  const byMonth: Record<string, { debit: number; credit: number }> = {};

  for (const t of transactions) {
    if (!byMonth[t.month]) byMonth[t.month] = { debit: 0, credit: 0 };
    if (t.type === 'debit' && !t.isCorrelationPair) {
      byMonth[t.month].debit += t.amount;
    } else if (t.type === 'credit') {
      byMonth[t.month].credit += t.amount;
    }
  }

  const data = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, vals]) => {
      const [y, m] = month.split('-');
      return {
        month: `${MONTHS_SHORT[parseInt(m) - 1]} '${y.slice(2)}`,
        Expenses: Math.round(vals.debit),
        Income: Math.round(vals.credit),
      };
    });

  if (data.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
        <span style={{ color: '#475569', fontSize: '0.875rem' }}>Upload statements to see trends</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Monthly Trend (Last 12 months)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area type="monotone" dataKey="Income" stroke="#4ade80" fill="url(#colorIncome)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="Expenses" stroke="#f87171" fill="url(#colorExpenses)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
