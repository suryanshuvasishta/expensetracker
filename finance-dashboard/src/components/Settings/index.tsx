import { useState } from 'react';
import { RefreshCw, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { DEFAULT_CATEGORIES } from '../../db/database';
import { fetchCategoriesFromSheet, parseCategoriesFromCSV } from '../../services/google-drive';
import type { Category } from '../../types';
import { generateId } from '../../parsers/base';

export function SettingsPage() {
  const { categories, setCategories, rerunCorrelation } = useStore();
  const [editCats, setEditCats] = useState<Category[]>([...categories]);
  const [sheetId, setSheetId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [csvText, setCsvText] = useState('');

  async function syncFromSheet() {
    if (!sheetId || !accessToken) {
      setSyncMsg('Enter both the Google Sheet ID and your access token.');
      return;
    }
    setSyncing(true);
    setSyncMsg('');
    try {
      const cats = await fetchCategoriesFromSheet(sheetId, accessToken);
      setEditCats(cats);
      setSyncMsg(`Synced ${cats.length} categories from Google Sheets!`);
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function importFromCSV() {
    const cats = parseCategoriesFromCSV(csvText);
    setEditCats(cats);
    setSyncMsg(`Imported ${cats.length} categories from CSV`);
  }

  async function saveCategories() {
    await setCategories(editCats);
    await rerunCorrelation();
    setSyncMsg('Categories saved and transactions re-categorized!');
  }

  function addCategory() {
    setEditCats(prev => [...prev, {
      id: generateId(),
      name: 'New Category',
      keywords: [],
      color: '#94a3b8',
      icon: '',
    }]);
  }

  function updateCat(id: string, patch: Partial<Category>) {
    setEditCats(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  function removeCat(id: string) {
    setEditCats(prev => prev.filter(c => c.id !== id));
  }

  function resetToDefaults() {
    setEditCats([...DEFAULT_CATEGORIES]);
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Settings" />
      <div style={{ padding: '1.5rem', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Google Sheets Sync */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Sync Categories from Google Sheets</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Connect to your expense tracker spreadsheet to import category names and keywords.
            Your sheet should have columns: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Category Name | Keywords (comma-separated) | Color (hex)</code>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Google Sheet ID</label>
              <input value={sheetId} onChange={e => setSheetId(e.target.value)} placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
              <p style={{ fontSize: '0.7rem', color: '#475569', margin: '4px 0 0' }}>Find this in the sheet URL: docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit</p>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Google OAuth Access Token</label>
              <input type="password" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Paste your OAuth2 access token here" />
              <p style={{ fontSize: '0.7rem', color: '#475569', margin: '4px 0 0' }}>Get a token from <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>OAuth Playground</a> with Sheets readonly scope</p>
            </div>
            <button className="btn-primary" onClick={syncFromSheet} disabled={syncing} style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
              {syncing ? 'Syncing...' : 'Sync from Google Sheets'}
            </button>
          </div>
        </div>

        {/* CSV Import */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Import Categories from CSV</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
            Paste CSV with format: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Category Name,keywords;separated;by;semicolons,#hexcolor</code>
          </p>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={"Category,Keywords,Color\nFood & Dining,swiggy;zomato;food;restaurant,#f97316"}
            rows={5}
          />
          <button className="btn-primary" onClick={importFromCSV} style={{ marginTop: '0.75rem', width: 'fit-content' }}>Import CSV</button>
        </div>

        {syncMsg && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: syncMsg.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', border: `1px solid ${syncMsg.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`, fontSize: '0.875rem', color: syncMsg.startsWith('Error') ? '#f87171' : '#4ade80', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={14} /> {syncMsg}
          </div>
        )}

        {/* Category Editor */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Categories ({editCats.length})</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" onClick={resetToDefaults} style={{ fontSize: '0.75rem' }}>Reset defaults</button>
              <button className="btn-ghost" onClick={addCategory} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus size={13} /> Add
              </button>
              <button className="btn-primary" onClick={saveCategories} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Save size={13} /> Save & Recategorize
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
            {editCats.map(cat => (
              <div key={cat.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: '#0f172a', borderRadius: '8px' }}>
                <input
                  type="color"
                  value={cat.color}
                  onChange={e => updateCat(cat.id, { color: e.target.value })}
                  style={{ width: '32px', height: '32px', padding: '2px', border: 'none', background: 'none', cursor: 'pointer' }}
                />
                <input
                  value={cat.name}
                  onChange={e => updateCat(cat.id, { name: e.target.value })}
                  placeholder="Category name"
                  style={{ width: '160px' }}
                />
                <input
                  value={cat.keywords.join(', ')}
                  onChange={e => updateCat(cat.id, { keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                  placeholder="keywords, comma, separated"
                  style={{ flex: 1 }}
                />
                <input
                  value={cat.icon || ''}
                  onChange={e => updateCat(cat.id, { icon: e.target.value })}
                  placeholder="🏷️"
                  style={{ width: '48px', textAlign: 'center' }}
                />
                <button onClick={() => removeCat(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Correlation */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Transaction Correlation</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Re-run correlation to match bank account CC payments with credit card statement entries.
            This prevents double-counting when you pay your credit card bill.
          </p>
          <button className="btn-primary" onClick={rerunCorrelation} style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={14} /> Re-run Correlation
          </button>
        </div>

        {/* Data management */}
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600, color: '#f87171' }}>Data</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
            All transaction data is stored in your browser's IndexedDB. It never leaves your device.
            Clear it here to start fresh.
          </p>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (confirm('Delete ALL transaction data? This cannot be undone.')) {
                const { db } = await import('../../db/database');
                await db.transactions.clear();
                await db.uploadedFiles.clear();
                window.location.reload();
              }
            }}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            Clear all data
          </button>
        </div>
      </div>
    </div>
  );
}
