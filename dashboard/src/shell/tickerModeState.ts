/**
 * How the stock/forex ticker shows its delta: as a percentage or an absolute
 * amount. Like the Tasks filter and stream state this is local UI state, kept in
 * localStorage so it survives the dashboard's repaints, never synced.
 */
export type TickerMode = "percent" | "amount";

const STATE_KEY = "cc:ticker-mode";

export const DEFAULT_TICKER_MODE: TickerMode = "percent";

function webStorage(explicit?: Storage): Storage | undefined {
  return explicit ?? (globalThis as { localStorage?: Storage }).localStorage;
}

export function loadTickerMode(storage?: Storage): TickerMode {
  const store = webStorage(storage);
  if (store === undefined) return DEFAULT_TICKER_MODE;
  try {
    return store.getItem(STATE_KEY) === "amount" ? "amount" : "percent";
  } catch {
    return DEFAULT_TICKER_MODE;
  }
}

export function saveTickerMode(mode: TickerMode, storage?: Storage): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(STATE_KEY, mode);
  } catch {
    // UI state is best-effort; a storage failure must not break rendering.
  }
}
