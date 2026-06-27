import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const iciciCCParser: BankParser = {
  account: 'ICICI Credit Card',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return (lower.includes('icici') &&
      (lower.includes('credit card') || lower.includes('creditcard') || lower.includes('_cc')));
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // ICICI CC format: Date | Transaction Description | Amount (INR)
    // Credits appear as negative amounts or with "Cr" suffix
    for (const line of lines) {
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 3) continue;

      const date = parseIndianDate(parts[0]);
      if (!date) continue;

      const lastPart = parts[parts.length - 1];
      const isCrSuffix = lastPart.toLowerCase().endsWith('cr');
      const amtStr = isCrSuffix ? lastPart.slice(0, -2) : lastPart;
      const amount = parseAmount(amtStr);

      if (amount === 0) continue;

      const narration = parts.slice(1, parts.length - 1).join(' ');
      const isCredit = isCrSuffix || amount < 0;

      transactions.push({
        date,
        account: 'ICICI Credit Card',
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
