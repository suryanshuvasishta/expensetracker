import type { AccountType, PaymentMethod } from '../types';
export type { ParsedTransaction } from '../types';

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function parseIndianDate(dateStr: string): string | null {
  if (!dateStr) return null;
  dateStr = dateStr.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY (HDFC XLS uses 2-digit year)
  const ddmmyy = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    const fullYear = parseInt(y) >= 90 ? `19${y}` : `20${y}`;
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD MMM YYYY (e.g. 15 Jan 2024)
  const ddMMMYYYY = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (ddMMMYYYY) {
    const [, d, mon, y] = ddMMMYYYY;
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const m = months[mon.slice(0, 3)];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  // DD-MMM-YYYY
  const ddMMMYYYY2 = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMMMYYYY2) {
    const [, d, mon, y] = ddMMMYYYY2;
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const m = months[mon.slice(0, 3)];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  // YYYY-MM-DD (already ISO)
  const isoDate = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return dateStr;

  return null;
}

export function parseAmount(amtStr: string): number {
  if (!amtStr) return 0;
  const cleaned = amtStr.replace(/[₹,\s]/g, '').replace(/[()]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function inferPaymentMethod(narration: string): PaymentMethod {
  const n = narration.toLowerCase();
  if (n.includes('upi')) return 'UPI';
  if (n.includes('neft')) return 'NEFT';
  if (n.includes('imps')) return 'IMPS';
  if (n.includes('rtgs')) return 'RTGS';
  if (n.includes('emi')) return 'EMI';
  if (n.includes('cheque') || n.includes('chq')) return 'Cheque';
  if (n.includes('netbanking') || n.includes('net banking') || n.includes('inf ')) return 'Net Banking';
  if (n.includes('atm') || n.includes('cash')) return 'Cash';
  if (n.includes('debit card') || n.includes('dc ')) return 'Debit Card';
  if (n.includes('credit card') || n.includes('cc ')) return 'Credit Card';
  return 'Other';
}

import type { ParsedTransaction } from '../types';

export interface BankParser {
  canParse(text: string, filename: string): boolean;
  parse(text: string, filename: string): ParsedTransaction[];
  account: AccountType;
}
