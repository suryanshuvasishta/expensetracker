import React from 'react';
import { Calendar, Menu } from 'lucide-react';
import { useStore } from '../../store';
import { useMobileMenu } from '../../context/MobileMenu';

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
  const { setOpen } = useMobileMenu();
  const months = getAvailableMonths(transactions);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <header style={{
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg-main)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        {/* Hamburger — only visible on mobile via CSS */}
        <button
          className="header-hamburger"
          onClick={() => setOpen(true)}
          style={{
            display: 'none', // overridden by .header-hamburger media query
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '10px',
            borderRadius: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
            minHeight: 44,
            flexShrink: 0,
          }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <Calendar size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
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
    </header>
  );
}

function formatMonth(m: string): string {
  const [year, month] = m.split('-');
  return `${MONTHS[parseInt(month) - 1]} ${year}`;
}
