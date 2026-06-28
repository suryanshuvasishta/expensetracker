import { useState, useMemo } from 'react';
import { Search, Filter, Download, Link2, Edit2, Check, X, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { generateId } from '../../parsers/base';
import type { Transaction } from '../../types';
import { CATEGORY_GROUPS } from '../../types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function TransactionsPage() {
  const { transactions, categories, selectedMonth, updateTransaction, saveCategoryRule, applyRuleToAll } = useStore();
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
  const SYSTEM_CATS = ['Salary', 'Investments', 'Credit Card Payment', 'Transfers'];

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditCategory(t.category);
    setLearnPrompt(null);
    setLearnApplied(null);
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
          <button className="btn-ghost" onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={14} /> Filters
          </button>
          <button className="btn-ghost" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={14} /> Export CSV
          </button>
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
              {CATEGORY_GROUPS.map(({ group, categories: cats }) => (
                <optgroup key={group} label={group}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
              <optgroup label="System">
                {SYSTEM_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            </select>
            <button className="btn-ghost" onClick={() => { setFilterAccount(''); setFilterType(''); setFilterCategory(''); setSearch(''); }}>
              Clear filters
            </button>
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
                      {t.narration}
                      {t.isCorrelationPair && (
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
                        <select value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ width: '170px', padding: '2px 4px', fontSize: '0.75rem' }}>
                          {CATEGORY_GROUPS.map(({ group, categories: cats }) => (
                            <optgroup key={group} label={group}>
                              {cats.map(c => <option key={c} value={c}>{c}</option>)}
                            </optgroup>
                          ))}
                          <optgroup label="System">
                            {SYSTEM_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        </select>
                        <button onClick={() => saveEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80' }}><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <CategoryBadge category={t.category} categories={categories} />
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.paymentMethod}</td>
                  <td>
                    <button onClick={() => startEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', borderRadius: '4px' }}>
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
