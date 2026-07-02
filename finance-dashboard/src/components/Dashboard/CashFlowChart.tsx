import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { Transaction, Owner } from '../../types';
import { monthlyFlows, formatMonthLabel } from '../../services/selectors';

interface Props {
  transactions: Transaction[];
  endMonth: string;
  owner: Owner | 'All';
  months?: number;
}

const COLORS = { income: '#4ade80', spend: '#f87171', net: '#60a5fa' };

export function CashFlowChart({ transactions, endMonth, owner, months = 6 }: Props) {
  const flows = monthlyFlows(transactions, endMonth, months, owner);
  const hasData = flows.some(f => f.income > 0 || f.spend > 0);

  const data = flows.map(f => ({
    month: formatMonthLabel(f.month),
    Income: Math.round(f.income),
    Expenses: Math.round(f.spend),
    Net: Math.round(f.net),
  }));

  if (!hasData) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
        <span style={{ color: '#475569', fontSize: '0.875rem' }}>Upload statements to see cash flow</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>
        Cash Flow — money in vs money out
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #1e293b)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
          />
          <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{v}</span>} />
          <ReferenceLine y={0} stroke="#334155" />
          <Bar dataKey="Income" fill={COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="Expenses" fill={COLORS.spend} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line type="monotone" dataKey="Net" stroke={COLORS.net} strokeWidth={2} dot={{ r: 3, fill: COLORS.net }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
