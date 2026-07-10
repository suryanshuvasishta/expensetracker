import { BarChart3, Upload, List, Settings, TrendingUp, ChevronLeft, ChevronRight, Wallet, PieChart, Sun, Moon, ArrowLeftRight } from 'lucide-react';
import { useStore } from '../../store';
import type { Owner } from '../../types';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'cashflow', label: 'Cash Flow', icon: ArrowLeftRight },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const OWNER_LABELS: { value: Owner | 'All'; label: string; short: string }[] = [
  { value: 'Suryanshu', label: 'Suryanshu', short: 'S' },
  { value: 'Khushboo', label: 'Khushboo', short: 'K' },
  { value: 'All', label: 'Both', short: '⊕' },
];

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle, mobileOpen = false }: Props) {
  const { selectedOwner, setSelectedOwner, theme, setTheme } = useStore();

  // On mobile the sidebar is always expanded (220px) when open
  const effectiveCollapsed = collapsed;

  return (
    <aside
      className={`sidebar-mobile${mobileOpen ? '' : ' sidebar-mobile-hidden'}`}
      style={{
        width: effectiveCollapsed ? '64px' : '220px',
        minHeight: '100dvh',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, transform 0.25s ease',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100dvh',
      }}
    >
      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        {!effectiveCollapsed && (
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Finance</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Dashboard</div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '10px', borderRadius: '6px', display: 'flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          {effectiveCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Persona switcher */}
      <div style={{ padding: '0.625rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
        {effectiveCollapsed ? (
          <button
            onClick={() => {
              const idx = OWNER_LABELS.findIndex(o => o.value === selectedOwner);
              setSelectedOwner(OWNER_LABELS[(idx + 1) % OWNER_LABELS.length].value as Owner | 'All');
            }}
            title={OWNER_LABELS.find(o => o.value === selectedOwner)?.label}
            style={{ width: '100%', background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', padding: '0.625rem', fontSize: '0.875rem', fontWeight: 700, minHeight: 44 }}
          >
            {OWNER_LABELS.find(o => o.value === selectedOwner)?.short}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '4px' }}>
            {OWNER_LABELS.map(o => (
              <button
                key={o.value}
                onClick={() => setSelectedOwner(o.value as Owner | 'All')}
                style={{
                  flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.75rem', fontWeight: selectedOwner === o.value ? 700 : 400,
                  borderRadius: '6px', border: 'none', cursor: 'pointer', minHeight: 40,
                  background: selectedOwner === o.value ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: selectedOwner === o.value ? '#60a5fa' : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav style={{ padding: '0.75rem 0.5rem', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={effectiveCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: 'none',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? '#60a5fa' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: active ? 500 : 400,
                marginBottom: '2px',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                minHeight: 44,
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!effectiveCollapsed && item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: effectiveCollapsed ? 'center' : 'space-between', gap: '0.5rem' }}>
        {effectiveCollapsed ? '🔒' : <span>🔒 All data stored locally</span>}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '10px', display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 40, minHeight: 40, justifyContent: 'center' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </aside>
  );
}
