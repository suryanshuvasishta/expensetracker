// Live price lookups for the Portfolio "Refresh Prices" feature.
//
// There is no public Google Finance API — GOOGLEFINANCE() only works inside
// Google Sheets, and Google has no equivalent JSON endpoint for third-party
// apps. This uses Yahoo Finance's free, keyless chart endpoint instead, which
// covers NSE/BSE tickers (suffix .NS / .BO) as well as US tickers. It's
// unofficial and can change or rate-limit without notice — there is no SLA.
//
// Ticker format examples: "RELIANCE.NS", "TCS.NS", "NIFTYBEES.NS", "AAPL".

const CHART_API = 'https://query1.finance.yahoo.com/v8/finance/chart/';

export interface PriceResult {
  ticker: string;
  price: number | null;
  error?: string;
}

export async function fetchLatestPrice(ticker: string): Promise<PriceResult> {
  const symbol = ticker.trim();
  if (!symbol) return { ticker, price: null, error: 'No ticker set' };

  try {
    const res = await fetch(`${CHART_API}${encodeURIComponent(symbol)}?interval=1d&range=1d`);
    if (!res.ok) return { ticker, price: null, error: `HTTP ${res.status}` };
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price !== 'number') return { ticker, price: null, error: 'No price in response' };
    return { ticker, price };
  } catch (err: any) {
    return { ticker, price: null, error: err?.message || 'Network error (likely blocked by CORS or offline)' };
  }
}

/** Fetch prices for multiple tickers, sequentially with a small delay to be a polite citizen. */
export async function fetchLatestPrices(tickers: string[]): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();
  for (const ticker of tickers) {
    results.set(ticker, await fetchLatestPrice(ticker));
    await new Promise(r => setTimeout(r, 150));
  }
  return results;
}
