/**
 * Which Customize-pane sections are collapsed. Like the dashboard's per-stream
 * open state, this is device-local UI state: it lives in localStorage, is never
 * synced, and just reopens the pane the way you last left it on this machine.
 * Stored as a list of collapsed section keys.
 */
const STATE_KEY = "cc:sections-collapsed";

function webStorage(explicit?: Storage): Storage | undefined {
  return explicit ?? (globalThis as { localStorage?: Storage }).localStorage;
}

export function loadSectionState(storage?: Storage): string[] {
  const store = webStorage(storage);
  if (store === undefined) return [];
  try {
    const raw = store.getItem(STATE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is string => typeof key === "string");
  } catch {
    return [];
  }
}

export function saveSectionState(keys: string[], storage?: Storage): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(STATE_KEY, JSON.stringify(keys));
  } catch {
    // UI state is best-effort; a storage failure must not break the pane.
  }
}

/**
 * A Set of collapsed section keys seeded from storage that persists itself on
 * every change, so both an individual section toggle and the collapse-all button
 * are remembered without the caller threading a save through every call site.
 */
export function createPersistedCollapsed(storage?: Storage): Set<string> {
  const set = new Set<string>(loadSectionState(storage));
  const persist = (): void => saveSectionState([...set], storage);
  const rawAdd = set.add.bind(set);
  const rawDelete = set.delete.bind(set);
  const rawClear = set.clear.bind(set);
  set.add = (key: string): Set<string> => {
    rawAdd(key);
    persist();
    return set;
  };
  set.delete = (key: string): boolean => {
    const removed = rawDelete(key);
    persist();
    return removed;
  };
  set.clear = (): void => {
    rawClear();
    persist();
  };
  return set;
}
