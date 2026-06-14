import { setText } from "../security/dom";
import type { Tone } from "../domain/primitives";

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
