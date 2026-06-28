import { useState } from 'react';
import { PlusCircle, Trash2, Edit2, Upload, X, Check, KeyRound } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import type { Investment, AssetClass, Owner } from '../../types';
import { ASSET_CLASSES, OWNERS } from '../../types';
import { generateId } from '../../parsers/base';
import { extractTextFromPDF } from '../../parsers';

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
  const [importing, setImporting] = useState<'zerodha' | 'cas' | null>(null);
  const [casPassword, setCasPassword] = useState('');
  const [casFile, setCasFile] = useState<File | null>(null);

  const ownerFilter = selectedOwner === 'All' ? null : selectedOwner as Owner;
  const visible = ownerFilter ? investments.filter(i => i.owner === ownerFilter || i.owner === 'Joint') : investments;

  const totalValue = visible.reduce((s, i) => s + i.currentValue, 0);
  const totalCost = visible.reduce((s, i) => s + (i.purchaseCost ?? 0), 0);
  const totalPnL = totalCost > 0 ? totalValue - totalCost : null;

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
    if (!confirm('Delete this holding?')) return;
    await deleteInvestment(id);
  }

  // Zerodha XLSX import
  async function handleZerodhaImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting('zerodha');
    try {
      const owner = (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner;
      const parsed = await parseZerodhaXLSX(file, owner);
      if (parsed.length === 0) {
        setImportError('No holdings found. Export your holdings from Zerodha Console → Portfolio → Holdings.');
        return;
      }
      await bulkSaveInvestments(parsed);
    } catch (err: any) {
      setImportError(err?.message || 'Zerodha import failed');
    } finally {
      setImporting(null);
    }
  }

  // CAS PDF import — may need password
  async function handleCASFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setCasFile(file);
    setCasPassword('');
    // Try without password first
    await runCASImport(file, '');
  }

  async function runCASImport(file: File, password: string) {
    setImporting('cas');
    setImportError('');
    try {
      const owner = (selectedOwner === 'All' ? 'Suryanshu' : selectedOwner) as Owner;
      const text = await extractTextFromPDF(file, password || undefined);
      const parsed = parseCASText(text, owner);
      if (parsed.length === 0) {
        setImportError('No mutual fund holdings found. Make sure this is a CAMS or Kfintech CAS PDF.');
        return;
      }
      await bulkSaveInvestments(parsed);
      setCasFile(null);
      setCasPassword('');
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted')) {
        setImportError('This PDF is password-protected. Enter the password below (usually PAN + date of birth).');
        // keep casFile set so user can enter password
      } else {
        setImportError(msg);
        setCasFile(null);
      }
    } finally {
      setImporting(null);
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Investment Portfolio" />
      <div style={{ padding: '1.5rem', maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Summary bar */}
        <div className="card" style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '0.25rem' }}>Total Portfolio Value</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9' }}>{fmt(totalValue)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtFull(totalValue)}</div>
            {totalPnL !== null && (
              <div style={{ fontSize: '0.8rem', color: totalPnL >= 0 ? '#4ade80' : '#f87171', marginTop: '0.25rem' }}>
                {totalPnL >= 0 ? '+' : ''}{fmt(totalPnL)} ({totalCost > 0 ? (totalPnL / totalCost * 100).toFixed(1) : 0}%)
              </div>
            )}
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

        {/* Import + Add */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-primary" onClick={startNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={15} /> Add Holding
          </button>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.875rem', color: importing === 'zerodha' ? '#60a5fa' : '#94a3b8' }}>
              <Upload size={14} /> {importing === 'zerodha' ? 'Importing…' : 'Zerodha Holdings XLSX'}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleZerodhaImport} disabled={importing !== null} />
          </label>
          <label style={{ cursor: 'pointer' }}>
            <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.875rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.875rem', color: importing === 'cas' ? '#60a5fa' : '#94a3b8' }}>
              <Upload size={14} /> {importing === 'cas' ? 'Importing…' : 'CAMS/Kfintech CAS PDF'}
            </span>
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleCASFileSelect} disabled={importing !== null} />
          </label>
        </div>

        {/* CAS password prompt */}
        {casFile && (
          <div className="card" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <KeyRound size={16} color="#fbbf24" />
            <span style={{ fontSize: '0.8125rem', color: '#fbbf24' }}>Password required for <strong>{casFile.name}</strong></span>
            <input
              type="password"
              value={casPassword}
              onChange={e => setCasPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runCASImport(casFile, casPassword)}
              placeholder="e.g. PANddmmyyyy (CAMS default)"
              style={{ flex: 1, minWidth: '200px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
              autoFocus
            />
            <button className="btn-primary" onClick={() => runCASImport(casFile, casPassword)} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }} disabled={importing !== null}>
              {importing === 'cas' ? 'Processing…' : 'Import'}
            </button>
            <button onClick={() => { setCasFile(null); setImportError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {importError && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8125rem', color: '#f87171' }}>
            {importError}
          </div>
        )}

        {/* Holdings by asset class */}
        {ASSET_CLASSES.map(ac => {
          const items = byClass[ac];
          if (!items?.length) return null;
          const classTotal = items.reduce((s, i) => s + i.currentValue, 0);
          const classCost = items.reduce((s, i) => s + (i.purchaseCost ?? 0), 0);
          const classPnL = classCost > 0 ? classTotal - classCost : null;
          return (
            <div key={ac} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: ASSET_CLASS_COLORS[ac], flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: '#f1f5f9' }}>{ac}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{items.length} holding{items.length !== 1 ? 's' : ''}</span>
                {classPnL !== null && (
                  <span style={{ fontSize: '0.8rem', color: classPnL >= 0 ? '#4ade80' : '#f87171' }}>
                    {classPnL >= 0 ? '+' : ''}{fmt(classPnL)} ({(classPnL / classCost * 100).toFixed(1)}%)
                  </span>
                )}
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f1f5f9' }}>{fmt(classTotal)}</span>
              </div>
              <div style={{ padding: '0.25rem 0' }}>
                <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 1rem', fontSize: '0.7rem', color: '#475569' }}>
                  <span style={{ flex: 1 }}>Name</span>
                  <span style={{ width: '90px' }}>Institution</span>
                  <span style={{ width: '60px', textAlign: 'right' }}>Owner</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Units/Qty</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Price/NAV</span>
                  <span style={{ width: '110px', textAlign: 'right' }}>Value</span>
                  <span style={{ width: '70px', textAlign: 'right' }}>P&L%</span>
                  <span style={{ width: '52px' }} />
                </div>
                {items.sort((a, b) => b.currentValue - a.currentValue).map(inv => {
                  const pnl = inv.purchaseCost ? inv.currentValue - inv.purchaseCost : null;
                  const pnlPct = pnl !== null && inv.purchaseCost ? pnl / inv.purchaseCost * 100 : null;
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                        {(inv.notes || inv.goal) && (
                          <div style={{ fontSize: '0.7rem', color: '#475569' }}>{[inv.goal, inv.notes].filter(Boolean).join(' · ')}</div>
                        )}
                      </div>
                      <span style={{ width: '90px', fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.institution}</span>
                      <span style={{ width: '60px', textAlign: 'right', fontSize: '0.7rem', color: '#64748b' }}>{inv.owner}</span>
                      <span style={{ width: '80px', textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                        {inv.units != null ? inv.units.toLocaleString('en-IN', { maximumFractionDigits: 3 }) : '—'}
                      </span>
                      <span style={{ width: '80px', textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                        {inv.nav != null ? '₹' + inv.nav.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                      </span>
                      <span style={{ width: '110px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>{fmtFull(inv.currentValue)}</span>
                      <span style={{ width: '70px', textAlign: 'right', fontSize: '0.8rem', color: pnlPct == null ? '#475569' : pnlPct >= 0 ? '#4ade80' : '#f87171' }}>
                        {pnlPct != null ? (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%' : '—'}
                      </span>
                      <div style={{ width: '52px', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button onClick={() => startEdit(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Delete">
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
            <div style={{ fontSize: '0.8125rem' }}>Add manually, import from Zerodha (XLSX), or from CAMS/Kfintech (CAS PDF)</div>
          </div>
        )}
      </div>

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
            <input value={inv.name} onChange={e => set('name', e.target.value)} placeholder="Fund name / Stock symbol / FD description" style={{ width: '100%' }} />
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

          {['Equity MF', 'Debt/Liquid MF', 'ETF', 'Stocks'].includes(inv.assetClass) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Units / Qty">
                <input type="number" value={inv.units ?? ''} onChange={e => set('units', parseFloat(e.target.value) || undefined)} onBlur={recalcValue} placeholder="0.000" style={{ width: '100%' }} />
              </Field>
              <Field label={inv.assetClass === 'Stocks' || inv.assetClass === 'ETF' ? 'LTP / Price (₹)' : 'NAV (₹)'}>
                <input type="number" value={inv.nav ?? ''} onChange={e => set('nav', parseFloat(e.target.value) || undefined)} onBlur={recalcValue} placeholder="0.00" style={{ width: '100%' }} />
              </Field>
            </div>
          )}

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

// Zerodha XLSX: header row has "Symbol", "ISIN", "Quantity Available", "Average Price", "Previous Closing Price"
async function parseZerodhaXLSX(file: File, owner: Owner): Promise<Investment[]> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellText: true, cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as string[][];

  // Find header row: must have "Symbol" and ("Quantity" or "Qty")
  const headerIdx = rows.findIndex(r =>
    r.some(c => c.trim() === 'Symbol') && r.some(c => /quantity|qty/i.test(c))
  );
  if (headerIdx < 0) return [];

  const header = rows[headerIdx].map(c => c.trim().toLowerCase());
  const col = (name: string) => header.findIndex(h => h.includes(name.toLowerCase()));

  const symbolCol = col('symbol');
  const isinCol = col('isin');
  const sectorCol = col('sector');
  // Total quantity = available + discrepant + long term + pledged margin + pledged loan
  const qtyAvailCol = col('quantity available');
  const qtyLTCol = col('quantity long term');
  const qtyPledgeMCol = col('quantity pledged (margin)');
  const qtyPledgeLCol = col('quantity pledged (loan)');
  const avgPriceCol = col('average price');
  const ltpCol = col('previous closing price');

  const investments: Investment[] = [];
  const now = new Date().toISOString();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const symbol = (row[symbolCol] || '').trim();
    if (!symbol || /total|summary/i.test(symbol)) continue;

    const parseN = (idx: number) => idx >= 0 ? parseFloat((row[idx] || '').replace(/,/g, '')) || 0 : 0;

    const qtyAvail = parseN(qtyAvailCol);
    const qtyLT = parseN(qtyLTCol);
    const qtyPledgeM = parseN(qtyPledgeMCol);
    const qtyPledgeL = parseN(qtyPledgeLCol);
    const totalQty = qtyAvail + qtyLT + qtyPledgeM + qtyPledgeL;

    const avgPrice = parseN(avgPriceCol);
    const ltp = parseN(ltpCol);
    const currentValue = ltp > 0 ? totalQty * ltp : totalQty * avgPrice;
    const purchaseCost = avgPrice > 0 ? totalQty * avgPrice : undefined;

    if (totalQty <= 0 && currentValue <= 0) continue;

    const sector = sectorCol >= 0 ? (row[sectorCol] || '').trim() : '';
    const isETF = sector === 'ETF' || /ETF|BEES|NIFTY|GOLD|SILVER|CPSE|LIQUID/i.test(symbol);

    investments.push({
      id: generateId(),
      owner,
      name: symbol,
      assetClass: isETF ? 'ETF' : 'Stocks',
      institution: 'Zerodha',
      units: totalQty,
      nav: ltp || undefined,
      currentValue: currentValue || purchaseCost || 0,
      purchaseCost,
      updatedAt: now,
      notes: isinCol >= 0 ? (row[isinCol] || '').trim() || undefined : undefined,
    });
  }

  return investments;
}

// CAMS / Kfintech CAS PDF text parser
function parseCASText(text: string, owner: Owner): Investment[] {
  const investments: Investment[] = [];
  const now = new Date().toISOString();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentFolio = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track folio
    const folioMatch = line.match(/Folio\s*(?:No\.?|Number)?\s*[:\-]\s*([^\s/]+)/i);
    if (folioMatch) currentFolio = folioMatch[1];

    // CAS closing balance line:
    // "Closing Unit Balance: 1,234.567   NAV on 28-Jun-2026 : ₹456.78"
    // "Closing Balance: 1234.567 unit(s)   Valuation on ...: ₹56789.00"
    const closingMatch = line.match(/closing\s+(?:unit\s+)?balance[:\s]+([\d,]+\.?\d*)/i);
    if (!closingMatch) continue;

    const units = parseFloat(closingMatch[1].replace(/,/g, ''));
    if (units <= 0) continue;

    // NAV on same line or next few lines
    let nav: number | undefined;
    let currentValue = 0;

    const navOnLine = line.match(/NAV\s+(?:on\s+[\d\-A-Za-z,]+\s*)?[:\-]?\s*[₹Rs.]?\s*([\d,]+\.?\d*)/i) ||
                      line.match(/[₹Rs.]\s*([\d,]+\.?\d*)\s*(?:per\s+unit)?/i);
    if (navOnLine) nav = parseFloat(navOnLine[1].replace(/,/g, ''));

    // Valuation/market value on same or next line
    const valueOnLine = line.match(/[Vv]aluation[^₹₹]*[₹Rs.]\s*([\d,]+\.?\d*)/);
    if (valueOnLine) currentValue = parseFloat(valueOnLine[1].replace(/,/g, ''));

    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const next = lines[j];
      if (!nav) {
        const m = next.match(/NAV\s+(?:on\s+[\d\-A-Za-z,]+\s*)?[:\-]?\s*[₹Rs.]?\s*([\d,]+\.?\d*)/i);
        if (m) nav = parseFloat(m[1].replace(/,/g, ''));
      }
      if (!currentValue) {
        const m = next.match(/[Vv]aluation[^₹]*[₹Rs.]\s*([\d,]+\.?\d*)/) ||
                  next.match(/[Mm]arket\s+[Vv]alue[^₹]*[₹Rs.]\s*([\d,]+\.?\d*)/);
        if (m) currentValue = parseFloat(m[1].replace(/,/g, ''));
      }
      if (nav && currentValue) break;
    }

    if (!currentValue && nav) currentValue = units * nav;

    // Look back for fund name (skip metadata lines)
    let fundName = '';
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const prev = lines[j];
      if (!prev || prev.length < 5) continue;
      if (/folio|pan|email|mobile|kyc|date|opening|transaction|dividend|isin|registrar|advisor|nominee|^[₹\d]/i.test(prev)) continue;
      // Fund names are typically long and contain "Fund" or "-"
      if (prev.length > 10) {
        fundName = prev;
        break;
      }
    }

    if (!fundName || currentValue <= 0) continue;

    const isDebt = /liquid|overnight|money\s*market|gilt|bond|income|debt|fixed\s*maturity|short\s*term|ultra\s*short|low\s*dur/i.test(fundName);
    const assetClass: AssetClass = isDebt ? 'Debt/Liquid MF' : 'Equity MF';

    investments.push({
      id: generateId(),
      owner,
      name: fundName.replace(/\s+/g, ' '),
      assetClass,
      institution: 'MF',
      units,
      nav,
      currentValue,
      updatedAt: now,
      notes: currentFolio ? `Folio: ${currentFolio}` : undefined,
    });
  }

  return investments;
}
