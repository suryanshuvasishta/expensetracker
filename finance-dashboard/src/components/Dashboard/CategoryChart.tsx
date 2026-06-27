import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Transaction, Category } from '../../types';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

const RADIAN = Math.PI / 180;

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function CategoryChart({ transactions, categories }: Props) {
  const debits = transactions.filter(t => t.type === 'debit' && !t.isCorrelationPair);

  const breakdown: Record<string, number> = {};
  for (const t of debits) {
    const cat = t.category || 'Other';
    breakdown[cat] = (breakdown[cat] || 0) + t.amount;
  }

  const data = Object.entries(breakdown)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      color: categories.find(c => c.name === name)?.color || '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <span style={{ color: '#475569', fontSize: '0.875rem' }}>No expense data for this month</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Expenses by Category</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={110}
            innerRadius={50}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.8125rem' }}
          />
          <Legend
            formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
