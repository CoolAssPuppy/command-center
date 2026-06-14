import { describe, expect, it } from "vitest";

import { parseDashboardPayload } from "../dashboard/compose";
import { createMockBridge, mockDashboardPayload } from "./mock";

describe("mockDashboardPayload", () => {
  it("is a valid dashboard payload", () => {
    expect(parseDashboardPayload(mockDashboardPayload()).ok).toBe(true);
  });

  it("exercises the variety the renderer must handle", () => {
    const payload = mockDashboardPayload();
    const kinds = payload.providers.flatMap((p) => p.feeds.map((f) => f.kind));
    const statuses = payload.providers.flatMap((p) => p.feeds.map((f) => f.status));

    expect(kinds).toContain("calendar.today");
    expect(kinds).toContain("reminders.today");
    expect(kinds).toContain("docs.recent");
    expect(kinds).toContain("linear.inbox");
    expect(statuses).toContain("ok");
  });

  it("carries a required glance on every feed", () => {
    const payload = mockDashboardPayload();
    for (const provider of payload.providers) {
      for (const feed of provider.feeds) {
        expect(feed.glance.value.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("createMockBridge", () => {
  it("resolves the fixture payload", async () => {
    const bridge = createMockBridge();

    const payload = await bridge.getDashboard();

    expect(parseDashboardPayload(payload).ok).toBe(true);
  });

  it("can serve a caller-supplied payload", async () => {
    const bridge = createMockBridge({ providers: [] });

    expect(await bridge.getDashboard()).toEqual({ providers: [] });
  });
});
