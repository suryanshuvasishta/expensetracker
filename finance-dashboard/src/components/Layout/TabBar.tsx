import { Wallet, List, PieChart, BarChart3, TrendingUp, ArrowLeftRight, PiggyBank, type LucideIcon } from 'lucide-react';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'cashflow', label: 'Cash Flow', icon: ArrowLeftRight },
];

export function TabBar({ currentPage, onNavigate }: Props) {
  return (
    <div
      className="tab-bar"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '2px',
        padding: '0.5rem 0.75rem 0',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Logo — takes you to Home (owner switch, theme, settings, quotes) */}
      <button
        onClick={() => onNavigate('home')}
        title="Home"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          marginRight: '0.5rem',
          flexShrink: 0,
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          background: currentPage === 'home' ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: '#60a5fa',
        }}
      >
        <PiggyBank size={18} />
      </button>

      {TABS.map(tab => {
        const Icon = tab.icon;
        const active = currentPage === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1rem',
              borderRadius: '10px 10px 0 0',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: active ? 600 : 400,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: active ? 'var(--bg-main)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-dim)',
              borderTop: active ? '1px solid var(--border)' : '1px solid transparent',
              borderLeft: active ? '1px solid var(--border)' : '1px solid transparent',
              borderRight: active ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: 'none',
              position: 'relative',
              top: active ? '1px' : '0',
              minHeight: 44,
            }}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
