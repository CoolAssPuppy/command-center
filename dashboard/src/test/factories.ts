import type {
  Card,
  FeedEnvelope,
  Glance,
  Widget,
} from "../domain";

/**
 * Factory functions for test data. Each returns a complete, valid object with
 * sensible defaults and accepts a partial override. Per the testing guide, we
 * never share mutable state across tests; each test builds what it needs.
 */

export function makeGlance(overrides: Partial<Glance> = {}): Glance {
  return {
    value: "3",
    label: "unread",
    tone: "urgent",
    trend: "up",
    ...overrides,
  };
}

export function makeMetricWidget(
  overrides: Partial<Extract<Widget, { type: "metric" }>["data"]> = {},
): Widget {
  return {
    type: "metric",
    title: "Open PRs",
    data: { value: "12", label: "awaiting review", tone: "urgent", ...overrides },
  };
}

export function makeListWidget(): Widget {
  return {
    type: "list",
    data: {
      items: [
        {
          leading: { kind: "avatar", url: "https://example.com/a.png" },
          title: "Grace assigned ENG-412",
          subtitle: "2m ago",
          trailing: { kind: "badge", text: "urgent", tone: "urgent" },
          action: { ref: "open", params: { url: "https://linear.app/x" } },
        },
      ],
    },
  };
}

export function makeChartWidget(): Widget {
  return {
    type: "chart",
    title: "Signups",
    data: {
      subtype: "line",
      xType: "time",
      yLabel: "signups",
      series: [
        {
          name: "this week",
          points: [{ x: "2026-06-14T00:00:00Z", y: 120 }],
        },
      ],
    },
  };
}

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    title: "DeployBot",
    icon: "rocket",
    accentColorHex: "#16A34A",
    glance: makeGlance({ value: "2", label: "deploys today", tone: "positive" }),
    preferredSize: "medium",
    widgets: [makeMetricWidget()],
    ...overrides,
  };
}

export function makeFeedEnvelope(
  overrides: Partial<FeedEnvelope> = {},
): FeedEnvelope {
  return {
    schemaVersion: 1,
    providerId: "linear-bar",
    kind: "linear.inbox",
    producedBy: { bundleId: "com.strategicnerds.LinearBarApp", appVersion: "1.4.2" },
    updatedAt: "2026-06-14T15:04:05Z",
    ttlSeconds: 300,
    status: "ok",
    glance: makeGlance(),
    data: {},
    ...overrides,
  };
}
