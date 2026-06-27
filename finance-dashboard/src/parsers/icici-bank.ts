import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const iciciBankParser: BankParser = {
  account: 'ICICI Bank',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return (lower.includes('icici bank') || lower.includes('icici_bank')) &&
      !lower.includes('credit card') && !lower.includes('creditcard');
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // ICICI Bank format: S.No | Value Date | Transaction Date | Cheque No | Transaction Remarks | Withdrawal | Deposit | Balance
    for (const line of lines) {
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 5) continue;

      // Try to find date in first few columns
      let date: string | null = null;
      let dateIdx = -1;

      for (let i = 0; i < Math.min(4, parts.length); i++) {
        date = parseIndianDate(parts[i]);
        if (date) { dateIdx = i; break; }
      }

      if (!date || dateIdx < 0) continue;

      // Skip serial number column if present
      const remaining = parts.slice(dateIdx + 1);
      if (remaining.length < 3) continue;

      // Last 3 cols: withdrawal, deposit, balance
      const lastThree = remaining.slice(-3);
      const narration = remaining.slice(0, remaining.length - 3).join(' ');

      const withdrawal = parseAmount(lastThree[0]);
      const deposit = parseAmount(lastThree[1]);
      const balance = parseAmount(lastThree[2]);

      if (withdrawal === 0 && deposit === 0) continue;

      const isDebit = withdrawal > 0;
      transactions.push({
        date,
        account: 'ICICI Bank',
        amount: isDebit ? withdrawal : deposit,
        narration: narration.trim(),
        category: '',
        paymentMethod: inferPaymentMethod(narration),
        type: isDebit ? 'debit' : 'credit',
        sourceFile: filename,
        balance,
      });
    }

    return transactions;
  },
};
