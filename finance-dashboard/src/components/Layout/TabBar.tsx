import { Wallet, List, PieChart, BarChart3, TrendingUp, ArrowLeftRight, PiggyBank, Settings as SettingsIcon, Sun, Moon, type LucideIcon } from 'lucide-react';
import { useStore } from '../../store';

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
  const { theme, setTheme } = useStore();

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
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
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

      {/* Settings + theme toggle, pinned to the top-right of the tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', paddingBottom: '0.5rem', marginLeft: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
            border: 'none', borderRadius: '10px', cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)',
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => onNavigate('settings')}
          title="Settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
            border: 'none', borderRadius: '10px', cursor: 'pointer',
            background: currentPage === 'settings' ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: currentPage === 'settings' ? '#60a5fa' : 'var(--text-dim)',
          }}
        >
          <SettingsIcon size={16} />
        </button>
      </div>
    </div>
  );
}
