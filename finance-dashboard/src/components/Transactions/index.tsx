import { useState, useMemo } from 'react';
import { Search, Filter, Download, Link2, Edit2, Check, X } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import type { Transaction } from '../../types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function TransactionsPage() {
  const { transactions, categories, selectedMonth, updateTransaction } = useStore();
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

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
  const catNames = [...new Set(categories.map(c => c.name))].sort();

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditCategory(t.category);
  }

  async function saveEdit(id: string) {
    await updateTransaction(id, { category: editCategory });
    setEditingId(null);
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
              {catNames.map(c => <option key={c} value={c}>{c}</option>)}
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
                        <select value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ width: '140px', padding: '2px 4px', fontSize: '0.75rem' }}>
                          {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => saveEdit(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80' }}><Check size={14} /></button>
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
