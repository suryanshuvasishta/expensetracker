import type { ParsedTransaction, AccountType } from '../types';
import { generateId, parseIndianDate, parseAmount, inferPaymentMethod } from './base';
import type { BankParser } from './base';
import { hdfcBankParser } from './hdfc-bank';
import { iciciBankParser } from './icici-bank';
import { axisCCParser } from './axis-cc';
import { sbiCCParser } from './sbi-cc';
import { iciciCCParser } from './icici-cc';

export async function extractTransactionsFromXLS(file: File): Promise<ParsedTransaction[]> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellText: true, cellDates: false });

  // Detect budget sheet: has multiple tabs named like "Aug25", "Jan26", "Apr 26" etc.
  const isBudgetSheet = workbook.SheetNames.filter(n =>
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{2}$/i.test(n.trim())
  ).length >= 2;
  if (isBudgetSheet) return parseBudgetSheetXLSX(workbook, XLSX);

  // Detect Paytm statement: dedicated "Passbook Payment History" tab
  const paytmSheetName = workbook.SheetNames.find((n: string) => /passbook payment history/i.test(n.trim()));
  if (paytmSheetName) {
    const paytmSheet = workbook.Sheets[paytmSheetName];
    const paytmRows: string[][] = XLSX.utils.sheet_to_json(paytmSheet, { header: 1, defval: '', raw: false }) as string[][];
    const paytmHeaderIdx = paytmRows.findIndex(r =>
      r.some(c => c === 'Date') && r.some(c => c === 'Transaction Details') && r.some(c => c === 'Your Account')
    );
    if (paytmHeaderIdx >= 0) return parsePaytmXLSRows(paytmRows, paytmHeaderIdx, file.name);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as string[][];

  // Detect HDFC format: header row has "Date" and "Narration"
  const hdfcHeaderIdx = rows.findIndex(r => r.some(c => c === 'Date') && r.some(c => c.includes('Narration')));
  if (hdfcHeaderIdx >= 0) return parseHDFCXLSRows(rows, hdfcHeaderIdx, file.name);

  // Detect ICICI Bank format: header row has "Transaction Date" and "Transaction Remarks"
  const iciciHeaderIdx = rows.findIndex(r => r.some(c => c === 'Transaction Date') && r.some(c => c.includes('Transaction Remarks')));
  if (iciciHeaderIdx >= 0) return parseICICIXLSRows(rows, iciciHeaderIdx, file.name);

  // Detect ICICI CC format: header row has "Transaction Date" and "Details" and "Amount (INR)"
  const iciciCCHeaderIdx = rows.findIndex(r => r.some(c => c === 'Transaction Date') && r.some(c => c === 'Details') && r.some(c => c.includes('Amount')));
  if (iciciCCHeaderIdx >= 0) return parseICICICCXLSRows(rows, iciciCCHeaderIdx, file.name);

  // Detect Axis CC format: header row has "Date", "Transaction Details", "Debit/Credit"
  const axisHeaderIdx = rows.findIndex(r => r.some(c => c === 'Date') && r.some(c => c === 'Transaction Details') && r.some(c => c === 'Debit/Credit'));
  if (axisHeaderIdx >= 0) return parseAxisCCXLSRows(rows, axisHeaderIdx, file.name);

  return [];
}

// Category name → canonical display name used in CATEGORY_GROUPS / categorizer
const BUDGET_SHEET_CATEGORY_MAP: Record<string, string> = {
  'maid': 'House Help',
  'cook': 'House Help',
  'iron': 'House Help',
  'house help': 'House Help',
  'toys': 'Toys & Joy Rides',
  'online shopping': 'Other Online Shopping',
  'one time large expenses (non budgeted)': 'One Time Large Expenses',
  'home loan pre-emi': 'Other Expenses',
  'credit card pending payment carried forward': 'Credit Card Payment',
  'on behalf of': 'Transfers',
  'brokerage': 'Investments',
  'ssy': 'Investments',
  'ppf': 'Investments',
  'personal & spousal healthcare': 'Personal & Spousal Healthcare',
};

// Any sheet category containing these substrings → Investments
const INVESTMENT_KEYWORDS = ['fund', 'nifty', 'sensex', 'smallcap', 'midcap', 'flexicap', 'flexi cap', 'balanced advantage', 'equity savings'];

function mapBudgetCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (BUDGET_SHEET_CATEGORY_MAP[lower]) return BUDGET_SHEET_CATEGORY_MAP[lower];
  if (INVESTMENT_KEYWORDS.some(k => lower.includes(k))) return 'Investments';
  return raw; // already a display name (Rent, Groceries, etc.)
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseBudgetDate(raw: string, sheetYear: number, _sheetMonth: number): string | null {
  const s = raw.trim();
  if (!s) return null;

  // "January 1, 2026" / "February 28, 2026"
  const longMatch = s.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (longMatch) {
    const m = MONTH_ABBR[longMatch[1].toLowerCase().slice(0, 3)];
    if (m) {
      const d = parseInt(longMatch[2]);
      const y = parseInt(longMatch[3]);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "1-Aug", "15-Sep", "31-Dec"
  const shortMatch = s.match(/^(\d{1,2})-([A-Za-z]{3,})$/);
  if (shortMatch) {
    const d = parseInt(shortMatch[1]);
    const m = MONTH_ABBR[shortMatch[2].toLowerCase().slice(0, 3)];
    if (m) {
      // Use sheet year; if month in date < sheet month it wrapped (unlikely but handle)
      return `${sheetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseBudgetSheetXLSX(workbook: any, XLSX: any): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const seen = new Set<string>(); // deduplicate by date+category+amount+owner

  for (const sheetName of workbook.SheetNames) {
    const trimmed = sheetName.trim();
    const sheetMatch = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{2})$/i);
    if (!sheetMatch) continue;

    const sheetMonthNum = MONTH_ABBR[sheetMatch[1].toLowerCase()];
    const sheetYear = 2000 + parseInt(sheetMatch[2]);

    const ws = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as string[][];

    // Header row is index 2; expense log starts at column 5 (F)
    const headerRow = rows[2] || [];
    // Detect column indices from header
    const logCols = headerRow.slice(5);
    const dateCol = 5 + logCols.findIndex((c: string) => /^date$/i.test(c.trim()));
    const expCol = 5 + logCols.findIndex((c: string) => /^expense$/i.test(c.trim()));
    const byCol = 5 + logCols.findIndex((c: string) => /^by$/i.test(c.trim()));
    const amtCol = 5 + logCols.findIndex((c: string) => /^amount$/i.test(c.trim()));
    const narrationCol = 5 + logCols.findIndex((c: string) => /^narration$/i.test(c.trim()));
    const pmCol = 5 + logCols.findIndex((c: string) => /^payment method$/i.test(c.trim()));

    if (dateCol < 5 || expCol < 5 || amtCol < 5) continue; // no valid header found

    const hasOwner = byCol >= 5;

    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = (row[dateCol] || '').trim();
      const rawCat = (row[expCol] || '').trim();
      const rawAmt = (row[amtCol] || '').trim();

      if (!rawDate || !rawCat || !rawAmt) continue;
      if (rawDate === 'Date' || rawCat === 'Expense') continue; // repeated header

      const date = parseBudgetDate(rawDate, sheetYear, sheetMonthNum);
      if (!date) continue;

      const amount = parseFloat(rawAmt.replace(/[₹,\s]/g, ''));
      if (!amount || amount <= 0) continue;

      const rawOwner = hasOwner ? (row[byCol] || '').trim() : '';
      const owner = rawOwner === 'Khushboo' ? 'Khushboo' : rawOwner === 'Suryanshu' ? 'Suryanshu' : 'Joint';

      const category = mapBudgetCategory(rawCat);
      const narration = narrationCol >= 5 ? (row[narrationCol] || '').trim() || rawCat : rawCat;
      const rawPM = pmCol >= 5 ? (row[pmCol] || '').trim() : '';
      const paymentMethod = inferPaymentMethod(rawPM) || 'Other';

      const dedupKey = `${date}|${rawCat}|${amount}|${owner}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      results.push({
        date,
        account: 'Unknown',
        amount,
        narration,
        category,
        paymentMethod,
        type: 'debit',
        sourceFile: 'Budgeted_Actual_Expenses.xlsx',
        owner: owner as import('../types').Owner,
      });
    }
  }

  return results;
}

// Paytm "Tags" auto-tagging → our category names. Only unambiguous tags are mapped;
// everything else falls through to the normal narration-keyword categorizer.
const PAYTM_TAG_CATEGORY_MAP: Record<string, string> = {
  'money transfer': 'Transfers',
  'self-transfer': 'Transfers',
  'money received': 'Transfers',
  'groceries': 'Groceries',
};

function mapPaytmTag(rawTag: string): string {
  const cleaned = rawTag.replace(/^#/, '').replace(/[^\x00-\x7F]/g, '').trim().toLowerCase();
  return PAYTM_TAG_CATEGORY_MAP[cleaned] || '';
}

function parsePaytmXLSRows(rows: string[][], headerIdx: number, filename: string): ParsedTransaction[] {
  const header = rows[headerIdx].map(c => c.trim());
  const dateCol = header.findIndex(c => c === 'Date');
  const detailsCol = header.findIndex(c => c === 'Transaction Details');
  const accountCol = header.findIndex(c => c === 'Your Account');
  const amountCol = header.findIndex(c => c === 'Amount');
  const refCol = header.findIndex(c => c.includes('UPI Ref'));
  const tagsCol = header.findIndex(c => c === 'Tags');

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = (row[dateCol] || '').trim();
    if (!dateStr) continue;

    const date = parseIndianDate(dateStr);
    if (!date) continue;

    const narration = (row[detailsCol] || '').trim();
    if (!narration) continue;

    // Wallet top-ups (bank → Paytm wallet) are internal transfers, not expenses.
    // Skipping them avoids double-counting against the wallet spends they fund.
    if (/^money added to/i.test(narration)) continue;

    const rawAmount = (row[amountCol] || '').trim();
    const amount = parseAmount(rawAmount);
    if (amount === 0) continue;

    const linkedAccount = (row[accountCol] || '').trim();
    const refNumber = refCol >= 0 ? (row[refCol] || '').trim() || undefined : undefined;
    const category = tagsCol >= 0 ? mapPaytmTag(row[tagsCol] || '') : '';

    transactions.push({
      date,
      account: 'Paytm Wallet',
      amount: Math.abs(amount),
      narration,
      category,
      paymentMethod: 'UPI',
      type: amount < 0 ? 'debit' : 'credit',
      sourceFile: filename,
      linkedAccount,
      refNumber,
    });
  }

  return transactions;
}

function parseAxisCCXLSRows(rows: string[][], headerIdx: number, filename: string): ParsedTransaction[] {
  const header = rows[headerIdx];
  const dateCol = header.findIndex(c => c === 'Date');
  const narrationCol = header.findIndex(c => c === 'Transaction Details');
  const amountCol = header.findIndex(c => c.includes('Amount'));
  const typeCol = header.findIndex(c => c === 'Debit/Credit');

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // Date format: "15 Jun '26" — strip the apostrophe before parsing
    const dateStr = (row[dateCol] || '').replace(/'/g, '').trim();
    if (!dateStr || dateStr.includes('End of Statement')) continue;

    const date = parseIndianDate(dateStr);
    if (!date) continue;

    const narration = row[narrationCol]?.trim() || '';
    const amount = parseAmount(row[amountCol] || '');
    const isDebit = (row[typeCol] || '').toLowerCase().includes('debit');

    if (amount === 0 || !narration) continue;

    transactions.push({
      date,
      account: 'Axis Credit Card',
      amount,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
    });
  }

  return transactions;
}

function parseICICICCXLSRows(rows: string[][], headerIdx: number, filename: string): ParsedTransaction[] {
  const header = rows[headerIdx];
  const dateCol = header.findIndex(c => c === 'Transaction Date');
  const narrationCol = header.findIndex(c => c === 'Details');
  const amountCol = header.findIndex(c => c.includes('Amount'));

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = row[dateCol]?.trim();
    if (!dateStr) continue;

    const date = parseIndianDate(dateStr);
    if (!date) continue;

    const narration = row[narrationCol]?.trim() || '';
    const rawAmount = row[amountCol]?.trim() || '';

    // Amount format: "1234.56 Dr." or "1234.56 Cr."
    const amountMatch = rawAmount.match(/([\d,]+\.?\d*)\s*(Dr\.|Cr\.)/i);
    if (!amountMatch) continue;

    const amount = parseAmount(amountMatch[1]);
    const isDebit = amountMatch[2].toLowerCase().startsWith('dr');

    if (amount === 0) continue;

    transactions.push({
      date,
      account: 'ICICI Credit Card',
      amount,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
    });
  }

  return transactions;
}

function parseICICIXLSRows(rows: string[][], headerIdx: number, filename: string): ParsedTransaction[] {
  const header = rows[headerIdx].map(c => c.trim());
  const dateCol = header.findIndex(c => c === 'Transaction Date');
  const narrationCol = header.findIndex(c => c.includes('Transaction Remarks'));
  const withdrawalCol = header.findIndex(c => c.includes('Withdrawal'));
  const depositCol = header.findIndex(c => c.includes('Deposit'));
  const balanceCol = header.findIndex(c => c.includes('Balance'));

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = row[dateCol]?.trim();
    if (!dateStr) continue;

    const date = parseIndianDate(dateStr);
    if (!date) continue;

    const narration = row[narrationCol]?.trim() || '';
    const withdrawal = parseAmount(row[withdrawalCol] || '');
    const deposit = parseAmount(row[depositCol] || '');
    const balance = parseAmount(row[balanceCol] || '');

    if (withdrawal === 0 && deposit === 0) continue;

    const isDebit = withdrawal > 0;
    transactions.push({
      date,
      account: 'ICICI Bank',
      amount: isDebit ? withdrawal : deposit,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
      balance,
    });
  }

  return transactions;
}

