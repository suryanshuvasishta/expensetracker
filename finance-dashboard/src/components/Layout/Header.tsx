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

// Fixed year range rather than deriving options from existing transactions —
// deriving from data meant the dropdown could omit whatever month is currently
// selected (e.g. selectedMonth defaults to "this month", which may have no
// transactions yet). A <select> whose value has no matching <option> falls back
// to visually showing the first option while the underlying state silently
// keeps the old value, so the list would look like it's showing e.g. "Jul" while
// actually still filtering on "Aug" with zero results. A fixed range guarantees
// there's always a real option for whatever selectedMonth actually is.
const YEARS = [2026, 2027, 2028, 2029, 2030];

export function Header({ title }: Props) {
  const { selectedMonth, setSelectedMonth } = useStore();

  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(`${selYear}-${e.target.value.padStart(2, '0')}`);
  };
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(`${e.target.value}-${String(selMonthNum).padStart(2, '0')}`);
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
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <Calendar size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
        <select
          value={selMonthNum}
          onChange={handleMonthChange}
          style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selYear}
          onChange={handleYearChange}
          style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
        >
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </header>
  );
}
