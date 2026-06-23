import { describe, expect, it } from "vitest";

import { loadStreamState, saveStreamState } from "./streamState";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length(): number {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    key(index: number): string | null {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

describe("stream open-state", () => {
  it("round-trips a saved map", () => {
    const storage = memoryStorage();
    saveStreamState({ a: true, b: false }, storage);
    expect(loadStreamState(storage)).toEqual({ a: true, b: false });
  });

  it("returns empty when nothing is saved", () => {
    expect(loadStreamState(memoryStorage())).toEqual({});
  });

  it("ignores non-boolean entries from a tampered store", () => {
    const storage = memoryStorage();
    storage.setItem("cc:streams-open", JSON.stringify({ a: true, b: "yes" }));
    expect(loadStreamState(storage)).toEqual({ a: true });
  });
});