function parseHDFCXLSRows(rows: string[][], headerIdx: number, filename: string): ParsedTransaction[] {
  const header = rows[headerIdx].map(c => c.trim());
  const dateCol = header.findIndex(c => c === 'Date');
  const narrationCol = header.findIndex(c => c.includes('Narration'));
  const withdrawalCol = header.findIndex(c => c.includes('Withdrawal'));
  const depositCol = header.findIndex(c => c.includes('Deposit'));
  const balanceCol = header.findIndex(c => c.includes('Balance') || c.includes('Closing'));

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = row[dateCol]?.trim();
    if (!dateStr || /^\*+$/.test(dateStr)) continue;

    const date = parseIndianDate(dateStr);
    if (!date) continue;

    const narration = row[narrationCol]?.trim() || '';
    const withdrawal = parseAmount(row[withdrawalCol] || '');
    const deposit = parseAmount(row[depositCol] || '');
    const balance = parseAmount(row[balanceCol] || '');

    if (withdrawal === 0 && deposit === 0) continue;

    const isDebit = withdrawal > 0;
    transactions.push({
      date,
      account: 'HDFC Bank',
      amount: isDebit ? withdrawal : deposit,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
      balance,
    });
  }

  return transactions;
}

const PARSERS: BankParser[] = [
  iciciCCParser,   // Check ICICI CC before ICICI Bank (more specific)
  hdfcBankParser,
  iciciBankParser,
  axisCCParser,
  sbiCCParser,
];

