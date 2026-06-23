import type { DockLink, Stream } from "../config/schema";
import { fallbackGlyph, faviconUrl } from "../dock/favicon";
import type { IntegrationResult, NormalizedItem } from "../integrations/types";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";

/**
 * Work streams: collapsible titled sections, collapsed by default. Built on
 * native <details>/<summary> so keyboard and accessibility come for free. The
 * content is a discriminated union: static text, a group of dock links, or an
 * integration feed (the integration renderer is injected by the platform; until
 * one is wired the stream shows a gentle placeholder).
 */
export interface StreamsModel {
  streams: Stream[];
  links: DockLink[];
  /** Per-stream open override; absent means use collapsedByDefault. */
  expanded: Record<string, boolean>;
  /** Resolved integration data, keyed by stream id. */
  integrationResults?: Record<string, IntegrationResult>;
}

export interface StreamsDeps {
  navigate: (url: string) => void;
  onToggle: (streamId: string, open: boolean) => void;
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
  details.open = isOpen(stream, model.expanded);

  const summary = document.createElement("summary");
  summary.className = "cc-stream__summary";
  summary.appendChild(el("span", "cc-stream__chevron", "›"));
  summary.appendChild(el("span", "cc-stream__title", stream.title));
  details.appendChild(summary);

  const body = el("div", "cc-stream__body");
  renderContent(body, stream, model, deps);
  details.appendChild(body);

  details.addEventListener("toggle", () => {
    deps.onToggle(stream.id, details.open);
  });

  return details;
}

function renderContent(
  body: HTMLElement,
  stream: Stream,
  model: StreamsModel,
  deps: StreamsDeps,
): void {
  const content = stream.content;

  if (content.type === "static") {
    if (content.body.trim().length === 0) {
      body.appendChild(el("div", "cc-stream__empty", "Nothing here yet."));
    } else {
      body.appendChild(el("div", "cc-stream__text", content.body));
    }
    return;
  }

  if (content.type === "links") {
    const chosen = content.linkIds
      .map((id) => model.links.find((link) => link.id === id))
      .filter((link): link is DockLink => link !== undefined);
    if (chosen.length === 0) {
      body.appendChild(el("div", "cc-stream__empty", "No links in this stream."));
      return;
    }
    const list = el("div", "cc-stream__links");
    for (const link of chosen) list.appendChild(renderStreamLink(link, deps));
    body.appendChild(list);
    return;
  }

  renderIntegration(body, model.integrationResults?.[stream.id], deps);
}

function renderIntegration(
  body: HTMLElement,
  result: IntegrationResult | undefined,
  deps: StreamsDeps,
): void {
  if (result === undefined || result.status === "loading") {
    body.appendChild(el("div", "cc-stream__empty", "Loading…"));
    return;
  }
  if (result.status === "needs_auth") {
    body.appendChild(
      el("div", "cc-stream__empty", "Connect this integration in the edit pane."),
    );
    return;
  }
  if (result.status === "error") {
    body.appendChild(
      el("div", "cc-stream__empty", result.error ?? "Could not load this stream."),
    );
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

function renderItem(item: NormalizedItem, deps: StreamsDeps): HTMLElement {
  const navigable = item.url !== undefined && isSafeUrl(item.url);
  const row = el(navigable ? "button" : "div", "cc-stream__item");
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

function renderStreamLink(link: DockLink, deps: StreamsDeps): HTMLElement {
  const row = el("button", "cc-stream__link");
  row.setAttribute("type", "button");

  const icon = faviconUrl(link);
  if (icon.length > 0) {
    const img = document.createElement("img");
    img.className = "cc-stream__link-icon";
    img.src = icon;
    img.alt = "";
    img.addEventListener("error", () => {
      img.replaceWith(el("span", "cc-stream__link-glyph", fallbackGlyph(link.title)));
    });
    row.appendChild(img);
  } else {
    row.appendChild(el("span", "cc-stream__link-glyph", fallbackGlyph(link.title)));
  }

  row.appendChild(el("span", "cc-stream__link-title", link.title));
  row.addEventListener("click", () => {
    if (isSafeUrl(link.url)) deps.navigate(link.url);
  });
  return row;
}
