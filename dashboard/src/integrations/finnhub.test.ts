import { describe, expect, it } from "vitest";

import { fetchStockQuotes } from "./finnhub";
import type { HttpRequest, HttpResponseLike } from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

describe("fetchStockQuotes", () => {
  it("returns nothing without symbols or a key", async () => {
    const fetch = (): Promise<HttpResponseLike> => Promise.resolve(json({ c: 1, dp: 1 }));
    expect(await fetchStockQuotes([], "key", fetch)).toEqual([]);
    expect(await fetchStockQuotes(["AAPL"], "", fetch)).toEqual([]);
  });

  it("maps a quote to symbol, price, and percent change", async () => {
    let captured: HttpRequest | undefined;
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> => {
      captured = request;
      return Promise.resolve(json({ c: 192.34, dp: 1.27 }));
    };
    const quotes = await fetchStockQuotes(["aapl"], "key", fetch);
    expect(quotes).toEqual([{ symbol: "AAPL", price: 192.34, changePercent: 1.27 }]);
    expect(captured?.url).toContain("symbol=AAPL");
    expect(captured?.url).toContain("token=key");
  });

  it("drops an unknown symbol (all-zero quote) and a failed request", async () => {
    const fetch = (request: HttpRequest): Promise<HttpResponseLike> =>
      request.url.includes("GOOD")
        ? Promise.resolve(json({ c: 10, dp: -2 }))
        : request.url.includes("ZERO")
          ? Promise.resolve(json({ c: 0, dp: 0 }))
          : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const quotes = await fetchStockQuotes(["GOOD", "ZERO", "BAD"], "key", fetch);
    expect(quotes).toEqual([{ symbol: "GOOD", price: 10, changePercent: -2 }]);
  });

  it("defaults a missing percent change to zero", async () => {
    const fetch = (): Promise<HttpResponseLike> => Promise.resolve(json({ c: 5 }));
    const quotes = await fetchStockQuotes(["X"], "key", fetch);
    expect(quotes[0]?.changePercent).toBe(0);
  });
});
