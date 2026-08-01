import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Download, Link2, Edit2, Check, X, Sparkles, Plus, ClipboardCheck, Trash2, ChevronDown, ChevronUp, Upload as UploadIcon, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { ImportPanel } from '../Upload';
import { generateId } from '../../parsers/base';
import type { Transaction, Category, Owner, AccountType, PaymentMethod } from '../../types';
import { buildCategoryGroups, MANUAL_SOURCE, OWNERS } from '../../types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function TransactionsPage() {
  const { transactions, categories, selectedMonth, selectedOwner, updateTransaction, deleteTransaction, deleteTransactionsForMonth, addTransactions, saveCategoryRule, applyRuleToAll, addCategory, rerunCorrelation } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Learn prompt state
  const [learnPrompt, setLearnPrompt] = useState<{ narration: string; category: string; keyword: string } | null>(null);
  const [learnApplied, setLearnApplied] = useState<number | null>(null);

  const monthTxns = transactions.filter(t => t.month === selectedMonth);

  const filtered = useMemo(() => {
    return monthTxns.filter(t => {
      if (search && !t.narration.toLowerCase().includes(search.toLowerCase()) &&
        !t.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAccount && t.account !== filterAccount) return false;
      if (filterType && t.type !== filterType) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthTxns, search, filterAccount, filterType, filterCategory]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const accounts = [...new Set(transactions.map(t => t.account))];
  const categoryGroups = useMemo(() => buildCategoryGroups(categories), [categories]);
  const ADD_NEW = '__add_new__';

  // Kakeibo month-end check: manual entries verified against statements vs still pending
  const manualMonth = monthTxns.filter(t => t.sourceFile === MANUAL_SOURCE);
  const manualVerified = manualMonth.filter(t => t.isCorrelationPair && t.correlatedIds?.length);
  const manualCash = manualMonth.filter(t => t.account === 'Cash');
  const manualPending = manualMonth.filter(t => t.account !== 'Cash' && !(t.isCorrelationPair && t.correlatedIds?.length));

  useEffect(() => { setChecked(false); }, [selectedMonth]);

  async function runKakeiboCheck() {
    setChecking(true);
    await rerunCorrelation(); // re-match manual entries against whatever statements have been imported since
    setChecked(true);
    setChecking(false);
  }

  async function handleAddManual(txn: Transaction) {
    await addTransactions([txn]);
    setShowAddForm(false);
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditCategory(t.category);
    setLearnPrompt(null);
    setLearnApplied(null);
  }

  async function handleCategorySelect(value: string) {
    if (value === ADD_NEW) {
      const name = window.prompt('New category name:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();
      if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        setEditCategory(trimmed);
        return;
      }
      const group = window.prompt('Group for this category (e.g. Miscellaneous, Income):', 'Miscellaneous') || 'Miscellaneous';
      const newCat: Category = {
        id: generateId(),
        name: trimmed,
        keywords: [],
        color: '#94a3b8',
        group: group.trim() || 'Miscellaneous',
      };
      await addCategory(newCat);
      setEditCategory(trimmed);
      return;
    }
    setEditCategory(value);
  }

  async function saveEdit(t: Transaction) {
    if (editCategory === t.category) { setEditingId(null); return; }
    await updateTransaction(t.id, { category: editCategory });
    setEditingId(null);
    // Suggest a keyword: first non-numeric word of 4+ chars, skip common filler
    const FILLER = new Set(['upi/', 'neft', 'imps', 'rtgs', 'from', 'with', 'payment', 'transfer', 'debit', 'credit']);
    const words = t.narration.split(/[\s\/\-]+/).filter(w => w.length >= 4 && !/^\d+$/.test(w) && !FILLER.has(w.toLowerCase()));
    const suggested = words[0]?.toUpperCase() || t.narration.slice(0, 12);
    setLearnPrompt({ narration: t.narration, category: editCategory, keyword: suggested });
    setLearnApplied(null);
  }

  async function handleLearn(keyword: string, category: string, save: boolean) {
    if (save) {
      await saveCategoryRule({ id: generateId(), keyword, category, createdAt: new Date().toISOString() });
      const count = await applyRuleToAll(keyword, category);
      setLearnApplied(count);
    }
    setTimeout(() => { setLearnPrompt(null); setLearnApplied(null); }, save ? 3000 : 0);
  }

  async function handleDeleteMonth() {
    if (monthTxns.length === 0) return;
    const confirmed = confirm(
      `Delete all ${monthTxns.length} transactions for ${selectedMonth}? This also removes their uploaded-file records. ` +
      `This can't be undone locally, and the deletion will propagate on the next Drive sync too.`
    );
    if (!confirmed) return;
    await deleteTransactionsForMonth(selectedMonth);
  }

  function exportCSV() {
    const header = 'Date,Account,Narration,Amount,Type,Category,Payment Method\n';
    const rows = filtered.map(t =>
      `"${t.date}","${t.account}","${t.narration.replace(/"/g, '""')}",${t.amount},"${t.type}","${t.category}","${t.paymentMethod}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Transactions" />
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search narration or category..."
              style={{ paddingLeft: '2rem' }}
            />
          </div>
          <button className="btn-primary" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={14} /> Add Entry
          </button>
          <button className="btn-ghost" onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={14} /> Filters
          </button>
          <button className="btn-ghost" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={14} /> Export CSV
          </button>
          {monthTxns.length > 0 && (
            <button
              className="btn-ghost"
              onClick={handleDeleteMonth}
              title={`Delete all transactions for ${selectedMonth}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <Trash2 size={14} /> Delete {selectedMonth}
            </button>
          )}
          <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{filtered.length} transactions</span>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Debit + Credit</option>
              <option value="debit">Debit only</option>
              <option value="credit">Credit only</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All Categories</option>
              {categoryGroups.map(({ group, categories: cats }) => (
                <optgroup key={group} label={group}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
            <button className="btn-ghost" onClick={() => { setFilterAccount(''); setFilterType(''); setFilterCategory(''); setSearch(''); }}>
              Clear filters
            </button>
          </div>
        )}

        {/* Kakeibo month-end check */}
        {manualMonth.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#60a5fa', fontWeight: 600 }}>
                <ClipboardCheck size={15} /> Kakeibo check ({selectedMonth})
              </span>
              <span style={{ color: '#4ade80' }}>✓ {manualVerified.length} verified against statements</span>
              <span style={{ color: '#94a3b8' }}>💵 {manualCash.length} cash (no statement)</span>
              <span style={{ color: manualPending.length > 0 ? '#fbbf24' : '#64748b' }}>
                ⏳ {manualPending.length} awaiting statement match
                {manualPending.length > 0 && ` (${fmt(manualPending.reduce((s, t) => s + t.amount, 0))})`}
              </span>
              <button
                className="btn-primary"
                onClick={runKakeiboCheck}
                disabled={checking}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', marginLeft: 'auto' }}
              >
                {checking ? 'Checking...' : 'Run Kakeibo Check'}
              </button>
            </div>

            {checked && (
              manualPending.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: 600 }}>
                    <AlertTriangle size={13} /> Flagged — no matching statement transaction found:
                  </span>
                  {manualPending.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.625rem', background: 'rgba(251,191,36,0.08)', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</span>
                      <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: '120px' }}>{t.narration}</span>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{t.account}</span>
                      <span style={{ fontWeight: 600 }}>{t.type === 'debit' ? '-' : '+'}{fmt(t.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#4ade80' }}>✓ All manual entries this month are accounted for.</span>
              )
            )}
          </div>
        )}

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Narration</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Payment Method</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#475569', padding: '2rem' }}>
                    No transactions found
                  </td>
                </tr>
              )}
              {paged.map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.8rem' }}>{formatDate(t.date)}</td>
                  <td>
                    <AccountBadge account={t.account} />
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                      {t.sourceFile === MANUAL_SOURCE && (
                        <span
                          title={t.isCorrelationPair && t.correlatedIds?.length ? 'Manual entry — verified against statement' : t.account === 'Cash' ? 'Manual cash entry' : 'Manual entry — awaiting statement match'}
                          style={{ marginRight: '5px', fontSize: '0.7rem' }}
                        >
                          {t.isCorrelationPair && t.correlatedIds?.length ? '✅' : t.account === 'Cash' ? '💵' : '✍️'}
                        </span>
                      )}
                      {t.narration}
                      {t.isCorrelationPair && t.sourceFile !== MANUAL_SOURCE && (
                        <span title="Correlated transaction" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: '4px' }}>
                          <Link2 size={10} color="#818cf8" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                    <span className={t.type === 'debit' ? 'debit' : 'credit'}>
                      {t.type === 'debit' ? '-' : '+'}{fmt(t.amount)}
                    </span>
                  </td>
                  <td>
                    {editingId === t.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select value={editCategory} onChange={e => handleCategorySelect(e.target.value)} style={{ width: '170px', padding: '2px 4px', fontSize: '0.75rem' }}>
                          {categoryGroups.map(({ group, categories: cats }) => (
                            <optgroup key={group} label={group}>
                              {cats.map(c => <option key={c} value={c}>{c}</option>)}
                            </optgroup>
                          ))}
                          <option value={ADD_NEW}>+ Add new category…</option>
                        </select>
                        <button onClick={() => saveEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80' }}><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <CategoryBadge category={t.category} categories={categories} />
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.paymentMethod}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '4px' }}>
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        const label = t.sourceFile === MANUAL_SOURCE ? 'this manual entry' : `this ${t.account} transaction`;
                        if (confirm(`Delete ${label}? "${t.narration}" — ${fmt(t.amount)}`)) deleteTransaction(t.id);
                      }}
                      title="Delete transaction"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7f1d1d', padding: '4px', borderRadius: '4px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add manual entry modal */}
        {showAddForm && (
          <AddTransactionModal
            categoryGroups={categoryGroups}
            defaultOwner={selectedOwner === 'All' ? 'Suryanshu' : selectedOwner}
            selectedMonth={selectedMonth}
            onSave={handleAddManual}
            onClose={() => setShowAddForm(false)}
          />
        )}

        {/* Learn prompt */}
        {learnPrompt && (
          <LearnPrompt
            narration={learnPrompt.narration}
            category={learnPrompt.category}
            keyword={learnPrompt.keyword}
            appliedCount={learnApplied}
            onConfirm={(kw) => handleLearn(kw, learnPrompt.category, true)}
            onDismiss={() => { setLearnPrompt(null); setLearnApplied(null); }}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Page {page + 1} of {totalPages}</span>
            <button className="btn-ghost" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next →</button>
          </div>
        )}

        {/* Import statements — collapsed by default; manual entry is the primary flow,
            this is for reconciling against bank/CC statements at month-end */}
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <button
            onClick={() => setShowImport(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-primary)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600 }}>
              <UploadIcon size={16} /> Import Bank / Credit Card Statements
            </span>
            {showImport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showImport && (
            <div style={{ marginTop: '1rem' }}>
              <ImportPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ACCOUNT_COLORS: Record<string, string> = {
  'HDFC Bank': '#2563eb',
  'ICICI Bank': '#7c3aed',
  'Axis Credit Card': '#dc2626',
  'SBI Credit Card': '#059669',
  'ICICI Credit Card': '#d97706',
  'Paytm Wallet': '#00baf2',
  'Cash': '#fbbf24',
  'Unknown': '#475569',
};

function AccountBadge({ account }: { account: string }) {
  const color = ACCOUNT_COLORS[account] || '#475569';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {account.replace(' Credit Card', ' CC')}
    </span>
  );
}

function CategoryBadge({ category, categories }: { category: string; categories: { name: string; color: string }[] }) {
  const cat = categories.find(c => c.name === category);
  const color = cat?.color || '#94a3b8';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {category || 'Uncategorized'}
    </span>
  );
}

