import type { Widget } from "../domain/widgets";
import { el, svgEl } from "./helpers";

/**
 * A small, dependency-free chart renderer. Charts are drawn as SVG so they stay
 * light and respect the first-paint budget. Cartesian subtypes plot points in a
 * fixed viewBox; radial subtypes draw a single shape the theme styles.
 */

type ChartWidget = Extract<Widget, { type: "chart" }>;
type Series = ChartWidget["data"]["series"][number];

const WIDTH = 100;
const HEIGHT = 40;
const CARTESIAN = new Set(["line", "area", "bar", "sparkline"]);

function yRange(series: Series[]): { min: number; max: number } {
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const min = ys.length > 0 ? Math.min(...ys) : 0;
  const max = ys.length > 0 ? Math.max(...ys) : 1;
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

function plot(point: { y: number }, index: number, count: number, range: { min: number; max: number }): { x: number; y: number } {
  const x = count > 1 ? (index / (count - 1)) * WIDTH : WIDTH / 2;
  const ratio = (point.y - range.min) / (range.max - range.min);
  const y = HEIGHT - ratio * HEIGHT;
  return { x, y };
}

function renderCartesian(svg: SVGElement, subtype: string, series: Series[]): void {
  const range = yRange(series);
  for (const line of series) {
    const coords = line.points.map((point, index) =>
      plot(point, index, line.points.length, range),
    );
    if (subtype === "bar") {
      for (const c of coords) {
        const rect = svgEl("rect", {
          x: String(c.x - 1),
          y: String(c.y),
          width: "2",
          height: String(HEIGHT - c.y),
          class: "cc-chart__bar",
        });
        svg.appendChild(rect);
      }
    } else {
      const polyline = svgEl("polyline", {
        class: "cc-chart__line",
        points: coords.map((c) => `${String(c.x)},${String(c.y)}`).join(" "),
      });
      svg.appendChild(polyline);
      for (const c of coords) {
        svg.appendChild(
          svgEl("circle", {
            cx: String(c.x),
            cy: String(c.y),
            r: "1.5",
            class: "cc-chart__point",
          }),
        );
      }
    }
  }
}

export function renderChart(host: HTMLElement, widget: ChartWidget): HTMLElement {
  const { subtype, series } = widget.data;
  const root = el("div", "cc-widget cc-chart");
  root.setAttribute("data-subtype", subtype);
  if (widget.title !== undefined) {
    root.appendChild(el("div", "cc-widget__title", widget.title));
  }

  const svg = svgEl("svg", {
    class: "cc-chart__svg",
    viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
    "data-subtype": subtype,
    preserveAspectRatio: "none",
  });

  if (CARTESIAN.has(subtype)) {
    renderCartesian(svg, subtype, series);
  } else {
    // donut, gauge: a single radial shape the theme styles
    svg.appendChild(
      svgEl("circle", { cx: "50", cy: "20", r: "16", class: "cc-chart__radial" }),
    );
  }

  root.appendChild(svg);
  host.appendChild(root);
  return root;
}
