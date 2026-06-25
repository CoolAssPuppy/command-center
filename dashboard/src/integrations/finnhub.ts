import { z } from "zod";

import type { HttpFetch } from "./types";

/**
 * Stock quotes for the ambient ticker, from Finnhub's free quote endpoint. One
 * request per symbol; a missing key, an unknown symbol, or a failed call drops
 * that symbol rather than failing the strip. This is glance data, so it never
 * blocks or errors loudly.
 */
const ENDPOINT = "https://finnhub.io/api/v1/quote";

export interface StockQuote {
  symbol: string;
  /** Latest price (or FX rate). */
  price: number;
  /** Percent change on the day. */
  changePercent: number;
  /** Absolute change on the day; undefined when it cannot be determined. */
  change?: number;
  /** A currency pair, so the ticker formats the rate and change with more decimals. */
  isForex?: boolean;
}

/** Finnhub returns current price `c`, absolute change `d`, percent change `dp`. */
const QuoteSchema = z.object({
  c: z.number(),
  d: z.number().nullable().optional(),
  dp: z.number().nullable().optional(),
});

export async function fetchStockQuotes(
  symbols: string[],
  apiKey: string,
  fetch: HttpFetch,
): Promise<StockQuote[]> {
  const cleaned = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))].filter(
    (symbol) => symbol.length > 0,
  );
  if (cleaned.length === 0 || apiKey.trim().length === 0) return [];

  const quotes = await Promise.all(
    cleaned.map(async (symbol): Promise<StockQuote | undefined> => {
      try {
        const response = await fetch({
          url: `${ENDPOINT}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
        });
        if (!response.ok) return undefined;
        const parsed = QuoteSchema.safeParse(await response.json());
        if (!parsed.success) return undefined;
        // Finnhub returns all zeros for an unknown symbol; skip it.
        if (parsed.data.c === 0) return undefined;
        const quote: StockQuote = {
          symbol,
          price: parsed.data.c,
          changePercent: parsed.data.dp ?? 0,
        };
        if (parsed.data.d !== undefined && parsed.data.d !== null) quote.change = parsed.data.d;
        return quote;
      } catch {
        return undefined;
      }
    }),
  );
  return quotes.filter((quote): quote is StockQuote => quote !== undefined);
}
