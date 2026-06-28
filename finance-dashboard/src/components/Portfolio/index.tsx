import { useState, useRef } from 'react';
import { PlusCircle, Trash2, Edit2, Upload, X, Check } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import type { Investment, AssetClass, Owner } from '../../types';
import { ASSET_CLASSES, OWNERS } from '../../types';
import { generateId } from '../../parsers/base';

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
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

function fmt(n: number) {
  if (n >= 1_00_00_000) return '₹' + (n / 1_00_00_000).toFixed(2) + 'Cr';
  if (n >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(2) + 'L';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function fmtFull(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

const EMPTY_INVESTMENT = (owner: Owner): Omit<Investment, 'id'> => ({
  owner,
  name: '',
  assetClass: 'Equity MF',
  institution: '',
  currentValue: 0,
  updatedAt: new Date().toISOString(),
});

export function PortfolioPage() {
  const { investments, saveInvestment, deleteInvestment, bulkSaveInvestments, selectedOwner } = useStore();
  const [editing, setEditing] = useState<Investment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const ownerFilter = selectedOwner === 'All' ? null : selectedOwner as Owner;
  const visible = ownerFilter ? investments.filter(i => i.owner === ownerFilter || i.owner === 'Joint') : investments;

  const totalValue = visible.reduce((s, i) => s + i.currentValue, 0);

  // Group by asset class
  const byClass: Record<string, Investment[]> = {};
  for (const inv of visible) {
    if (!byClass[inv.assetClass]) byClass[inv.assetClass] = [];
    byClass[inv.assetClass].push(inv);
  }

  function startEdit(inv: Investment) {
    setEditing({ ...inv });
    setShowForm(true);
  }

  function startNew() {
    const owner = (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner;
    setEditing({ id: generateId(), ...EMPTY_INVESTMENT(owner) });
    setShowForm(true);
  }

  async function handleSave() {
    if (!editing) return;
    await saveInvestment(editing);
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await deleteInvestment(id);
  }

  // Zerodha CSV import
  async function handleZerodhaImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const owner = (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner;
      const parsed = parseZerodhaHoldings(text, owner);
      if (parsed.length === 0) {
        setImportError('No holdings found. Make sure this is a Zerodha holdings CSV export.');
        return;
      }
      await bulkSaveInvestments(parsed);
    } catch (err: any) {
      setImportError(err?.message || 'Import failed');
    }
  }

  // CAMS/Kfintech CAS — basic text parsing
  async function handleCASImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const owner = (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner;
      const parsed = parseCASStatement(text, owner);
      if (parsed.length === 0) {
        setImportError('No mutual fund holdings found in this file. Supported: CAMS/Kfintech CAS text export.');
        return;
      }
      await bulkSaveInvestments(parsed);
    } catch (err: any) {
      setImportError(err?.message || 'Import failed');
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Investment Portfolio" />
      <div style={{ padding: '1.5rem', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Summary bar */}
        <div className="card" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '0.25rem' }}>Total Portfolio Value</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9' }}>{fmt(totalValue)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtFull(totalValue)}</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {ASSET_CLASSES.filter(ac => byClass[ac]?.length).map(ac => {
              const classTotal = (byClass[ac] || []).reduce((s, i) => s + i.currentValue, 0);
              const pct = totalValue > 0 ? (classTotal / totalValue * 100).toFixed(1) : '0';
              return (
                <div key={ac} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ASSET_CLASS_COLORS[ac], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ac}</span>
                  <span style={{ fontSize: '0.75rem', color: '#f1f5f9', fontWeight: 600 }}>{fmt(classTotal)}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Allocation bar */}
        {totalValue > 0 && (
          <div style={{ height: '10px', borderRadius: '6px', overflow: 'hidden', display: 'flex', gap: '1px' }}>
            {ASSET_CLASSES.filter(ac => byClass[ac]?.length).map(ac => {
              const classTotal = (byClass[ac] || []).reduce((s, i) => s + i.currentValue, 0);
              const pct = classTotal / totalValue * 100;
              return (
                <div key={ac} style={{ flex: pct, background: ASSET_CLASS_COLORS[ac], transition: 'flex 0.3s' }} title={`${ac}: ${pct.toFixed(1)}%`} />
              );
            })}
          </div>
        )}

        {/* Import + Add buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-primary" onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={15} /> Add Holding
          </button>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.875rem', color: '#94a3b8' }}>
              <Upload size={14} /> Zerodha Holdings CSV
            </span>
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleZerodhaImport} />
          </label>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.875rem', color: '#94a3b8' }}>
              <Upload size={14} /> CAMS/Kfintech CAS
            </span>
            <input type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={handleCASImport} ref={fileRef} />
          </label>
          {importError && <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{importError}</span>}
        </div>

        {/* Holdings by asset class */}
        {ASSET_CLASSES.map(ac => {
          const items = byClass[ac];
          if (!items?.length) return null;
          const classTotal = items.reduce((s, i) => s + i.currentValue, 0);
          return (
            <div key={ac} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#1e293b', borderBottom: '1px solid #334155' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: ASSET_CLASS_COLORS[ac] }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: '#f1f5f9' }}>{ac}</span>
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{items.length} holding{items.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>{fmt(classTotal)}</span>
              </div>
              <div style={{ padding: '0.25rem 0' }}>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 1rem', fontSize: '0.7rem', color: '#475569' }}>
                  <span style={{ flex: 1 }}>Name</span>
                  <span style={{ width: '100px' }}>Institution</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>Owner</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Units</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>NAV/Price</span>
                  <span style={{ width: '110px', textAlign: 'right' }}>Current Value</span>
                  <span style={{ width: '60px', textAlign: 'right' }}>P&L</span>
                  <span style={{ width: '56px' }} />
                </div>
                {items.map(inv => {
                  const pnl = inv.purchaseCost ? inv.currentValue - inv.purchaseCost : null;
                  const pnlPct = pnl !== null && inv.purchaseCost ? pnl / inv.purchaseCost * 100 : null;
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderTop: '1px solid #1e293b' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                        {inv.notes && <div style={{ fontSize: '0.7rem', color: '#475569' }}>{inv.notes}</div>}
                      </div>
                      <span style={{ width: '100px', fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.institution}</span>
                      <span style={{ width: '70px', textAlign: 'right', fontSize: '0.7rem', color: '#64748b' }}>{inv.owner}</span>
                      <span style={{ width: '80px', textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                        {inv.units != null ? inv.units.toFixed(3) : '—'}
                      </span>
                      <span style={{ width: '80px', textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                        {inv.nav != null ? '₹' + inv.nav.toFixed(2) : '—'}
                      </span>
                      <span style={{ width: '110px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: '#f1f5f9' }}>{fmtFull(inv.currentValue)}</span>
                      <span style={{ width: '60px', textAlign: 'right', fontSize: '0.75rem', color: pnl == null ? '#475569' : pnl >= 0 ? '#4ade80' : '#f87171' }}>
                        {pnlPct != null ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : '—'}
                      </span>
                      <div style={{ width: '56px', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => startEdit(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <div style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>No holdings yet</div>
            <div style={{ fontSize: '0.8125rem' }}>Add manually or import from Zerodha / CAMS</div>
          </div>
        )}
      </div>

      {/* Edit / Add modal */}
      {showForm && editing && (
        <InvestmentForm
          inv={editing}
          onChange={setEditing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

interface FormProps {
  inv: Investment;
  onChange: (inv: Investment) => void;
  onSave: () => void;
  onClose: () => void;
}

function InvestmentForm({ inv, onChange, onSave, onClose }: FormProps) {
  function set<K extends keyof Investment>(key: K, value: Investment[K]) {
    onChange({ ...inv, [key]: value });
  }

  function recalcValue() {
    if (inv.units != null && inv.nav != null && inv.units > 0 && inv.nav > 0) {
      onChange({ ...inv, currentValue: inv.units * inv.nav });
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            {inv.name ? `Edit: ${inv.name}` : 'Add Holding'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <Field label="Name">
            <input value={inv.name} onChange={e => set('name', e.target.value)} placeholder="Fund name / Stock / FD description" style={{ width: '100%' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Asset Class">
              <select value={inv.assetClass} onChange={e => set('assetClass', e.target.value as AssetClass)} style={{ width: '100%' }}>
                {ASSET_CLASSES.map(ac => <option key={ac} value={ac}>{ac}</option>)}
              </select>
            </Field>
            <Field label="Owner">
              <select value={inv.owner} onChange={e => set('owner', e.target.value as Owner)} style={{ width: '100%' }}>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Institution / Broker">
            <input value={inv.institution} onChange={e => set('institution', e.target.value)} placeholder="e.g. Zerodha, HDFC Bank, SBI" style={{ width: '100%' }} />
          </Field>

          {/* Units + NAV for MF/ETF/Stocks */}
          {['Equity MF', 'Debt/Liquid MF', 'ETF', 'Stocks'].includes(inv.assetClass) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Units / Qty">
                <input type="number" value={inv.units ?? ''} onChange={e => { set('units', parseFloat(e.target.value) || undefined); }} onBlur={recalcValue} placeholder="0.000" style={{ width: '100%' }} />
              </Field>
              <Field label={inv.assetClass === 'Stocks' || inv.assetClass === 'ETF' ? 'LTP / Price (₹)' : 'NAV (₹)'}>
                <input type="number" value={inv.nav ?? ''} onChange={e => { set('nav', parseFloat(e.target.value) || undefined); }} onBlur={recalcValue} placeholder="0.00" style={{ width: '100%' }} />
              </Field>
            </div>
          )}

          {/* FD fields */}
          {inv.assetClass === 'FD' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Principal (₹)">
                <input type="number" value={inv.principal ?? ''} onChange={e => set('principal', parseFloat(e.target.value) || undefined)} style={{ width: '100%' }} />
              </Field>
              <Field label="Interest Rate (%)">
                <input type="number" value={inv.interestRate ?? ''} onChange={e => set('interestRate', parseFloat(e.target.value) || undefined)} style={{ width: '100%' }} />
              </Field>
              <Field label="Maturity Date">
                <input type="date" value={inv.maturityDate ?? ''} onChange={e => set('maturityDate', e.target.value)} style={{ width: '100%' }} />
              </Field>
            </div>
          )}

          <Field label="Current Value (₹)" required>
            <input type="number" value={inv.currentValue || ''} onChange={e => set('currentValue', parseFloat(e.target.value) || 0)} placeholder="Current market value" style={{ width: '100%' }} />
          </Field>
          <Field label="Purchase Cost (₹) — for P&L">
            <input type="number" value={inv.purchaseCost ?? ''} onChange={e => set('purchaseCost', parseFloat(e.target.value) || undefined)} placeholder="Total invested amount" style={{ width: '100%' }} />
          </Field>
          <Field label="Goal">
            <select value={inv.goal ?? ''} onChange={e => set('goal', e.target.value || undefined)} style={{ width: '100%' }}>
              <option value="">— None —</option>
              <option>Retirement</option>
              <option>{"Children's Fund"}</option>
              <option>Home Ownership</option>
              <option>Emergency</option>
              <option>Consumer Durables</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Notes">
            <input value={inv.notes ?? ''} onChange={e => set('notes', e.target.value || undefined)} placeholder="Optional notes" style={{ width: '100%' }} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSave} disabled={!inv.name || inv.currentValue <= 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={15} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.375rem' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function parseZerodhaHoldings(csv: string, owner: Owner): Investment[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('instrument') && l.toLowerCase().includes('qty'));
  if (headerIdx < 0) return [];

  const header = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const get = (row: string[], col: string) => {
    const idx = header.findIndex(h => h.includes(col));
    return idx >= 0 ? (row[idx] || '').replace(/"/g, '').trim() : '';
  };

  const investments: Investment[] = [];
  const now = new Date().toISOString();

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const name = get(row, 'instrument');
    if (!name || name.toLowerCase() === 'total') continue;

    const qty = parseFloat(get(row, 'qty')) || 0;
    const ltp = parseFloat(get(row, 'ltp')) || parseFloat(get(row, 'cur val')) / (qty || 1);
    const curVal = parseFloat(get(row, 'cur val')) || qty * ltp;
    const avgCost = parseFloat(get(row, 'avg cost')) || 0;

    if (curVal <= 0 && qty <= 0) continue;

    // Classify as ETF if name ends with common ETF suffixes, else Stocks
    const isETF = /ETF|BEES|NIFTY|GOLD|SILVER|CPSE/i.test(name);

    investments.push({
      id: generateId(),
      owner,
      name,
      assetClass: isETF ? 'ETF' : 'Stocks',
      institution: 'Zerodha',
      units: qty,
      nav: ltp,
      currentValue: curVal || qty * ltp,
      purchaseCost: avgCost * qty || undefined,
      updatedAt: now,
    });
  }

  return investments;
}

function parseCASStatement(text: string, owner: Owner): Investment[] {
  const investments: Investment[] = [];
  const now = new Date().toISOString();
  const lines = text.split('\n').map(l => l.trim());

  let currentFolio = '';
  let currentAMC = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // AMC line detection
    if (/Folio No\s*:/i.test(line)) {
      currentFolio = (line.match(/Folio No\s*:\s*([^\s]+)/i) || [])[1] || '';
    }

    // Match fund name lines (typically before balance line)
    // Balance lines: "Closing Unit Balance: 123.456" or "Units: 123.456  NAV: 456.78"
    const balanceLine = line.match(/closing\s+unit\s+balance[:\s]+([\d,]+\.?\d*)/i) ||
                        line.match(/units?\s*[:\s]+([\d,]+\.?\d*)\s+.*NAV[:\s]+([\d,]+\.?\d*)/i);

    if (balanceLine) {
      // Look back for fund name
      let fundName = '';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j];
        if (prev && !/Folio|PAN|Email|Mobile|KYC|Date|Opening|Closing|Transaction|Dividend/i.test(prev) && prev.length > 5) {
          fundName = prev;
          break;
        }
      }

      const units = parseFloat(balanceLine[1].replace(/,/g, ''));
      const nav = balanceLine[2] ? parseFloat(balanceLine[2].replace(/,/g, '')) : 0;

      // Look ahead for NAV if not found
      let finalNAV = nav;
      if (!finalNAV) {
        for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
          const navMatch = lines[j].match(/NAV[:\s]+([\d,]+\.?\d*)/i);
          if (navMatch) { finalNAV = parseFloat(navMatch[1].replace(/,/g, '')); break; }
        }
      }

      if (fundName && units > 0) {
        const isDebt = /liquid|overnight|money market|gilt|bond|income|debt|fixed maturity|short term|ultra short/i.test(fundName);
        const assetClass: AssetClass = isDebt ? 'Debt/Liquid MF' : 'Equity MF';

        investments.push({
          id: generateId(),
          owner,
          name: fundName,
          assetClass,
          institution: currentAMC || 'MF',
          units,
          nav: finalNAV || undefined,
          currentValue: finalNAV ? units * finalNAV : 0,
          updatedAt: now,
          notes: currentFolio ? `Folio: ${currentFolio}` : undefined,
        });
      }
    }

    // Track AMC name
    if (/\bAMC\b|Mutual Fund|Asset Management/i.test(line) && line.length < 80) {
      currentAMC = line.replace(/[-=*]+/g, '').trim();
    }
  }

  return investments;
}
