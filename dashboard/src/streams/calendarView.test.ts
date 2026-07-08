import { describe, expect, it } from "vitest";

import type { NormalizedItem } from "../integrations/types";
import { host } from "../test/dom";
import { el } from "../render/helpers";
import { groupCalendarItems, renderCalendarItems } from "./calendarView";

const NOW = new Date("2026-06-25T12:00:00Z").getTime();

const timed = (id: string, startOffsetMin: number, durationMin = 30): NormalizedItem => ({
  id,
  title: id,
  startMs: NOW + startOffsetMin * 60_000,
  endMs: NOW + (startOffsetMin + durationMin) * 60_000,
});

const allDay = (id: string): NormalizedItem => ({ id, title: id, isAllDay: true });

const renderItem = (item: NormalizedItem): HTMLElement => el("div", "row", item.title);

describe("groupCalendarItems", () => {
  it("splits events into all-day, finished, and still-ahead", () => {
    const groups = groupCalendarItems(
      [allDay("holiday"), timed("done", -120), timed("soon", 30)],
      NOW,
    );
    expect(groups.allDay.map((i) => i.id)).toEqual(["holiday"]);
    expect(groups.prior.map((i) => i.id)).toEqual(["done"]);
    expect(groups.upcoming.map((i) => i.id)).toEqual(["soon"]);
  });

  it("keeps an in-progress event out of the prior group", () => {
    // Started 10 min ago, ends in 20 min: still ahead of the viewer, not prior.
    const groups = groupCalendarItems([timed("live", -10, 30)], NOW);
    expect(groups.upcoming.map((i) => i.id)).toEqual(["live"]);
    expect(groups.prior).toHaveLength(0);
  });

  it("falls back to start time when an event has no end", () => {
    const noEnd: NormalizedItem = { id: "past", title: "past", startMs: NOW - 60_000 };
    expect(groupCalendarItems([noEnd], NOW).prior.map((i) => i.id)).toEqual(["past"]);
  });
});

describe("renderCalendarItems", () => {
  it("folds finished events behind a counted disclosure, upcoming stays inline", () => {
    const list = host();
    renderCalendarItems(list, [timed("done", -120), timed("soon", 30)], NOW, renderItem);
    const fold = list.querySelector(".cc-calfold");
    expect(fold?.querySelector(".cc-calfold__label")?.textContent).toBe("1 prior event");
    // The upcoming row is a direct child of the list, not inside the fold.
    const inline = [...list.children].filter((node) => node.classList.contains("row"));
    expect(inline.map((node) => node.textContent)).toEqual(["soon"]);
  });

  it("shows two or fewer all-day events inline", () => {
    const list = host();
    renderCalendarItems(list, [allDay("a"), allDay("b")], NOW, renderItem);
    expect(list.querySelector(".cc-calfold")).toBeNull();
    expect(list.querySelectorAll(".row")).toHaveLength(2);
  });

  it("folds three or more all-day events behind a counted disclosure", () => {
    const list = host();
    renderCalendarItems(list, [allDay("a"), allDay("b"), allDay("c")], NOW, renderItem);
    const labels = [...list.querySelectorAll(".cc-calfold__label")].map((n) => n.textContent);
    expect(labels).toContain("3 all-day events");
  });
});
