import { svgEl } from "../render/helpers";

/**
 * Minimalist line weather icons, one per icon name from describeWeatherCode.
 * Stroke-only, currentColor, so they take the theme's text colour and stay
 * quiet. A small, geometric set, in the spirit of Feather icons.
 */
function base(): SVGElement {
  return svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.6",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
}

function line(x1: number, y1: number, x2: number, y2: number): SVGElement {
  return svgEl("line", { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2) });
}

function path(d: string): SVGElement {
  return svgEl("path", { d });
}

const CLOUD = "M17.5 18a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.5 9.2 4.5 4.5 0 0 0 7 18z";
/** A cloud shifted right/down to tuck under a sun for the partly-cloudy mark. */
const CLOUD_SM = "M16.5 19a3.2 3.2 0 0 0 .4-6.38A4.8 4.8 0 0 0 8 11.4 3.6 3.6 0 0 0 8.4 19z";

function sun(): SVGElement {
  const svg = base();
  svg.appendChild(svgEl("circle", { cx: "12", cy: "12", r: "4.2" }));
  const rays: ReadonlyArray<readonly [number, number, number, number]> = [
    [12, 2, 12, 4.2], [12, 19.8, 12, 22], [2, 12, 4.2, 12], [19.8, 12, 22, 12],
    [4.9, 4.9, 6.4, 6.4], [17.6, 17.6, 19.1, 19.1], [4.9, 19.1, 6.4, 17.6], [17.6, 6.4, 19.1, 4.9],
  ];
  for (const [x1, y1, x2, y2] of rays) svg.appendChild(line(x1, y1, x2, y2));
  return svg;
}

function cloud(): SVGElement {
  const svg = base();
  svg.appendChild(path(CLOUD));
  return svg;
}

function cloudSun(): SVGElement {
  const svg = base();
  svg.appendChild(svgEl("circle", { cx: "8", cy: "7.5", r: "3" }));
  for (const [x1, y1, x2, y2] of [
    [8, 1.8, 8, 3], [2.3, 7.5, 3.5, 7.5], [4, 3.5, 4.9, 4.4], [12, 3.5, 11.1, 4.4],
  ] as const) {
    svg.appendChild(line(x1, y1, x2, y2));
  }
  svg.appendChild(path(CLOUD_SM));
  return svg;
}

function withCloud(...marks: SVGElement[]): SVGElement {
  const svg = base();
  svg.appendChild(path("M17.5 15.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.5 6.7 4.5 4.5 0 0 0 7 15.5z"));
  for (const mark of marks) svg.appendChild(mark);
  return svg;
}

function fog(): SVGElement {
  return withCloud(line(6, 19, 14, 19), line(9, 21.5, 17, 21.5));
}

function drizzle(): SVGElement {
  return withCloud(line(9, 18, 8.5, 20), line(15, 18, 14.5, 20));
}

function sleet(): SVGElement {
  return withCloud(line(9, 18, 8.5, 20), svgEl("circle", { cx: "14.5", cy: "20", r: "0.6", fill: "currentColor", stroke: "none" }));
}

function rain(): SVGElement {
  return withCloud(line(8.5, 18, 8, 21), line(12, 18, 11.5, 21), line(15.5, 18, 15, 21));
}

function snow(): SVGElement {
  const flake = (cx: number, cy: number): SVGElement =>
    svgEl("circle", { cx: String(cx), cy: String(cy), r: "0.7", fill: "currentColor", stroke: "none" });
  return withCloud(flake(9, 19), flake(12, 21), flake(15, 19));
}

function storm(): SVGElement {
  return withCloud(svgEl("polyline", { points: "12.5 17 10 20.5 13 20.5 11 23.5" }));
}

const ICONS: Record<string, () => SVGElement> = {
  sun,
  cloud,
  "cloud-sun": cloudSun,
  fog,
  drizzle,
  sleet,
  rain,
  snow,
  storm,
};

/** Build the minimalist icon for a name, falling back to a plain cloud. */
export function weatherIcon(name: string): SVGElement {
  return (ICONS[name] ?? cloud)();
}
