import { describe, expect, it } from "vitest";

import { rankLaneEntries } from "./needsYouLane";

describe("rankLaneEntries", () => {
  it("puts urgent items ahead of upcoming calendar events", () => {
    const ranked = rankLaneEntries([
      { service: "google-calendar", item: { id: "evt", title: "Standup", sortKey: "2026-06-25T09:00:00Z" } },
      { service: "github", item: { id: "pr", title: "Review me", tone: "urgent" } },
    ]);
    expect(ranked.map((entry) => entry.item.id)).toEqual(["pr", "evt"]);
  });

  it("orders upcoming calendar events by soonest start", () => {
    const ranked = rankLaneEntries([
      { service: "google-calendar", item: { id: "late", title: "Late", sortKey: "2026-06-25T15:00:00Z" } },
      { service: "google-calendar", item: { id: "soon", title: "Soon", sortKey: "2026-06-25T09:00:00Z" } },
    ]);
    expect(ranked.map((entry) => entry.item.id)).toEqual(["soon", "late"]);
  });

  it("ignores non-calendar neutral items (only urgent or upcoming events surface)", () => {
    const ranked = rankLaneEntries([
      { service: "notion", item: { id: "note", title: "A note" } },
      { service: "linear", item: { id: "iss", title: "Urgent issue", tone: "urgent" } },
    ]);
    expect(ranked.map((entry) => entry.item.id)).toEqual(["iss"]);
  });

  it("dedupes by id and caps the list at seven", () => {
    const many = Array.from({ length: 10 }, (_unused, index) => ({
      service: "github",
      item: { id: `pr-${String(index)}`, title: `PR ${String(index)}`, tone: "urgent" as const },
    }));
    const ranked = rankLaneEntries([...many, many[0]!]);
    expect(ranked).toHaveLength(7);
    expect(new Set(ranked.map((entry) => entry.item.id)).size).toBe(7);
  });
});
