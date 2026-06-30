import { db } from '../db/database';
import type { Owner, Transaction } from '../types';

// Full-fidelity CSV backup of transactions — round-trips every field needed to
// restore exactly (unlike the spreadsheet-oriented export in Transactions/index.tsx),
// so it can be used as a month-to-month backup and re-imported without re-parsing
// source statements.
const COLUMNS = [
  'id', 'owner', 'date', 'account', 'amount', 'narration', 'category', 'paymentMethod',
  'type', 'sourceFile', 'balance', 'refNumber', 'linkedAccount', 'correlatedIds',
  'isCorrelationPair', 'month', 'createdAt',
] as const;

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function txnToRow(t: Transaction): string {
  return COLUMNS.map(col => {
    if (col === 'correlatedIds') return csvEscape((t.correlatedIds || []).join('|'));
    return csvEscape((t as any)[col]);
  }).join(',');
}

export async function exportTransactionsCSV(owner: Owner | 'All', filenameSuffix: string): Promise<void> {
  const all = await db.transactions.toArray();
  const filtered = owner === 'All' ? all : all.filter(t => t.owner === owner);
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  const header = COLUMNS.join(',');
  const rows = filtered.map(txnToRow);
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-backup-${filenameSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal RFC4180-ish CSV line parser supporting quoted fields with embedded
// commas/newlines and doubled-quote escaping.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

export async function importTransactionsCSV(file: File): Promise<{ imported: number }> {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length === 0) throw new Error('Empty CSV file');

  const header = rows[0];
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });

  const required = ['id', 'owner', 'date', 'account', 'amount', 'narration', 'category', 'paymentMethod', 'type', 'sourceFile', 'month', 'createdAt'];
  for (const col of required) {
    if (!(col in idx)) throw new Error(`CSV is missing required column "${col}". Use the "Export Transactions CSV" backup format.`);
  }

  const txns: Transaction[] = rows.slice(1).filter(r => r.some(c => c !== '')).map(r => {
    const get = (col: string) => (idx[col] !== undefined ? r[idx[col]] : '');
    const correlatedIdsRaw = get('correlatedIds');
    const balanceRaw = get('balance');
    return {
      id: get('id'),
      owner: get('owner') as Owner,
      date: get('date'),
      account: get('account') as Transaction['account'],
      amount: parseFloat(get('amount')) || 0,
      narration: get('narration'),
      category: get('category'),
      paymentMethod: get('paymentMethod') as Transaction['paymentMethod'],
      type: get('type') as Transaction['type'],
      sourceFile: get('sourceFile'),
      balance: balanceRaw ? parseFloat(balanceRaw) : undefined,
      refNumber: get('refNumber') || undefined,
      linkedAccount: get('linkedAccount') || undefined,
      correlatedIds: correlatedIdsRaw ? correlatedIdsRaw.split('|').filter(Boolean) : undefined,
      isCorrelationPair: get('isCorrelationPair') === 'true',
      month: get('month'),
      createdAt: get('createdAt'),
    };
  }).filter(t => t.id && t.date);

  if (txns.length === 0) throw new Error('No valid transaction rows found in CSV');

  await db.transactions.bulkPut(txns);
  return { imported: txns.length };
}
