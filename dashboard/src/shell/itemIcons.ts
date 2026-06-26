import type { ItemIcon } from "../integrations/types";
import { svgEl } from "../render/helpers";

/**
 * Small Linear-flavored type glyphs drawn before an item's title, so an issue, a
 * project, and an initiative read as different kinds at a glance. Stroke-only and
 * currentColor, so they take the row's (muted) color; no remote icons.
 */
function glyph(...children: SVGElement[]): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  for (const child of children) svg.appendChild(child);
  return svg;
}

const square = (x: number, y: number, size: number, r: number): SVGElement =>
  svgEl("rect", {
    x: String(x),
    y: String(y),
    width: String(size),
    height: String(size),
    rx: String(r),
  });

const circle = (r: number): SVGElement =>
  svgEl("circle", { cx: "12", cy: "12", r: String(r) });

const BUILDERS: Record<ItemIcon, () => SVGElement> = {
  // A rounded square, the Linear issue mark.
  "linear-issue": () => glyph(square(4, 4, 16, 5)),
  // A small 2x2 grid, a collection of work.
  "linear-project": () =>
    glyph(square(4, 4, 7, 1.5), square(13, 4, 7, 1.5), square(4, 13, 7, 1.5), square(13, 13, 7, 1.5)),
  // Concentric rings, a goal to aim at.
  "linear-initiative": () => glyph(circle(8.5), circle(3.5)),
  // A dog-eared page, a document.
  "linear-document": () =>
    glyph(
      svgEl("path", { d: "M14 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z" }),
      svgEl("path", { d: "M14 4v4h4" }),
    ),
};

/** Build the glyph for an item icon hint. */
export function itemIcon(icon: ItemIcon): SVGElement {
  return BUILDERS[icon]();
}
