/**
 * The Tasks-section filter and sort. Like stream open/closed state this is local
 * UI state, not config: it stays in localStorage, never synced, and survives the
 * dashboard's repaints (the 60s tick and data arrivals). `statuses` undefined
 * means every status is shown (the default); a list means only those.
 */
export interface TaskFilterState {
  statuses?: string[];
  sort: "asc" | "desc";
}

const STATE_KEY = "cc:task-filter";

export const DEFAULT_TASK_FILTER: TaskFilterState = { sort: "asc" };

function webStorage(explicit?: Storage): Storage | undefined {
  return explicit ?? (globalThis as { localStorage?: Storage }).localStorage;
}

export function loadTaskFilterState(storage?: Storage): TaskFilterState {
  const store = webStorage(storage);
  if (store === undefined) return { ...DEFAULT_TASK_FILTER };
  try {
    const raw = store.getItem(STATE_KEY);
    if (raw === null) return { ...DEFAULT_TASK_FILTER };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_TASK_FILTER };
    const record = parsed as { statuses?: unknown; sort?: unknown };
    const state: TaskFilterState = { sort: record.sort === "desc" ? "desc" : "asc" };
    if (Array.isArray(record.statuses)) {
      state.statuses = record.statuses.filter((value): value is string => typeof value === "string");
    }
    return state;
  } catch {
    return { ...DEFAULT_TASK_FILTER };
  }
}

export function saveTaskFilterState(state: TaskFilterState, storage?: Storage): void {
  const store = webStorage(storage);
  if (store === undefined) return;
  try {
    store.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // UI state is best-effort; a storage failure must not break rendering.
  }
}
