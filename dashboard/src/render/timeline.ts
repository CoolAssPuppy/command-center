import type { Widget } from "../domain/widgets";
import type { RenderContext } from "./context";
import { applyTone, clamp, el } from "./helpers";

type TimelineWidget = Extract<Widget, { type: "timeline" }>;
type TimelineItem = TimelineWidget["data"]["items"][number];

const MIN_WIDTH_PERCENT = 1.5;

export function renderTimeline(
  host: HTMLElement,
  widget: TimelineWidget,
  ctx: RenderContext,
): HTMLElement {
  const root = el("div", "cc-widget cc-timeline");
  if (widget.title !== undefined) {
    root.appendChild(el("div", "cc-widget__title", widget.title));
  }
  const axis = el("div", "cc-timeline__axis");
  root.setAttribute("data-from", widget.data.from);
  root.setAttribute("data-to", widget.data.to);

  const from = Date.parse(widget.data.from);
  const to = Date.parse(widget.data.to);
  const span = to - from;

  for (const item of widget.data.items) {
    axis.appendChild(renderItem(item, from, span, ctx));
  }
  root.appendChild(axis);
  host.appendChild(root);
  return root;
}

function renderItem(
  item: TimelineItem,
  from: number,
  span: number,
  ctx: RenderContext,
): HTMLElement {
  const start = Date.parse(item.start);
  const end = item.end !== undefined ? Date.parse(item.end) : start;
  const left = span > 0 ? clamp(((start - from) / span) * 100, 0, 100) : 0;
  const width =
    span > 0 ? Math.max(MIN_WIDTH_PERCENT, ((end - start) / span) * 100) : MIN_WIDTH_PERCENT;

  const node = el(item.action ? "button" : "div", "cc-timeline__item", item.label);
  node.style.left = `${String(left)}%`;
  node.style.width = `${String(clamp(width, MIN_WIDTH_PERCENT, 100))}%`;
  applyTone(node, item.tone);

  if (item.action) {
    node.setAttribute("type", "button");
    const action = item.action;
    node.addEventListener("click", () => {
      ctx.invokeAction(action);
    });
  }
  return node;
}
