import { describe, expect, it } from "vitest";

import { DEFAULT_TASK_FILTER, loadTaskFilterState, saveTaskFilterState } from "./taskFilterState";

/** A minimal in-memory Storage stub, so tests never touch a real localStorage. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => map.delete(key),
    setItem: (key, value) => map.set(key, value),
  };
}

describe("taskFilterState", () => {
  it("defaults to sort ascending with all statuses when nothing is stored", () => {
    expect(loadTaskFilterState(memoryStorage())).toEqual(DEFAULT_TASK_FILTER);
  });

  it("round-trips a saved filter", () => {
    const storage = memoryStorage();
    saveTaskFilterState({ sort: "desc", statuses: ["Todo", "Doing"] }, storage);
    expect(loadTaskFilterState(storage)).toEqual({ sort: "desc", statuses: ["Todo", "Doing"] });
  });

  it("falls back to the default on malformed JSON", () => {
    expect(loadTaskFilterState(memoryStorage({ "cc:task-filter": "{not json" }))).toEqual(
      DEFAULT_TASK_FILTER,
    );
  });

  it("coerces an unknown sort to ascending and drops non-string statuses", () => {
    const stored = { "cc:task-filter": JSON.stringify({ sort: "sideways", statuses: ["Todo", 3, null] }) };
    expect(loadTaskFilterState(memoryStorage(stored))).toEqual({ sort: "asc", statuses: ["Todo"] });
  });

  it("ignores a non-object payload", () => {
    expect(loadTaskFilterState(memoryStorage({ "cc:task-filter": "42" }))).toEqual(
      DEFAULT_TASK_FILTER,
    );
  });
});
