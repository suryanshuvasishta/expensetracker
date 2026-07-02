import type { Transaction } from '../../types';
import { spendTxns } from '../../services/selectors';

interface Props {
  transactions: Transaction[];
}

function extractMerchant(narration: string): string {
  // VPA anywhere in the narration: merchant.name@bank → "merchant name"
  const vpaMatch = narration.match(/([a-z0-9._-]{3,})@[a-z]{2,}/i);
  if (vpaMatch) {
    const handle = vpaMatch[1].replace(/[._-]+/g, ' ').replace(/\d{4,}/g, '').trim();
    if (handle.length >= 3) return titleCase(handle).slice(0, 30);
  }
  // UPI patterns: UPI/MERCHANT/XXXX or UPI-MERCHANT-...
  const upiMatch = narration.match(/UPI[-\/]([^\/\-]+)/i);
  if (upiMatch) {
    const m = cleanupSegment(upiMatch[1]);
    if (m) return m;
  }
  // POS patterns
  const posMatch = narration.match(/POS\s+(.+?)(?:\s{2,}|\d{4,}|$)/i);
  if (posMatch) {
    const m = cleanupSegment(posMatch[1]);
    if (m) return m;
  }
  return cleanupSegment(narration) || narration.trim().slice(0, 30);
}

// Strip ref/txn number runs and collapse whitespace so the same merchant
// doesn't fragment into several rows.
function cleanupSegment(s: string): string {
  const cleaned = s.replace(/\b\d{6,}\b/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 30);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export function TopMerchants({ transactions }: Props) {
  const debits = spendTxns(transactions);

  const merchants: Record<string, { count: number; total: number }> = {};
  for (const t of debits) {
    const merchant = extractMerchant(t.narration);
    if (!merchants[merchant]) merchants[merchant] = { count: 0, total: 0 };
    merchants[merchant].count++;
    merchants[merchant].total += t.amount;
  }

  const top = Object.entries(merchants)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 8);

  const maxAmount = top[0]?.[1].total || 1;

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Top Merchants</h3>
      {top.length === 0 ? (
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>No data for this month</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {top.map(([merchant, { count, total }]) => (
            <div key={merchant}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8125rem' }}>
                <span style={{ color: '#cbd5e1', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{merchant}</span>
                <span style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>₹{Math.round(total).toLocaleString('en-IN')}</span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{count}×</span>
                </span>
              </div>
              <div style={{ height: '4px', background: '#1e293b', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(total / maxAmount) * 100}%`, background: '#3b82f6', borderRadius: '9999px', transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
