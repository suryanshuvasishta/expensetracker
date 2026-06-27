import React from 'react';
import { Calendar } from 'lucide-react';
import { useStore } from '../../store';

interface Props {
  title: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function getAvailableMonths(transactions: { month: string }[]): string[] {
  const months = new Set(transactions.map(t => t.month));
  return Array.from(months).sort().reverse();
}

export function Header({ title }: Props) {
  const { transactions, selectedMonth, setSelectedMonth } = useStore();
  const months = getAvailableMonths(transactions);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <header style={{
      padding: '1rem 1.5rem',
      borderBottom: '1px solid #334155',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#0f172a',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#f1f5f9' }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={14} color="#94a3b8" />
          <select
            value={selectedMonth}
            onChange={handleChange}
            style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          >
            {months.length === 0 && (
              <option value={selectedMonth}>{formatMonth(selectedMonth)}</option>
            )}
            {months.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

function formatMonth(m: string): string {
  const [year, month] = m.split('-');
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}
