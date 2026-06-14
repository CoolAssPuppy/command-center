import { describe, expect, it } from "vitest";

import { makeFeedEnvelope, makeGlance } from "../test/factories";
import {
  makeDashboardPayload,
  makeManifest,
  makeProviderEntry,
} from "../test/dashboard-factories";
import { makeCalendarToday } from "../test/kind-factories";
import { composeDashboard, parseDashboardPayload } from "./compose";

// Inside the feed's 300s ttl (updatedAt 15:04:05Z).
const NOW = new Date("2026-06-14T15:05:00Z");
// Past the ttl.
const LATER = new Date("2026-06-14T15:20:00Z");

describe("composeDashboard", () => {
  it("composes a ready card from an ok feed with the manifest's actions", () => {
    const cards = composeDashboard(makeDashboardPayload(), NOW);

    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card?.state).toBe("ready");
    expect(card?.fresh).toBe(true);
    expect(card?.displayName).toBe("Linear");
    expect(card?.actions[0]?.id).toBe("open");
    expect(card?.card?.widgets.length).toBeGreaterThan(0);
  });

  it("excludes a disabled feed entirely", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "linear.inbox", status: "disabled" })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)).toHaveLength(0);
  });

  it("resolves needs_auth to a reconnect state", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "linear.inbox", status: "needs_auth" })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.state).toBe("needs_auth");
  });

  it("resolves an error feed to an error state", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "linear.inbox", status: "error" })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.state).toBe("error");
  });

  it("treats a malformed known-kind feed as an error, not a crash", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [
            makeFeedEnvelope({ kind: "linear.inbox", status: "ok", data: { items: [{}] } }),
          ],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.state).toBe("error");
  });

  it("silently skips an unknown kind so one provider cannot break the page", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "weather.galactic", status: "ok" })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)).toHaveLength(0);
  });

  it("marks an ok feed past its ttl as not fresh but still renders it", () => {
    const cards = composeDashboard(makeDashboardPayload(), LATER);

    expect(cards[0]?.state).toBe("ready");
    expect(cards[0]?.fresh).toBe(false);
    expect(cards[0]?.ageSeconds).toBeGreaterThan(300);
  });

  it("treats a stale feed as not fresh", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "linear.inbox", status: "stale" })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.fresh).toBe(false);
  });

  it("renders an empty calendar day as an empty state", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          manifest: makeManifest({ providerId: "mn", displayName: "Calendar" }),
          feeds: [
            makeFeedEnvelope({
              kind: "calendar.today",
              status: "ok",
              data: makeCalendarToday({ events: [] }),
            }),
          ],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.state).toBe("empty");
  });

  it("refuses a feed from a future schema version", () => {
    const payload = makeDashboardPayload({
      providers: [
        makeProviderEntry({
          feeds: [makeFeedEnvelope({ kind: "linear.inbox", schemaVersion: 2 })],
        }),
      ],
    });

    expect(composeDashboard(payload, NOW)[0]?.state).toBe("error");
  });

  it("orders cards by settings.layout.cardOrder and drops hidden ones", () => {
    const payload = makeDashboardPayload({
      settings: {
        layout: { cardOrder: ["calendar.today", "linear.inbox"], hidden: ["docs.recent"] },
      },
      providers: [
        makeProviderEntry({
          manifest: makeManifest({ providerId: "docs", displayName: "Docs" }),
          feeds: [makeFeedEnvelope({ kind: "docs.recent", glance: makeGlance() })],
        }),
        makeProviderEntry(),
        makeProviderEntry({
          manifest: makeManifest({ providerId: "mn", displayName: "Calendar" }),
          feeds: [
            makeFeedEnvelope({
              kind: "calendar.today",
              data: makeCalendarToday(),
            }),
          ],
        }),
      ],
    });

    const cards = composeDashboard(payload, NOW);

    expect(cards.map((c) => c.kind)).toEqual(["calendar.today", "linear.inbox"]);
  });
});

describe("parseDashboardPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(parseDashboardPayload(makeDashboardPayload()).ok).toBe(true);
  });

  it("rejects a payload whose providers are not an array", () => {
    expect(parseDashboardPayload({ providers: "nope" }).ok).toBe(false);
  });
});
