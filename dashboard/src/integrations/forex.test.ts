import { describe, expect, it } from "vitest";

import { fetchForexQuotes, parseForexPair, priorDay, splitSymbols } from "./forex";
import type { HttpRequest, HttpResponseLike } from "./types";

const json = (body: unknown): HttpResponseLike => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

describe("parseForexPair", () => {
  it("accepts EURUSD, EUR/USD, and a trailing =X", () => {
    expect(parseForexPair("EURUSD")).toEqual({ base: "EUR", quote: "USD", display: "EUR/USD" });
    expect(parseForexPair("EUR/USD")).toEqual({ base: "EUR", quote: "USD", display: "EUR/USD" });
    expect(parseForexPair("EURUSD=X")).toEqual({ base: "EUR", quote: "USD", display: "EUR/USD" });
    expect(parseForexPair("eurusd=x")).toEqual({ base: "EUR", quote: "USD", display: "EUR/USD" });
  });

  it("ignores non-pairs", () => {
    expect(parseForexPair("AAPL")).toBeUndefined();
    expect(parseForexPair("EUR")).toBeUndefined();
    expect(parseForexPair("EURUSDX")).toBeUndefined();
  });
});

describe("splitSymbols", () => {
  it("routes pairs to forex and the rest to stocks", () => {
    const { forex, stocks } = splitSymbols(["EURUSD", "AAPL", "GBP/JPY", "MSFT", " "]);
    expect(forex.map((pair) => pair.display)).toEqual(["EUR/USD", "GBP/JPY"]);
    expect(stocks).toEqual(["AAPL", "MSFT"]);
  });
});

describe("priorDay", () => {
  it("returns the calendar day before, across month boundaries", () => {
    expect(priorDay("2026-06-25")).toBe("2026-06-24");
    expect(priorDay("2026-06-01")).toBe("2026-05-31");
  });
});

describe("fetchForexQuotes", () => {
  const respond = (request: HttpRequest): Promise<HttpResponseLike> => {
    if (request.url.includes("/latest")) {
      return Promise.resolve(json({ date: "2026-06-25", rates: { USD: 1.0832 } }));
    }
    if (request.url.includes("/2026-06-24")) {
      return Promise.resolve(json({ date: "2026-06-24", rates: { USD: 1.0811 } }));
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  };

  it("derives the rate, absolute change, and percent change", async () => {
    const [quote] = await fetchForexQuotes([{ base: "EUR", quote: "USD", display: "EUR/USD" }], respond);
    expect(quote?.symbol).toBe("EUR/USD");
    expect(quote?.isForex).toBe(true);
    expect(quote?.price).toBe(1.0832);
    expect(quote?.change).toBeCloseTo(0.0021, 6);
    expect(quote?.changePercent).toBeCloseTo(0.1942, 3);
  });

  it("shows the rate with no delta when the prior day cannot be fetched", async () => {
    const latestOnly = (request: HttpRequest): Promise<HttpResponseLike> =>
      request.url.includes("/latest")
        ? Promise.resolve(json({ date: "2026-06-25", rates: { USD: 1.0832 } }))
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const [quote] = await fetchForexQuotes([{ base: "EUR", quote: "USD", display: "EUR/USD" }], latestOnly);
    expect(quote?.price).toBe(1.0832);
    expect(quote?.change).toBeUndefined();
    expect(quote?.changePercent).toBe(0);
  });
});
