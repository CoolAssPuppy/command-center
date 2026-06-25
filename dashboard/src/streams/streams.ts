import { COMBINED_CALENDARS_ID, type Connection, type Stream } from "../config/schema";
import type { IntegrationResult, NormalizedItem } from "../integrations/types";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { brandIcon } from "../shell/brandIcons";
import { makeCardDraggable, makeColumnDropZone, type MoveCardHandler } from "../shell/cardDrag";
import type { CardColumn } from "../shell/cardMove";
import { itemIcon } from "../shell/itemIcons";

/**
 * Work-stream panels. Each stream names a connection and shows that connection's
 * items: a collapsible titled panel with the service's brand mark in the header
 * and a loading / needs-auth / error / items body. Built on native <details> so
 * keyboard and accessibility come for free.
 */
export interface StreamsModel {
  streams: Stream[];
  connections: Connection[];
  /** Which work-area column to render; only cards in this column appear here. */
  column: CardColumn;
  /** Per-stream open override; absent means use collapsedByDefault. */
  expanded: Record<string, boolean>;
  /** Resolved integration data, keyed by connection id. */
  integrationResults?: Record<string, IntegrationResult>;
}

export interface StreamsDeps {
  navigate: (url: string) => void;
  onToggle: (streamId: string, open: boolean) => void;
  /** Move a card to a column at a position (drag-and-drop or keyboard). */
  onMoveCard?: MoveCardHandler;
}

function isOpen(stream: Stream, expanded: Record<string, boolean>): boolean {
  const override = expanded[stream.id];
  return override !== undefined ? override : !stream.collapsedByDefault;
}

/** Cards that live only in the left lane, never as a column card. */
function isLaneOnly(stream: Stream, connections: Connection[]): boolean {
  if (stream.connectionId === COMBINED_CALENDARS_ID) return false;
  if (stream.role === "tasks") return true;
  const connection = connections.find((item) => item.id === stream.connectionId);
  return connection?.service === "linear" && stream.linearView === "inbox";
}

/**
 * Render one work-area column. Cards flow in config order, filtered to this
 * column; lane-only cards (tasks role, Linear inbox) are skipped since they show
 * in the lane. The container is a drop zone, with a thin empty-state target so a
 * card can be dragged into an otherwise-empty column.
 */
export function renderStreams(
  host: HTMLElement,
  model: StreamsModel,
  deps: StreamsDeps,
): HTMLElement {
  const root = el("div", "cc-streams");
  root.dataset.column = model.column;

  // The surface layout is owned by each card's column + order, not the config
  // array order (which the Customize pane reorders cosmetically). Sort by order.
  const cards = model.streams
    .filter((stream) => !isLaneOnly(stream, model.connections) && stream.column === model.column)
    .sort((a, b) => a.order - b.order);
  for (const stream of cards) {
    root.appendChild(renderStream(stream, model, deps));
  }
  const count = cards.length;

  if (deps.onMoveCard !== undefined) {
    // Offer an empty-column drop target only once there is a card to drag, so a
    // fresh dashboard with no cards stays clean. The column always accepts drops.
    const hasAnyCard = model.streams.some((stream) => !isLaneOnly(stream, model.connections));
    if (count === 0 && hasAnyCard) {
      root.appendChild(el("div", "cc-streams__empty", "Drop a card here"));
    }
    makeColumnDropZone(root, model.column, deps.onMoveCard);
  }

  host.appendChild(root);
  return root;
}

function renderStream(
  stream: Stream,
  model: StreamsModel,
  deps: StreamsDeps,
): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "cc-stream";
  details.dataset.flipId = `stream:${stream.id}`;
  details.open = isOpen(stream, model.expanded);

  const isCombined = stream.connectionId === COMBINED_CALENDARS_ID;
  const connection = model.connections.find((item) => item.id === stream.connectionId);
  // The combined stream uses the calendar mark; a real connection uses its own.
  const service = isCombined ? "google-calendar" : connection?.service;
  // Results are keyed by card (stream) id; the combined card by its virtual id.
  const resultKey = isCombined ? COMBINED_CALENDARS_ID : stream.id;
  // The panel's nature drives how prominent it is: action queues earn room,
  // reference material stays quiet and short. See the kind styles.
  details.dataset.kind = panelKind(service);

  const result = model.integrationResults?.[resultKey];

  const summary = document.createElement("summary");
  summary.className = "cc-stream__summary";
  const chevron = el("span", "cc-stream__chevron", "›");
  chevron.setAttribute("aria-hidden", "true");
  summary.appendChild(chevron);
  if (service !== undefined) {
    const icon = brandIcon(service);
    if (icon !== undefined) summary.appendChild(icon);
  }
  summary.appendChild(el("span", "cc-stream__title", stream.title));
  details.appendChild(summary);

  const body = el("div", "cc-stream__body");
  if (!isCombined && connection === undefined) {
    body.appendChild(el("div", "cc-stream__empty", "This connection was removed."));
  } else {
    renderResult(body, result, deps);
  }
  details.appendChild(body);

  details.addEventListener("toggle", () => {
    deps.onToggle(stream.id, details.open);
  });

  if (deps.onMoveCard !== undefined) {
    makeCardDraggable(details, stream.id, model.column, deps.onMoveCard);
  }
  return details;
}

function renderResult(
  body: HTMLElement,
  result: IntegrationResult | undefined,
  deps: StreamsDeps,
): void {
  if (result === undefined || result.status === "loading") {
    body.appendChild(el("div", "cc-stream__empty", "Loading…"));
    return;
  }
  if (result.status === "needs_auth") {
    body.appendChild(el("div", "cc-stream__empty", "Connect this service in the edit pane."));
    return;
  }
  if (result.status === "error") {
    body.appendChild(el("div", "cc-stream__empty", result.error ?? "Could not load this stream."));
    return;
  }
  const items = result.items ?? [];
  if (items.length === 0) {
    body.appendChild(el("div", "cc-stream__empty", "Nothing to show."));
    return;
  }
  const list = el("div", "cc-stream__items");
  for (const item of items) list.appendChild(renderItem(item, deps));
  body.appendChild(list);
}

/** Group services so the layout can size action queues and reference apart. */
function panelKind(service: string | undefined): string {
  if (service === "github" || service === "linear") return "queue";
  if (service === "google-calendar") return "calendar";
  return "reference";
}

function renderItem(item: NormalizedItem, deps: StreamsDeps): HTMLElement {
  const navigable = item.url !== undefined && isSafeUrl(item.url);
  const row = el(navigable ? "button" : "div", "cc-stream__item");
  row.dataset.tone = item.tone ?? "neutral";
  if (navigable && item.url !== undefined) {
    const url = item.url;
    row.setAttribute("type", "button");
    row.addEventListener("click", () => {
      deps.navigate(url);
    });
  }

  if (item.icon !== undefined) {
    const iconWrap = el("span", "cc-stream__item-icon");
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.appendChild(itemIcon(item.icon));
    row.appendChild(iconWrap);
  }

  const body = el("div", "cc-stream__item-body");
  body.appendChild(el("span", "cc-stream__item-title", item.title));
  if (item.subtitle !== undefined) {
    body.appendChild(el("span", "cc-stream__item-sub", item.subtitle));
  }
  row.appendChild(body);
  if (item.meta !== undefined) {
    row.appendChild(el("span", "cc-stream__item-meta", item.meta));
  }
  return row;
}
