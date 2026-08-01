import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const iciciBankParser: BankParser = {
  account: 'ICICI Bank',

  canParse(text: string, filename: string): boolean {
    const combined = (text + filename).toLowerCase();
    return (
      combined.includes('icici bank') ||
      combined.includes('icici_bank') ||
      combined.includes('icicibankltd') ||
      // "OpTransactionHistory" is ICICI's savings account PDF filename pattern
      /optransactionhistory/i.test(filename)
    ) && !combined.includes('credit card') && !combined.includes('creditcard');
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Strategy 1: tab-separated (old XLS export or pdfjs with tab gaps)
    // Handles variable number of amount cols by scanning numerics from right
    const tsvResult = parseTSVLines(lines, filename);
    if (tsvResult.length > 0) return tsvResult;

    // Strategy 2: multi-line block format produced by some PDF extractions where
    // each block starts with "[row#] DD.MM.YYYY" and the narration + amounts
    // span several subsequent lines
    return parseMultiLineBlocks(lines, filename);
  },
};

// ---------------------------------------------------------------------------
// Strategy 1 — tab-separated lines
// ---------------------------------------------------------------------------

function parseTSVLines(lines: string[], filename: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  let prevBalance: number | null = null;

  for (const line of lines) {
    // Only process lines that actually contain a tab (column separator)
    if (!line.includes('\t')) continue;

    const parts = line.split('\t').map(p => p.trim());

    // Find the date in the first 3 parts (row# may precede it)
    let date: string | null = null;
    let dateIdx = -1;
    for (let i = 0; i < Math.min(3, parts.length); i++) {
      date = parseIndianDate(parts[i]);
      if (date) { dateIdx = i; break; }
    }
    if (!date || dateIdx < 0) continue;

    const after = parts.slice(dateIdx + 1);
    if (after.length < 2) continue;

    // Scan for numeric fields — empty deposit/withdrawal columns are absent in
    // pdfjs output, so we can't rely on fixed column positions.
    const numerics: { idx: number; val: number }[] = [];
    for (let j = 0; j < after.length; j++) {
      const s = after[j];
      if (!s) continue; // empty cell
      const n = parseAmount(s);
      if (n > 0) numerics.push({ idx: j, val: n });
    }

    // Need at least: one transaction amount + the running balance
    if (numerics.length < 2) continue;

    const balance = numerics[numerics.length - 1].val;
    const amountEntry = numerics[numerics.length - 2];

    // Use running balance delta to determine debit vs credit
    let isDebit: boolean;
    let amount: number;

    if (prevBalance !== null) {
      const delta = balance - prevBalance;
      isDebit = delta < -0.005;
      amount = Math.round(Math.abs(delta) * 100) / 100;
    } else {
      // First transaction: fall back to amount column value and narration heuristic
      amount = amountEntry.val;
      const lower = after.join(' ').toLowerCase();
      isDebit = lower.includes('debit') || lower.includes('trf to') || lower.includes('withdrawal');
    }

    if (amount < 0.01) { prevBalance = balance; continue; }

    // Narration = everything before the second-to-last numeric column;
    // strip pure long digit runs (cheque/ref numbers like 159249 or 50200067172675)
    const narParts = after
      .slice(0, amountEntry.idx)
      .filter(p => p && !/^\d{6,}$/.test(p));
    const narration = narParts.join(' ').trim();
    if (!narration) { prevBalance = balance; continue; }

    prevBalance = balance;
    results.push({
      date,
      account: 'ICICI Bank',
      amount,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
      balance,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Strategy 2 — multi-line PDF blocks
// ---------------------------------------------------------------------------

function parseMultiLineBlocks(lines: string[], filename: string): ParsedTransaction[] {
  // Group lines into per-transaction blocks.
  // A block starts when we see a line beginning with an optional row# then a DD.MM.YYYY date.
  interface Block { date: string; text: string[] }
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const line of lines) {
    const m = line.match(/^(?:\d+\s+)?(\d{2}\.\d{2}\.\d{4})\b/);
    if (m) {
      const date = parseIndianDate(m[1]);
      if (date) {
        if (cur) blocks.push(cur);
        const rest = line.slice(m[0].length).trim();
        cur = { date, text: rest ? [rest] : [] };
        continue;
      }
    }
    if (cur) cur.text.push(line);
  }
  if (cur) blocks.push(cur);

  const results: ParsedTransaction[] = [];
  let prevBalance: number | null = null;

  for (const block of blocks) {
    const joined = block.text.join(' ');

    // Find all INR amounts in this block (numbers with exactly 2 decimal digits)
    const allNumerics = [...joined.matchAll(/\b([\d,]+\.\d{2})\b/g)]
      .map(m => parseAmount(m[1]))
      .filter(n => n > 0);

    if (allNumerics.length < 2) continue;

    const balance = allNumerics[allNumerics.length - 1];

    let isDebit: boolean;
    let amount: number;

    if (prevBalance !== null) {
      const delta = balance - prevBalance;
      isDebit = delta < -0.005;
      amount = Math.round(Math.abs(delta) * 100) / 100;
    } else {
      amount = allNumerics[allNumerics.length - 2];
      const lower = joined.toLowerCase();
      isDebit = lower.includes('debit') || lower.includes('trf to') || lower.includes('withdrawal');
    }

    if (amount < 0.01) { prevBalance = balance; continue; }

    // Build narration by stripping trailing amounts and leading cheque numbers
    let narration = joined;
    for (let i = 0; i < 3; i++) {
      narration = narration.replace(/\s*[\d,]+\.\d{2}\s*$/, '').trim();
    }
    narration = narration.replace(/^\d{6,}\s*/, '').trim();
    if (!narration) { prevBalance = balance; continue; }

    prevBalance = balance;
    results.push({
      date: block.date,
      account: 'ICICI Bank',
      amount,
      narration,
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
      balance,
    });
  }

  return results;
}
