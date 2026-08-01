import { useState, useMemo } from 'react';
import { RefreshCw, Plus, Trash2, AlertCircle, Download, Upload, ChevronUp, ChevronDown, ChevronRight, Check, X, GripVertical, Edit2 } from 'lucide-react';
import { useStore } from '../../store';
import { Header } from '../Layout/Header';
import { DEFAULT_CATEGORIES } from '../../db/database';
import { fetchCategoriesFromSheet, parseCategoriesFromCSV } from '../../services/google-drive';
import { exportSnapshot, importSnapshot, getCurrentFY } from '../../services/snapshot';
import { exportTransactionsCSV, importTransactionsCSV } from '../../services/csvBackup';
import * as driveSync from '../../services/driveSync';
import type { Category, Owner } from '../../types';
import { generateId } from '../../parsers/base';

export function SettingsPage() {
  const {
    categories, categoryGroups, setCategories, addCategory, deleteCategory,
    saveCategoryGroups, addCategoryGroup, renameCategoryGroup, deleteCategoryGroup,
    rerunCorrelation, recategorizeUncategorized, transactions, budgets, investments, liabilities,
    categoryRules, deleteCategoryRule, goals, addGoal, deleteGoal, selectedMonth, loadAll,
  } = useStore();
  const [newGoalName, setNewGoalName] = useState('');
  const [recatMsg, setRecatMsg] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

  // Categories grouped and ordered exactly as they'll appear in the Transactions
  // dropdown — this editor IS the single source of truth for that ordering.
  const sortedGroups = useMemo(() => [...categoryGroups].sort((a, b) => a.order - b.order), [categoryGroups]);
  const catsByGroup = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      const g = c.group || 'Miscellaneous';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [categories]);

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function expandAll() { setOpenGroups(new Set(sortedGroups.map(g => g.id))); }
  function collapseAll() { setOpenGroups(new Set()); }

  async function moveGroup(id: string, dir: -1 | 1) {
    const idx = sortedGroups.findIndex(g => g.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= sortedGroups.length) return;
    const a = sortedGroups[idx], b = sortedGroups[swapWith];
    await saveCategoryGroups(categoryGroups.map(g =>
      g.id === a.id ? { ...g, order: b.order } : g.id === b.id ? { ...g, order: a.order } : g
    ));
  }

  async function moveSubcategory(cat: Category, dir: -1 | 1) {
    const siblings = catsByGroup.get(cat.group || 'Miscellaneous') || [];
    const idx = siblings.findIndex(c => c.id === cat.id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapWith];
    const aOrder = a.order ?? idx, bOrder = b.order ?? swapWith;
    await Promise.all([
      addCategory({ ...a, order: bOrder }),
      addCategory({ ...b, order: aOrder }),
    ]);
  }

  // Move a sub-category into a different Category (group), appending it at the end.
  async function moveSubcategoryToGroup(cat: Category, targetGroup: string) {
    if ((cat.group || 'Miscellaneous') === targetGroup) return;
    const siblings = catsByGroup.get(targetGroup) || [];
    const order = siblings.length > 0 ? Math.max(...siblings.map(c => c.order ?? 0)) + 1 : 0;
    await addCategory({ ...cat, group: targetGroup, order });
    setOpenGroups(prev => new Set(prev).add(sortedGroups.find(g => g.name === targetGroup)?.id || ''));
  }

  // Drag-and-drop reordering/regrouping (desktop pointer devices). The up/down
  // buttons and "Move to" dropdown below cover touch devices, where native HTML5
  // drag-and-drop mostly doesn't work.
  function handleDrop(targetCat: Category | null, targetGroupName: string) {
    if (!dragCatId) return;
    const dragged = categories.find(c => c.id === dragCatId);
    setDragCatId(null);
    setDragOverCatId(null);
    if (!dragged) return;

    if (!targetCat) {
      // Dropped on a group header/empty area — append to end of that group.
      moveSubcategoryToGroup(dragged, targetGroupName);
      return;
    }
    if (dragged.id === targetCat.id) return;

    const siblings = catsByGroup.get(targetGroupName) || [];
    const withoutDragged = siblings.filter(c => c.id !== dragged.id);
    const targetIdx = withoutDragged.findIndex(c => c.id === targetCat.id);
    withoutDragged.splice(targetIdx, 0, { ...dragged, group: targetGroupName });
    const updates = withoutDragged.map((c, i) => ({ ...c, group: targetGroupName, order: i }));
    Promise.all(updates.map(c => addCategory(c)));
    setOpenGroups(prev => new Set(prev).add(sortedGroups.find(g => g.name === targetGroupName)?.id || ''));
  }

  async function handleAddGroup() {
    const name = window.prompt('New Category name (e.g. "Travel"):');
    if (name?.trim()) await addCategoryGroup(name.trim());
  }

  async function handleDeleteGroup(id: string, name: string) {
    const count = (catsByGroup.get(name) || []).length;
    const msg = count > 0
      ? `Delete "${name}"? Its ${count} sub-categor${count === 1 ? 'y' : 'ies'} will move to Miscellaneous.`
      : `Delete "${name}"?`;
    if (confirm(msg)) await deleteCategoryGroup(id);
  }

  function startRenameGroup(id: string, name: string) {
    setEditingGroupId(id);
    setEditingGroupName(name);
  }

  async function commitRenameGroup() {
    if (editingGroupId) await renameCategoryGroup(editingGroupId, editingGroupName);
    setEditingGroupId(null);
  }

  function addSubcategory(groupName: string) {
    const siblings = catsByGroup.get(groupName) || [];
    const order = siblings.length > 0 ? Math.max(...siblings.map(c => c.order ?? 0)) + 1 : 0;
    addCategory({ id: generateId(), name: 'New Category', keywords: [], color: '#94a3b8', icon: '', group: groupName, order });
  }

  function updateSubcategory(cat: Category, patch: Partial<Category>) {
    addCategory({ ...cat, ...patch });
  }

  async function handleRecategorize() {
    const recategorized = await recategorizeUncategorized();
    await rerunCorrelation();
    setRecatMsg(
      recategorized > 0
        ? `${recategorized} previously uncategorized transactions matched keywords and were updated!`
        : 'Re-ran categorization — nothing new to update.'
    );
  }

  async function handleAddGoal() {
    const trimmed = newGoalName.trim();
    if (!trimmed) return;
    if (!goals.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) {
      await addGoal({ id: generateId(), name: trimmed });
    }
    setNewGoalName('');
  }
  const [sheetId, setSheetId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [csvText, setCsvText] = useState('');
  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [txnCsvMsg, setTxnCsvMsg] = useState('');
  const [txnCsvImporting, setTxnCsvImporting] = useState(false);

  // Google Drive sync state
  const [gClientId, setGClientId] = useState(driveSync.getClientId());
  const [deviceOwner, setDeviceOwnerState] = useState<string>(driveSync.getDeviceOwner());
  const [driveConnected, setDriveConnected] = useState(driveSync.isConnected());
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveMsg, setDriveMsg] = useState('');
  const [lastSync, setLastSync] = useState(driveSync.getLastSync());

  async function handleDriveConnect() {
    try {
      driveSync.setClientId(gClientId);
      if (deviceOwner) driveSync.setDeviceOwner(deviceOwner as Owner);
      await driveSync.connect();
      setDriveConnected(true);
      setDriveMsg('Connected to Google Drive! Use "Sync now" to run the first sync.');
    } catch (e: any) {
      setDriveMsg(`Connect error: ${e.message}`);
    }
  }

  async function handleDriveSync(force = false) {
    setDriveSyncing(true);
    setDriveMsg('');
    try {
      if (deviceOwner) driveSync.setDeviceOwner(deviceOwner as Owner);
      const result = await driveSync.syncNow(force);
      setLastSync(driveSync.getLastSync());
      setDriveMsg(
        result.pulledFrom.length > 0
          ? `Synced! Merged ${result.mergedTransactions} transactions from ${result.pulledFrom.join(', ')}; pushed this device's data and monthly backups.`
          : 'Synced! Pushed this device\'s data and monthly backups (no other device files found yet).'
      );
    } catch (e: any) {
      if (e instanceof driveSync.SyncGuardError) {
        const proceed = window.confirm(
          `${e.message}\n\nOnly continue if you intentionally deleted transactions (e.g. bulk-removed duplicates). ` +
          `If your local data was accidentally cleared or failed to load, click Cancel and fix that first — ` +
          `continuing will permanently overwrite the Drive backup with the smaller local dataset.`
        );
        if (proceed) {
          await handleDriveSync(true);
          return;
        }
        setDriveMsg('Sync cancelled — local data was not pushed to Drive.');
      } else {
        setDriveMsg(`Sync error: ${e.message}`);
      }
    } finally {
      setDriveSyncing(false);
    }
  }

  function handleDriveDisconnect() {
    driveSync.disconnect();
    setDriveConnected(false);
    setDriveMsg('Disconnected. Your local data is untouched.');
  }

  async function syncFromSheet() {
    if (!sheetId || !accessToken) {
      setSyncMsg('Enter both the Google Sheet ID and your access token.');
      return;
    }
    setSyncing(true);
    setSyncMsg('');
    try {
      const cats = await fetchCategoriesFromSheet(sheetId, accessToken);
      await setCategories(cats.map((c, i) => ({ ...c, order: i })));
      await loadAll(); // refresh categoryGroups so any new group names from the sheet get a real, orderable entry
      setSyncMsg(`Synced ${cats.length} categories from Google Sheets!`);
    } catch (e: any) {
      setSyncMsg(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function importFromCSV() {
    const cats = parseCategoriesFromCSV(csvText);
    await setCategories(cats.map((c, i) => ({ ...c, order: i })));
    await loadAll();
    setSyncMsg(`Imported ${cats.length} categories from CSV`);
  }

  async function resetToDefaults() {
    if (!confirm('Reset to the default category list? This replaces ALL categories and groups — custom ones you added will be lost.')) return;
    await setCategories(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })));
    await loadAll();
    setSyncMsg('Categories reset to defaults.');
  }

  async function handleExport(filterType: 'month' | 'fy' | 'all', filterValue: string) {
    try {
      await exportSnapshot(transactions, budgets, investments, liabilities, categories, filterType, filterValue);
    } catch (e: any) {
      setSnapshotMsg(`Export error: ${e.message}`);
    }
  }

  async function handleTxnCsvExport(owner: Owner | 'All', suffix: string) {
    try {
      await exportTransactionsCSV(owner, suffix);
    } catch (e: any) {
      setTxnCsvMsg(`Export error: ${e.message}`);
    }
  }

  async function handleTxnCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setTxnCsvImporting(true);
    setTxnCsvMsg('');
    try {
      const result = await importTransactionsCSV(file);
      await loadAll();
      setTxnCsvMsg(`Imported ${result.imported} transactions from CSV`);
    } catch (err: any) {
      setTxnCsvMsg(`Import error: ${err.message}`);
    } finally {
      setTxnCsvImporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setSnapshotMsg('');
    try {
      const result = await importSnapshot(file);
      await loadAll();
      setSnapshotMsg(`Imported ${result.imported} transactions from "${result.type}"`);
    } catch (err: any) {
      setSnapshotMsg(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <Header title="Settings" />
      <div style={{ padding: '1.5rem', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Google Drive Sync */}
        <div className="card" style={{ borderColor: 'rgba(96,165,250,0.35)' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>☁️ Google Drive Sync</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Two-way sync between you and Khushboo via a shared Drive folder (<code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>FinanceDashboardSync</code>).
            Each device pushes its data and pulls the other's; monthly backups (CSV + JSON for Suryanshu, Khushboo, and Combined)
            are rewritten on every sync. One-time setup: create a Google OAuth Client ID —{' '}
            <a href="https://github.com/suryanshuvasishta/expensetracker/blob/main/finance-dashboard/DRIVE_SYNC_SETUP.md" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>step-by-step guide</a>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Google OAuth Client ID</label>
                <input value={gClientId} onChange={e => setGClientId(e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>This device belongs to</label>
                <select value={deviceOwner} onChange={e => setDeviceOwnerState(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— select —</option>
                  <option value="Suryanshu">Suryanshu</option>
                  <option value="Khushboo">Khushboo</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {!driveConnected ? (
                <button className="btn-primary" onClick={handleDriveConnect} disabled={!gClientId.trim() || !deviceOwner}>
                  Connect Google Drive
                </button>
              ) : (
                <>
                  <button className="btn-primary" onClick={() => handleDriveSync()} disabled={driveSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={14} className={driveSyncing ? 'spinning' : ''} />
                    {driveSyncing ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button className="btn-ghost" onClick={handleDriveDisconnect}>Disconnect</button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    ✓ Connected{lastSync ? ` · last sync ${new Date(lastSync).toLocaleString('en-IN')}` : ' · not synced yet'}
                    {' · auto-syncs on app open and ~20s after changes'}
                  </span>
                </>
              )}
            </div>
            {driveMsg && (
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: driveMsg.includes('error') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', color: driveMsg.includes('error') ? '#f87171' : '#4ade80' }}>
                {driveMsg}
              </div>
            )}
          </div>
        </div>

        {/* Snapshots — Export & Import */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Snapshots — Export & Import</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Export your data as a JSON snapshot. Import merges data — existing records with the same ID are overwritten.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn-ghost" onClick={() => handleExport('month', selectedMonth)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export This Month ({selectedMonth})
            </button>
            <button className="btn-ghost" onClick={() => handleExport('fy', getCurrentFY())} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export This FY ({getCurrentFY()})
            </button>
            <button className="btn-ghost" onClick={() => handleExport('all', '')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export All Time
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.5rem 1rem' }}>
                <Upload size={14} /> {importing ? 'Importing…' : 'Import Snapshot'}
              </span>
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>⚠️ Importing merges data — existing records with the same ID are overwritten.</span>
          </div>
          {snapshotMsg && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: snapshotMsg.startsWith('Import error') || snapshotMsg.startsWith('Export error') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', color: snapshotMsg.startsWith('Import error') || snapshotMsg.startsWith('Export error') ? '#f87171' : '#4ade80' }}>
              {snapshotMsg}
            </div>
          )}
        </div>

        {/* Transactions CSV Backup */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Transactions CSV Backup</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Full-fidelity CSV export/import of all transactions (every account, every month) — usable in Excel/Sheets and
            round-trips cleanly back into the app, so you don't need to re-parse source statements after correcting categories.
            Use this for periodic backups; import upserts by transaction ID.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button className="btn-ghost" onClick={() => handleTxnCsvExport('Suryanshu', 'suryanshu')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export Suryanshu
            </button>
            <button className="btn-ghost" onClick={() => handleTxnCsvExport('Khushboo', 'khushboo')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export Khushboo
            </button>
            <button className="btn-ghost" onClick={() => handleTxnCsvExport('All', 'combined')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <Download size={14} /> Export Combined (All)
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.5rem 1rem' }}>
                <Upload size={14} /> {txnCsvImporting ? 'Importing…' : 'Import Transactions CSV'}
              </span>
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleTxnCsvImport} disabled={txnCsvImporting} />
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>⚠️ Only import a CSV exported from this backup tool — upserts by ID.</span>
          </div>
          {txnCsvMsg && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: txnCsvMsg.startsWith('Import error') || txnCsvMsg.startsWith('Export error') ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)', color: txnCsvMsg.startsWith('Import error') || txnCsvMsg.startsWith('Export error') ? '#f87171' : '#4ade80' }}>
              {txnCsvMsg}
            </div>
          )}
        </div>

        {/* Google Sheets Sync */}
        <div className="card">
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600 }}>Sync Categories from Google Sheets</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Connect to your expense tracker spreadsheet to import category names and keywords.
            Your sheet should have columns: <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Category Name | Keywords (comma-separated) | Color (hex)</code>
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
            Paste CSV with format: <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>Category Name,keywords;separated;by;semicolons,#hexcolor</code>
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

        {/* Category Editor — the single, unified place to edit Categories (groups) and
            their Sub-categories, including the order they appear in everywhere else
            (Transactions dropdown, Budget rows). Every edit here saves immediately —
            there's no separate "unsaved draft" state to lose track of.
            Categories collapse by default (click the name/chevron) so the page stays
            short instead of dumping every sub-category on screen at once. Sub-categories
            can be moved between Categories via drag-and-drop (desktop) or the "Move to"
            dropdown (works everywhere, including touch, where native drag doesn't). */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Categories ({categories.length})</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Click a Category to expand it. Drag a sub-category (⠿) to reorder or drop it on another Category to move it there.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={expandAll} style={{ fontSize: '0.75rem' }}>Expand all</button>
              <button className="btn-ghost" onClick={collapseAll} style={{ fontSize: '0.75rem' }}>Collapse all</button>
              <button className="btn-ghost" onClick={resetToDefaults} style={{ fontSize: '0.75rem' }}>Reset defaults</button>
              <button className="btn-ghost" onClick={handleAddGroup} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus size={13} /> Add Category
              </button>
              <button className="btn-primary" onClick={handleRecategorize} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <RefreshCw size={13} /> Recategorize Now
              </button>
            </div>
          </div>

          {recatMsg && (
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
              {recatMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sortedGroups.map((group, gi) => {
              const subcats = catsByGroup.get(group.name) || [];
              const open = openGroups.has(group.id);
              return (
                <div
                  key={group.id}
                  style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleDrop(null, group.name); }}
                >
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.625rem', background: 'var(--bg-elevated)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button onClick={() => moveGroup(group.id, -1)} disabled={gi === 0} style={{ background: 'none', border: 'none', cursor: gi === 0 ? 'default' : 'pointer', color: gi === 0 ? 'var(--text-faint)' : 'var(--text-dim)', padding: 0, lineHeight: 0 }}><ChevronUp size={13} /></button>
                      <button onClick={() => moveGroup(group.id, 1)} disabled={gi === sortedGroups.length - 1} style={{ background: 'none', border: 'none', cursor: gi === sortedGroups.length - 1 ? 'default' : 'pointer', color: gi === sortedGroups.length - 1 ? 'var(--text-faint)' : 'var(--text-dim)', padding: 0, lineHeight: 0 }}><ChevronDown size={13} /></button>
                    </div>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      title={open ? 'Collapse' : 'Expand'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '2px', display: 'flex' }}
                    >
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {editingGroupId === group.id ? (
                      <>
                        <input
                          value={editingGroupName}
                          onChange={e => setEditingGroupName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && commitRenameGroup()}
                          autoFocus
                          style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}
                        />
                        <button onClick={commitRenameGroup} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', padding: '4px' }}><Check size={14} /></button>
                        <button onClick={() => setEditingGroupId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px' }}><X size={14} /></button>
                      </>
                    ) : (
                      <span
                        onClick={() => toggleGroup(group.id)}
                        onDoubleClick={() => startRenameGroup(group.id, group.name)}
                        title="Click to expand/collapse, double-click to rename"
                        style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        {group.name}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{subcats.length}</span>
                    <button onClick={() => { addSubcategory(group.name); setOpenGroups(prev => new Set(prev).add(group.id)); }} title="Add sub-category" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', padding: '4px' }}>
                      <Plus size={14} />
                    </button>
                    <button onClick={() => startRenameGroup(group.id, group.name)} title="Rename category" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDeleteGroup(group.id, group.name)} title="Delete category" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Sub-categories */}
                  {open && subcats.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.5rem' }}>
                      {subcats.map((cat, ci) => (
                        <div
                          key={cat.id}
                          draggable
                          onDragStart={() => setDragCatId(cat.id)}
                          onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverCatId(cat.id); }}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleDrop(cat, group.name); }}
                          style={{
                            display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', padding: '0.5rem',
                            background: dragOverCatId === cat.id ? 'rgba(59,130,246,0.12)' : 'var(--bg-main)',
                            borderRadius: '8px',
                            border: dragOverCatId === cat.id ? '1px dashed #60a5fa' : '1px solid transparent',
                            opacity: dragCatId === cat.id ? 0.4 : 1,
                          }}
                        >
                          <span style={{ cursor: 'grab', color: 'var(--text-faint)', display: 'flex', touchAction: 'none' }} title="Drag to reorder or move">
                            <GripVertical size={14} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <button onClick={() => moveSubcategory(cat, -1)} disabled={ci === 0} style={{ background: 'none', border: 'none', cursor: ci === 0 ? 'default' : 'pointer', color: ci === 0 ? 'var(--text-faint)' : 'var(--text-dim)', padding: 0, lineHeight: 0 }}><ChevronUp size={12} /></button>
                            <button onClick={() => moveSubcategory(cat, 1)} disabled={ci === subcats.length - 1} style={{ background: 'none', border: 'none', cursor: ci === subcats.length - 1 ? 'default' : 'pointer', color: ci === subcats.length - 1 ? 'var(--text-faint)' : 'var(--text-dim)', padding: 0, lineHeight: 0 }}><ChevronDown size={12} /></button>
                          </div>
                          <input
                            type="color"
                            value={cat.color}
                            onChange={e => updateSubcategory(cat, { color: e.target.value })}
                            style={{ width: '28px', height: '28px', padding: '2px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <input
                            defaultValue={cat.name}
                            onBlur={e => e.target.value.trim() && e.target.value !== cat.name && updateSubcategory(cat, { name: e.target.value.trim() })}
                            placeholder="Sub-category name"
                            style={{ flex: '1 1 130px', minWidth: '100px' }}
                          />
                          <input
                            defaultValue={cat.keywords.join(', ')}
                            onBlur={e => updateSubcategory(cat, { keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                            placeholder="keywords, comma, separated"
                            style={{ flex: '2 1 200px', fontSize: '0.8125rem' }}
                          />
                          <input
                            defaultValue={cat.icon || ''}
                            onBlur={e => updateSubcategory(cat, { icon: e.target.value })}
                            placeholder="🏷️"
                            style={{ width: '44px', textAlign: 'center', flexShrink: 0 }}
                          />
                          <select
                            value={group.name}
                            onChange={e => moveSubcategoryToGroup(cat, e.target.value)}
                            title="Move to a different Category"
                            style={{ width: '110px', fontSize: '0.75rem', flexShrink: 0 }}
                          >
                            {sortedGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                          </select>
                          <button
                            onClick={() => confirm(`Delete "${cat.name}"?`) && deleteCategory(cat.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', flexShrink: 0 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {open && subcats.length === 0 && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      No sub-categories yet — drop one here, or use the + above.
                    </div>
                  )}
                </div>
              );
            })}
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

        {/* Category rules */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Auto-Classification Rules</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
            Rules are learned when you reclassify a transaction. They're applied first on every new upload.
          </p>
          {categoryRules.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.8125rem' }}>No rules yet. Reclassify a transaction to start learning.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: '#475569', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1 }}>Keyword (in narration)</span>
                <span style={{ width: '160px' }}>→ Category</span>
                <span style={{ width: '32px' }}></span>
              </div>
              {[...categoryRules].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(rule => (
                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ flex: 1, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{rule.keyword}</span>
                  <span style={{ width: '160px', color: '#94a3b8' }}>{rule.category}</span>
                  <button
                    onClick={() => deleteCategoryRule(rule.id)}
                    title="Delete rule"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px', width: '32px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financial goals */}
        <div className="card">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>Financial Goals</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
            Used to tag investments on the Portfolio tab (e.g. Retirement, Child's Education, Emergency Fund).
            You can also add a new goal directly from a holding's editor.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
            {goals.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{g.name}</span>
                <button
                  onClick={() => deleteGoal(g.id)}
                  title="Delete goal"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={newGoalName}
              onChange={e => setNewGoalName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
              placeholder="e.g. Sabbatical Fund"
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={handleAddGoal} disabled={!newGoalName.trim()} style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}>
              Add
            </button>
          </div>
        </div>

        {/* Data management */}
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 600, color: '#f87171' }}>Data</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>
            All data is stored in your browser's IndexedDB. It never leaves your device.
            Clearing removes transactions, uploads, budgets, portfolio, and learned rules
            (category definitions are kept). Export a snapshot first if you might want it back.
          </p>
          <p style={{ color: '#fbbf24', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
            If Google Drive sync is connected, budgets/investments/liabilities can still come
            back from your Drive backup on the next sync (only transaction deletes are tracked
            and propagated). Disconnect sync first, or expect to re-clear after a sync, if you
            need those gone for good too.
          </p>
          <button
            className="btn-ghost"
            onClick={async () => {
              if (confirm('Delete ALL data — transactions, uploads, budgets, investments, liabilities, and learned rules? This cannot be undone.')) {
                const { db } = await import('../../db/database');
                // Tombstone every transaction before clearing — otherwise the next Drive
                // sync silently pulls them all back in from this device's own last backup.
                const allIds = (await db.transactions.toArray()).map(t => t.id);
                const deletedAt = new Date().toISOString();
                await db.tombstones.bulkPut(allIds.map(id => ({ id, deletedAt })));
                await db.transactions.clear();
                await db.uploadedFiles.clear();
                await db.budgets.clear();
                await db.investments.clear();
                await db.liabilities.clear();
                await db.categoryRules.clear();
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