export async function extractTextFromPDF(file: File, password?: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    password: password || '',
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by y-coordinate to reconstruct table rows.
    // PDF coordinates are bottom-up, so sort y descending (top of page first).
    const items = textContent.items
      .filter((item: any) => 'str' in item && item.str.trim())
      .map((item: any) => ({
        str: item.str as string,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
        w: (item.width ?? 0) as number,
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    // Cluster into lines by y proximity
    const Y_TOLERANCE = 4;
    const lines: { y: number; items: { str: string; x: number; w: number }[] }[] = [];

    for (const item of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - item.y) <= Y_TOLERANCE) {
        last.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    // Build text: use tabs between cells when there's a significant x-gap
    for (const line of lines) {
      const sorted = line.items.sort((a, b) => a.x - b.x);
      let lineText = '';
      let prevEndX = -1;

      for (const item of sorted) {
        if (prevEndX >= 0) {
          const gap = item.x - prevEndX;
          lineText += gap > 15 ? '\t' : ' ';
        }
        lineText += item.str;
        prevEndX = item.x + (item.w > 0 ? item.w : item.str.length * 5);
      }

      fullText += lineText.trim() + '\n';
    }
  }

  return fullText;
}

export function detectAccount(text: string, filename: string): AccountType {
  for (const parser of PARSERS) {
    if (parser.canParse(text, filename)) {
      return parser.account;
    }
  }
  return 'Unknown';
}

export function parseStatement(
  text: string,
  filename: string,
  overrideAccount?: AccountType
): ParsedTransaction[] {
  const account = overrideAccount || detectAccount(text, filename);

  for (const parser of PARSERS) {
    if (parser.account === account || parser.canParse(text, filename)) {
      const results = parser.parse(text, filename);
      if (results.length > 0) return results;
    }
  }

  // If no parser matched, try a generic CSV-style parse
  return parseGeneric(text, filename);
}

function parseGeneric(text: string, filename: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 3) continue;

    const date = parseIndianDate(parts[0]);
    if (!date) continue;

    const amtStr = parts[parts.length - 1];
    const amount = parseAmount(amtStr);
    if (amount === 0) continue;

    const narration = parts.slice(1, parts.length - 1).join(' ');
    transactions.push({
      date,
      account: 'Unknown',
      amount: Math.abs(amount),
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: amount < 0 ? 'credit' : 'debit',
      sourceFile: filename,
    });
  }

  return transactions;
}

export function finalizeTransactions(
  parsed: ParsedTransaction[],
  sourceFile: string,
  owner: import('../types').Owner = 'Suryanshu'
): import('../types').Transaction[] {
  const now = new Date().toISOString();
  return parsed.map(p => ({
    ...p,
    id: generateId(),
    owner: p.owner ?? owner,
    month: p.date.slice(0, 7),
    sourceFile,
    createdAt: now,
    correlatedIds: [],
    isCorrelationPair: false,
  }));
}
