/** ₹12,34,567 — full Indian-locale rupees, rounded. */
export function fmtINR(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

/** ₹1.23L / ₹4.56Cr above 1 lakh, full rupees below. */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return '₹' + (abs / 1_00_00_000).toFixed(2) + 'Cr';
  if (abs >= 1_00_000) return '₹' + (abs / 1_00_000).toFixed(2) + 'L';
  return fmtINR(abs);
}
