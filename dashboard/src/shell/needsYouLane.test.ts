import { describe, expect, it } from "vitest";

import { buildLaneBuckets, formatCountdown } from "./needsYouLane";

const now = new Date("2026-06-25T08:00:00Z");
const nowMs = now.getTime();

describe("buildLaneBuckets", () => {
  it("picks the soonest meeting within the next hour and ignores the rest", () => {
    const buckets = buildLaneBuckets(
      [
        { service: "google-calendar", item: { id: "soon", title: "Soon", startMs: nowMs + 20 * 60_000 } },
        { service: "google-calendar", item: { id: "later", title: "Later", startMs: nowMs + 40 * 60_000 } },
        { service: "google-calendar", item: { id: "far", title: "Far", startMs: nowMs + 3 * 60 * 60_000 } },
        { service: "google-calendar", item: { id: "past", title: "Past", startMs: nowMs - 30 * 60_000 } },
      ],
      now,
    );
    expect(buckets.meeting?.item.id).toBe("soon");
  });

  it("buckets review-requested PRs, the Linear inbox, and tasks by source", () => {
    const buckets = buildLaneBuckets(
      [
        { service: "github", item: { id: "pr", title: "Review me", tone: "urgent" } },
        { service: "github", item: { id: "mine", title: "My PR" } },
        { service: "linear", item: { id: "n1", title: "Mention" }, linearInbox: true },
        { service: "notion", item: { id: "note", title: "A task" }, role: "tasks" },
        { service: "todoist", item: { id: "td", title: "A todo" }, role: "tasks" },
      ],
      now,
    );
    expect(buckets.reviews.map((entry) => entry.item.id)).toEqual(["pr"]);
    expect(buckets.linearInbox.map((entry) => entry.item.id)).toEqual(["n1"]);
    expect(buckets.tasks.map((entry) => entry.item.id).sort()).toEqual(["note", "td"]);
  });

  it("keeps reference-role task sources out of the lane, but defaults Google Tasks in", () => {
    const buckets = buildLaneBuckets(
      [
        { service: "notion", item: { id: "note", title: "Personal note" } },
        { service: "notion", item: { id: "task", title: "Real task" }, role: "tasks" },
        { service: "google-tasks", item: { id: "gt", title: "A google task" } },
      ],
      now,
    );
    // Default Notion is reference (excluded); Google Tasks defaults to tasks.
    expect(buckets.tasks.map((entry) => entry.item.id).sort()).toEqual(["gt", "task"]);
  });
});

describe("formatCountdown", () => {
  it("formats minutes and hours, and 'now' when imminent", () => {
    expect(formatCountdown(nowMs + 22 * 60_000, nowMs)).toBe("in 22 min");
    expect(formatCountdown(nowMs + 90 * 60_000, nowMs)).toBe("in 1 hr 30 min");
    expect(formatCountdown(nowMs + 2 * 60 * 60_000, nowMs)).toBe("in 2 hr");
    expect(formatCountdown(nowMs + 30_000, nowMs)).toBe("now");
  });

  it("returns undefined once a meeting is well underway", () => {
    expect(formatCountdown(nowMs - 5 * 60_000, nowMs)).toBeUndefined();
  });
});
