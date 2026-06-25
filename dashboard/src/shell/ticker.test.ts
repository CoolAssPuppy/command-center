import { describe, expect, it } from "vitest";

import type { StockQuote } from "../integrations/finnhub";
import { formatDelta } from "./ticker";

const quote = (overrides: Partial<StockQuote>): StockQuote => ({
  symbol: "AAPL",
  price: 100,
  changePercent: 0,
  ...overrides,
});

describe("formatDelta", () => {
  it("shows the percent change in percent mode", () => {
    expect(formatDelta(quote({ changePercent: 1.27 }), "percent")).toEqual({
      text: "+1.27%",
      dir: "up",
    });
    expect(formatDelta(quote({ changePercent: -0.5 }), "percent")).toEqual({
      text: "-0.50%",
      dir: "down",
    });
  });

  it("shows the absolute change in amount mode, 2 decimals for stocks", () => {
    expect(formatDelta(quote({ change: 2.15, changePercent: 1.3 }), "amount")).toEqual({
      text: "+2.15",
      dir: "up",
    });
    expect(formatDelta(quote({ change: -2.15, changePercent: -1.3 }), "amount")).toEqual({
      text: "-2.15",
      dir: "down",
    });
  });

  it("uses 4 decimals for forex amounts", () => {
    const fx = quote({ symbol: "EUR/USD", price: 1.0832, change: 0.0021, isForex: true });
    expect(formatDelta(fx, "amount")).toEqual({ text: "+0.0021", dir: "up" });
    expect(formatDelta(quote({ changePercent: 0.19, isForex: true }), "percent")).toEqual({
      text: "+0.19%",
      dir: "up",
    });
  });

  it("returns undefined for amount mode when the absolute change is unknown", () => {
    expect(formatDelta(quote({ changePercent: 0.5 }), "amount")).toBeUndefined();
  });
});
