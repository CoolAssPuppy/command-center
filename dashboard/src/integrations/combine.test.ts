import { describe, expect, it } from "vitest";

import { combineCalendars, groupCombineSelection, resolveCombineTargets } from "./combine";
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

describe("groupCombineSelection", () => {
  it("groups a (connection, calendar) selection into one fetch per account", () => {
    const targets = groupCombineSelection(
      [
        { connectionId: "work", calendarId: "team@x" },
        { connectionId: "home", calendarId: "primary" },
        { connectionId: "work", calendarId: "primary" },
      ],
      ["work", "home"],
    );
    expect(targets).toEqual([
      { connectionId: "work", calendarIds: ["team@x", "primary"] },
      { connectionId: "home", calendarIds: ["primary"] },
    ]);
  });

  it("drops calendars whose account is no longer connected and dedupes", () => {
    const targets = groupCombineSelection(
      [
        { connectionId: "work", calendarId: "primary" },
        { connectionId: "work", calendarId: "primary" },
        { connectionId: "gone", calendarId: "primary" },
      ],
      ["work"],
    );
    expect(targets).toEqual([{ connectionId: "work", calendarIds: ["primary"] }]);
  });
});

describe("resolveCombineTargets", () => {
  const never = (): Promise<string[] | undefined> => {
    throw new Error("listCalendars should not be called when a selection exists");
  };

  it("restricts to the stored selection without listing calendars", async () => {
    const targets = await resolveCombineTargets(
      [{ connectionId: "work", calendarId: "team@x" }],
      ["work", "home"],
      never,
    );
    expect(targets).toEqual([{ connectionId: "work", calendarIds: ["team@x"] }]);
  });

  it("defaults to every calendar from every account when unset", async () => {
    const lists: Record<string, string[]> = {
      work: ["primary", "team@x"],
      home: ["primary"],
    };
    const targets = await resolveCombineTargets(
      [],
      ["work", "home"],
      (connectionId) => Promise.resolve(lists[connectionId]),
    );
    expect(targets).toEqual([
      { connectionId: "work", calendarIds: ["primary", "team@x"] },
      { connectionId: "home", calendarIds: ["primary"] },
    ]);
  });

  it("falls back to primary for an account whose list cannot be read", async () => {
    const targets = await resolveCombineTargets(
      [],
      ["work"],
      () => Promise.resolve(undefined),
    );
    expect(targets).toEqual([{ connectionId: "work", calendarIds: ["primary"] }]);
  });
});
