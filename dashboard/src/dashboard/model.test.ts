import { describe, expect, it } from "vitest";

import { mockDashboardPayload } from "../bridge/mock";
import { buildDashboardModel } from "./model";

const NOW = new Date("2026-06-14T15:05:00Z");

describe("buildDashboardModel", () => {
  it("parses, composes, and plans the mock payload into cards", () => {
    const result = buildDashboardModel(mockDashboardPayload(), NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cards.length).toBeGreaterThan(0);
    expect(result.value.settings?.profile?.name).toBe("Prashant");
  });

  it("surfaces a needs_auth provider as a needs_auth card", () => {
    const payload = {
      providers: [
        {
          manifest: {
            schemaVersion: 1,
            providerId: "notion",
            displayName: "Notion",
            bundleId: "com.acme.notion",
            feeds: [{ kind: "docs.recent" }],
          },
          feeds: [
            {
              schemaVersion: 1,
              providerId: "notion",
              kind: "docs.recent",
              updatedAt: "2026-06-14T15:04:00Z",
              status: "needs_auth",
              glance: { value: "!", label: "reconnect" },
              data: { items: [] },
            },
          ],
        },
      ],
    };
    const result = buildDashboardModel(payload, NOW);
    if (!result.ok) throw new Error(result.error);

    const notion = result.value.cards.find((c) => c.providerId === "notion");
    expect(notion?.state).toBe("needs_auth");
  });

  it("includes a generic card-kind provider with its chart widget", () => {
    const payload = {
      providers: [
        {
          manifest: {
            schemaVersion: 1,
            providerId: "metrics",
            displayName: "Metrics",
            bundleId: "com.acme.metrics",
            feeds: [{ kind: "card" }],
          },
          feeds: [
            {
              schemaVersion: 1,
              providerId: "metrics",
              kind: "card",
              updatedAt: "2026-06-14T15:04:00Z",
              ttlSeconds: 300,
              status: "ok",
              glance: { value: "2", label: "today" },
              data: {
                card: {
                  title: "Metrics",
                  glance: { value: "2", label: "today" },
                  widgets: [
                    {
                      type: "chart",
                      data: {
                        subtype: "bar",
                        xType: "time",
                        series: [{ name: "w", points: [{ x: "2026-06-13", y: 1 }] }],
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };
    const result = buildDashboardModel(payload, NOW);
    if (!result.ok) throw new Error(result.error);

    const metrics = result.value.cards.find((c) => c.providerId === "metrics");
    const types = metrics?.card?.widgets.map((w) => w.type) ?? [];
    expect(types).toContain("chart");
  });

  it("returns an error for an unparseable payload", () => {
    expect(buildDashboardModel({ providers: "no" }, NOW).ok).toBe(false);
  });
});
