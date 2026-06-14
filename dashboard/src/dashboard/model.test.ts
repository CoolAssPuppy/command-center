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

  it("surfaces the needs_auth provider as a needs_auth card", () => {
    const result = buildDashboardModel(mockDashboardPayload(), NOW);
    if (!result.ok) throw new Error(result.error);

    const notion = result.value.cards.find((c) => c.providerId === "notion");
    expect(notion?.state).toBe("needs_auth");
  });

  it("includes the generic card-kind provider with its chart widget", () => {
    const result = buildDashboardModel(mockDashboardPayload(), NOW);
    if (!result.ok) throw new Error(result.error);

    const deploybot = result.value.cards.find((c) => c.providerId === "deploybot");
    const types = deploybot?.card?.widgets.map((w) => w.type) ?? [];
    expect(types).toContain("chart");
  });

  it("returns an error for an unparseable payload", () => {
    expect(buildDashboardModel({ providers: "no" }, NOW).ok).toBe(false);
  });
});
