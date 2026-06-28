import type { Investment, Liability } from '../../types';

interface Props {
  investments: Investment[];
  liabilities: Liability[];
  selectedOwner: string;
}

function fmt(n: number) {
  if (n >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(2) + 'Cr';
  if (n >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(2) + 'L';
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

const ASSET_COLORS: Record<string, string> = {
  'FD': '#facc15',
  'Debt/Liquid MF': '#60a5fa',
  'Equity MF': '#4ade80',
  'ETF': '#34d399',
  'Stocks': '#a78bfa',
  'Real Estate': '#fb923c',
  'Gold': '#fbbf24',
  'NPS': '#38bdf8',
  'PPF/SSY': '#86efac',
  'Other': '#94a3b8',
};

export function NetWorthCard({ investments, liabilities, selectedOwner }: Props) {
  const filtInv = selectedOwner === 'All'
    ? investments
    : investments.filter(i => i.owner === selectedOwner || i.owner === 'Joint');

  const filtLiab = selectedOwner === 'All'
    ? liabilities
    : liabilities.filter(l => l.owner === selectedOwner || l.owner === 'Joint');

  const totalAssets = filtInv.reduce((s, i) => s + i.currentValue, 0);
  const totalLiabilities = filtLiab.reduce((s, l) => s + l.outstandingAmount, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Group assets by class
  const byClass: Record<string, number> = {};
  for (const inv of filtInv) {
    byClass[inv.assetClass] = (byClass[inv.assetClass] || 0) + inv.currentValue;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Net Worth summary */}
        <div style={{ minWidth: '160px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Net Worth</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: netWorth >= 0 ? '#4ade80' : '#f87171' }}>
            {netWorth < 0 ? '-' : ''}{fmt(netWorth)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            Assets: {fmt(totalAssets)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.125rem' }}>
            Liabilities: {fmt(totalLiabilities)}
          </div>
        </div>

        {/* Assets breakdown */}
        {totalAssets > 0 && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>Assets by Class</div>
            {/* Bar */}
            <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', gap: '1px', marginBottom: '0.625rem' }}>
              {Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([ac, val]) => (
                <div
                  key={ac}
                  style={{ flex: val / totalAssets * 100, background: ASSET_COLORS[ac] || '#94a3b8', transition: 'flex 0.3s' }}
                  title={`${ac}: ${fmt(val)} (${(val / totalAssets * 100).toFixed(1)}%)`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([ac, val]) => (
                <div key={ac} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ASSET_COLORS[ac] || '#94a3b8', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)' }}>{ac}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liabilities list */}
        {filtLiab.length > 0 && (
          <div style={{ minWidth: '220px', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>Liabilities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {filtLiab.map(l => {
                const pct = totalLiabilities > 0 ? (l.outstandingAmount / totalLiabilities) * 100 : 0;
                return (
                  <div key={l.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.125rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{l.name}</span>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>{fmt(l.outstandingAmount)}</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#f87171', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
