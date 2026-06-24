import { svgEl } from "../render/helpers";

/**
 * A small line icon per edit-pane section, so the long pane is scannable and
 * each section reads as its own thing rather than one more identical header.
 * Stroke-only, currentColor, minimalist, keyed by the section's collapse key.
 */
function icon(...children: SVGElement[]): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.6",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  for (const child of children) svg.appendChild(child);
  return svg;
}

const circle = (cx: number, cy: number, r: number): SVGElement =>
  svgEl("circle", { cx: String(cx), cy: String(cy), r: String(r) });
const line = (x1: number, y1: number, x2: number, y2: number): SVGElement =>
  svgEl("line", { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2) });
const path = (d: string): SVGElement => svgEl("path", { d });
const rect = (x: number, y: number, w: number, h: number, r = 2): SVGElement =>
  svgEl("rect", {
    x: String(x),
    y: String(y),
    width: String(w),
    height: String(h),
    rx: String(r),
  });

const ICONS: Record<string, () => SVGElement> = {
  // Globe
  zones: () =>
    icon(circle(12, 12, 9), line(3, 12, 21, 12), svgEl("ellipse", { cx: "12", cy: "12", rx: "4", ry: "9" })),
  // Sun
  weather: () =>
    icon(
      circle(12, 12, 4),
      line(12, 2, 12, 4), line(12, 20, 12, 22), line(2, 12, 4, 12), line(20, 12, 22, 12),
      line(5, 5, 6.4, 6.4), line(17.6, 17.6, 19, 19), line(5, 19, 6.4, 17.6), line(17.6, 6.4, 19, 5),
    ),
  // Link
  dock: () =>
    icon(
      path("M10 13a5 5 0 0 0 7 0l2-2a5 5 0 1 0-7-7l-1 1"),
      path("M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 1 0 7 7l1-1"),
    ),
  // Share nodes
  connections: () =>
    icon(
      circle(18, 5, 2.6), circle(6, 12, 2.6), circle(18, 19, 2.6),
      line(8.3, 13.4, 15.7, 17.6), line(15.7, 6.4, 8.3, 10.6),
    ),
  // Stacked cards
  streams: () => icon(rect(4, 4, 16, 7), rect(4, 13, 16, 7)),
  // Image
  wallpaper: () =>
    icon(rect(3, 3, 18, 18, 2), circle(8.5, 8.5, 1.5), path("M21 15l-5-5L5 21")),
  // Contrast
  appearance: () =>
    icon(circle(12, 12, 9), svgEl("path", { d: "M12 3a9 9 0 0 0 0 18z", fill: "currentColor", stroke: "none" })),
  // Download
  backup: () =>
    icon(
      path("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"),
      svgEl("polyline", { points: "7 10 12 15 17 10" }),
      line(12, 15, 12, 3),
    ),
};

/** The icon for a section key, or undefined if none. */
export function sectionIcon(key: string): SVGElement | undefined {
  return ICONS[key]?.();
}
