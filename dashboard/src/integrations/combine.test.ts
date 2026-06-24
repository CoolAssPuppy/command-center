import { describe, expect, it } from "vitest";

import type { Connection } from "../config/schema";
import { combineCalendars } from "./combine";
import type { IntegrationResult, NormalizedItem } from "./types";

const cal = (id: string): Connection => ({ id, name: id, service: "google-calendar" });

const item = (id: string, sortKey: string): NormalizedItem => ({ id, title: id, sortKey });

describe("combineCalendars", () => {
  it("merges events from every calendar, sorted by start time", () => {
    const results: Record<string, IntegrationResult> = {
      a: { status: "ok", items: [item("a2", "2026-06-24T15:00"), item("a1", "2026-06-24T09:00")] },
      b: { status: "ok", items: [item("b1", "2026-06-24T11:00")] },
    };
    const merged = combineCalendars([cal("a"), cal("b")], results);
    expect(merged.status).toBe("ok");
    expect(merged.items?.map((i) => i.id)).toEqual(["a1", "b1", "a2"]);
  });

  it("stays ok when one calendar is disconnected, showing the rest", () => {
    const results: Record<string, IntegrationResult> = {
      a: { status: "ok", items: [item("a1", "2026-06-24T09:00")] },
      b: { status: "needs_auth" },
    };
    const merged = combineCalendars([cal("a"), cal("b")], results);
    expect(merged.status).toBe("ok");
    expect(merged.items?.map((i) => i.id)).toEqual(["a1"]);
  });

  it("needs auth when no calendar has loaded", () => {
    const results: Record<string, IntegrationResult> = {
      a: { status: "needs_auth" },
      b: { status: "needs_auth" },
    };
    expect(combineCalendars([cal("a"), cal("b")], results).status).toBe("needs_auth");
  });
});
