import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const hdfcBankParser: BankParser = {
  account: 'HDFC Bank',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return lower.includes('hdfc bank') || lower.includes('hdfc_bank') || lower.includes('hdfcbank');
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // HDFC statement format: Date | Narration | Chq/Ref | Value Date | Withdrawal | Deposit | Balance
    // Lines with transaction data match date pattern at start
    const txnPattern = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})?\s*([\d,]+\.?\d*)\s*([\d,]+\.?\d*)?\s*([\d,]+\.?\d*)?$/;

    for (const line of lines) {
      const match = line.match(txnPattern);
      if (!match) continue;

      const [, dateStr, narration, , col4, col5, col6] = match;
      const date = parseIndianDate(dateStr);
      if (!date) continue;

      let withdrawal = 0;
      let deposit = 0;
      let balance = 0;

      // HDFC has: withdrawal | deposit | balance
      if (col6) {
        withdrawal = parseAmount(col4);
        deposit = parseAmount(col5 || '0');
        balance = parseAmount(col6);
      } else if (col5) {
        withdrawal = parseAmount(col4);
        deposit = 0;
        balance = parseAmount(col5);
      }

      if (withdrawal === 0 && deposit === 0) continue;

      const isDebit = withdrawal > 0;
      const amount = isDebit ? withdrawal : deposit;

      transactions.push({
        date,
        account: 'HDFC Bank',
        amount,
        narration: narration.trim(),
        category: '',
        paymentMethod: inferPaymentMethod(narration),
        type: isDebit ? 'debit' : 'credit',
        sourceFile: filename,
        balance,
      });
    }

    // Fallback: try tab/csv-like splitting
    if (transactions.length === 0) {
      return parseHDFCTabular(text, filename);
    }

    return transactions;
  },
};

function parseHDFCTabular(text: string, filename: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Try splitting by multiple spaces or tabs
    const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;

    const date = parseIndianDate(parts[0]);
    if (!date) continue;

    // Last 3 are typically withdrawal, deposit, balance (some may be empty)
    const lastThree = parts.slice(-3);
    const narration = parts.slice(1, parts.length - 3).join(' ');

    const withdrawal = parseAmount(lastThree[0]);
    const deposit = parseAmount(lastThree[1]);
    const balance = parseAmount(lastThree[2]);

    if (withdrawal === 0 && deposit === 0) continue;

    const isDebit = withdrawal > 0;
    transactions.push({
      date,
      account: 'HDFC Bank',
      amount: isDebit ? withdrawal : deposit,
      narration: narration || parts[1],
      category: '',
      paymentMethod: inferPaymentMethod(narration),
      type: isDebit ? 'debit' : 'credit',
      sourceFile: filename,
      balance,
    });
  }

  return transactions;
}