const MANUAL_ACCOUNTS: AccountType[] = ['Cash', 'HDFC Bank', 'ICICI Bank', 'Axis Credit Card', 'SBI Credit Card', 'ICICI Credit Card', 'Paytm Wallet'];
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'NEFT', 'IMPS', 'Net Banking', 'Other'];

function AddTransactionModal({
  categoryGroups, defaultOwner, selectedMonth, onSave, onClose,
}: {
  categoryGroups: { group: string; categories: string[] }[];
  defaultOwner: Owner;
  selectedMonth: string;
  onSave: (t: Transaction) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;

  const [date, setDate] = useState(defaultDate);
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState<AccountType>('Cash');
  const [narration, setNarration] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');

  const valid = !!date && parseFloat(amount) > 0 && narration.trim().length > 0;

  function save() {
    if (!valid) return;
    onSave({
      id: generateId(),
      owner,
      date,
      account,
      amount: parseFloat(amount),
      narration: narration.trim(),
      category, // empty → auto-categorized by keywords/rules on add
      paymentMethod,
      type,
      sourceFile: MANUAL_SOURCE,
      month: date.slice(0, 7),
      createdAt: new Date().toISOString(),
    });
  }

  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' };
  const fieldStyle: React.CSSProperties = { width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Add Transaction (Kakeibo)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <select value={owner} onChange={e => setOwner(e.target.value as Owner)} style={fieldStyle}>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'debit' | 'credit')} style={fieldStyle}>
                <option value="debit">Expense (debit)</option>
                <option value="credit">Income (credit)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount (₹)</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Vegetables from sabzi mandi" style={fieldStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Paid via account</label>
              <select value={account} onChange={e => {
                const a = e.target.value as AccountType;
                setAccount(a);
                if (a === 'Cash') setPaymentMethod('Cash');
                else if (a.includes('Credit Card')) setPaymentMethod('Credit Card');
                else setPaymentMethod('UPI');
              }} style={fieldStyle}>
                {MANUAL_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} style={fieldStyle}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Category (leave blank to auto-classify)</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={fieldStyle}>
              <option value="">Auto-classify from description</option>
              {categoryGroups.map(({ group, categories: cats }) => (
                <optgroup key={group} label={group}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', lineHeight: 1.5 }}>
            Entries on bank/CC accounts are auto-verified when the matching statement is uploaded
            (same account &amp; amount within 3 days). Cash entries always count directly.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!valid}>Add Entry</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnPrompt({
  narration, category, keyword, appliedCount, onConfirm, onDismiss,
}: {
  narration: string; category: string; keyword: string; appliedCount: number | null;
  onConfirm: (kw: string) => void; onDismiss: () => void;
}) {
  const [kw, setKw] = useState(keyword);

  if (appliedCount !== null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', fontSize: '0.8125rem', color: '#4ade80' }}>
        <Sparkles size={15} />
        Rule saved! Applied <strong style={{ margin: '0 2px' }}>{appliedCount}</strong> more transactions → <strong style={{ margin: '0 2px' }}>{category}</strong>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.8125rem' }}>
      <Sparkles size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
      <span style={{ color: 'var(--text-muted)' }}>Apply <strong style={{ color: 'var(--text-primary)', margin: '0 2px' }}>{category}</strong> to all transactions containing:</span>
      <input
        value={kw}
        onChange={e => setKw(e.target.value)}
        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #334155', background: 'var(--bg-main)', color: 'var(--text-primary)', width: '180px' }}
        placeholder="keyword"
      />
      <button
        className="btn-primary"
        onClick={() => onConfirm(kw)}
        disabled={!kw.trim()}
        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
      >
        Save rule &amp; apply
      </button>
      <button
        className="btn-ghost"
        onClick={onDismiss}
        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
      >
        Skip
      </button>
      <span style={{ fontSize: '0.7rem', color: '#475569', flex: '0 0 100%', marginTop: '-0.25rem' }}>
        Narration: <em>{narration.slice(0, 60)}{narration.length > 60 ? '…' : ''}</em>
      </span>
    </div>
  );
}
