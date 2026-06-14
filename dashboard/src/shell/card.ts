import type { PlacedCard } from "../dashboard/attention";
import { applyTone, el } from "../render/helpers";
import { renderWidget } from "../render/index";
import type { RenderContext } from "../render/context";
import { resolveActionUrl } from "../security/url";
import { createActionInvoker, type ActionInvokerDeps } from "./actions";

/**
 * Render one composed-and-placed card. The header always shows the glance. The
 * body depends on state and presentation: a full ready card shows its widgets,
 * a glance card shows nothing more, needs_auth shows a reconnect prompt, error
 * and empty show a quiet line. Stale data carries an age note.
 */

export interface CardDeps extends ActionInvokerDeps {
  formatTime: (iso: string) => string;
  reducedMotion: boolean;
}

function ageLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "updated just now";
  if (minutes < 60) return `updated ${String(minutes)}m ago`;
  return `updated ${String(Math.round(minutes / 60))}h ago`;
}

function renderHeader(card: PlacedCard): HTMLElement {
  const header = el("div", "cc-card__header");
  if (card.icon !== undefined) {
    const icon = el("span", "cc-card__icon");
    icon.setAttribute("data-icon", card.icon);
    header.appendChild(icon);
  }
  header.appendChild(el("span", "cc-card__name", card.displayName));

  const glance = el("span", "cc-card__glance");
  applyTone(glance, card.glance.tone);
  glance.appendChild(el("span", "cc-card__glance-value", card.glance.value));
  glance.appendChild(el("span", "cc-card__glance-label", card.glance.label));
  header.appendChild(glance);
  return header;
}

function renderBody(
  card: PlacedCard,
  ctx: RenderContext,
  onReconnect: () => void,
): HTMLElement {
  const body = el("div", "cc-card__body");

  if (card.state === "needs_auth") {
    const reconnect = el(
      "button",
      "cc-card__reconnect",
      `Reconnect in ${card.displayName}`,
    );
    reconnect.setAttribute("type", "button");
    reconnect.addEventListener("click", onReconnect);
    body.appendChild(reconnect);
    return body;
  }

  if (card.state === "error") {
    body.appendChild(el("div", "cc-card__notice", "Couldn't load this right now."));
    return body;
  }

  if (card.state === "empty") {
    body.appendChild(el("div", "cc-card__notice", "Nothing here right now."));
    return body;
  }

  // ready: only a full card paints its widgets; a glance card shows nothing more
  if (card.presentation === "full" && card.card) {
    for (const widget of card.card.widgets) renderWidget(body, widget, ctx);
  }
  return body;
}

export function renderCard(
  host: HTMLElement,
  card: PlacedCard,
  deps: CardDeps,
): HTMLElement {
  const root = el("div", "cc-card");
  root.setAttribute("data-state", card.state);
  root.setAttribute("data-presentation", card.presentation);
  root.setAttribute("data-kind", card.kind);
  if (card.accentColorHex !== undefined) {
    root.style.setProperty("--cc-card-accent", card.accentColorHex);
  }

  const ctx: RenderContext = {
    formatTime: deps.formatTime,
    invokeAction: createActionInvoker(card.actions, deps),
    reducedMotion: deps.reducedMotion,
  };

  // Reconnect launches the provider app for re-auth via a commandcenter route,
  // which needs no feed-supplied param and is always a safe scheme.
  const onReconnect = (): void => {
    const resolved = resolveActionUrl(
      { id: "reconnect", route: "commandcenter://openProvider" },
      { ref: "reconnect", params: { providerId: card.providerId } },
    );
    if (resolved.ok) deps.navigate(resolved.value);
  };

  root.appendChild(renderHeader(card));
  root.appendChild(renderBody(card, ctx, onReconnect));

  if (!card.fresh && card.ageSeconds !== null) {
    root.appendChild(el("div", "cc-card__age", ageLabel(card.ageSeconds)));
  }

  host.appendChild(root);
  return root;
}
