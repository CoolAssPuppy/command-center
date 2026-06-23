/**
 * Per-stream open/closed state. This is UI state, not config: it stays local
 * (never synced) and overrides each stream's collapsedByDefault once the user
 * has toggled it. Stored as a small id -> open map in localStorage.
 */
const STATE_KEY = "cc:streams-open";

function webStorage(explicit?: Storage): Storage | undefined {
  return explicit ?? (globalThis as { localStorage?: Storage }).localStorage;
}

export function loadStreamState(storage?: Storage): Record<string, boolean> {
  const store = webStorage(storage);
  if (store === undefined) return {};
  try {
    const raw = store.getItem(STATE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveStreamState(
  state: Record<string, boolean>,
  storage?: Storage,
): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // UI state is best-effort; a storage failure must not break rendering.
  }
}
