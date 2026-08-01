import type { Owner, Transaction } from '../types';
import { db } from '../db/database';
import { buildFullSnapshot, type Snapshot } from './snapshot';
import { buildTransactionsCSV } from './csvBackup';
import { useStore } from '../store';

// Google Drive two-way sync for a couple sharing one Drive folder.
// Each device pushes its full local DB to its own file (device-<owner>.json) and
// pulls + merges EVERY device file, including its own (union by record id) — this
// is what lets a locally-wiped/cleared DB self-heal from its own last backup
// instead of that wipe getting pushed over the backup. Deletions are tracked as
// tombstones so a merge can never silently resurrect something you deliberately
// deleted. Monthly backup files (JSON + CSV × Suryanshu/Khushboo/Combined) are
// rewritten on every sync.
//
// Requires a Google OAuth Client ID (see DRIVE_SYNC_SETUP.md). Uses the full
// `drive` scope because the folder is shared between two Google accounts and the
// narrower drive.file scope can't see files created under the other account.

/** Thrown when a push would overwrite a Drive backup with far fewer transactions
 *  than it currently holds — almost always a sign of local data loss (cleared
 *  DB, failed load, etc.) rather than an intentional bulk delete. Callers should
 *  confirm with the user and retry with force:true if the shrink is intentional. */
export class SyncGuardError extends Error {
  remoteCount: number;
  localCount: number;
  constructor(remoteCount: number, localCount: number) {
    super(
      `Local data has ${localCount} transactions but the Drive backup has ${remoteCount}. ` +
      `Refusing to overwrite — this looks like local data loss, not an intentional deletion.`
    );
    this.remoteCount = remoteCount;
    this.localCount = localCount;
    this.name = 'SyncGuardError';
  }
}

const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_NAME = 'FinanceDashboardSync';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const LS = {
  clientId: 'gdrive_client_id',
  deviceOwner: 'gdrive_device_owner',
  token: 'gdrive_token', // { access_token, expires_at }
  folderId: 'gdrive_folder_id',
  lastSync: 'gdrive_last_sync',
};

declare global {
  interface Window {
    google: any;
  }
}

// ---------- config ----------

export function getClientId(): string {
  return localStorage.getItem(LS.clientId) || '';
}
export function setClientId(id: string) {
  localStorage.setItem(LS.clientId, id.trim());
}
export function getDeviceOwner(): Owner | '' {
  return (localStorage.getItem(LS.deviceOwner) as Owner) || '';
}
export function setDeviceOwner(owner: Owner) {
  localStorage.setItem(LS.deviceOwner, owner);
}
export function getLastSync(): string {
  return localStorage.getItem(LS.lastSync) || '';
}
export function isConnected(): boolean {
  return !!getClientId() && !!localStorage.getItem(LS.token);
}
export function disconnect() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.folderId);
}

// ---------- auth ----------

let gisLoaded: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoaded) {
    gisLoaded = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }
  return gisLoaded;
}

function requestToken(interactive: boolean): Promise<string> {
  const clientId = getClientId();
  if (!clientId) throw new Error('Google Client ID not set');
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const expiresAt = Date.now() + (Number(response.expires_in) - 120) * 1000;
        localStorage.setItem(LS.token, JSON.stringify({ access_token: response.access_token, expires_at: expiresAt }));
        resolve(response.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.message || 'Google sign-in was cancelled')),
    });
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

/** Interactive connect — call from a button click. */
export async function connect(): Promise<void> {
  await loadGis();
  await requestToken(true);
}

/** Valid access token, silently refreshing if expired. Throws if user interaction is needed. */
async function getToken(): Promise<string> {
  const raw = localStorage.getItem(LS.token);
  if (raw) {
    try {
      const { access_token, expires_at } = JSON.parse(raw);
      if (access_token && Date.now() < expires_at) return access_token;
    } catch { /* fall through to refresh */ }
  }
  await loadGis();
  return requestToken(false);
}

// ---------- Drive REST helpers ----------

