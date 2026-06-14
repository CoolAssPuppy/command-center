import type { ListItem, Widget } from "../domain/widgets";
import { isSafeUrl } from "../security/url";
import type { RenderContext } from "./context";
import { applyTone, el, makeActionable } from "./helpers";

type ListWidget = Extract<Widget, { type: "list" }>;

function renderLeading(leading: NonNullable<ListItem["leading"]>): HTMLElement {
  switch (leading.kind) {
    case "avatar": {
      const img = el("img", "cc-avatar");
      // Feed-supplied image URL is untrusted: only load https, never data:/http.
      if (isSafeUrl(leading.url, ["https:"])) img.setAttribute("src", leading.url);
      img.setAttribute("alt", "");
      return img;
    }
    case "icon": {
      const node = el("span", "cc-icon");
      node.setAttribute("data-icon", leading.name);
      return node;
    }
    case "colorDot": {
      const dot = el("span", "cc-dot");
      dot.style.backgroundColor = leading.colorHex;
      return dot;
    }
  }
}

function renderTrailing(
  trailing: NonNullable<ListItem["trailing"]>,
  ctx: RenderContext,
): HTMLElement {
  switch (trailing.kind) {
    case "badge": {
      const badge = el("span", "cc-badge", trailing.text);
      applyTone(badge, trailing.tone);
      return badge;
    }
    case "text":
      return el("span", "cc-trailing-text", trailing.text);
    case "time":
      return el("span", "cc-time", ctx.formatTime(trailing.iso));
  }
}

function renderItem(item: ListItem, ctx: RenderContext): HTMLElement {
  const row = el(item.action ? "button" : "div", "cc-list__row");
  makeActionable(row, item.action, ctx);
  if (item.leading) row.appendChild(renderLeading(item.leading));

  const body = el("span", "cc-list__body");
  body.appendChild(el("span", "cc-list__title", item.title));
  if (item.subtitle !== undefined) {
    body.appendChild(el("span", "cc-list__subtitle", item.subtitle));
  }
  row.appendChild(body);

  if (item.trailing) row.appendChild(renderTrailing(item.trailing, ctx));

  const li = el("li", "cc-list__item");
  li.appendChild(row);
  return li;
}

export function renderList(
  host: HTMLElement,
  widget: ListWidget,
  ctx: RenderContext,
): HTMLElement {
  const root = el("div", "cc-widget cc-list");
  if (widget.title !== undefined) {
    root.appendChild(el("div", "cc-widget__title", widget.title));
  }
  const list = el("ul", "cc-list__items");
  for (const item of widget.data.items) list.appendChild(renderItem(item, ctx));
  root.appendChild(list);
  host.appendChild(root);
  return root;
}
