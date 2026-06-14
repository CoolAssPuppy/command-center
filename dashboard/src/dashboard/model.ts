import type { ParseResult } from "../domain/feed";
import { planLayout, type LayoutOptions, type PlacedCard } from "./attention";
import { composeDashboard, parseDashboardPayload } from "./compose";
import type { Settings } from "./payload";

/**
 * Turn a raw getDashboard payload into renderable data: parse it, compose the
 * provider feeds into state-resolved cards, and plan the attention layout. This
 * is the one call the shell makes between receiving bytes and rendering.
 */

export interface DashboardData {
  settings: Settings | undefined;
  cards: PlacedCard[];
}

export function buildDashboardModel(
  raw: unknown,
  now: Date,
  layout: LayoutOptions = {},
): ParseResult<DashboardData> {
  const parsed = parseDashboardPayload(raw);
  if (!parsed.ok) return parsed;

  const cards = planLayout(composeDashboard(parsed.value, now), layout);
  return { ok: true, value: { settings: parsed.value.settings, cards } };
}
