import type { Transaction } from '../types';

const CC_ACCOUNTS = ['Axis Credit Card', 'SBI Credit Card', 'ICICI Credit Card'];
const BANK_ACCOUNTS = ['HDFC Bank', 'ICICI Bank'];
const PAYTM_ACCOUNT = 'Paytm Wallet';

/**
 * Correlates transactions across accounts:
 * 1. Bank debit matching a CC statement credit (CC payment)
 * 2. Deduplication of same transaction appearing in multiple files
 */
export function correlateTransactions(transactions: Transaction[]): Transaction[] {
  const txns = [...transactions];
  const matched = new Set<string>();

  // Find CC payments: bank debit that matches a CC credit within ±3 days and same amount
  const bankDebits = txns.filter(t => BANK_ACCOUNTS.includes(t.account) && t.type === 'debit');
  const ccCredits = txns.filter(t => CC_ACCOUNTS.includes(t.account) && t.type === 'credit');

  for (const bankTxn of bankDebits) {
    if (matched.has(bankTxn.id)) continue;

    const isCCPaymentNarration =
      bankTxn.narration.toLowerCase().includes('credit card') ||
      bankTxn.narration.toLowerCase().includes('cc payment') ||
      bankTxn.narration.toLowerCase().includes('card payment') ||
      bankTxn.category === 'Credit Card Payment';

    if (!isCCPaymentNarration) continue;

    const bankDate = new Date(bankTxn.date).getTime();

    for (const ccTxn of ccCredits) {
      if (matched.has(ccTxn.id)) continue;
      if (Math.abs(ccTxn.amount - bankTxn.amount) > 1) continue; // amount must match within ₹1

      const ccDate = new Date(ccTxn.date).getTime();
      const dayDiff = Math.abs(bankDate - ccDate) / (1000 * 60 * 60 * 24);

      if (dayDiff <= 3) {
        matched.add(bankTxn.id);
        matched.add(ccTxn.id);

        const bankIdx = txns.findIndex(t => t.id === bankTxn.id);
        const ccIdx = txns.findIndex(t => t.id === ccTxn.id);

        if (bankIdx >= 0) {
          txns[bankIdx] = {
            ...txns[bankIdx],
            category: 'Credit Card Payment',
            correlatedIds: [ccTxn.id],
            isCorrelationPair: true,
          };
        }
        if (ccIdx >= 0) {
          txns[ccIdx] = {
            ...txns[ccIdx],
            correlatedIds: [bankTxn.id],
            isCorrelationPair: true,
          };
        }
        break;
      }
    }
  }

  // Find Paytm payments funded directly from a linked bank account (not the wallet
  // balance) — these also appear as a bank statement debit, so dedupe them: hide the
  // generic bank-side debit and keep the richer, merchant-tagged Paytm transaction.
  const paytmBankDebits = txns.filter(t =>
    t.account === PAYTM_ACCOUNT && t.type === 'debit' &&
    t.linkedAccount && t.linkedAccount.toLowerCase() !== 'upi lite'
  );
  const bankDebits2 = txns.filter(t => BANK_ACCOUNTS.includes(t.account) && t.type === 'debit');

  for (const paytmTxn of paytmBankDebits) {
    if (matched.has(paytmTxn.id)) continue;
    const paytmDate = new Date(paytmTxn.date).getTime();

    for (const bankTxn of bankDebits2) {
      if (matched.has(bankTxn.id)) continue;
      if (Math.abs(bankTxn.amount - paytmTxn.amount) > 1) continue;

      const bankDate = new Date(bankTxn.date).getTime();
      const dayDiff = Math.abs(paytmDate - bankDate) / (1000 * 60 * 60 * 24);

      if (dayDiff <= 2) {
        matched.add(paytmTxn.id);
        matched.add(bankTxn.id);

        const paytmIdx = txns.findIndex(t => t.id === paytmTxn.id);
        const bankIdx = txns.findIndex(t => t.id === bankTxn.id);

        if (bankIdx >= 0) {
          txns[bankIdx] = {
            ...txns[bankIdx],
            category: 'Transfers',
            correlatedIds: [paytmTxn.id],
            isCorrelationPair: true,
          };
        }
        if (paytmIdx >= 0) {
          txns[paytmIdx] = {
            ...txns[paytmIdx],
            correlatedIds: [bankTxn.id],
          };
        }
        break;
      }
    }
  }

  // Dedup: same account, same date, same amount, similar narration → keep first
  const dedupKeys = new Set<string>();
  return txns.filter(t => {
    const key = `${t.account}|${t.date}|${t.amount}|${t.type}`;
    if (dedupKeys.has(key)) return false;
    dedupKeys.add(key);
    return true;
  });
}

export function getNetSpend(transactions: Transaction[]): number {
  // Net spend = CC debits + bank debits - CC payment debits (to avoid double counting)
  return transactions.reduce((sum, t) => {
    if (t.type !== 'debit') return sum;
    if (t.isCorrelationPair && BANK_ACCOUNTS.includes(t.account)) return sum; // skip CC payments from bank
    return sum + t.amount;
  }, 0);
}
