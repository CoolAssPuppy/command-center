import type { NormalizedItem } from "../integrations/types";
import { el } from "../render/helpers";

/**
 * Calendar cards read best as "what's left of the day", so the schedule is split
 * into three groups. Events that have already finished collapse behind a "N prior
 * events" disclosure; all-day events collapse behind their own disclosure once
 * there are enough of them to crowd the timed schedule; everything still ahead
 * shows inline. The grouping is pure and testable; rendering wraps each foldable
 * group in a native <details> so keyboard and a11y come for free.
 */
export interface CalendarGroups {
  /** All-day (date-only) events. */
  allDay: NormalizedItem[];
  /** Timed events that have already ended. */
  prior: NormalizedItem[];
  /** Timed events still to come (or in progress). */
  upcoming: NormalizedItem[];
}

/** Up to this many all-day events show inline; beyond it, they fold away. */
const ALL_DAY_INLINE_LIMIT = 2;

/** Whether a timed event has finished by `nowMs` (falls back to its start). */
function hasFinished(item: NormalizedItem, nowMs: number): boolean {
  if (item.endMs !== undefined) return item.endMs <= nowMs;
  return item.startMs !== undefined && item.startMs < nowMs;
}

/** Split calendar items into all-day, already-finished, and still-ahead groups. */
export function groupCalendarItems(
  items: readonly NormalizedItem[],
  nowMs: number,
): CalendarGroups {
  const groups: CalendarGroups = { allDay: [], prior: [], upcoming: [] };
  for (const item of items) {
    if (item.isAllDay === true) {
      groups.allDay.push(item);
    } else if (hasFinished(item, nowMs)) {
      groups.prior.push(item);
    } else {
      groups.upcoming.push(item);
    }
  }
  return groups;
}

/** "1 prior event" / "3 prior events": a count with a correctly pluralized noun. */
function countLabel(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** How an item turns into a row; injected so this module never imports streams. */
type RenderItem = (item: NormalizedItem) => HTMLElement;

/** A collapsed <details> group: a "N …" summary that opens to reveal its rows. */
function foldGroup(
  label: string,
  items: readonly NormalizedItem[],
  renderItem: RenderItem,
): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "cc-calfold";
  const summary = document.createElement("summary");
  summary.className = "cc-calfold__summary";
  const chevron = el("span", "cc-calfold__chevron", "›");
  chevron.setAttribute("aria-hidden", "true");
  summary.appendChild(chevron);
  summary.appendChild(el("span", "cc-calfold__label", label));
  details.appendChild(summary);
  const body = el("div", "cc-calfold__body");
  for (const item of items) body.appendChild(renderItem(item));
  details.appendChild(body);
  return details;
}

/**
 * Render a calendar's items into `list`: finished events fold away first, then
 * all-day events (inline while few, folded once many), then the events still
 * ahead. Non-calendar streams keep rendering their items flat.
 */
export function renderCalendarItems(
  list: HTMLElement,
  items: readonly NormalizedItem[],
  nowMs: number,
  renderItem: RenderItem,
): void {
  const { allDay, prior, upcoming } = groupCalendarItems(items, nowMs);

  if (prior.length > 0) {
    list.appendChild(foldGroup(countLabel(prior.length, "prior event"), prior, renderItem));
  }

  if (allDay.length > ALL_DAY_INLINE_LIMIT) {
    list.appendChild(foldGroup(countLabel(allDay.length, "all-day event"), allDay, renderItem));
  } else {
    for (const item of allDay) list.appendChild(renderItem(item));
  }

  for (const item of upcoming) list.appendChild(renderItem(item));
}
