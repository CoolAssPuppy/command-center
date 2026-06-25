import { z } from "zod";

import type { StockQuote } from "./finnhub";
import type { HttpFetch } from "./types";

/**
 * Foreign-exchange rates for the ambient ticker, from Frankfurter (free, no key,
 * CORS friendly). Finnhub's quote endpoint is equities only, so currency pairs
 * are routed here instead. Each pair fetches the latest rate plus the prior
 * business day's rate to derive a daily change that reads like a stock. A failed
 * prior-day lookup just drops the delta rather than failing the pair.
 */
const BASE_URL = "https://api.frankfurter.dev/v1";

export interface ForexPair {
  base: string;
  quote: string;
  /** Display form, e.g. "EUR/USD". */
  display: string;
}

/**
 * Parse a configured symbol into a currency pair, or undefined when it is not
 * one. Accepts EURUSD, EUR/USD, and a trailing "=X" suffix (EURUSD=X); a pair is
 * two 3-letter ISO codes, optionally slash-separated.
 */
export function parseForexPair(symbol: string): ForexPair | undefined {
  const cleaned = symbol
    .trim()
    .toUpperCase()
    .replace(/=X$/i, "")
    .replace("/", "");
  if (!/^[A-Z]{6}$/.test(cleaned)) return undefined;
  const base = cleaned.slice(0, 3);
  const quote = cleaned.slice(3, 6);
  return { base, quote, display: `${base}/${quote}` };
}

/** Split configured symbols into forex pairs and the leftover stock symbols. */
export function splitSymbols(symbols: string[]): { forex: ForexPair[]; stocks: string[] } {
  const forex: ForexPair[] = [];
  const stocks: string[] = [];
  for (const symbol of symbols) {
    const pair = parseForexPair(symbol);
    if (pair !== undefined) forex.push(pair);
    else if (symbol.trim().length > 0) stocks.push(symbol);
  }
  return { forex, stocks };
}

const RatesSchema = z.object({
  date: z.string().optional(),
  rates: z.record(z.number()),
});

/** The calendar day before an ISO date string (YYYY-MM-DD), as a new ISO string. */
export function priorDay(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(ms)) return isoDate;
  return new Date(ms - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function rateAt(
  path: string,
  pair: ForexPair,
  fetch: HttpFetch,
): Promise<{ rate: number; date: string } | undefined> {
  try {
    const response = await fetch({
      url: `${BASE_URL}/${path}?base=${pair.base}&symbols=${pair.quote}`,
    });
    if (!response.ok) return undefined;
    const parsed = RatesSchema.safeParse(await response.json());
    if (!parsed.success) return undefined;
    const rate = parsed.data.rates[pair.quote];
    if (rate === undefined) return undefined;
    return { rate, date: parsed.data.date ?? "" };
  } catch {
    return undefined;
  }
}

export async function fetchForexQuotes(
  pairs: ForexPair[],
  fetch: HttpFetch,
): Promise<StockQuote[]> {
  const quotes = await Promise.all(
    pairs.map(async (pair): Promise<StockQuote | undefined> => {
      const latest = await rateAt("latest", pair, fetch);
      if (latest === undefined) return undefined;

      const quote: StockQuote = {
        symbol: pair.display,
        price: latest.rate,
        changePercent: 0,
        isForex: true,
      };

      // The prior business day's rate gives a daily delta; Frankfurter returns
      // the closest business day on or before the requested date.
      if (latest.date.length > 0) {
        const prior = await rateAt(priorDay(latest.date), pair, fetch);
        if (prior !== undefined && prior.rate !== 0) {
          quote.change = latest.rate - prior.rate;
          quote.changePercent = ((latest.rate - prior.rate) / prior.rate) * 100;
        }
      }
      return quote;
    }),
  );
  return quotes.filter((quote): quote is StockQuote => quote !== undefined);
}
