import type { ManifestAction } from "../domain/actions";
import {
  CURRENT_SCHEMA_VERSION,
  isFeedFresh,
  type FeedEnvelope,
  type ParseResult,
} from "../domain/feed";
import { CONVENIENCE_KINDS, cardFromFeed } from "../domain/kinds";
import type { Glance, Status } from "../domain/primitives";
import type { Card } from "../domain/widgets";
import {
  DashboardPayloadSchema,
  type DashboardPayload,
  type Manifest,
  type Settings,
} from "./payload";

/**
 * Composition turns the getDashboard payload into ordered, state-resolved cards
 * the renderer can paint. It never fetches and never holds a token: it only
 * shapes finished feeds. A single bad feed degrades to an error or is skipped,
 * never crashing the page. See docs/02-architecture.md and docs/07-dashboard-ui.md.
 */

export type CardState = "ready" | "empty" | "needs_auth" | "error";

export interface ComposedCard {
  providerId: string;
  displayName: string;
  kind: string;
  state: CardState;
  status: Status;
  /** The required feed glance, always present even when there is no card body. */
  glance: Glance;
  /** Whether the data is within its ttl. Drives the "updated Nm ago" note. */
  fresh: boolean;
  ageSeconds: number | null;
  /** The mapped card, or null when there is no renderable data. */
  card: Card | null;
  actions: ManifestAction[];
  icon?: string;
  accentColorHex?: string;
}

function isKnownKind(kind: string): boolean {
  return kind === "card" || (CONVENIENCE_KINDS as readonly string[]).includes(kind);
}

function ageSecondsOf(feed: FeedEnvelope, now: Date): number | null {
  const updated = Date.parse(feed.updatedAt);
  if (Number.isNaN(updated)) return null;
  return Math.round((now.getTime() - updated) / 1000);
}

function composeFeed(
  manifest: Manifest,
  feed: FeedEnvelope,
  now: Date,
): ComposedCard {
  const base: ComposedCard = {
    providerId: manifest.providerId,
    displayName: manifest.displayName,
    kind: feed.kind,
    status: feed.status,
    glance: feed.glance,
    state: "error",
    fresh: false,
    ageSeconds: ageSecondsOf(feed, now),
    card: null,
    actions: manifest.actions ?? [],
  };
  if (manifest.accentColorHex !== undefined) {
    base.accentColorHex = manifest.accentColorHex;
  }

  // A feed from a newer contract version is refused, never half-rendered.
  if (feed.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return base;
  }

  const mapped = cardFromFeed(feed);
  const card = mapped.ok ? mapped.value : null;
  if (card) base.card = card;

  const icon = manifest.icon ?? card?.icon;
  if (icon !== undefined) base.icon = icon;

  if (feed.status === "needs_auth") {
    base.state = "needs_auth";
  } else if (feed.status === "error") {
    base.state = "error";
  } else {
    // ok or stale
    if (!mapped.ok || !card) base.state = "error";
    else if (card.widgets.length === 0) base.state = "empty";
    else base.state = "ready";
    base.fresh = feed.status === "ok" && isFeedFresh(feed, now);
  }

  return base;
}

function orderCards(cards: ComposedCard[], settings?: Settings): ComposedCard[] {
  const order = settings?.layout?.cardOrder ?? [];
  const hidden = new Set(settings?.layout?.hidden ?? []);

  const rankOf = (card: ComposedCard): number => {
    const byKind = order.indexOf(card.kind);
    const byProvider = order.indexOf(card.providerId);
    const index = byKind >= 0 ? byKind : byProvider;
    return index >= 0 ? index : order.length;
  };

  return cards
    .filter((card) => !hidden.has(card.kind) && !hidden.has(card.providerId))
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rankOf(a.card) - rankOf(b.card) || a.index - b.index)
    .map((entry) => entry.card);
}

export function composeDashboard(
  payload: DashboardPayload,
  now: Date,
): ComposedCard[] {
  const cards: ComposedCard[] = [];
  for (const provider of payload.providers) {
    for (const feed of provider.feeds) {
      if (feed.status === "disabled") continue;
      if (!isKnownKind(feed.kind)) continue; // ignored, not an error
      cards.push(composeFeed(provider.manifest, feed, now));
    }
  }
  return orderCards(cards, payload.settings);
}

export function parseDashboardPayload(
  input: unknown,
): ParseResult<DashboardPayload> {
  const parsed = DashboardPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid payload" };
  }
  return { ok: true, value: parsed.data };
}
