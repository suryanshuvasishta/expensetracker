import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Sun, Moon, PiggyBank, Quote, Wallet, List, PieChart, BarChart3, Upload, ClipboardCheck } from 'lucide-react';
import { useStore } from '../../store';
import type { Owner } from '../../types';

interface Props {
  onNavigate: (page: string) => void;
}

const OWNER_LABELS: { value: Owner | 'All'; short: string; label: string }[] = [
  { value: 'Suryanshu', short: 'S', label: 'Suryanshu' },
  { value: 'Khushboo', short: 'K', label: 'Khushboo' },
  { value: 'All', short: '⊕', label: 'Both' },
];

const QUOTES: { text: string; author: string }[] = [
  { text: 'Do not save what is left after spending, but spend what is left after saving.', author: 'Warren Buffett' },
  { text: 'The big money is not in the buying and the selling, but in the waiting.', author: 'Charlie Munger' },
  { text: 'Spend each day trying to be a little wiser than you were when you woke up.', author: 'Charlie Munger' },
  { text: 'Risk comes from not knowing what you are doing.', author: 'Warren Buffett' },
  { text: "It's not how much money you make, but how much money you keep.", author: 'Robert Kiyosaki' },
  { text: 'The stock market is a device for transferring money from the impatient to the patient.', author: 'Warren Buffett' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'The most important quality for an investor is temperament, not intellect.', author: 'Warren Buffett' },
  { text: 'Know what you own, and know why you own it.', author: 'Peter Lynch' },
  { text: "Someone's sitting in the shade today because someone planted a tree a long time ago.", author: 'Warren Buffett' },
  { text: 'A budget is telling your money where to go instead of wondering where it went.', author: 'Dave Ramsey' },
  { text: 'Beware of little expenses; a small leak will sink a great ship.', author: 'Benjamin Franklin' },
];

const STEPS: { icon: typeof Wallet; title: string; body: string }[] = [
  { icon: Wallet, title: '1. Set your Budget', body: 'Start on the Budget tab — set income, category budgets, and fixed liabilities for the month.' },
  { icon: List, title: '2. Log transactions as you spend', body: 'Use "Add Entry" on the Transactions tab to log expenses by hand as they happen (the Kakeibo way) — pick a category or leave it blank to auto-classify.' },
  { icon: Upload, title: '3. Import statements at month-end', body: 'Expand "Import Bank / Credit Card Statements" at the bottom of the Transactions tab and drop in your PDF/XLS statements.' },
  { icon: ClipboardCheck, title: '4. Run the Kakeibo check', body: 'Click "Run Kakeibo Check" to reconcile — it flags any manual entry that has no matching statement transaction, so nothing slips through.' },
  { icon: PieChart, title: '5. Track investments', body: 'Log holdings on the Portfolio tab to see asset allocation and goal progress.' },
  { icon: BarChart3, title: '6. Review the big picture', body: 'Dashboard, Trends, and Cash Flow give you month-over-month spend, category breakdowns, and account-level cash movement.' },
];

export function HomePage({ onNavigate }: Props) {
  const { selectedOwner, setSelectedOwner, theme, setTheme } = useStore();
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx(i => (i + 1) % QUOTES.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const quote = QUOTES[quoteIdx];

  const iconBtn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: '10px', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PiggyBank size={22} color="#60a5fa" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Finance Dashboard</h1>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>🔒 All data stored locally</div>
            </div>
          </div>

          {/* Settings + theme toggle, upper right */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={iconBtn}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => onNavigate('settings')} title="Settings" style={iconBtn}>
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>

        {/* Owner / persona selection */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Viewing as</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {OWNER_LABELS.map(o => (
              <button
                key={o.value}
                onClick={() => setSelectedOwner(o.value as Owner | 'All')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.875rem 0.5rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: selectedOwner === o.value ? 700 : 400,
                  background: selectedOwner === o.value ? 'rgba(59,130,246,0.15)' : 'var(--bg-elevated)',
                  color: selectedOwner === o.value ? '#60a5fa' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>{o.short}</span>
                <span style={{ fontSize: '0.75rem' }}>{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rotating motivational quote */}
        <div className="card" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)', textAlign: 'center', padding: '1.75rem 1.5rem' }}>
          <Quote size={20} color="#60a5fa" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
          <p style={{ margin: '0 0 0.75rem', fontSize: '1.0625rem', lineHeight: 1.5, color: 'var(--text-primary)', fontStyle: 'italic' }}>
            "{quote.text}"
          </p>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)', fontWeight: 600 }}>— {quote.author}</p>
        </div>

        {/* Getting started / onboarding */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Getting Started</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {STEPS.map(step => {
              const Icon = step.icon;
              return (
                <div key={step.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color="#60a5fa" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8438rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.title}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
