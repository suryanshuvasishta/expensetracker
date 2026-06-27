import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const sbiCCParser: BankParser = {
  account: 'SBI Credit Card',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return (lower.includes('sbi') || lower.includes('state bank')) &&
      (lower.includes('credit card') || lower.includes('cc'));
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // SBI CC format: Sl.No | Transaction Date | Transaction Details | Domestic Amount | International Amount
    for (const line of lines) {
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 3) continue;

      // Skip serial number (pure digit) at start
      let startIdx = 0;
      if (/^\d+$/.test(parts[0])) startIdx = 1;

      const date = parseIndianDate(parts[startIdx]);
      if (!date) continue;

      // Last two columns are domestic and international amounts
      const remaining = parts.slice(startIdx + 1);
      if (remaining.length < 2) continue;

      const narration = remaining.slice(0, remaining.length - 2).join(' ');
      const domesticAmt = parseAmount(remaining[remaining.length - 2]);
      const intlAmt = parseAmount(remaining[remaining.length - 1]);

      const amount = domesticAmt || intlAmt;
      if (amount === 0) continue;

      // On SBI CC, negative amount = credit (payment)
      const isCredit = amount < 0;
      transactions.push({
        date,
        account: 'SBI Credit Card',
        amount: Math.abs(amount),
        narration: narration.trim(),
        category: '',
        paymentMethod: isCredit ? 'Credit Card' : inferPaymentMethod(narration),
        type: isCredit ? 'credit' : 'debit',
        sourceFile: filename,
      });
    }

    return transactions;
  },
};
