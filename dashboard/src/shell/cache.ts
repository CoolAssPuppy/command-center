/**
 * Last-known dashboard payload, cached so a new tab paints instantly from the
 * previous result before live data arrives. The page never flashes empty. The
 * cache holds only display data, never a token. See docs/07-dashboard-ui.md.
 */

const CACHE_KEY = "cc.dashboard.cache.v1";

export function saveCachedPayload(payload: unknown): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // storage may be unavailable or full; caching is best-effort
  }
}

export function loadCachedPayload(): unknown {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCachedPayload(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
