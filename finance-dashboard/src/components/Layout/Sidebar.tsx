import { BarChart3, Upload, List, Settings, TrendingUp, ChevronLeft, ChevronRight, Wallet, PieChart } from 'lucide-react';
import { useStore } from '../../store';
import type { Owner } from '../../types';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const OWNER_LABELS: { value: Owner | 'All'; label: string; short: string }[] = [
  { value: 'Suryanshu', label: 'Suryanshu', short: 'S' },
  { value: 'Khushboo', label: 'Khushboo', short: 'K' },
  { value: 'All', label: 'Both', short: '⊕' },
];

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: Props) {
  const { selectedOwner, setSelectedOwner } = useStore();

  return (
    <aside
      style={{
        width: collapsed ? '64px' : '220px',
        minHeight: '100vh',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>Finance</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Dashboard</div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px', display: 'flex' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Persona switcher */}
      <div style={{ padding: '0.625rem 0.5rem', borderBottom: '1px solid #334155' }}>
        {collapsed ? (
          <button
            onClick={() => {
              const idx = OWNER_LABELS.findIndex(o => o.value === selectedOwner);
              setSelectedOwner(OWNER_LABELS[(idx + 1) % OWNER_LABELS.length].value as Owner | 'All');
            }}
            title={OWNER_LABELS.find(o => o.value === selectedOwner)?.label}
            style={{ width: '100%', background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', padding: '0.375rem', fontSize: '0.875rem', fontWeight: 700 }}
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
                  flex: 1, padding: '0.25rem', fontSize: '0.7rem', fontWeight: selectedOwner === o.value ? 700 : 400,
                  borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: selectedOwner === o.value ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: selectedOwner === o.value ? '#60a5fa' : '#64748b',
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
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: 'none',
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: active ? 500 : 400,
                marginBottom: '2px',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid #334155', fontSize: '0.7rem', color: '#475569', textAlign: collapsed ? 'center' : 'left' }}>
        {collapsed ? '🔒' : '🔒 All data stored locally'}
      </div>
    </aside>
  );
}
