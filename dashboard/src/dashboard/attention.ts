import type { ComposedCard } from "./compose";

/**
 * The attention model. Attention is scarce: with many providers, the platform
 * decides what earns a full card and what earns a single glance line. See
 * docs/00-vision.md and docs/07-dashboard-ui.md.
 *
 * Rules, in order:
 * - Empty and error cards never take a full slot. They show as a glance.
 * - Urgent cards that have something to show are always full, even past budget,
 *   because urgency outranks the budget.
 * - Remaining full slots go to ready and needs_auth cards in their existing
 *   order, so a needs_auth prompt is seen and the user's ordering is respected.
 * - Everything else shows as a glance.
 */

export type Presentation = "full" | "glance";

export interface PlacedCard extends ComposedCard {
  presentation: Presentation;
}

export interface LayoutOptions {
  /** How many cards get a full body before the rest collapse to a glance. */
  maxFull?: number;
}

/** Cards that have a body worth a full slot. */
function isFullCandidate(card: ComposedCard): boolean {
  return card.state === "ready" || card.state === "needs_auth";
}

function isUrgent(card: ComposedCard): boolean {
  return isFullCandidate(card) && card.glance.tone === "urgent";
}

export function planLayout(
  cards: ComposedCard[],
  options: LayoutOptions = {},
): PlacedCard[] {
  const maxFull = options.maxFull ?? 4;
  const urgentCount = cards.filter(isUrgent).length;
  let normalSlots = Math.max(0, maxFull - urgentCount);

  return cards.map((card) => {
    let presentation: Presentation = "glance";
    if (isUrgent(card)) {
      presentation = "full";
    } else if (isFullCandidate(card) && normalSlots > 0) {
      presentation = "full";
      normalSlots -= 1;
    }
    return { ...card, presentation };
  });
}
