import { COMBINED_CALENDARS_ID, type Connection, type Stream } from "../config/schema";
import type { IntegrationResult, NormalizedItem } from "../integrations/types";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { brandIcon } from "../shell/brandIcons";
import { makeDashboardReorderable, type ReorderHandler } from "../shell/dashboardReorder";

/**
 * Work-stream panels. Each stream names a connection and shows that connection's
 * items: a collapsible titled panel with the service's brand mark in the header
 * and a loading / needs-auth / error / items body. Built on native <details> so
 * keyboard and accessibility come for free.
 */
export interface StreamsModel {
  streams: Stream[];
  connections: Connection[];
  /** Per-stream open override; absent means use collapsedByDefault. */
  expanded: Record<string, boolean>;
  /** Resolved integration data, keyed by connection id. */
  integrationResults?: Record<string, IntegrationResult>;
}

export interface StreamsDeps {
  navigate: (url: string) => void;
  onToggle: (streamId: string, open: boolean) => void;
  /** Reorder work-stream panels by dragging one onto another. */
  onReorder?: ReorderHandler;
}

function isOpen(stream: Stream, expanded: Record<string, boolean>): boolean {
  const override = expanded[stream.id];
  return override !== undefined ? override : !stream.collapsedByDefault;
}

export function renderStreams(
  host: HTMLElement,
  model: StreamsModel,
  deps: StreamsDeps,
): HTMLElement {
  const root = el("div", "cc-streams");
  for (const stream of model.streams) {
    // Some connections belong only in the left lane, not as a right-column card:
    // a role "tasks" source, and a Linear connection in inbox view. The
    // combined-calendars virtual id has no connection, so it always stays. The
    // stream config is untouched, so reverting the role/view brings the card back.
    if (stream.connectionId !== COMBINED_CALENDARS_ID) {
      const connection = model.connections.find((item) => item.id === stream.connectionId);
      if (connection?.role === "tasks") continue;
      if (connection?.service === "linear" && connection.linearView === "inbox") continue;
    }
    root.appendChild(renderStream(stream, model, deps));
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
  const resultKey = isCombined ? COMBINED_CALENDARS_ID : connection?.id;
  // The panel's nature drives how prominent it is: action queues earn room,
  // reference material stays quiet and short. See the kind styles.
  details.dataset.kind = panelKind(service);

  const result = resultKey !== undefined ? model.integrationResults?.[resultKey] : undefined;

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
  if (resultKey === undefined) {
    body.appendChild(el("div", "cc-stream__empty", "This connection was removed."));
  } else {
    renderResult(body, result, deps);
  }
  details.appendChild(body);

  details.addEventListener("toggle", () => {
    deps.onToggle(stream.id, details.open);
  });

  if (deps.onReorder !== undefined) {
    makeDashboardReorderable(details, "streams", stream.id, deps.onReorder);
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
