import { setText } from "../security/dom";
import type { ActionRef } from "../domain/actions";
import type { Tone } from "../domain/primitives";
import type { RenderContext } from "./context";

/**
 * Small DOM construction helpers shared by the widget renderers. All text goes
 * through setText, so no renderer ever assigns innerHTML. See docs/10-security.md.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Create an element, optionally with a class and inert text content. */
export function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) setText(node, text);
  return node;
}

/** Create an SVG element with attributes. */
export function svgEl(
  tag: string,
  attrs: Record<string, string> = {},
): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/** Reflect a semantic tone as a data attribute the theme styles. */
export function applyTone(node: Element, tone: Tone | undefined): void {
  if (tone !== undefined) node.setAttribute("data-tone", tone);
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Wire an optional action onto a node. When present, mark it a button and
 * invoke the action on click; the platform validates and navigates (a renderer
 * never resolves or opens a URL itself). The caller picks the button/div tag.
 */
export function makeActionable(
  node: HTMLElement,
  action: ActionRef | undefined,
  ctx: RenderContext,
): void {
  if (action === undefined) return;
  node.setAttribute("type", "button");
  node.addEventListener("click", () => {
    ctx.invokeAction(action);
  });
}
