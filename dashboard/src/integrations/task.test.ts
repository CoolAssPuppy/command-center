import { describe, expect, it } from "vitest";

import { formatTaskDue, isOverdue, taskTone } from "./task";

const now = new Date("2026-06-25T12:00:00Z");

describe("formatTaskDue", () => {
  it("formats a bare date and a datetime, and rejects junk", () => {
    expect(formatTaskDue("2026-06-26")).toMatch(/\w/);
    expect(formatTaskDue("2026-06-26T17:00:00Z")).toMatch(/\w/);
    expect(formatTaskDue("nope")).toBeUndefined();
  });
});

describe("isOverdue", () => {
  it("is true for a past date and false for today or the future", () => {
    expect(isOverdue("2026-06-20", now)).toBe(true);
    // A bare date counts through its whole day, so today is not yet overdue.
    expect(isOverdue("2026-06-25", now)).toBe(false);
    expect(isOverdue("2026-07-01", now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
  });
});

describe("taskTone", () => {
  it("is urgent for high priority or an overdue date, else undefined", () => {
    expect(taskTone({ highPriority: true }, now)).toBe("urgent");
    expect(taskTone({ dueIso: "2026-06-20" }, now)).toBe("urgent");
    expect(taskTone({ dueIso: "2026-07-01" }, now)).toBeUndefined();
    expect(taskTone({}, now)).toBeUndefined();
  });
});
