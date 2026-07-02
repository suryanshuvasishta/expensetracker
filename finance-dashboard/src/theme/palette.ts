// Shared chart colors — one source of truth so the same entity is the same color
// on every page. Category colors live on the Category records themselves (DB-backed).

export const ASSET_CLASS_COLORS: Record<string, string> = {
  'FD': '#facc15',
  'Debt/Liquid MF': '#60a5fa',
  'Equity MF': '#4ade80',
  'ETF': '#34d399',
  'Stocks': '#a78bfa',
  'Real Estate': '#fb923c',
  'Gold': '#fbbf24',
  'NPS': '#38bdf8',
  'PPF/SSY': '#86efac',
  'Other': '#94a3b8',
};

export const SEMANTIC = {
  income: '#4ade80',
  expense: '#f87171',
  net: '#60a5fa',
};
