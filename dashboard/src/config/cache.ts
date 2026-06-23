import { parseConfig, type Config } from "./schema";

/**
 * A synchronous mirror of the last-known config in localStorage. chrome.storage
 * is async, so the new tab would otherwise flash empty on every open; instead we
 * paint instantly from this cache, then repaint once the authoritative config
 * loads. Reads are validated, so a stale or corrupt cache can never crash paint.
 */
const CACHE_KEY = "cc:config-cache";

function webStorage(explicit?: Storage): Storage | undefined {
  if (explicit !== undefined) return explicit;
  const candidate = (globalThis as { localStorage?: Storage }).localStorage;
  return candidate;
}

export function loadCachedConfig(storage?: Storage): Config | undefined {
  const store = webStorage(storage);
  if (store === undefined) return undefined;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (raw === null) return undefined;
    return parseConfig(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function saveCachedConfig(config: Config, storage?: Storage): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify(config));
  } catch {
    // A full or unavailable storage is not worth failing a render over.
  }
}
