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

    // ICICI Bank savings account format (tab-separated after PDF extraction):
    // S No | Transaction Date (DD.MM.YYYY) | Cheque Number (may be empty) | Transaction Remarks | Withdrawal | Deposit | Balance
    for (const line of lines) {
      const parts = line.split(/\t/).map(p => p.trim());

      // Find date in first 3 columns (S.No may precede it)
      let date: string | null = null;
      let dateIdx = -1;
      for (let i = 0; i < Math.min(3, parts.length); i++) {
        date = parseIndianDate(parts[i]);
        if (date) { dateIdx = i; break; }
      }
      if (!date || dateIdx < 0) continue;

      // After date: [cheque?] narration ... withdrawal deposit balance
      // Balance is always last; withdrawal and deposit are the two before it (one will be 0/empty)
      const after = parts.slice(dateIdx + 1).map(p => p.trim());
      if (after.length < 2) continue;

      // The last three non-empty-looking parts should be withdrawal, deposit, balance
      // But empty cells come through as empty strings — keep them to preserve positions
      const balance = parseAmount(after[after.length - 1]);
      const deposit = parseAmount(after[after.length - 2]);
      const withdrawal = parseAmount(after[after.length - 3]);

      // Narration is everything between date and the last 3 columns, skip pure numeric cheque numbers
      const narrationParts = after.slice(0, after.length - 3).filter(p => p && !/^\d+$/.test(p));
      const narration = narrationParts.join(' ').trim();

      if (withdrawal === 0 && deposit === 0) continue;
      if (!narration) continue;

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
  },
};
