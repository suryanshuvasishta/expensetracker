import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Transaction } from '../../types';

const METHOD_COLORS: Record<string, string> = {
  'UPI': '#818cf8',
  'Credit Card': '#f472b6',
  'Debit Card': '#fb923c',
  'NEFT': '#34d399',
  'IMPS': '#22d3ee',
  'RTGS': '#a78bfa',
  'Net Banking': '#60a5fa',
  'Cash': '#fbbf24',
  'EMI': '#f87171',
  'Cheque': '#94a3b8',
  'Other': '#64748b',
};

interface Props {
  transactions: Transaction[];
}

export function PaymentMethodChart({ transactions }: Props) {
  const debits = transactions.filter(t => t.type === 'debit');

  const breakdown: Record<string, number> = {};
  for (const t of debits) {
    const m = t.paymentMethod || 'Other';
    breakdown[m] = (breakdown[m] || 0) + t.amount;
  }

  const data = Object.entries(breakdown)
    .map(([method, amount]) => ({ method, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  if (data.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
        <span style={{ color: '#475569', fontSize: '0.875rem' }}>No data</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>By Payment Method</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="method"
            width={90}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount']}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={METHOD_COLORS[entry.method] || '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
