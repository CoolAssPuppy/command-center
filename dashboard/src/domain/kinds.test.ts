import { describe, expect, it } from "vitest";

import { makeCard, makeFeedEnvelope } from "../test/factories";
import {
  makeCalendarEvent,
  makeCalendarToday,
  makeDocsRecent,
  makeLinearInbox,
  makeRemindersToday,
} from "../test/kind-factories";
import { cardFromFeed } from "./kinds";
import type { Widget } from "./widgets";

function firstList(widgets: Widget[]) {
  const widget = widgets[0];
  if (!widget || widget.type !== "list") {
    throw new Error("expected a list widget");
  }
  return widget.data.items;
}

describe("cardFromFeed: calendar.today", () => {
  it("maps events into a list card with the feed's glance", () => {
    const envelope = makeFeedEnvelope({
      kind: "calendar.today",
      data: makeCalendarToday(),
    });

    const result = cardFromFeed(envelope);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.glance).toEqual(envelope.glance);
    const items = firstList(result.value.widgets);
    expect(items[0]?.title).toBe("Design review");
    expect(items[0]?.leading).toEqual({ kind: "colorDot", colorHex: "#4285F4" });
    expect(items[0]?.trailing).toEqual({
      kind: "time",
      iso: "2026-06-14T16:00:00-07:00",
    });
  });

  it("gives events with a meeting a join action carrying url and platform", () => {
    const envelope = makeFeedEnvelope({
      kind: "calendar.today",
      data: makeCalendarToday({ events: [makeCalendarEvent()] }),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    const items = firstList(result.value.widgets);

    expect(items[0]?.action).toEqual({
      ref: "join",
      params: { url: "https://meet.google.com/abc-defg-hij", platform: "meet" },
    });
  });

  it("omits the join action for events with no meeting", () => {
    const { meeting: _meeting, ...noMeeting } = makeCalendarEvent();
    const envelope = makeFeedEnvelope({
      kind: "calendar.today",
      data: makeCalendarToday({ events: [noMeeting] }),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    expect(firstList(result.value.widgets)[0]?.action).toBeUndefined();
  });

  it("renders an empty day as a card with no widgets", () => {
    const envelope = makeFeedEnvelope({
      kind: "calendar.today",
      data: makeCalendarToday({ events: [] }),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.widgets).toEqual([]);
  });

  it("rejects an event missing its required start time", () => {
    const broken = { ...makeCalendarEvent(), start: undefined };
    const envelope = makeFeedEnvelope({
      kind: "calendar.today",
      data: { events: [broken] },
    });

    expect(cardFromFeed(envelope).ok).toBe(false);
  });
});

describe("cardFromFeed: reminders.today", () => {
  it("flags overdue reminders with an urgent badge instead of a time", () => {
    const envelope = makeFeedEnvelope({
      kind: "reminders.today",
      data: makeRemindersToday({
        items: [
          { id: "r", title: "Late thing", overdue: true, due: "2026-06-14T09:00:00Z" },
        ],
      }),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    expect(firstList(result.value.widgets)[0]?.trailing).toEqual({
      kind: "badge",
      text: "overdue",
      tone: "urgent",
    });
  });
});

describe("cardFromFeed: linear.inbox", () => {
  it("maps an inbox row with an avatar, open action, and urgent badge", () => {
    const envelope = makeFeedEnvelope({
      kind: "linear.inbox",
      data: makeLinearInbox({
        items: [
          {
            id: "n",
            reason: "SLA breached on",
            urgent: true,
            actorName: "Grace",
            actorAvatarUrl: "https://example.com/g.png",
            targetTitle: "Crash",
            targetType: "issue",
            url: "https://linear.app/acme/issue/ENG-1",
          },
        ],
      }),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    const item = firstList(result.value.widgets)[0];
    expect(item?.leading).toEqual({ kind: "avatar", url: "https://example.com/g.png" });
    expect(item?.action).toEqual({
      ref: "open",
      params: { url: "https://linear.app/acme/issue/ENG-1" },
    });
    expect(item?.trailing).toEqual({ kind: "badge", text: "urgent", tone: "urgent" });
    expect(item?.subtitle).toBe("Grace SLA breached on");
  });

  it("rejects an inbox row with no url, which is required to open it", () => {
    const envelope = makeFeedEnvelope({
      kind: "linear.inbox",
      data: { items: [{ id: "n", reason: "x" }] },
    });

    expect(cardFromFeed(envelope).ok).toBe(false);
  });
});

describe("cardFromFeed: docs.recent", () => {
  it("maps a doc with an open action and an edited-time trailing", () => {
    const envelope = makeFeedEnvelope({
      kind: "docs.recent",
      data: makeDocsRecent(),
    });

    const result = cardFromFeed(envelope);
    if (!result.ok) throw new Error(result.error);
    const item = firstList(result.value.widgets)[0];
    expect(item?.action).toEqual({ ref: "open", params: { url: "https://notion.so/q3" } });
    expect(item?.trailing).toEqual({ kind: "time", iso: "2026-06-14T13:00:00Z" });
  });
});

describe("cardFromFeed: generic and unknown kinds", () => {
  it("passes a card-kind feed through after validating it", () => {
    const card = makeCard();
    const envelope = makeFeedEnvelope({ kind: "card", data: { card } });

    const result = cardFromFeed(envelope);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(card);
  });

  it("rejects a card-kind feed whose card is malformed", () => {
    const envelope = makeFeedEnvelope({
      kind: "card",
      data: { card: { title: "x" } },
    });

    expect(cardFromFeed(envelope).ok).toBe(false);
  });

  it("returns an error for an unknown kind, so composition can skip it", () => {
    const envelope = makeFeedEnvelope({ kind: "weather.galactic", data: {} });

    const result = cardFromFeed(envelope);
    expect(result.ok).toBe(false);
  });
});