async function driveFetch(url: string, init: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function ensureFolder(): Promise<string> {
  const cached = localStorage.getItem(LS.folderId);
  if (cached) return cached;

  // Searches both owned and shared-with-me folders, so whichever partner created
  // the folder first, the other finds the same one after it's shared.
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await driveFetch(`${API}/files?q=${q}&fields=files(id,name)&pageSize=5`);
  let folderId: string;
  if (found.files?.length > 0) {
    folderId = found.files[0].id;
  } else {
    const created = await driveFetch(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = created.id;
  }
  localStorage.setItem(LS.folderId, folderId);
  return folderId;
}

async function findFile(folderId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
  const res = await driveFetch(`${API}/files?q=${q}&fields=files(id)&pageSize=1`);
  return res.files?.[0]?.id || null;
}

async function uploadFile(folderId: string, name: string, content: string, mimeType: string): Promise<void> {
  const existingId = await findFile(folderId, name);
  const metadata = existingId ? {} : { name, parents: [folderId] };
  const boundary = '-------finance-dashboard-sync';
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

  const url = existingId
    ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart&fields=id`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id`;

  await driveFetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function downloadJSON(fileId: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.json();
}

// ---------- merge ----------

function stamp(t: Transaction): string {
  return t.updatedAt || t.createdAt || '';
}

/**
 * Merge a remote device snapshot without clobbering fresher local edits:
 * transactions use last-write-wins on updatedAt/createdAt; budgets, investments,
 * liabilities, and categories are added only when missing locally (each person
 * edits their own on their own device, so id-collisions mean "already have it").
 *
 * Tombstones from the remote are merged in first and used to both (a) filter out
 * incoming transactions that were deliberately deleted elsewhere, so a merge can
 * never resurrect them, and (b) delete any local copy that predates the remote
 * deletion but hasn't been removed locally yet.
 */
async function mergeRemoteSnapshot(snapshot: Snapshot): Promise<number> {
  if (!snapshot.version || !snapshot.transactions) throw new Error('Invalid snapshot');

  // 1. Merge tombstones first — deletions are terminal, so we only ever add new ones.
  const localTombstones = await db.tombstones.toArray();
  const localTombstoneIds = new Set(localTombstones.map(t => t.id));
  const newTombstones = (snapshot.tombstones || []).filter(t => !localTombstoneIds.has(t.id));
  if (newTombstones.length) await db.tombstones.bulkPut(newTombstones);
  const allTombstoneIds = new Set([...localTombstoneIds, ...newTombstones.map(t => t.id)]);

  // 2. Apply any local transactions that a remote device already tombstoned.
  const staleLocalIds = (await db.transactions.toArray())
    .map(t => t.id)
    .filter(id => allTombstoneIds.has(id));
  if (staleLocalIds.length) await db.transactions.bulkDelete(staleLocalIds);

  // 3. Merge transactions, skipping anything tombstoned (deliberately deleted) anywhere.
  const localTxns = new Map((await db.transactions.toArray()).map(t => [t.id, t]));
  const toApply = snapshot.transactions.filter(remote => {
    if (allTombstoneIds.has(remote.id)) return false;
    const local = localTxns.get(remote.id);
    return !local || stamp(remote) > stamp(local);
  });
  if (toApply.length) await db.transactions.bulkPut(toApply);

  const addMissing = async (table: { toArray: () => Promise<any[]>; bulkPut: (r: any[]) => Promise<any> }, records?: { id: string }[]) => {
    if (!records?.length) return;
    const existing = new Set((await table.toArray()).map((r: any) => r.id));
    const fresh = records.filter(r => !existing.has(r.id));
    if (fresh.length) await table.bulkPut(fresh);
  };
  await addMissing(db.budgets, snapshot.budgets);
  await addMissing(db.investments, snapshot.investments);
  await addMissing(db.liabilities, snapshot.liabilities);
  await addMissing(db.categories, snapshot.categories);

  return toApply.length + staleLocalIds.length;
}

// ---------- sync ----------

export interface SyncResult {
  pulledFrom: string[];
  mergedTransactions: number;
  backupsWritten: boolean;
}

let syncing = false;

export async function syncNow(force = false): Promise<SyncResult> {
  if (syncing) throw new Error('Sync already in progress');
  const deviceOwner = getDeviceOwner();
  if (!deviceOwner) throw new Error('Set which person this device belongs to first');
  syncing = true;
  try {
    const folderId = await ensureFolder();

    // 1. Pull: merge every device file, INCLUDING our own. Merging our own last
    // backup back in is what lets a cleared/corrupted local DB self-heal on the
    // next sync instead of that empty state getting pushed over the backup —
    // tombstones (merged first, inside mergeRemoteSnapshot) stop this from
    // resurrecting anything that was deliberately deleted.
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and name contains 'device-'`);
    const listing = await driveFetch(`${API}/files?q=${q}&fields=files(id,name)&pageSize=10`);
    const pulledFrom: string[] = [];
    let mergedTransactions = 0;
    let ownRemoteCount: number | null = null;
    for (const f of listing.files || []) {
      try {
        const snapshot = (await downloadJSON(f.id)) as Snapshot;
        if (f.name === `device-${deviceOwner}.json`) {
          ownRemoteCount = snapshot.transactions?.length ?? 0;
        }
        mergedTransactions += await mergeRemoteSnapshot(snapshot);
        pulledFrom.push(f.name);
      } catch (e) {
        console.warn(`Drive sync: could not merge ${f.name}`, e);
      }
    }

    // Always refresh in-memory state from IndexedDB after any merge writes, even
    // when nothing new came in — otherwise the UI can silently drift from what's
    // actually on disk (e.g. after tombstone-driven deletes with 0 net additions).
    await useStore.getState().loadAll();
    await useStore.getState().rerunCorrelation();

    // 2. Push: our full local DB as this device's file — but refuse to overwrite
    // a substantially larger remote backup with a much smaller local state
    // unless explicitly forced. This is the guard against local data loss
    // (cleared DB, failed load, etc.) silently becoming permanent remote loss.
    const snapshot = await buildFullSnapshot();
    const localCount = snapshot.transactions.length;
    if (!force && ownRemoteCount !== null && ownRemoteCount > 0 && localCount < ownRemoteCount * 0.5) {
      throw new SyncGuardError(ownRemoteCount, localCount);
    }
    await uploadFile(folderId, `device-${deviceOwner}.json`, JSON.stringify(snapshot), 'application/json');

    // 3. Monthly backups for the current month: JSON + CSV × Suryanshu/Khushboo/Combined
    const month = new Date().toISOString().slice(0, 7);
    const monthTxns = snapshot.transactions.filter(t => t.month === month);
    const scopes: { label: string; owner: Owner | 'All' }[] = [
      { label: 'suryanshu', owner: 'Suryanshu' },
      { label: 'khushboo', owner: 'Khushboo' },
      { label: 'combined', owner: 'All' },
    ];
    for (const s of scopes) {
      const txns = s.owner === 'All' ? monthTxns : monthTxns.filter(t => t.owner === s.owner || t.owner === 'Joint');
      await uploadFile(folderId, `backup-${month}-${s.label}.csv`, buildTransactionsCSV(txns), 'text/csv');
      await uploadFile(
        folderId,
        `backup-${month}-${s.label}.json`,
        JSON.stringify({ ...snapshot, transactions: txns, filterType: 'month', filterLabel: `${month} ${s.label}` }),
        'application/json'
      );
    }

    localStorage.setItem(LS.lastSync, new Date().toISOString());
    return { pulledFrom, mergedTransactions, backupsWritten: true };
  } finally {
    syncing = false;
  }
}

// ---------- auto sync ----------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncStarted = false;

/** Call once on app start: initial sync + debounced push after local changes. */
export function initAutoSync() {
  if (autoSyncStarted || !isConnected() || !getDeviceOwner()) return;
  autoSyncStarted = true;

  // Initial sync shortly after load (let loadAll finish first)
  setTimeout(() => {
    syncNow().catch(e => console.warn('Drive auto-sync (startup) failed:', e.message));
  }, 3000);

  // Debounced sync after local transaction changes
  let lastTxns = useStore.getState().transactions;
  useStore.subscribe(state => {
    if (state.transactions === lastTxns) return;
    lastTxns = state.transactions;
    if (syncing) return; // change caused by the sync itself — don't re-trigger
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncNow().catch(e => console.warn('Drive auto-sync failed:', e.message));
    }, 20_000);
  });
}

/** Rough count of local records, for the Settings status line. */
export async function localCounts(): Promise<{ transactions: number }> {
  return { transactions: await db.transactions.count() };
}
