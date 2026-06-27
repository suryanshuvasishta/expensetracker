import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const axisCCParser: BankParser = {
  account: 'Axis Credit Card',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return lower.includes('axis bank') || lower.includes('axis credit') || lower.includes('axis_cc') || lower.includes('axiscc');
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Axis CC format: Date | Description | Amount | Type (Dr/Cr)
    // OR: Date | Description | Dr Amount | Cr Amount
    for (const line of lines) {
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 3) continue;

      const date = parseIndianDate(parts[0]);
      if (!date) continue;

      const lastPart = parts[parts.length - 1].toLowerCase();
      const isCredit = lastPart === 'cr' || lastPart.includes('(cr)');
      const isDebit = lastPart === 'dr' || lastPart.includes('(dr)');

      let amount = 0;
      let narration = '';

      if (isCredit || isDebit) {
        // Format: Date | Description | Amount | Dr/Cr
        amount = parseAmount(parts[parts.length - 2]);
        narration = parts.slice(1, parts.length - 2).join(' ');
      } else {
        // Format: Date | Description | Amount (positive = debit on CC)
        amount = parseAmount(parts[parts.length - 1]);
        narration = parts.slice(1, parts.length - 1).join(' ');
      }

      if (amount === 0) continue;

      transactions.push({
        date,
        account: 'Axis Credit Card',
        amount,
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
