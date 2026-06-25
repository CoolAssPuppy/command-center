import { describe, expect, it } from "vitest";

import { combineCalendars } from "./combine";
import type { NormalizedItem } from "./types";

const item = (id: string, sortKey: string): NormalizedItem => ({ id, title: id, sortKey });

describe("combineCalendars", () => {
  it("merges events from every calendar, sorted by start time", () => {
    const merged = combineCalendars([
      { status: "ok", items: [item("a2", "2026-06-24T15:00"), item("a1", "2026-06-24T09:00")] },
      { status: "ok", items: [item("b1", "2026-06-24T11:00")] },
    ]);
    expect(merged.status).toBe("ok");
    expect(merged.items?.map((i) => i.id)).toEqual(["a1", "b1", "a2"]);
  });

  it("stays ok when one calendar is disconnected, showing the rest", () => {
    const merged = combineCalendars([
      { status: "ok", items: [item("a1", "2026-06-24T09:00")] },
      { status: "needs_auth" },
    ]);
    expect(merged.status).toBe("ok");
    expect(merged.items?.map((i) => i.id)).toEqual(["a1"]);
  });

  it("needs auth when no calendar has loaded", () => {
    expect(combineCalendars([{ status: "needs_auth" }, { status: "needs_auth" }]).status).toBe(
      "needs_auth",
    );
  });
});
