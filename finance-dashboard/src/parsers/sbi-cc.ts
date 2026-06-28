import type { BankParser, ParsedTransaction } from './base';
import { parseIndianDate, parseAmount, inferPaymentMethod } from './base';

export const sbiCCParser: BankParser = {
  account: 'SBI Credit Card',

  canParse(text: string, filename: string): boolean {
    const lower = text.toLowerCase() + filename.toLowerCase();
    return (lower.includes('sbi card') || lower.includes('sbi credit card') || lower.includes('sbicard')) &&
      !lower.includes('hdfc') && !lower.includes('icici');
  },

  parse(text: string, filename: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // SBI Card statement format (PDF extracted):
    // Date (DD Mon YY) | Transaction Details | Amount C/D
    // Amount ends with " C" (credit) or " D" (debit)
    for (const line of lines) {
      // Amount pattern: digits/commas followed by C or D at end of line
      const amountMatch = line.match(/^(.+?)\s+([\d,]+\.?\d*)\s+([CD])\s*$/);
      if (!amountMatch) continue;

      const prefix = amountMatch[1].trim();
      const amount = parseAmount(amountMatch[2]);
      const isDebit = amountMatch[3] === 'D';

      if (amount === 0) continue;

      // Date is at the start: DD Mon YY (7-9 chars)
      const dateMatch = prefix.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+(.*)/);
      if (!dateMatch) continue;

      const date = parseIndianDate(dateMatch[1]);
      if (!date) continue;

      const narration = dateMatch[2].trim();
      if (!narration) continue;

      // Skip pure fee/tax lines without meaningful narration
      if (/^(CGST|SGST|IGST|FORGN CURR MARKUP)/i.test(narration)) continue;

      transactions.push({
        date,
        account: 'SBI Credit Card',
        amount,
        narration,
        category: '',
        paymentMethod: inferPaymentMethod(narration),
        type: isDebit ? 'debit' : 'credit',
        sourceFile: filename,
      });
    }

    return transactions;
  },
};
