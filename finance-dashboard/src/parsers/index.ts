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
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as string[][];

  // Detect HDFC format: header row has "Date" and "Narration"
  const hdfcHeaderIdx = rows.findIndex(r => r.some(c => c === 'Date') && r.some(c => c.includes('Narration')));
  if (hdfcHeaderIdx >= 0) return parseHDFCXLSRows(rows, hdfcHeaderIdx, file.name);

  // Detect ICICI format: header row has "Transaction Date" and "Transaction Remarks"
  const iciciHeaderIdx = rows.findIndex(r => r.some(c => c === 'Transaction Date') && r.some(c => c.includes('Transaction Remarks')));
  if (iciciHeaderIdx >= 0) return parseICICIXLSRows(rows, iciciHeaderIdx, file.name);

  return [];
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
  sourceFile: string
): import('../types').Transaction[] {
  const now = new Date().toISOString();
  return parsed.map(p => ({
    ...p,
    id: generateId(),
    month: p.date.slice(0, 7),
    sourceFile,
    createdAt: now,
    correlatedIds: [],
    isCorrelationPair: false,
  }));
}
