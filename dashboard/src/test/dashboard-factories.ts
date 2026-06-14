import type { PlacedCard } from "../dashboard/attention";
import type { ComposedCard } from "../dashboard/compose";
import type {
  DashboardPayload,
  Manifest,
  ProviderEntry,
} from "../dashboard/payload";
import { makeCard, makeFeedEnvelope, makeGlance } from "./factories";
import { makeLinearInbox } from "./kind-factories";

export function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    schemaVersion: 1,
    providerId: "linear-bar",
    displayName: "Linear",
    bundleId: "com.strategicnerds.LinearBarApp",
    appVersion: "1.4.2",
    icon: "linear",
    accentColorHex: "#5E6AD2",
    updatedAt: "2026-06-14T15:04:05Z",
    feeds: [
      {
        kind: "linear.inbox",
        path: "linear/inbox.json",
        refreshIntervalSeconds: 120,
        title: "Linear inbox",
      },
    ],
    actions: [{ id: "open", urlTemplate: "linearbar://open?url={url}" }],
    ...overrides,
  };
}

export function makeProviderEntry(
  overrides: Partial<ProviderEntry> = {},
): ProviderEntry {
  return {
    manifest: makeManifest(),
    feeds: [
      makeFeedEnvelope({
        kind: "linear.inbox",
        glance: makeGlance({ value: "3", label: "unread" }),
        data: makeLinearInbox(),
      }),
    ],
    ...overrides,
  };
}

export function makeComposedCard(
  overrides: Partial<ComposedCard> = {},
): ComposedCard {
  return {
    providerId: "linear-bar",
    displayName: "Linear",
    kind: "linear.inbox",
    state: "ready",
    status: "ok",
    glance: makeGlance({ tone: "neutral" }),
    fresh: true,
    ageSeconds: 10,
    card: makeCard(),
    actions: [],
    ...overrides,
  };
}

export function makePlacedCard(overrides: Partial<PlacedCard> = {}): PlacedCard {
  const { presentation, ...composedOverrides } = overrides;
  return {
    ...makeComposedCard(composedOverrides),
    presentation: presentation ?? "full",
  };
}

export function makeDashboardPayload(
  overrides: Partial<DashboardPayload> = {},
): DashboardPayload {
  return {
    settings: { schemaVersion: 1, profile: { name: "Prashant" } },
    providers: [makeProviderEntry()],
    generatedAt: "2026-06-14T15:05:00Z",
    ...overrides,
  };
}
