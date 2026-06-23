import { el, svgEl } from "../render/helpers";

/**
 * Brand-mark tiles for the integration panels. Each is the service's real logo
 * on a white app-tile: the Google Calendar "31", the Linear mark, and the Notion
 * "N". Brand colors are intentional and theme-independent. Returns undefined for
 * sources without a mark.
 */
function tile(): HTMLElement {
  // The logos (Google blue, Linear indigo, Notion ink) need a light ground to
  // stay legible, so the tile is light on every theme. A warm off-white plus a
  // soft ring keeps it from glaring as a pure-white chip on the dark themes.
  // Decorative: the stream title already names the service.
  const node = el("div", "cc-brand");
  node.setAttribute("aria-hidden", "true");
  node.style.background = "#F5F2EC";
  node.style.border = "1px solid rgba(20,22,28,0.12)";
  return node;
}

function svg(viewBox: string): SVGElement {
  return svgEl("svg", { viewBox, width: "15", height: "15", fill: "none" });
}

function googleCalendar(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  // calendar binding rings
  mark.appendChild(svgEl("rect", { x: "7.4", y: "2.4", width: "1.5", height: "4", rx: "0.75", fill: "#4285F4" }));
  mark.appendChild(svgEl("rect", { x: "15.1", y: "2.4", width: "1.5", height: "4", rx: "0.75", fill: "#4285F4" }));
  // blue header band
  mark.appendChild(svgEl("rect", { x: "4", y: "4", width: "16", height: "4", rx: "1", fill: "#4285F4" }));
  // the "31"
  const text = svgEl("text", {
    x: "12",
    y: "18.5",
    "text-anchor": "middle",
    "font-family": "Archivo, sans-serif",
    "font-size": "9.5",
    "font-weight": "700",
    fill: "#4285F4",
  });
  text.textContent = "31";
  mark.appendChild(text);
  node.appendChild(mark);
  return node;
}

function linear(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  mark.appendChild(
    svgEl("path", {
      fill: "#5E6AD2",
      d: "M2.886 4.18A11.98 11.98 0 0 1 11.99 0C18.624 0 24 5.376 24 12.01c0 3.64-1.62 6.902-4.18 9.104L2.886 4.18ZM.682 7.679a12.06 12.06 0 0 0-.633 3.34L12.98 23.95a12.06 12.06 0 0 0 3.34-.633L.682 7.68ZM.012 12.93l11.057 11.057c-2.74-.244-5.3-1.45-7.255-3.4l-.401-.401C1.461 18.23.256 15.67.012 12.93Zm.717 4.342 6.012 6.011c-2.359-.804-4.225-2.43-5.226-4.627a8.7 8.7 0 0 1-.786-1.384Z",
    }),
  );
  node.appendChild(mark);
  return node;
}

function notion(): HTMLElement {
  const node = tile();
  const mark = svg("0 0 24 24");
  mark.appendChild(
    svgEl("path", {
      d: "M7 17 V7 L17 17 V7",
      stroke: "#0F0F0F",
      "stroke-width": "2.2",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      fill: "none",
    }),
  );
  node.appendChild(mark);
  return node;
}

export function brandIcon(integrationId: string): HTMLElement | undefined {
  if (integrationId === "google-calendar") return googleCalendar();
  if (integrationId === "linear") return linear();
  if (integrationId === "notion") return notion();
  return undefined;
}
