import type { ItemTone } from "./types";

/**
 * Shared task helpers so Notion, Todoist, and Google Tasks present and tone their
 * items the same way. Due dates render as a short month and day; a high priority
 * or an overdue date marks the item urgent so the lane can lift it.
 */

/** True when the value is a bare calendar date (no time component). */
function isDateOnly(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/** Resolve a due value to epoch ms; a bare date counts through its whole day. */
export function dueToMs(iso: string): number {
  const value = isDateOnly(iso) ? `${iso}T23:59:59` : iso;
  return Date.parse(value);
}

/** A due date as a short "Jun 26", or undefined if it cannot be parsed. */
export function formatTaskDue(iso: string): string | undefined {
  const ms = isDateOnly(iso) ? Date.parse(`${iso}T12:00:00`) : Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(ms),
  );
}

/** Whether a due date has already passed (a bare date is overdue after its day). */
export function isOverdue(iso: string | undefined, now: Date): boolean {
  if (iso === undefined) return false;
  const ms = dueToMs(iso);
  return !Number.isNaN(ms) && ms < now.getTime();
}

/** Urgent when the task is high priority or its due date has passed. */
export function taskTone(
  options: { highPriority?: boolean; dueIso?: string },
  now: Date,
): ItemTone | undefined {
  if (options.highPriority === true) return "urgent";
  if (isOverdue(options.dueIso, now)) return "urgent";
  return undefined;
}
