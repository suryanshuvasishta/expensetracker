import { Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { useStore } from '../../store';
import type { Owner } from '../../types';

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const OWNER_LABELS: { value: Owner | 'All'; short: string; label: string }[] = [
  { value: 'Suryanshu', short: 'S', label: 'Suryanshu' },
  { value: 'Khushboo', short: 'K', label: 'Khushboo' },
  { value: 'All', short: '⊕', label: 'Both' },
];

const railBtn = (active: boolean): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: '10px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
  color: active ? '#60a5fa' : 'var(--text-dim)',
  transition: 'all 0.15s',
});

export function SideRail({ currentPage, onNavigate }: Props) {
  const { selectedOwner, setSelectedOwner, theme, setTheme } = useStore();
  const current = OWNER_LABELS.find(o => o.value === selectedOwner);

  return (
    <aside
      style={{
        width: '60px',
        minHeight: '100dvh',
        height: '100dvh',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 0',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
      }}
    >
      <button
        onClick={() => {
          const idx = OWNER_LABELS.findIndex(o => o.value === selectedOwner);
          setSelectedOwner(OWNER_LABELS[(idx + 1) % OWNER_LABELS.length].value as Owner | 'All');
        }}
        title={`Viewing: ${current?.label} — tap to switch`}
        style={{ ...railBtn(true), fontWeight: 700, fontSize: '0.875rem' }}
      >
        {current?.short}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onNavigate('settings')}
          title="Settings"
          style={railBtn(currentPage === 'settings')}
        >
          <SettingsIcon size={18} />
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={railBtn(false)}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </aside>
  );
}
